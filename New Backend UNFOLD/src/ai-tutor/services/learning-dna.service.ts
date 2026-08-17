import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttentionSpanService } from './attention-span.service';
import { ConfidenceCalibrationService } from './confidence-calibration.service';
import { StruggleBehaviorService } from './struggle-behavior.service';
import { TeachingFormatService } from './teaching-format.service';
import { BEHAVIOR_WINDOW_DAYS } from '../ai-tutor.constants';
import { LearningDnaSnapshot } from '../interfaces/scoring.interface';

/**
 * The single aggregation point the vision doc calls "Learning DNA" — pulls
 * together every other signal service into one profile, recomputed
 * on-demand (or on a schedule via the BullMQ processor) rather than joined
 * live on every dashboard read.
 *
 * Honest note on `learningSpeed`: true "how fast does this student learn"
 * needs a longitudinal record of (first exposure → mastery reached) per
 * topic, which requires storing mastery-score history over time — we don't
 * have a time-series table for that yet (TopicMastery is a single current
 * row per topic, not a log). As a defensible interim proxy, we use the
 * proportion of topics-with-real-evidence (confidence > 0.5) that have
 * already reached PROFICIENT or STRONG — i.e. "of what this student has
 * actually engaged with enough for us to trust a score, how much have they
 * already mastered." This correlates with speed but isn't a direct
 * measurement of it; swap in a proper mastery-history table when that
 * becomes available and this function is the only place that needs to change.
 */
