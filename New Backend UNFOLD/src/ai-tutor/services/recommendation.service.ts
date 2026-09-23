import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BehavioralFeatureService } from './behavioral-feature.service';
import { LearningDnaService } from './learning-dna.service';
import { TeachingFormatService } from './teaching-format.service';
import {
  RecommendationItemDto,
  RecommendationQueryDto,
  RecommendationScoreBreakdownDto,
  RecommendationSignalsDto,
} from '../dto/recommendation.dto';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly behavioralService: BehavioralFeatureService,
    private readonly learningDnaService: LearningDnaService,
    private readonly formatService: TeachingFormatService,
  ) {}

  /**
   * Produce adaptive, deterministic recommendations for the authenticated student.
   * Pulls persisted topic mastery, longitudinal trajectory, behavioral telemetry,
   * format effectiveness, and actual curriculum resources.
   */
  async getRecommendations(
    studentId: string,
    query?: RecommendationQueryDto,
  ): Promise<RecommendationItemDto[]> {
    const limit = query?.limit && query.limit > 0 ? Math.min(query.limit, 20) : 5;

    // 1. Fetch available curriculum topics with actual database resources
    const topics = await this.prisma.topic.findMany({
      where: {
        ...(query?.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query?.topicId ? { id: query.topicId } : {}),
      },
      include: {
        subject: true,
        lectures: { orderBy: { id: 'asc' } },
        quizQuestions: { select: { id: true, prompt: true, difficulty: true } },
        teachingContents: true,
      },
      orderBy: { order: 'asc' },
    });

    if (topics.length === 0) {
      return [];
    }

    // 2. Concurrently fetch all student-isolated persisted data
    const [masteryRows, behavioralData, longitudinal, preferredFormat] =
      await Promise.all([
        this.prisma.topicMastery.findMany({
          where: { studentId },
        }),
        this.behavioralService.extractFeaturesForStudent(studentId),
        this.learningDnaService.getLongitudinalSignals(studentId),
        this.formatService.getOverallPreferredFormat(studentId),
      ]);

    // Build lookup maps for efficient, student-isolated data access
    const masteryMap = new Map(masteryRows.map((m) => [m.topicId, m]));
    const topicBehaviorMap = new Map(
      (behavioralData.topics || []).map((t) => [t.topicId, t]),
    );

    const trajectoryMap = new Map<
      string,
      { trend: 'IMPROVING' | 'DECLINING' | 'STABLE'; delta: number }
    >();
    for (const t of longitudinal.improvingTopics || []) {
      trajectoryMap.set(t.topicId, { trend: 'IMPROVING', delta: t.delta });
    }
    for (const t of longitudinal.decliningTopics || []) {
      trajectoryMap.set(t.topicId, { trend: 'DECLINING', delta: t.delta });
    }
    for (const t of longitudinal.stableTopics || []) {
      trajectoryMap.set(t.topicId, { trend: 'STABLE', delta: 0 });
    }

    // 3. Score and evaluate each candidate topic activity
    const candidates: RecommendationItemDto[] = [];

    for (const topic of topics) {
      const mastery = masteryMap.get(topic.id);
      const behavior = topicBehaviorMap.get(topic.id);
      const trajectory = trajectoryMap.get(topic.id);

      // Determine evidence sufficiency
      const hasSufficientData = !!(
        mastery != null ||
        (behavior != null &&
          (behavior.videoEventsCount > 0 || behavior.questionsAttempted > 0))
      );

      const masteryScore = mastery ? Number(mastery.masteryScore.toFixed(3)) : null;
      const masteryLevel = mastery
        ? (mastery.masteryLevel as any)
        : 'NO_DATA';
      const needsReview = mastery ? mastery.needsReview : false;
      const trajectoryTrend = trajectory
        ? trajectory.trend
        : hasSufficientData
        ? 'STABLE'
        : 'INSUFFICIENT_DATA';
      const masteryDelta = trajectory ? trajectory.delta : null;

      const struggleSignal = behavior ? behavior.struggleSignal : null;
      const rewatchRate = behavior ? behavior.rewatchRate : null;
      const completionRate = behavior ? behavior.videoCompletionRate : null;
      const recentAccuracy = behavior ? behavior.quizAccuracy : null;
      const dominantMistakeType = mastery?.dominantMistakeType || null;

      const signals: RecommendationSignalsDto = {
        masteryScore,
        masteryLevel,
        needsReview,
        trajectoryTrend,
        masteryDelta,
        struggleSignal,
        rewatchRate,
        completionRate,
        recentAccuracy,
        dominantMistakeType:
          dominantMistakeType !== 'NONE' ? dominantMistakeType : null,
        preferredFormat,
        hasSufficientData,
      };

      // 4. Select actual curriculum resource for this topic
      const selectedResource = this.selectCurriculumResource(
        topic,
        signals,
        preferredFormat,
      );

      // 5. Calculate deterministic score components
      const scoreBreakdown = this.calculateScoreBreakdown(
        topic.order,
        signals,
        selectedResource.resourceType,
        preferredFormat,
      );

      // 6. Generate explainable, evidence-based rationale
      const rationale = this.generateRationale(
        topic.name,
        signals,
        selectedResource,
        scoreBreakdown,
      );

      candidates.push({
        id: `rec-${studentId}-${topic.id}-${selectedResource.activityType.toLowerCase()}`,
        topicId: topic.id,
        topicName: topic.name,
        subjectId: topic.subject?.id || topic.subjectId,
        subjectName: topic.subject?.name || 'General',
        activityType: selectedResource.activityType,
        resourceId: selectedResource.resourceId,
        resourceTitle: selectedResource.resourceTitle,
        resourceType: selectedResource.resourceType,
        score: scoreBreakdown.finalScore,
        priority: scoreBreakdown.finalScore,
        rationale,
        reason: rationale,
        signals,
        scoreBreakdown,
      });
    }

    // 7. Sort descending by score; break ties deterministically by topic order
    candidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.topicId.localeCompare(b.topicId);
    });

    return candidates.slice(0, limit);
  }

  /**
   * Return the single highest-priority recommendation for the student next.
   */
  async getNextRecommendation(
    studentId: string,
  ): Promise<RecommendationItemDto | null> {
    const recommendations = await this.getRecommendations(studentId, {
      limit: 1,
    });
    return recommendations.length > 0 ? recommendations[0] : null;
  }

  /**
   * Deterministic scoring function matching RecommendationScoreBreakdownDto:
   *
   * finalScore = clamp(0, 1,
   *     baseRelevance
   *   + weakTopicSignal
   *   + reviewUrgency
   *   + trajectorySignal
   *   + behavioralStruggleSignal
   *   + formatMatchBonus
   *   - masteredPenalty
   * )
   */
  private calculateScoreBreakdown(
    topicOrder: number,
    signals: RecommendationSignalsDto,
    resourceType: string,
    preferredFormat: string | null,
  ): RecommendationScoreBreakdownDto {
    // 1. Base curricular relevance (0.10..0.40): foundational order 1 gets 0.40
    const baseRelevance = Number(
      Math.max(0.1, 0.4 - (topicOrder - 1) * 0.05).toFixed(3),
    );

    // 2. Weak topic signal (0..0.35): higher for lower mastery
    let weakTopicSignal = 0.0;
    if (signals.masteryScore != null) {
      weakTopicSignal = Number(((1.0 - signals.masteryScore) * 0.35).toFixed(3));
    }

    // 3. Review urgency (0 or 0.20): bonus if flagged for review
    const reviewUrgency = signals.needsReview ? 0.2 : 0.0;

    // 4. Longitudinal trajectory signal (-0.05..0.15)
    let trajectorySignal = 0.0;
    if (signals.trajectoryTrend === 'DECLINING') {
      trajectorySignal = 0.15; // acute drop requires intervention
    } else if (
      signals.trajectoryTrend === 'IMPROVING' &&
      signals.masteryScore != null &&
      signals.masteryScore < 0.85
    ) {
      trajectorySignal = 0.1; // positive reinforcement
    }

    // 5. Behavioral struggle signal (0..0.25)
    let behavioralStruggleSignal = 0.0;
    if (signals.hasSufficientData) {
      const hasStruggle =
        (signals.struggleSignal != null && signals.struggleSignal >= 0.5) ||
        (signals.rewatchRate != null && signals.rewatchRate >= 1.5) ||
        (signals.completionRate != null &&
          signals.completionRate < 0.6 &&
          signals.completionRate > 0);

      if (hasStruggle) {
        const rawStruggle = signals.struggleSignal ?? 0.6;
        behavioralStruggleSignal = Number(
          Math.min(0.25, Math.max(0.05, rawStruggle * 0.25)).toFixed(3),
        );
      }
    }

    // 6. Format match bonus (0 or 0.10)
    let formatMatchBonus = 0.0;
    if (preferredFormat && resourceType.toUpperCase() === preferredFormat.toUpperCase()) {
      formatMatchBonus = 0.1;
    }

    // 7. Mastered penalty (0..0.45)
    let masteredPenalty = 0.0;
    if (
      signals.masteryLevel === 'STRONG' ||
      (signals.masteryScore != null && signals.masteryScore >= 0.85 && !signals.needsReview)
    ) {
      masteredPenalty = 0.45;
    } else if (
      signals.masteryLevel === 'PROFICIENT' &&
      !signals.needsReview
    ) {
      masteredPenalty = 0.15;
    }

    // Combine and clamp to [0.0, 1.0]
    const rawScore =
      baseRelevance +
      weakTopicSignal +
      reviewUrgency +
      trajectorySignal +
      behavioralStruggleSignal +
      formatMatchBonus -
      masteredPenalty;

    const finalScore = Number(Math.min(1.0, Math.max(0.0, rawScore)).toFixed(3));

    return {
      baseRelevance,
      weakTopicSignal,
      reviewUrgency,
      trajectorySignal,
      behavioralStruggleSignal,
      formatMatchBonus,
      masteredPenalty,
      finalScore,
    };
  }

  /**
   * Deterministic, explainable rationale generator.
   */
  private generateRationale(
    topicName: string,
    signals: RecommendationSignalsDto,
    resource: { activityType: string; resourceType: string; resourceTitle: string },
    breakdown: RecommendationScoreBreakdownDto,
  ): string {
    let rationale = '';

    // Case E: New student / Insufficient data
    if (!signals.hasSufficientData) {
      return `Recommended as foundational curriculum content for topic "${topicName}" (insufficient learner history to personalize yet).`;
    }

    // Case A: Weak topic (low mastery or needsReview)
    if (
      (signals.masteryScore != null && signals.masteryScore < 0.4) ||
      signals.needsReview
    ) {
      const scoreStr =
        signals.masteryScore != null ? ` (${signals.masteryScore.toFixed(2)})` : '';
      if (signals.dominantMistakeType) {
        rationale = `Recommended because topic mastery is low${scoreStr} and frequent ${signals.dominantMistakeType} errors occurred. Flagged for review.`;
      } else if (signals.needsReview) {
        rationale = `Recommended because topic mastery is low${scoreStr} and the topic is flagged for review.`;
      } else {
        rationale = `Recommended because topic mastery is low${scoreStr} and requires foundational review.`;
      }

      if (breakdown.behavioralStruggleSignal > 0) {
        rationale += ` Behavioral telemetry indicates difficulty with this material.`;
      }
    }
    // Case B: Improving topic
    else if (
      signals.trajectoryTrend === 'IMPROVING' &&
      signals.masteryScore != null &&
      signals.masteryScore < 0.85
    ) {
      const deltaStr =
        signals.masteryDelta != null ? `+${signals.masteryDelta.toFixed(2)}` : 'positive';
      rationale = `Recommended to reinforce progress: recent mastery is improving (${deltaStr}) but remains below strong proficiency (${signals.masteryScore.toFixed(2)}).`;
    }
    // Declining topic
    else if (signals.trajectoryTrend === 'DECLINING') {
      const deltaStr =
        signals.masteryDelta != null ? `${signals.masteryDelta.toFixed(2)}` : 'negative';
      rationale = `Recommended because recent mastery has declined (${deltaStr}) and requires targeted review.`;
    }
    // Case D: Behavioral struggle on non-weak topic
    else if (breakdown.behavioralStruggleSignal > 0) {
      const rewatchStr =
        signals.rewatchRate != null ? `rewatch rate: ${signals.rewatchRate.toFixed(1)}` : 'repeated rewinds';
      rationale = `Recommended because behavioral signals (${rewatchStr}) and low video completion suggest struggle with this lecture.`;
    }
    // Case C: Mastered topic
    else if (
      signals.masteryLevel === 'STRONG' ||
      (signals.masteryScore != null && signals.masteryScore >= 0.85)
    ) {
      rationale = `Recommended for retention check: topic is already strongly mastered (${signals.masteryScore?.toFixed(2)}).`;
    }
    // Default developing topic
    else {
      rationale = `Recommended for ongoing study and progression on topic "${topicName}".`;
    }

    // Format preference note
    if (breakdown.formatMatchBonus > 0 && signals.preferredFormat) {
      rationale += ` Delivered in your preferred learning format (${signals.preferredFormat.toLowerCase()}).`;
    }

    return rationale;
  }

  /**
   * Select concrete curriculum resource from actual database records.
   */
  private selectCurriculumResource(
    topic: any,
    signals: RecommendationSignalsDto,
    preferredFormat: string | null,
  ): {
    activityType: 'LECTURE' | 'PRACTICE_QUIZ' | 'TEACHING_CONTENT' | 'REVIEW';
    resourceId: string | null;
    resourceTitle: string;
    resourceType: string;
  } {
    // 1. If preferred format matches available teaching content, serve preferred format
    if (preferredFormat && topic.teachingContents && topic.teachingContents.length > 0) {
      const matchedContent = topic.teachingContents.find(
        (tc: any) => tc.format?.toUpperCase() === preferredFormat.toUpperCase(),
      );
      if (matchedContent) {
        return {
          activityType: 'TEACHING_CONTENT',
          resourceId: matchedContent.id,
          resourceTitle: matchedContent.title || `${topic.name} (${preferredFormat})`,
          resourceType: matchedContent.format,
        };
      }
    }

    // 2. If behavioral struggle or video incomplete, recommend lecture
    if (
      topic.lectures &&
      topic.lectures.length > 0 &&
      (signals.rewatchRate != null && signals.rewatchRate >= 1.5 ||
        (signals.completionRate != null && signals.completionRate < 0.8) ||
        !signals.hasSufficientData)
    ) {
      const lecture = topic.lectures[0];
      return {
        activityType: 'LECTURE',
        resourceId: lecture.id,
        resourceTitle: lecture.title,
        resourceType: 'VIDEO',
      };
    }

    // 3. If mastery is improving or weak and quiz questions exist, recommend practice quiz
    if (topic.quizQuestions && topic.quizQuestions.length > 0) {
      if (
        signals.trajectoryTrend === 'IMPROVING' ||
        signals.masteryLevel === 'DEVELOPING' ||
        signals.masteryLevel === 'WEAK' ||
        signals.needsReview
      ) {
        return {
          activityType: 'PRACTICE_QUIZ',
          resourceId: topic.quizQuestions[0]?.id || null,
          resourceTitle: `Practice Quiz: ${topic.name}`,
          resourceType: 'QUIZ',
        };
      }
    }

    // 4. Default to first lecture if available
    if (topic.lectures && topic.lectures.length > 0) {
      const lecture = topic.lectures[0];
      return {
        activityType: 'LECTURE',
        resourceId: lecture.id,
        resourceTitle: lecture.title,
        resourceType: 'VIDEO',
      };
    }

    // 5. Fallback to first teaching content if available
    if (topic.teachingContents && topic.teachingContents.length > 0) {
      const content = topic.teachingContents[0];
      return {
        activityType: 'TEACHING_CONTENT',
        resourceId: content.id,
        resourceTitle: content.title || `${topic.name} Content`,
        resourceType: content.format || 'TEXT',
      };
    }

    // 6. Fallback to practice quiz if available
    if (topic.quizQuestions && topic.quizQuestions.length > 0) {
      return {
        activityType: 'PRACTICE_QUIZ',
        resourceId: topic.quizQuestions[0].id,
        resourceTitle: `Practice Quiz: ${topic.name}`,
        resourceType: 'QUIZ',
      };
    }

    // 7. General review overview when no explicit resource entities exist
    return {
      activityType: 'REVIEW',
      resourceId: null,
      resourceTitle: `${topic.name} Concept Review`,
      resourceType: 'CONCEPT_STUDY',
    };
  }
}
