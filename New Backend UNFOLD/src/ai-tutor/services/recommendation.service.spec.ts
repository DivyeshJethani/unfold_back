import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BehavioralFeatureService } from './behavioral-feature.service';
import { LearningDnaService } from './learning-dna.service';
import { TeachingFormatService } from './teaching-format.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: any;
  let behavioralService: any;
  let learningDnaService: any;
  let formatService: any;

  const mockTopic1 = {
    id: 'top-1',
    subjectId: 'sub-1',
    name: 'Kinematics',
    order: 1,
    subject: { id: 'sub-1', name: 'Physics' },
    lectures: [
      { id: 'lec-1', title: 'Kinematics Intro', videoUrl: 'http://video1.mp4', durationSec: 600 },
    ],
    quizQuestions: [{ id: 'q-1', prompt: 'What is acceleration?', difficulty: 0.5 }],
    teachingContents: [
      { id: 'tc-1', format: 'DIAGRAM', title: 'Kinematics Diagrams', body: '...' },
      { id: 'tc-2', format: 'SIMULATION', title: 'Motion Sim', body: '...' },
    ],
  };

  const mockTopic2 = {
    id: 'top-2',
    subjectId: 'sub-1',
    name: 'Dynamics',
    order: 2,
    subject: { id: 'sub-1', name: 'Physics' },
    lectures: [
      { id: 'lec-2', title: 'Newton Laws', videoUrl: 'http://video2.mp4', durationSec: 800 },
    ],
    quizQuestions: [{ id: 'q-2', prompt: 'What is F=ma?', difficulty: 0.6 }],
    teachingContents: [],
  };

  const mockTopic3 = {
    id: 'top-3',
    subjectId: 'sub-2',
    name: 'Thermodynamics',
    order: 3,
    subject: { id: 'sub-2', name: 'Chemistry' },
    lectures: [],
    quizQuestions: [],
    teachingContents: [],
  };

  beforeEach(async () => {
    prisma = {
      topic: {
        findMany: jest.fn().mockResolvedValue([mockTopic1, mockTopic2]),
      },
      topicMastery: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    behavioralService = {
      extractFeaturesForStudent: jest.fn().mockResolvedValue({
        studentId: 'student-1',
        overall: {
          video: { uniqueLecturesWatched: 0 },
          learning: { quizzesAttempted: 0, dominantMistakeType: 'NONE' },
        },
        topics: [],
      }),
    };

    learningDnaService = {
      getLongitudinalSignals: jest.fn().mockResolvedValue({
        improvingTopics: [],
        decliningTopics: [],
        stableTopics: [],
        masteryTrajectory: 'INSUFFICIENT_DATA',
        sustainedImprovement: false,
        totalSnapshots: 0,
      }),
    };

    formatService = {
      getOverallPreferredFormat: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: PrismaService, useValue: prisma },
        { provide: BehavioralFeatureService, useValue: behavioralService },
        { provide: LearningDnaService, useValue: learningDnaService },
        { provide: TeachingFormatService, useValue: formatService },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 1. Weak Topic Recommendation
  // --------------------------------------------------------------------------
  describe('Weak Topic Recommendation', () => {
    it('prioritizes weak topic with review urgency and explainable rationale', async () => {
      prisma.topicMastery.findMany.mockResolvedValue([
        {
          topicId: 'top-1',
          masteryScore: 0.25,
          masteryLevel: 'WEAK',
          needsReview: true,
          dominantMistakeType: 'CONCEPT',
        },
      ]);

      const recs = await service.getRecommendations('student-1');

      expect(recs.length).toBeGreaterThan(0);
      const topRec = recs[0];
      expect(topRec.topicId).toBe('top-1');
      expect(topRec.signals.masteryLevel).toBe('WEAK');
      expect(topRec.signals.needsReview).toBe(true);
      expect(topRec.scoreBreakdown?.weakTopicSignal).toBeCloseTo((1 - 0.25) * 0.35, 2);
      expect(topRec.scoreBreakdown?.reviewUrgency).toBe(0.2);
      expect(topRec.rationale).toContain('mastery is low');
      expect(topRec.rationale).toContain('CONCEPT');
      expect(topRec.rationale).toContain('review');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Improving Topic Recommendation
  // --------------------------------------------------------------------------
  describe('Improving Topic Recommendation', () => {
    it('reinforces improving topic without treating it as a severe crisis', async () => {
      prisma.topicMastery.findMany.mockResolvedValue([
        {
          topicId: 'top-1',
          masteryScore: 0.62,
          masteryLevel: 'DEVELOPING',
          needsReview: false,
        },
      ]);

      learningDnaService.getLongitudinalSignals.mockResolvedValue({
        improvingTopics: [
          {
            topicId: 'top-1',
            delta: 0.12,
            trend: 'IMPROVING',
            currentScore: 0.62,
            previousScore: 0.5,
          },
        ],
        decliningTopics: [],
        stableTopics: [],
        masteryTrajectory: 'IMPROVING',
      });

      const recs = await service.getRecommendations('student-1');
      const rec = recs.find((r) => r.topicId === 'top-1');

      expect(rec).toBeDefined();
      expect(rec!.signals.trajectoryTrend).toBe('IMPROVING');
      expect(rec!.scoreBreakdown?.trajectorySignal).toBe(0.1);
      expect(rec!.scoreBreakdown?.reviewUrgency).toBe(0.0);
      expect(rec!.rationale).toContain('reinforce progress');
      expect(rec!.rationale).toContain('improving');
      expect(rec!.rationale).toContain('+0.12');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Mastered Topic Deprioritization
  // --------------------------------------------------------------------------
  describe('Mastered Topic Deprioritization', () => {
    it('applies mastered penalty so strong topics do not block unmastered topics', async () => {
      // top-1 is strongly mastered; top-2 is developing/unmastered
      prisma.topicMastery.findMany.mockResolvedValue([
        {
          topicId: 'top-1',
          masteryScore: 0.92,
          masteryLevel: 'STRONG',
          needsReview: false,
        },
        {
          topicId: 'top-2',
          masteryScore: 0.55,
          masteryLevel: 'DEVELOPING',
          needsReview: false,
        },
      ]);

      const recs = await service.getRecommendations('student-1');

      const rec1 = recs.find((r) => r.topicId === 'top-1')!;
      const rec2 = recs.find((r) => r.topicId === 'top-2')!;

      expect(rec1.scoreBreakdown?.masteredPenalty).toBe(0.45);
      expect(rec2.scoreBreakdown?.masteredPenalty).toBe(0.0);
      // Unmastered topic 2 should outrank mastered topic 1
      expect(rec2.score).toBeGreaterThan(rec1.score);
      expect(rec1.rationale).toContain('already strongly mastered');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Behavioral Struggle Signal
  // --------------------------------------------------------------------------
  describe('Behavioral Struggle Influence', () => {
    it('incorporates video telemetry struggle (rewinds & dropoffs) into score and rationale', async () => {
      prisma.topicMastery.findMany.mockResolvedValue([
        {
          topicId: 'top-1',
          masteryScore: 0.5,
          masteryLevel: 'DEVELOPING',
          needsReview: false,
        },
      ]);

      behavioralService.extractFeaturesForStudent.mockResolvedValue({
        studentId: 'student-1',
        overall: { video: { uniqueLecturesWatched: 1 } },
        topics: [
          {
            topicId: 'top-1',
            struggleSignal: 0.8,
            rewatchRate: 3.0,
            videoCompletionRate: 0.4,
            videoEventsCount: 8,
            questionsAttempted: 0,
          },
        ],
      });

      const recs = await service.getRecommendations('student-1');
      const rec = recs.find((r) => r.topicId === 'top-1')!;

      expect(rec.signals.rewatchRate).toBe(3.0);
      expect(rec.scoreBreakdown?.behavioralStruggleSignal).toBeGreaterThan(0.15);
      expect(rec.rationale).toContain('rewatch rate: 3.0');
      expect(rec.activityType).toBe('LECTURE');
      expect(rec.resourceId).toBe('lec-1');
    });
  });

  // --------------------------------------------------------------------------
  // 5. New Student / Insufficient Data
  // --------------------------------------------------------------------------
  describe('New Student / Insufficient Data', () => {
    it('returns curricular progression without falsely claiming weak mastery', async () => {
      prisma.topicMastery.findMany.mockResolvedValue([]);
      behavioralService.extractFeaturesForStudent.mockResolvedValue({
        studentId: 'new-student',
        overall: { video: { uniqueLecturesWatched: 0 }, learning: { questionsAttempted: 0 } },
        topics: [],
      });
      learningDnaService.getLongitudinalSignals.mockResolvedValue({
        improvingTopics: [],
        decliningTopics: [],
        stableTopics: [],
        masteryTrajectory: 'INSUFFICIENT_DATA',
        totalSnapshots: 0,
      });

      const recs = await service.getRecommendations('new-student');

      expect(recs.length).toBe(2);
      expect(recs[0].topicId).toBe('top-1'); // order 1 first
      expect(recs[0].signals.hasSufficientData).toBe(false);
      expect(recs[0].signals.masteryLevel).toBe('NO_DATA');
      expect(recs[0].scoreBreakdown?.weakTopicSignal).toBe(0);
      expect(recs[0].scoreBreakdown?.reviewUrgency).toBe(0);
      expect(recs[0].rationale).toContain('insufficient learner history to personalize yet');
      expect(recs[0].rationale).not.toContain('mastery is low');
    });
  });

  // --------------------------------------------------------------------------
  // 6. Deterministic Scoring Formula Verification
  // --------------------------------------------------------------------------
  describe('Deterministic Scoring Formula', () => {
    it('produces exact mathematical scores matching the documented breakdown', async () => {
      prisma.topicMastery.findMany.mockResolvedValue([
        {
          topicId: 'top-1',
          masteryScore: 0.3,
          masteryLevel: 'WEAK',
          needsReview: true,
        },
      ]);

      const recs = await service.getRecommendations('student-1');
      const rec = recs.find((r) => r.topicId === 'top-1')!;
      const b = rec.scoreBreakdown!;

      // topic order 1: baseRelevance = 0.40
      expect(b.baseRelevance).toBe(0.4);
      // weakTopicSignal: (1 - 0.3) * 0.35 = 0.245
      expect(b.weakTopicSignal).toBe(0.245);
      // reviewUrgency: needsReview = true -> 0.20
      expect(b.reviewUrgency).toBe(0.2);
      // no trajectory, no struggle, no format match, no penalty
      expect(b.trajectorySignal).toBe(0);
      expect(b.behavioralStruggleSignal).toBe(0);
      expect(b.formatMatchBonus).toBe(0);
      expect(b.masteredPenalty).toBe(0);

      const expectedRaw = 0.4 + 0.245 + 0.2; // 0.845
      expect(b.finalScore).toBe(0.845);
      expect(rec.score).toBe(0.845);
      expect(rec.priority).toBe(0.845);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Student Data Isolation
  // --------------------------------------------------------------------------
  describe('Student Data Isolation', () => {
    it('ensures Student A data never affects Student B recommendations', async () => {
      const studentAId = 'student-A';
      const studentBId = 'student-B';

      // Set up conditional responses based on studentId
      prisma.topicMastery.findMany.mockImplementation(({ where }: any) => {
        if (where.studentId === studentAId) {
          return Promise.resolve([
            { topicId: 'top-1', masteryScore: 0.1, masteryLevel: 'WEAK', needsReview: true },
          ]);
        }
        if (where.studentId === studentBId) {
          return Promise.resolve([
            { topicId: 'top-1', masteryScore: 0.95, masteryLevel: 'STRONG', needsReview: false },
          ]);
        }
        return Promise.resolve([]);
      });

      behavioralService.extractFeaturesForStudent.mockImplementation((sId: string) => {
        if (sId === studentAId) {
          return Promise.resolve({
            studentId: studentAId,
            overall: {},
            topics: [{ topicId: 'top-1', struggleSignal: 0.9, rewatchRate: 4.0 }],
          });
        }
        return Promise.resolve({
          studentId: studentBId,
          overall: {},
          topics: [{ topicId: 'top-1', struggleSignal: 0.1, rewatchRate: 0.0 }],
        });
      });

      const recsA = await service.getRecommendations(studentAId);
      const recsB = await service.getRecommendations(studentBId);

      const recA1 = recsA.find((r) => r.topicId === 'top-1')!;
      const recB1 = recsB.find((r) => r.topicId === 'top-1')!;

      // Student A: low mastery, struggle -> very high score
      expect(recA1.signals.masteryScore).toBe(0.1);
      expect(recA1.score).toBeGreaterThan(0.7);
      expect(recA1.rationale).toContain('mastery is low');

      // Student B: strong mastery, no struggle -> deprioritized
      expect(recB1.signals.masteryScore).toBe(0.95);
      expect(recB1.score).toBeLessThan(0.4);
      expect(recB1.rationale).toContain('already strongly mastered');

      // Assert prisma was called strictly with each student's isolated ID
      expect(prisma.topicMastery.findMany).toHaveBeenCalledWith({ where: { studentId: studentAId } });
      expect(prisma.topicMastery.findMany).toHaveBeenCalledWith({ where: { studentId: studentBId } });
    });
  });

  // --------------------------------------------------------------------------
  // 8. Teaching Format Preference Match
  // --------------------------------------------------------------------------
  describe('Teaching Format Preference Match', () => {
    it('awards format match bonus when preferred format matches available teaching content', async () => {
      formatService.getOverallPreferredFormat.mockResolvedValue('DIAGRAM');
      prisma.topicMastery.findMany.mockResolvedValue([
        { topicId: 'top-1', masteryScore: 0.5, masteryLevel: 'DEVELOPING', needsReview: false },
      ]);

      const recs = await service.getRecommendations('student-1');
      const rec = recs.find((r) => r.topicId === 'top-1')!;

      expect(rec.activityType).toBe('TEACHING_CONTENT');
      expect(rec.resourceType).toBe('DIAGRAM');
      expect(rec.resourceId).toBe('tc-1');
      expect(rec.scoreBreakdown?.formatMatchBonus).toBe(0.1);
      expect(rec.rationale).toContain('preferred learning format (diagram)');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Edge Cases & Query Filters
  // --------------------------------------------------------------------------
  describe('Edge Cases and Filters', () => {
    it('returns empty array when curriculum has no topics', async () => {
      prisma.topic.findMany.mockResolvedValue([]);

      const recs = await service.getRecommendations('student-1');
      expect(recs).toEqual([]);
    });

    it('filters by subjectId and topicId when supplied', async () => {
      await service.getRecommendations('student-1', {
        subjectId: 'sub-1',
        topicId: 'top-1',
        limit: 1,
      });

      expect(prisma.topic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { subjectId: 'sub-1', id: 'top-1' },
        }),
      );
    });

    it('getNextRecommendation returns the top single recommendation', async () => {
      const nextRec = await service.getNextRecommendation('student-1');
      expect(nextRec).toBeDefined();
      expect(nextRec?.topicId).toBe('top-1');
    });
  });
});