@Injectable()
export class LearningDnaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attentionService: AttentionSpanService,
    private readonly confidenceService: ConfidenceCalibrationService,
    private readonly struggleService: StruggleBehaviorService,
    private readonly formatService: TeachingFormatService,
  ) {}

  async recompute(studentId: string): Promise<LearningDnaSnapshot> {
    const [attention, calibration, resilience, preferredFormat, masteryRows, mistakeStats] = await Promise.all([
      this.attentionService.recomputeForStudent(studentId),
      this.confidenceService.computeCalibration(studentId),
      this.struggleService.computeResilienceScore(studentId),
      this.formatService.getOverallPreferredFormat(studentId),
      this.prisma.topicMastery.findMany({ where: { studentId } }),
      this.getMistakeStats(studentId),
    ]);

    const learningSpeed = this.estimateLearningSpeed(masteryRows);
    const problemSolvingScore = this.estimateProblemSolving(resilience, mistakeStats);

    const dominantMistakePattern = mistakeStats.dominant;

    const summary = this.buildSummary({
      learningSpeed,
      memoryRetention: attention.memoryRetentionScore,
      attentionSpanSec: attention.estimatedAttentionSpanSec,
      problemSolvingScore,
      confidenceCalibration: calibration.calibrationScore,
      calibrationBias: calibration.bias,
      resilienceScore: resilience,
      preferredFormat,
      dominantMistakePattern,
    });

    const snapshot: LearningDnaSnapshot = {
      studentId,
      learningSpeed,
      memoryRetention: attention.memoryRetentionScore,
      attentionSpanSec: attention.estimatedAttentionSpanSec,
      problemSolvingScore,
      confidenceCalibration: calibration.calibrationScore,
      resilienceScore: resilience,
      preferredFormat: preferredFormat as any,
      dominantMistakePattern: dominantMistakePattern as any,
      summary,
    };

    await this.prisma.learningDnaProfile.upsert({
      where: { studentId },
      create: {
        studentId,
        learningSpeed,
        memoryRetention: attention.memoryRetentionScore,
        attentionSpanSec: attention.estimatedAttentionSpanSec,
        problemSolvingScore,
        confidenceCalibration: calibration.calibrationScore,
        resilienceScore: resilience,
        preferredFormat: preferredFormat as any,
        dominantMistakePattern: dominantMistakePattern as any,
        summary,
        rawSnapshot: { ...snapshot, calibrationDetail: calibration, mistakeStats } as any,
      },
      update: {
        learningSpeed,
        memoryRetention: attention.memoryRetentionScore,
        attentionSpanSec: attention.estimatedAttentionSpanSec,
        problemSolvingScore,
        confidenceCalibration: calibration.calibrationScore,
        resilienceScore: resilience,
        preferredFormat: preferredFormat as any,
        dominantMistakePattern: dominantMistakePattern as any,
        summary,
        rawSnapshot: { ...snapshot, calibrationDetail: calibration, mistakeStats } as any,
      },
    });

    return snapshot;
  }

  private estimateLearningSpeed(masteryRows: Array<{ confidence: number; masteryLevel: string }>): number {
    const trusted = masteryRows.filter((r) => r.confidence > 0.5);
    if (trusted.length === 0) return 0.5;
    const mastered = trusted.filter((r) => r.masteryLevel === 'PROFICIENT' || r.masteryLevel === 'STRONG');
    return Number((mastered.length / trusted.length).toFixed(2));
  }

  private estimateProblemSolving(resilience: number, mistakeStats: { carelessRatio: number }): number {
    // Rewards persistence (resilience) more heavily than raw error-avoidance,
    // per the doc's point that a wrong answer via good process still shows
    // strong problem-solving ability.
    return Number((0.7 * resilience + 0.3 * (1 - mistakeStats.carelessRatio)).toFixed(2));
  }

  private async getMistakeStats(studentId: string) {
    const since = new Date(Date.now() - BEHAVIOR_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const wrongAnswers = await this.prisma.quizAnswer.findMany({
      where: { isCorrect: false, mistakeType: { not: 'NONE' }, attempt: { studentId, startedAt: { gte: since } } },
      select: { mistakeType: true },
    });

    if (wrongAnswers.length === 0) return { dominant: null, carelessRatio: 0 };

    const counts = new Map<string, number>();
    for (const a of wrongAnswers) counts.set(a.mistakeType, (counts.get(a.mistakeType) ?? 0) + 1);
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] as any;
    const carelessRatio = (counts.get('CARELESS') ?? 0) / wrongAnswers.length;

    return { dominant, carelessRatio };
  }

  private buildSummary(p: {
    learningSpeed: number; memoryRetention: number; attentionSpanSec: number;
    problemSolvingScore: number; confidenceCalibration: number; calibrationBias: string;
    resilienceScore: number; preferredFormat: string | null; dominantMistakePattern: string | null;
  }): string {
    const speedWord = p.learningSpeed > 0.7 ? 'quickly' : p.learningSpeed > 0.4 ? 'at a steady pace' : 'gradually, with repetition';
    const retentionWord = p.memoryRetention > 0.7 ? 'holds onto what they learn well' : p.memoryRetention > 0.4 ? 'retains most things but benefits from spaced review' : 'forgets faster than average, so frequent short revisions help';
    const attentionMin = Math.round(p.attentionSpanSec / 60);
    const resilienceWord = p.resilienceScore > 0.7 ? 'tends to keep trying when stuck' : p.resilienceScore > 0.4 ? 'sometimes needs a nudge to persist through difficulty' : 'tends to disengage quickly when stuck and may need more encouragement';
    const biasWord = p.calibrationBias === 'OVERCONFIDENT' ? 'tends to feel more sure than they should' : p.calibrationBias === 'UNDERCONFIDENT' ? 'tends to underestimate what they actually know' : 'has a good sense of what they do and don\'t know';
    const formatWord = p.preferredFormat ? `learns this material best through ${p.preferredFormat.toLowerCase()} content` : 'hasn\'t generated enough format data yet to show a clear preference';
    const mistakeWord = p.dominantMistakePattern ? `most mistakes trace back to ${p.dominantMistakePattern.toLowerCase()} gaps rather than not trying` : 'no dominant mistake pattern yet';

    return `This student learns ${speedWord} and ${retentionWord}. Focus holds for roughly ${attentionMin} minutes at a time. They ${resilienceWord}, and ${biasWord}. They ${formatWord}; ${mistakeWord}.`;
  }
}
