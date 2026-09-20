import { Test, TestingModule } from '@nestjs/testing';
import { BehavioralFeatureService } from './behavioral-feature.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfidenceCalibrationService } from './confidence-calibration.service';
import { StruggleBehaviorService } from './struggle-behavior.service';

describe('BehavioralFeatureService', () => {
  let service: BehavioralFeatureService;
  let prisma: any;
  let confidenceService: any;
  let struggleService: any;

  beforeEach(async () => {
    prisma = {
      videoInteractionEvent: {
        findMany: jest.fn(),
      },
      quizAttempt: {
        findMany: jest.fn(),
      },
      topicMastery: {
        findMany: jest.fn(),
      },
      topic: {
        findMany: jest.fn(),
      },
    };

    confidenceService = {
      computeCalibration: jest.fn().mockResolvedValue({
        calibrationScore: 0.8,
        bias: 'WELL_CALIBRATED',
        avgPredictedConfidence: 0.7,
        avgActualAccuracy: 0.75,
        sampleSize: 4,
      }),
    };

    struggleService = {
      computeResilienceScore: jest.fn().mockResolvedValue(0.7),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BehavioralFeatureService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfidenceCalibrationService, useValue: confidenceService },
        { provide: StruggleBehaviorService, useValue: struggleService },
      ],
    }).compile();

    service = module.get<BehavioralFeatureService>(BehavioralFeatureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractFeaturesForStudent - Empty Data Case', () => {
    it('should return clean default baseline features when student has no interactions', async () => {
      prisma.videoInteractionEvent.findMany.mockResolvedValue([]);
      prisma.quizAttempt.findMany.mockResolvedValue([]);
      prisma.topicMastery.findMany.mockResolvedValue([]);
      prisma.topic.findMany.mockResolvedValue([
        { id: 'top-1', name: 'Kinematics', subject: { id: 'sub-1', name: 'Physics' } },
      ]);
      confidenceService.computeCalibration.mockResolvedValue({
        calibrationScore: 0.5,
        bias: 'INSUFFICIENT_DATA',
        sampleSize: 0,
      });
      struggleService.computeResilienceScore.mockResolvedValue(0.5);

      const result = await service.extractFeaturesForStudent('student-empty');

      expect(result.studentId).toBe('student-empty');
      expect(result.overall.video.uniqueLecturesWatched).toBe(0);
      expect(result.overall.video.totalWatchTimeSec).toBe(0);
      expect(result.overall.video.completionRate).toBe(0);
      expect(result.overall.learning.quizzesAttempted).toBe(0);
      expect(result.overall.learning.questionsAttempted).toBe(0);
      expect(result.overall.learning.accuracy).toBe(0);
      expect(result.overall.learning.performanceTrend).toBe('INSUFFICIENT_DATA');
      expect(result.overall.learning.dominantMistakeType).toBe('NONE');
      expect(result.overall.confidence.calibrationScore).toBe(0.5);
      expect(result.overall.engagementScore).toBe(0.5);

      expect(result.topics).toHaveLength(1);
      expect(result.topics[0].topicId).toBe('top-1');
      expect(result.topics[0].masteryScore).toBe(0.5);
      expect(result.topics[0].videoEventsCount).toBe(0);
      expect(result.topics[0].questionsAttempted).toBe(0);
      expect(result.topics[0].engagementSignal).toBe('LOW');
    });
  });

  describe('extractFeaturesForStudent - Normal Data Case with Real Telemetry', () => {
    it('should correctly calculate fine-grained video, learning, and topic signals', async () => {
      const mockVideoEvents = [
        {
          id: 'e1',
          studentId: 's1',
          lectureId: 'lec-1',
          eventType: 'PLAY',
          atSecond: 0,
          playbackSpeed: 1.0,
          lecture: { id: 'lec-1', topicId: 'top-1', durationSec: 600 },
        },
        {
          id: 'e2',
          studentId: 's1',
          lectureId: 'lec-1',
          eventType: 'PAUSE',
          atSecond: 150,
          playbackSpeed: 1.0,
          lecture: { id: 'lec-1', topicId: 'top-1', durationSec: 600 },
        },
        {
          id: 'e3',
          studentId: 's1',
          lectureId: 'lec-1',
          eventType: 'REWIND',
          atSecond: 150,
          toSecond: 90,
          lecture: { id: 'lec-1', topicId: 'top-1', durationSec: 600 },
        },
        {
          id: 'e4',
          studentId: 's1',
          lectureId: 'lec-1',
          eventType: 'SEEK',
          atSecond: 90,
          toSecond: 300,
          lecture: { id: 'lec-1', topicId: 'top-1', durationSec: 600 },
        },
        {
          id: 'e5',
          studentId: 's1',
          lectureId: 'lec-1',
          eventType: 'COMPLETE',
          atSecond: 600,
          lecture: { id: 'lec-1', topicId: 'top-1', durationSec: 600 },
        },
      ];

      const mockQuizAttempts = [
        {
          id: 'att-1',
          studentId: 's1',
          startedAt: new Date('2026-09-18T10:00:00Z'),
          answers: [
            {
              id: 'ans-1',
              isCorrect: true,
              timeTakenMs: 12000,
              mistakeType: 'NONE',
              question: { id: 'q-1', topicId: 'top-1' },
            },
            {
              id: 'ans-2',
              isCorrect: false,
              timeTakenMs: 18000,
              mistakeType: 'CALCULATION',
              question: { id: 'q-2', topicId: 'top-1' },
            },
            {
              id: 'ans-3',
              isCorrect: true,
              timeTakenMs: 10000,
              mistakeType: 'NONE',
              question: { id: 'q-3', topicId: 'top-1' },
            },
            {
              id: 'ans-4',
              isCorrect: true,
              timeTakenMs: 8000,
              mistakeType: 'NONE',
              question: { id: 'q-4', topicId: 'top-1' },
            },
          ],
        },
      ];

      const mockMastery = [
        {
          topicId: 'top-1',
          masteryScore: 0.72,
          masteryLevel: 'PROFICIENT',
          needsReview: false,
        },
      ];

      const mockTopics = [
        {
          id: 'top-1',
          name: 'Kinematics & 1D Motion',
          subjectId: 'sub-1',
          subject: { id: 'sub-1', name: 'Physics' },
        },
      ];

      prisma.videoInteractionEvent.findMany.mockResolvedValue(mockVideoEvents);
      prisma.quizAttempt.findMany.mockResolvedValue(mockQuizAttempts);
      prisma.topicMastery.findMany.mockResolvedValue(mockMastery);
      prisma.topic.findMany.mockResolvedValue(mockTopics);

      const result = await service.extractFeaturesForStudent('s1');

      // Video assertions
      expect(result.overall.video.uniqueLecturesWatched).toBe(1);
      expect(result.overall.video.completedLecturesCount).toBe(1);
      expect(result.overall.video.completionRate).toBe(1.0);
      expect(result.overall.video.totalWatchTimeSec).toBe(600);
      expect(result.overall.video.totalPauses).toBe(1);
      expect(result.overall.video.totalRewinds).toBe(1);
      expect(result.overall.video.totalSeeks).toBe(1);
      expect(result.overall.video.totalForwards).toBe(0);
      expect(result.overall.video.rewatchTendency).toBe(1.0);

      // Learning assertions
      expect(result.overall.learning.quizzesAttempted).toBe(1);
      expect(result.overall.learning.questionsAttempted).toBe(4);
      expect(result.overall.learning.accuracy).toBe(0.75); // 3 out of 4
      expect(result.overall.learning.avgTimeTakenMs).toBe(12000); // (12000 + 18000 + 10000 + 8000) / 4
      expect(result.overall.learning.dominantMistakeType).toBe('CALCULATION');
      expect(result.overall.learning.performanceTrend).toBe('STABLE');

      // Topic breakdown assertions
      expect(result.topics).toHaveLength(1);
      const top1 = result.topics[0];
      expect(top1.topicId).toBe('top-1');
      expect(top1.masteryScore).toBe(0.72);
      expect(top1.masteryLevel).toBe('PROFICIENT');
      expect(top1.quizzesAttempted).toBe(1);
      expect(top1.questionsAttempted).toBe(4);
      expect(top1.quizAccuracy).toBe(0.75);
      expect(top1.videoEventsCount).toBe(5);
      expect(top1.videoCompletionRate).toBe(1.0);
      expect(top1.engagementSignal).toBe('HIGH');
    });
  });
});
