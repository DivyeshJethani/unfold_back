import { Test } from '@nestjs/testing';
import { WeakTopicDetectionService } from './weak-topic-detection.service';
import { LearningDnaService } from './learning-dna.service';
import { AttentionSpanService } from './attention-span.service';
import { ConfidenceCalibrationService } from './confidence-calibration.service';
import { StruggleBehaviorService } from './struggle-behavior.service';
import { TeachingFormatService } from './teaching-format.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WeaknessSignal } from '../interfaces/scoring.interface';

describe('Historical Learner State & Longitudinal Learning DNA (Task 6 Tests A-G)', () => {
  let weakTopicService: WeakTopicDetectionService;
  let learningDnaService: LearningDnaService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      topicMastery: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockImplementation(({ create, update }) => ({ ...create, ...update })),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
      },
      topicMasteryHistory: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'hist-1', ...data })),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      quizAnswer: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      learningDnaProfile: {
        upsert: jest.fn().mockImplementation(({ create }) => create),
      },
    };

    const mockAttention = {
      recomputeForStudent: jest.fn().mockResolvedValue({
        memoryRetentionScore: 0.75,
        estimatedAttentionSpanSec: 900,
      }),
    };
    const mockConfidence = {
      computeCalibration: jest.fn().mockResolvedValue({
        calibrationScore: 0.8,
        bias: 'WELL_CALIBRATED',
      }),
    };
    const mockStruggle = {
      computeResilienceScore: jest.fn().mockResolvedValue(0.7),
    };
    const mockFormat = {
      getOverallPreferredFormat: jest.fn().mockResolvedValue('VIDEO'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WeakTopicDetectionService,
        LearningDnaService,
        { provide: PrismaService, useValue: prisma },
        { provide: AttentionSpanService, useValue: mockAttention },
        { provide: ConfidenceCalibrationService, useValue: mockConfidence },
        { provide: StruggleBehaviorService, useValue: mockStruggle },
        { provide: TeachingFormatService, useValue: mockFormat },
      ],
    }).compile();

    weakTopicService = moduleRef.get(WeakTopicDetectionService);
    learningDnaService = moduleRef.get(LearningDnaService);
  });

  // ==========================================================================
  // TEST A: Genuine mastery update creates TopicMasteryHistory
  // ==========================================================================
  it('A: Genuine mastery update creates a TopicMasteryHistory record', async () => {
    prisma.topicMastery.findUnique.mockResolvedValue(null);

    const signal: WeaknessSignal = {
      source: 'QUIZ',
      studentId: 'student-A',
      topicId: 'topic-1',
      strengthDelta: 0.5,
      confidence: 0.8,
      occurredAt: new Date('2026-09-19T10:00:00Z'),
    };

    const result = await weakTopicService.applySignal(signal);

    expect(result).toBeDefined();
    expect(prisma.topicMasteryHistory.create).toHaveBeenCalledTimes(1);
    expect(prisma.topicMasteryHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 'student-A',
        topicId: 'topic-1',
        masteryScore: result.newScore,
        masteryLevel: result.newLevel,
        recordedAt: signal.occurredAt,
      }),
    });
  });

  // ==========================================================================
  // TEST B: Reading/recomputing Learning DNA does NOT create history
  // ==========================================================================
  it('B: Reading or recomputing Learning DNA does NOT create any TopicMasteryHistory record', async () => {
    // 1. Calling recompute()
    const snapshot = await learningDnaService.recompute('student-A');
    expect(snapshot).toBeDefined();

    // 2. Calling getTrajectory()
    const trajectory = await learningDnaService.getLongitudinalSignals('student-A');
    expect(trajectory).toBeDefined();

    // 3. Calling getHistory()
    const history = await learningDnaService.getMasteryHistory('student-A');
    expect(history).toBeDefined();

    // Verify zero history writes were invoked
    expect(prisma.topicMasteryHistory.create).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // TEST C: Multiple genuine mastery evaluations create chronological history
  // ==========================================================================
  it('C: Multiple genuine mastery evaluations create chronological history', async () => {
    const t1 = new Date('2026-09-19T09:00:00Z');
    const t2 = new Date('2026-09-19T10:00:00Z');
    const t3 = new Date('2026-09-19T11:00:00Z');

    prisma.topicMastery.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ masteryScore: 0.55, confidence: 0.4, masteryLevel: 'DEVELOPING', consecutiveFailures: 0 })
      .mockResolvedValueOnce({ masteryScore: 0.65, confidence: 0.45, masteryLevel: 'DEVELOPING', consecutiveFailures: 0 });

    await weakTopicService.applySignal({
      source: 'QUIZ', studentId: 'student-A', topicId: 'topic-1', strengthDelta: 0.3, confidence: 0.7, occurredAt: t1,
    });
    await weakTopicService.applySignal({
      source: 'REVISION_TEST', studentId: 'student-A', topicId: 'topic-1', strengthDelta: 0.5, confidence: 0.8, occurredAt: t2,
    });
    await weakTopicService.applySignal({
      source: 'SPACED_RETENTION', studentId: 'student-A', topicId: 'topic-1', strengthDelta: 0.4, confidence: 0.75, occurredAt: t3,
    });

    expect(prisma.topicMasteryHistory.create).toHaveBeenCalledTimes(3);

    const calls = prisma.topicMasteryHistory.create.mock.calls;
    expect(calls[0][0].data.recordedAt).toEqual(t1);
    expect(calls[1][0].data.recordedAt).toEqual(t2);
    expect(calls[2][0].data.recordedAt).toEqual(t3);
  });

  // ==========================================================================
  // TEST D: Increasing mastery is classified as IMPROVING
  // ==========================================================================
  it('D: Increasing mastery is classified as IMPROVING', async () => {
    prisma.topicMasteryHistory.findMany.mockResolvedValue([
      {
        id: 'h1',
        studentId: 'student-A',
        topicId: 'topic-1',
        masteryScore: 0.45,
        masteryLevel: 'DEVELOPING',
        recordedAt: new Date('2026-09-18T10:00:00Z'),
        topic: { id: 'topic-1', name: 'Quadratic Equations' },
      },
      {
        id: 'h2',
        studentId: 'student-A',
        topicId: 'topic-1',
        masteryScore: 0.72,
        masteryLevel: 'PROFICIENT',
        recordedAt: new Date('2026-09-19T10:00:00Z'),
        topic: { id: 'topic-1', name: 'Quadratic Equations' },
      },
    ]);

    const result = await learningDnaService.getLongitudinalSignals('student-A');

    expect(result.masteryTrajectory).toBe('IMPROVING');
    expect(result.improvingTopics).toHaveLength(1);
    expect(result.improvingTopics[0].topicId).toBe('topic-1');
    expect(result.improvingTopics[0].trend).toBe('IMPROVING');
    expect(result.improvingTopics[0].delta).toBeGreaterThan(0);
    expect(result.decliningTopics).toHaveLength(0);
  });

  // ==========================================================================
  // TEST E: Decreasing mastery is classified as DECLINING
  // ==========================================================================
  it('E: Decreasing mastery is classified as DECLINING', async () => {
    prisma.topicMasteryHistory.findMany.mockResolvedValue([
      {
        id: 'h1',
        studentId: 'student-A',
        topicId: 'topic-1',
        masteryScore: 0.75,
        masteryLevel: 'PROFICIENT',
        recordedAt: new Date('2026-09-18T10:00:00Z'),
        topic: { id: 'topic-1', name: 'Thermodynamics' },
      },
      {
        id: 'h2',
        studentId: 'student-A',
        topicId: 'topic-1',
        masteryScore: 0.48,
        masteryLevel: 'DEVELOPING',
        recordedAt: new Date('2026-09-19T10:00:00Z'),
        topic: { id: 'topic-1', name: 'Thermodynamics' },
      },
    ]);

    const result = await learningDnaService.getLongitudinalSignals('student-A');

    expect(result.masteryTrajectory).toBe('DECLINING');
    expect(result.decliningTopics).toHaveLength(1);
    expect(result.decliningTopics[0].topicId).toBe('topic-1');
    expect(result.decliningTopics[0].trend).toBe('DECLINING');
    expect(result.decliningTopics[0].delta).toBeLessThan(0);
    expect(result.improvingTopics).toHaveLength(0);
  });

  // ==========================================================================
  // TEST F: 0 or 1 historical records safely produce INSUFFICIENT_DATA
  // ==========================================================================
  it('F: 0 or 1 historical records safely produce INSUFFICIENT_DATA and sustainedImprovement=false', async () => {
    // Case F1: 0 records
    prisma.topicMasteryHistory.findMany.mockResolvedValueOnce([]);
    const resultZero = await learningDnaService.getLongitudinalSignals('student-A');
    expect(resultZero.masteryTrajectory).toBe('INSUFFICIENT_DATA');
    expect(resultZero.sustainedImprovement).toBe(false);
    expect(resultZero.improvingTopics).toHaveLength(0);
    expect(resultZero.decliningTopics).toHaveLength(0);
    expect(resultZero.stableTopics).toHaveLength(0);
    expect(resultZero.totalSnapshots).toBe(0);

    // Case F2: 1 record
    prisma.topicMasteryHistory.findMany.mockResolvedValueOnce([
      {
        id: 'h1',
        studentId: 'student-A',
        topicId: 'topic-1',
        masteryScore: 0.6,
        masteryLevel: 'DEVELOPING',
        recordedAt: new Date('2026-09-19T10:00:00Z'),
        topic: { id: 'topic-1', name: 'Vectors' },
      },
    ]);
    const resultOne = await learningDnaService.getLongitudinalSignals('student-A');
    expect(resultOne.masteryTrajectory).toBe('INSUFFICIENT_DATA');
    expect(resultOne.sustainedImprovement).toBe(false);
    expect(resultOne.improvingTopics).toHaveLength(0);
    expect(resultOne.decliningTopics).toHaveLength(0);
    expect(resultOne.stableTopics).toHaveLength(0);
    expect(resultOne.totalSnapshots).toBe(1);
  });

  // ==========================================================================
  // TEST G: Student isolation: Student A cannot retrieve Student B's history
  // ==========================================================================
  it('G: Student isolation: getMasteryHistory and getLongitudinalSignals filter strictly by studentId', async () => {
    prisma.topicMasteryHistory.findMany.mockImplementation(({ where }) => {
      if (where.studentId === 'student-A') {
        return Promise.resolve([
          { id: 'h-A', studentId: 'student-A', topicId: 'top-1', masteryScore: 0.7, recordedAt: new Date() },
        ]);
      }
      if (where.studentId === 'student-B') {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const historyA = await learningDnaService.getMasteryHistory('student-A');
    expect(historyA).toHaveLength(1);
    expect(historyA[0].studentId).toBe('student-A');

    const historyB = await learningDnaService.getMasteryHistory('student-B');
    expect(historyB).toHaveLength(0);

    expect(prisma.topicMasteryHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: 'student-A' }),
      }),
    );
    expect(prisma.topicMasteryHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentId: 'student-B' }),
      }),
    );
  });
});
