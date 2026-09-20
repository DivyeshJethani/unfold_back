import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfidenceCalibrationService } from './confidence-calibration.service';
import { StruggleBehaviorService } from './struggle-behavior.service';
import {
  BehavioralFeaturesResponseDto,
  OverallBehaviorFeaturesDto,
  TopicBehaviorFeaturesDto,
  VideoBehaviorFeaturesDto,
  LearningBehaviorFeaturesDto,
  ConfidenceBehaviorFeaturesDto,
} from '../dto/behavioral-features.dto';

@Injectable()
export class BehavioralFeatureService {
  private readonly logger = new Logger(BehavioralFeatureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly confidenceService: ConfidenceCalibrationService,
    private readonly struggleService: StruggleBehaviorService,
  ) {}

  /**
   * Extract comprehensive, deterministic behavioral features for an authenticated student
   * from persisted video interactions, quiz attempts, and confidence records.
   */
  async extractFeaturesForStudent(studentId: string): Promise<BehavioralFeaturesResponseDto> {
    const [
      videoEvents,
      quizAttempts,
      confidenceResult,
      resilienceScore,
      masteryRows,
      allTopics,
    ] = await Promise.all([
      this.prisma.videoInteractionEvent.findMany({
        where: { studentId },
        include: {
          lecture: {
            include: {
              topic: {
                include: { subject: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.quizAttempt.findMany({
        where: { studentId },
        include: {
          answers: {
            include: {
              question: {
                include: {
                  topic: {
                    include: { subject: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { startedAt: 'asc' },
      }),
      this.confidenceService.computeCalibration(studentId),
      this.struggleService.computeResilienceScore(studentId),
      this.prisma.topicMastery.findMany({
        where: { studentId },
        include: {
          topic: {
            include: { subject: true },
          },
        },
      }),
      this.prisma.topic.findMany({
        include: { subject: true },
        orderBy: { order: 'asc' },
      }),
    ]);

    // 1. Process Video Behavior Features
    const videoFeatures = this.calculateVideoFeatures(videoEvents);

    // 2. Process Learning / Practice Behavior Features
    const learningFeatures = this.calculateLearningFeatures(quizAttempts);

    // 3. Overall Engagement Composite Score
    const engagementScore = this.calculateCompositeEngagement(
      videoFeatures,
      learningFeatures,
      confidenceResult.calibrationScore,
      resilienceScore,
    );

    const confidenceDto: ConfidenceBehaviorFeaturesDto = {
      calibrationScore: confidenceResult.calibrationScore,
      avgPredictedConfidence: confidenceResult.avgPredictedConfidence ?? 0.5,
      avgActualAccuracy: confidenceResult.avgActualAccuracy ?? 0.5,
      calibrationBias: confidenceResult.bias as any,
      sampleSize: confidenceResult.sampleSize,
    };

    const overall: OverallBehaviorFeaturesDto = {
      video: videoFeatures,
      learning: learningFeatures,
      confidence: confidenceDto,
      engagementScore,
      resilienceScore,
    };

    // 4. Topic-Level Feature Breakdown
    const topicFeatures = this.calculateTopicFeatures(
      allTopics,
      videoEvents,
      quizAttempts,
      masteryRows,
      resilienceScore,
    );

    return {
      studentId,
      generatedAt: new Date().toISOString(),
      overall,
      topics: topicFeatures,
    };
  }

  /**
   * Calculate video interaction telemetry features
   */
  private calculateVideoFeatures(events: any[]): VideoBehaviorFeaturesDto {
    if (events.length === 0) {
      return {
        totalWatchTimeSec: 0,
        uniqueLecturesWatched: 0,
        completedLecturesCount: 0,
        completionRate: 0,
        totalPauses: 0,
        pauseFrequencyPerMin: 0,
        totalRewinds: 0,
        totalForwards: 0,
        totalSeeks: 0,
        totalReplays: 0,
        avgPlaybackSpeed: 1.0,
        rewatchTendency: 0,
        dropOffRate: 0,
      };
    }

    // Group events by lecture
    const lectureEventMap = new Map<string, any[]>();
    for (const event of events) {
      if (!lectureEventMap.has(event.lectureId)) {
        lectureEventMap.set(event.lectureId, []);
      }
      lectureEventMap.get(event.lectureId)!.push(event);
    }

    let totalWatchTimeSec = 0;
    let completedLecturesCount = 0;
    let totalDropOffs = 0;
    let totalPauses = 0;
    let totalRewinds = 0;
    let totalForwards = 0;
    let totalSeeks = 0;
    let totalReplays = 0;
    const speedValues: number[] = [];

    for (const [lectureId, lEvents] of lectureEventMap.entries()) {
      const lectureDuration = lEvents[0]?.lecture?.durationSec || 600;
      let hasCompleted = false;
      let maxAtSecond = 0;

      for (const e of lEvents) {
        if (e.eventType === 'PAUSE') totalPauses++;
        else if (e.eventType === 'REWIND') totalRewinds++;
        else if (e.eventType === 'FORWARD' || e.eventType === 'FAST_FORWARD' || e.eventType === 'SKIP_SECTION') {
          totalForwards++;
        } else if (e.eventType === 'SEEK') totalSeeks++;
        else if (e.eventType === 'REPLAY') totalReplays++;
        else if (e.eventType === 'COMPLETE') hasCompleted = true;
        else if (e.eventType === 'DROP_OFF') totalDropOffs++;

        if (e.playbackSpeed != null && e.playbackSpeed > 0) {
          speedValues.push(e.playbackSpeed);
        }

        if (e.atSecond != null && e.atSecond > maxAtSecond) {
          maxAtSecond = e.atSecond;
        }
      }

      // Check completion either via explicit COMPLETE event or reached >= 90% duration
      if (hasCompleted || maxAtSecond >= 0.9 * lectureDuration) {
        completedLecturesCount++;
        totalWatchTimeSec += lectureDuration;
      } else {
        totalWatchTimeSec += Math.min(lectureDuration, maxAtSecond);
      }
    }

    const uniqueLectures = lectureEventMap.size;
    const completionRate = uniqueLectures > 0 ? Number((completedLecturesCount / uniqueLectures).toFixed(2)) : 0;
    const totalWatchMinutes = totalWatchTimeSec / 60;
    const pauseFrequencyPerMin =
      totalWatchMinutes >= 0.2 ? Number((totalPauses / totalWatchMinutes).toFixed(2)) : 0;
    const avgPlaybackSpeed =
      speedValues.length > 0
        ? Number((speedValues.reduce((s, v) => s + v, 0) / speedValues.length).toFixed(2))
        : 1.0;
    const rewatchTendency =
      uniqueLectures > 0
        ? Number(((totalRewinds + totalReplays) / uniqueLectures).toFixed(2))
        : 0;
    const dropOffRate =
      uniqueLectures > 0 ? Number((totalDropOffs / uniqueLectures).toFixed(2)) : 0;

    return {
      totalWatchTimeSec,
      uniqueLecturesWatched: uniqueLectures,
      completedLecturesCount,
      completionRate,
      totalPauses,
      pauseFrequencyPerMin,
      totalRewinds,
      totalForwards,
      totalSeeks,
      totalReplays,
      avgPlaybackSpeed,
      rewatchTendency,
      dropOffRate,
    };
  }

  /**
   * Calculate learning and quiz assessment performance features
   */
  private calculateLearningFeatures(attempts: any[]): LearningBehaviorFeaturesDto {
    const allAnswers: any[] = [];
    for (const attempt of attempts) {
      if (attempt.answers && attempt.answers.length > 0) {
        allAnswers.push(...attempt.answers);
      }
    }

    if (allAnswers.length === 0) {
      return {
        quizzesAttempted: 0,
        questionsAttempted: 0,
        accuracy: 0,
        avgTimeTakenMs: 0,
        recentAccuracy: 0,
        performanceTrend: 'INSUFFICIENT_DATA',
        dominantMistakeType: 'NONE',
      };
    }

    const totalQuestions = allAnswers.length;
    const correctCount = allAnswers.filter((a) => a.isCorrect).length;
    const accuracy = Number((correctCount / totalQuestions).toFixed(2));
    const avgTimeTakenMs = Math.round(
      allAnswers.reduce((sum, a) => sum + (a.timeTakenMs || 0), 0) / totalQuestions,
    );

    // Recent accuracy (last 10 answers)
    const recentAnswers = allAnswers.slice(-10);
    const recentCorrect = recentAnswers.filter((a) => a.isCorrect).length;
    const recentAccuracy = Number((recentCorrect / recentAnswers.length).toFixed(2));

    // Performance trend
    let performanceTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA' = 'STABLE';
    if (totalQuestions < 4) {
      performanceTrend = 'INSUFFICIENT_DATA';
    } else {
      const diff = recentAccuracy - accuracy;
      if (diff >= 0.08) performanceTrend = 'IMPROVING';
      else if (diff <= -0.08) performanceTrend = 'DECLINING';
      else performanceTrend = 'STABLE';
    }

    // Mistake classification frequency
    const mistakeCounts: Record<string, number> = {};
    for (const a of allAnswers) {
      if (!a.isCorrect && a.mistakeType && a.mistakeType !== 'NONE') {
        mistakeCounts[a.mistakeType] = (mistakeCounts[a.mistakeType] || 0) + 1;
      }
    }

    let dominantMistakeType = 'NONE';
    let maxMistakeCount = 0;
    for (const [mType, count] of Object.entries(mistakeCounts)) {
      if (count > maxMistakeCount) {
        maxMistakeCount = count;
        dominantMistakeType = mType;
      }
    }

    return {
      quizzesAttempted: attempts.length,
      questionsAttempted: totalQuestions,
      accuracy,
      avgTimeTakenMs,
      recentAccuracy,
      performanceTrend,
      dominantMistakeType,
    };
  }

  /**
   * Derive composite engagement score (0..1)
   */
  private calculateCompositeEngagement(
    video: VideoBehaviorFeaturesDto,
    learning: LearningBehaviorFeaturesDto,
    calibrationScore: number,
    resilienceScore: number,
  ): number {
    let score = 0.5; // neutral baseline

    // Factor 1: Video completion (weight: 0.35)
    const videoScore = video.uniqueLecturesWatched > 0 ? video.completionRate : 0.5;

    // Factor 2: Quiz accuracy & activity (weight: 0.25)
    const learningScore = learning.questionsAttempted > 0 ? learning.accuracy : 0.5;

    // Factor 3: Metacognitive Calibration (weight: 0.20)
    const calibScore = calibrationScore || 0.5;

    // Factor 4: Resilience / persistence under struggle (weight: 0.20)
    const resScore = resilienceScore || 0.5;

    score = videoScore * 0.35 + learningScore * 0.25 + calibScore * 0.20 + resScore * 0.20;

    return Number(Math.min(1, Math.max(0, score)).toFixed(2));
  }

  /**
   * Calculate per-topic behavioral breakdown
   */
  private calculateTopicFeatures(
    allTopics: any[],
    videoEvents: any[],
    quizAttempts: any[],
    masteryRows: any[],
    resilienceScore: number,
  ): TopicBehaviorFeaturesDto[] {
    const topicFeatures: TopicBehaviorFeaturesDto[] = [];

    const masteryByTopicId = new Map<string, any>(masteryRows.map((m) => [m.topicId, m]));

    // Group video events by topicId
    const videoEventsByTopicId = new Map<string, any[]>();
    for (const e of videoEvents) {
      const topicId = e.lecture?.topicId;
      if (topicId) {
        if (!videoEventsByTopicId.has(topicId)) videoEventsByTopicId.set(topicId, []);
        videoEventsByTopicId.get(topicId)!.push(e);
      }
    }

    // Group quiz answers by topicId
    const answersByTopicId = new Map<string, any[]>();
    const attemptsByTopicId = new Map<string, number>();

    for (const attempt of quizAttempts) {
      const topicIdSet = new Set<string>();
      for (const ans of attempt.answers || []) {
        const topicId = ans.question?.topicId;
        if (topicId) {
          topicIdSet.add(topicId);
          if (!answersByTopicId.has(topicId)) answersByTopicId.set(topicId, []);
          answersByTopicId.get(topicId)!.push(ans);
        }
      }
      for (const tId of topicIdSet) {
        attemptsByTopicId.set(tId, (attemptsByTopicId.get(tId) || 0) + 1);
      }
    }

    for (const topic of allTopics) {
      const topicId = topic.id;
      const mastery = masteryByTopicId.get(topicId);
      const masteryScore = mastery ? Number(mastery.masteryScore.toFixed(2)) : 0.5;
      const masteryLevel = mastery ? mastery.masteryLevel : 'DEVELOPING';
      const needsReview = mastery ? mastery.needsReview : false;

      const tEvents = videoEventsByTopicId.get(topicId) || [];
      const tAnswers = answersByTopicId.get(topicId) || [];
      const tQuizzes = attemptsByTopicId.get(topicId) || 0;

      // Video metrics for topic
      const lectureIds = new Set(tEvents.map((e) => e.lectureId));
      let completedLectures = 0;
      let rewindsAndReplays = 0;

      for (const lId of lectureIds) {
        const forLecture = tEvents.filter((e) => e.lectureId === lId);
        const isCompleted = forLecture.some((e) => e.eventType === 'COMPLETE');
        if (isCompleted) completedLectures++;
        rewindsAndReplays += forLecture.filter(
          (e) => e.eventType === 'REWIND' || e.eventType === 'REPLAY',
        ).length;
      }

      const videoCompletionRate =
        lectureIds.size > 0 ? Number((completedLectures / lectureIds.size).toFixed(2)) : 0;
      const rewatchRate =
        lectureIds.size > 0 ? Number((rewindsAndReplays / lectureIds.size).toFixed(2)) : 0;

      // Quiz metrics for topic
      const questionsAttempted = tAnswers.length;
      const correctAnswers = tAnswers.filter((a) => a.isCorrect).length;
      const quizAccuracy =
        questionsAttempted > 0 ? Number((correctAnswers / questionsAttempted).toFixed(2)) : 0;
      const avgQuestionTimeMs =
        questionsAttempted > 0
          ? Math.round(tAnswers.reduce((sum, a) => sum + (a.timeTakenMs || 0), 0) / questionsAttempted)
          : 0;

      // Topic struggle signal
      // High struggle when: low mastery, high mistakes, or heavy rewinding
      let struggleSignal = 0.2; // baseline low struggle
      if (masteryScore < 0.45) struggleSignal += 0.35;
      if (questionsAttempted >= 2 && quizAccuracy < 0.5) struggleSignal += 0.25;
      if (rewatchRate >= 2.0) struggleSignal += 0.15;
      if (resilienceScore < 0.4) struggleSignal += 0.10;
      struggleSignal = Number(Math.min(1.0, struggleSignal).toFixed(2));

      // Engagement signal
      let engagementSignal: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      const totalInteractions = tEvents.length + questionsAttempted;
      if (totalInteractions >= 5 || (videoCompletionRate >= 0.8 && questionsAttempted >= 2)) {
        engagementSignal = 'HIGH';
      } else if (totalInteractions >= 2) {
        engagementSignal = 'MEDIUM';
      }

      topicFeatures.push({
        topicId: topic.id,
        topicName: topic.name,
        subjectId: topic.subject?.id || topic.subjectId,
        subjectName: topic.subject?.name || 'General',
        masteryScore,
        masteryLevel,
        needsReview,
        quizzesAttempted: tQuizzes,
        questionsAttempted,
        quizAccuracy,
        avgQuestionTimeMs,
        videoEventsCount: tEvents.length,
        videoCompletionRate,
        rewatchRate,
        struggleSignal,
        engagementSignal,
      });
    }

    return topicFeatures;
  }
}
