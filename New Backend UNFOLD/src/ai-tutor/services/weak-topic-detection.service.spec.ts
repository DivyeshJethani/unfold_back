import { Test } from '@nestjs/testing';
import { WeakTopicDetectionService } from './weak-topic-detection.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WeakTopicDetectionService', () => {
  let service: WeakTopicDetectionService;
  let prisma: { topicMastery: { findUnique: jest.Mock; upsert: jest.Mock; findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      topicMastery: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockImplementation(({ create, update }) => ({ ...create, ...update })),
        findMany: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [WeakTopicDetectionService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(WeakTopicDetectionService);
  });

  it('starts a new topic at the neutral default (0.5) when no prior record exists', async () => {
    prisma.topicMastery.findUnique.mockResolvedValue(null);
    const result = await service.applySignal({
      source: 'QUIZ', studentId: 's1', topicId: 't1', strengthDelta: 0, confidence: 0.5, occurredAt: new Date(),
    });
    expect(result.previousScore).toBe(0.5);
  });

  it('pulls mastery score down after a strongly negative signal (failed exam)', async () => {
    prisma.topicMastery.findUnique.mockResolvedValue({
      masteryScore: 0.5, masteryLevel: 'DEVELOPING', confidence: 0.3, consecutiveFailures: 0,
    });
    const examSignal = service.buildSignalFromExamMark({ studentId: 's1', topicId: 't1', marksObtained: 20, maxMarks: 100 });
    const result = await service.applySignal(examSignal);
    expect(result.newScore).toBeLessThan(result.previousScore);
  });

  it('pushes mastery score up after a strong quiz result', async () => {
    prisma.topicMastery.findUnique.mockResolvedValue({
      masteryScore: 0.5, masteryLevel: 'DEVELOPING', confidence: 0.3, consecutiveFailures: 0,
    });
    const quizSignal = service.buildSignalFromQuizAttempt({ studentId: 's1', topicId: 't1', score: 0.95 });
    const result = await service.applySignal(quizSignal);
    expect(result.newScore).toBeGreaterThan(result.previousScore);
  });

  it('marks needsReview and flags AI-teachback after the first revision-test failure', async () => {
    prisma.topicMastery.findUnique.mockResolvedValue({
      masteryScore: 0.5, masteryLevel: 'DEVELOPING', confidence: 0.3, consecutiveFailures: 0,
    });
    const failSignal = service.buildSignalFromRevisionTest({ studentId: 's1', topicId: 't1', score: 0.2 });
    const result = await service.applySignal(failSignal);
    expect(result.needsReview).toBe(true);
    expect(result.triggeredAiTeachback).toBe(true);
    expect(result.triggeredPeerEscalation).toBe(false);
  });

  it('escalates to peer teaching after repeated consecutive failures on the same topic', async () => {
    prisma.topicMastery.findUnique.mockResolvedValue({
      masteryScore: 0.3, masteryLevel: 'WEAK', confidence: 0.4, consecutiveFailures: 1,
    });
    const secondFailSignal = service.buildSignalFromRevisionTest({ studentId: 's1', topicId: 't1', score: 0.15 });
    const result = await service.applySignal(secondFailSignal);
    expect(result.needsReview).toBe(true);
    expect(result.triggeredPeerEscalation).toBe(true);
  });

  it('keeps scores within [0, 1] bounds regardless of extreme repeated signals', async () => {
    prisma.topicMastery.findUnique.mockResolvedValue({
      masteryScore: 0.98, masteryLevel: 'STRONG', confidence: 0.9, consecutiveFailures: 0,
    });
    const result = await service.applySignal({
      source: 'QUIZ', studentId: 's1', topicId: 't1', strengthDelta: 1, confidence: 1, occurredAt: new Date(),
    });
    expect(result.newScore).toBeLessThanOrEqual(1);
    expect(result.newScore).toBeGreaterThanOrEqual(0);
  });

  describe('spaced retention signal', () => {
    it('trusts a 30-day retention check more than a 2-day one (higher confidence)', () => {
      const short = service.buildSignalFromSpacedRetention({ studentId: 's1', topicId: 't1', score: 0.5, intervalDays: 2 });
      const long = service.buildSignalFromSpacedRetention({ studentId: 's1', topicId: 't1', score: 0.5, intervalDays: 30 });
      expect(long.confidence).toBeGreaterThan(short.confidence);
    });

    it('produces a negative signal when a student forgets a topic at the 30-day check', () => {
      const signal = service.buildSignalFromSpacedRetention({ studentId: 's1', topicId: 't1', score: 0.1, intervalDays: 30 });
      expect(signal.strengthDelta).toBeLessThan(0);
      expect(signal.source).toBe('SPACED_RETENTION');
    });
  });
});
