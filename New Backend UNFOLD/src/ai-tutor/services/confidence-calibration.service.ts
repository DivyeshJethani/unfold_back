import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from './credit.service';
import { CREDIT_AMOUNTS } from '../ai-tutor.constants';

/**
 * "How confident are you?" captured alongside every answer, then compared
 * against whether the student was actually right. This is a classic
 * calibration problem — we use a Brier score (mean squared error between
 * stated probability and the 0/1 outcome), which is the standard way to
 * measure "does this person know what they know."
 *
 * Brier score is 0 (perfect) to 1 (worst); we report calibration as
 * `1 - brier` so higher is always better, matching every other 0..1 score
 * in this system.
 */
@Injectable()
export class ConfidenceCalibrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly creditService: CreditService,
  ) {}

  async recordOutcome(params: {
    studentId: string;
    topicId: string;
    refType: 'QUIZ_QUESTION' | 'REVISION_TEST' | 'TEACHBACK';
    refId: string;
    predictedConfidence: number; // 0..1
    wasCorrect: boolean;
  }) {
    const record = await this.prisma.confidenceRecord.create({
      data: {
        studentId: params.studentId,
        topicId: params.topicId,
        refType: params.refType,
        refId: params.refId,
        predictedConfidence: Math.min(1, Math.max(0, params.predictedConfidence)),
        wasCorrect: params.wasCorrect,
      },
    });

    // Reward good calibration directly and immediately for this single
    // answer (not just the rolling score) — e.g. said "20% confident" and
    // was indeed wrong is just as valuable a signal as being right at 90%.
    const singleShotError = Math.abs(params.predictedConfidence - (params.wasCorrect ? 1 : 0));
    if (singleShotError < 0.15) {
      await this.creditService.award({
        studentId: params.studentId,
        amount: CREDIT_AMOUNTS.WELL_CALIBRATED_CONFIDENCE,
        reason: 'WELL_CALIBRATED_CONFIDENCE',
        refId: record.id,
      });
    }

    return record;
  }

  /**
   * Rolling calibration score + bias direction ("overconfident" means the
   * student's stated confidence consistently outruns their actual
   * accuracy; "underconfident" is the reverse — both are useful things for
   * a student to see about themselves, separate from raw knowledge).
   */
  async computeCalibration(studentId: string, take = 100) {
    const records = await this.prisma.confidenceRecord.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take,
    });

    if (records.length === 0) {
      return { calibrationScore: 0.5, bias: 'INSUFFICIENT_DATA' as const, sampleSize: 0 };
    }

    const brier =
      records.reduce((sum, r) => {
        const outcome = r.wasCorrect ? 1 : 0;
        return sum + Math.pow(r.predictedConfidence - outcome, 2);
      }, 0) / records.length;

    const avgPredicted = records.reduce((s, r) => s + r.predictedConfidence, 0) / records.length;
    const avgActual = records.reduce((s, r) => s + (r.wasCorrect ? 1 : 0), 0) / records.length;
    const biasGap = avgPredicted - avgActual;

    const bias = biasGap > 0.1 ? 'OVERCONFIDENT' : biasGap < -0.1 ? 'UNDERCONFIDENT' : 'WELL_CALIBRATED';

    return {
      calibrationScore: Number((1 - brier).toFixed(2)),
      bias,
      avgPredictedConfidence: Number(avgPredicted.toFixed(2)),
      avgActualAccuracy: Number(avgActual.toFixed(2)),
      sampleSize: records.length,
    };
  }
}
