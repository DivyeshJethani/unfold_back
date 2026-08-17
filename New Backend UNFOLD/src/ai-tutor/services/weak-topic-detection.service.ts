import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeaknessSignal, TopicMasteryUpdateResult } from '../interfaces/scoring.interface';
import {
  MASTERY_EWMA_ALPHA,
  MASTERY_THRESHOLDS,
  AI_TEACHBACK_ESCALATION_THRESHOLD,
} from '../ai-tutor.constants';

@Injectable()
export class WeakTopicDetectionService {
  private readonly logger = new Logger(WeakTopicDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async applySignal(signal: WeaknessSignal): Promise<TopicMasteryUpdateResult> {
    const existing = await this.prisma.topicMastery.findUnique({
      where: { studentId_topicId: { studentId: signal.studentId, topicId: signal.topicId } },
    });

    const previousScore = existing?.masteryScore ?? 0.5;
    const previousConfidence = existing?.confidence ?? 0.3;
    const previousLevel = existing?.masteryLevel ?? 'DEVELOPING';
    const previousFailures = existing?.consecutiveFailures ?? 0;

    const effectiveAlpha = MASTERY_EWMA_ALPHA * signal.confidence;

    const target = signal.strengthDelta >= 0
      ? previousScore + (1 - previousScore) * signal.strengthDelta
      : previousScore + previousScore * signal.strengthDelta;

    const newScore = this.clamp01(
      previousScore + effectiveAlpha * (target - previousScore),
    );

    const newConfidence = this.clamp01(previousConfidence + 0.08 * (1 - previousConfidence));
    const newLevel = this.scoreToLevel(newScore);

    const isFailureSignal =
      (signal.source === 'REVISION_TEST' || signal.source === 'QUIZ') &&
      signal.strengthDelta < 0;
    const consecutiveFailures = isFailureSignal ? previousFailures + 1 : 0;

    const needsReview = newScore < MASTERY_THRESHOLDS.WEAK || consecutiveFailures >= 1;

    const triggeredAiTeachback =
      needsReview && consecutiveFailures > 0 && consecutiveFailures < AI_TEACHBACK_ESCALATION_THRESHOLD;
    const triggeredPeerEscalation =
      needsReview && consecutiveFailures >= AI_TEACHBACK_ESCALATION_THRESHOLD;

    await this.prisma.topicMastery.upsert({
      where: { studentId_topicId: { studentId: signal.studentId, topicId: signal.topicId } },
      create: {
        studentId: signal.studentId,
        topicId: signal.topicId,
        masteryScore: newScore,
        masteryLevel: newLevel,
        confidence: newConfidence,
        needsReview,
        consecutiveFailures,
      },
      update: {
        masteryScore: newScore,
        masteryLevel: newLevel,
        confidence: newConfidence,
        needsReview,
        consecutiveFailures,
        lastEvaluatedAt: new Date(),
      },
    });

    this.logger.debug(
      `mastery update student=${signal.studentId} topic=${signal.topicId} ` +
        `${previousScore.toFixed(2)} -> ${newScore.toFixed(2)} (source=${signal.source})`,
    );

    return {
      studentId: signal.studentId,
      topicId: signal.topicId,
      previousScore,
      newScore,
      previousLevel,
      newLevel,
      needsReview,
      triggeredAiTeachback,
      triggeredPeerEscalation,
    };
  }

  async applySignals(signals: WeaknessSignal[]): Promise<TopicMasteryUpdateResult[]> {
    const results: TopicMasteryUpdateResult[] = [];
    for (const s of signals) {
      results.push(await this.applySignal(s));
    }
    return results;
  }

  buildSignalFromExamMark(params: {
    studentId: string; topicId: string; marksObtained: number; maxMarks: number;
  }): WeaknessSignal {
    const ratio = params.maxMarks > 0 ? params.marksObtained / params.maxMarks : 0;
    const strengthDelta = this.clamp(-1, 1, (ratio - 0.6) / 0.4);
    return {
      source: 'EXAM', topicId: params.topicId, studentId: params.studentId,
      strengthDelta, confidence: 0.7, occurredAt: new Date(),
      meta: { marksObtained: params.marksObtained, maxMarks: params.maxMarks },
    };
  }

  buildSignalFromQuizAttempt(params: { studentId: string; topicId: string; score: number }): WeaknessSignal {
    return {
      source: 'QUIZ', topicId: params.topicId, studentId: params.studentId,
      strengthDelta: this.clamp(-1, 1, (params.score - 0.6) / 0.4),
      confidence: 0.55, occurredAt: new Date(), meta: { score: params.score },
    };
  }

  buildSignalFromRevisionTest(params: {
    studentId: string; topicId: string; score: number; nemotronQualityScore?: number;
  }): WeaknessSignal {
    const blended = params.nemotronQualityScore != null
      ? 0.6 * params.score + 0.4 * params.nemotronQualityScore
      : params.score;
    return {
      source: 'REVISION_TEST', topicId: params.topicId, studentId: params.studentId,
      strengthDelta: this.clamp(-1, 1, (blended - 0.65) / 0.35),
      confidence: 0.65, occurredAt: new Date(),
      meta: { score: params.score, nemotronQualityScore: params.nemotronQualityScore },
    };
  }

  buildSignalFromPeerTeaching(params: {
    tuteeId: string; topicId: string; postSessionQuizScore: number;
  }): WeaknessSignal {
    return {
      source: 'PEER_TEACHING', topicId: params.topicId, studentId: params.tuteeId,
      strengthDelta: this.clamp(-1, 1, (params.postSessionQuizScore - 0.6) / 0.4),
      confidence: 0.6, occurredAt: new Date(),
    };
  }

  /** New: a spaced-retention check-in (2/7/30 days later) counts as its own signal source. */
  buildSignalFromSpacedRetention(params: {
    studentId: string; topicId: string; score: number; intervalDays: number;
  }): WeaknessSignal {
    // Longer intervals are weighted slightly higher: forgetting something
    // after 30 days is more informative about true retention than after 2.
    const confidence = params.intervalDays >= 30 ? 0.7 : params.intervalDays >= 7 ? 0.6 : 0.45;
    return {
      source: 'SPACED_RETENTION', topicId: params.topicId, studentId: params.studentId,
      strengthDelta: this.clamp(-1, 1, (params.score - 0.6) / 0.4),
      confidence, occurredAt: new Date(),
      meta: { intervalDays: params.intervalDays },
    };
  }

  async listWeakTopicsForStudent(studentId: string) {
    return this.prisma.topicMastery.findMany({
      where: { studentId, needsReview: true },
      include: { topic: { include: { subject: true } } },
      orderBy: { masteryScore: 'asc' },
    });
  }

  private scoreToLevel(score: number): 'WEAK' | 'DEVELOPING' | 'PROFICIENT' | 'STRONG' {
    if (score < MASTERY_THRESHOLDS.WEAK) return 'WEAK';
    if (score < MASTERY_THRESHOLDS.DEVELOPING) return 'DEVELOPING';
    if (score < MASTERY_THRESHOLDS.PROFICIENT) return 'PROFICIENT';
    return 'STRONG';
  }

  private clamp01(n: number) { return Math.min(1, Math.max(0, n)); }
  private clamp(min: number, max: number, n: number) { return Math.min(max, Math.max(min, n)); }
}
