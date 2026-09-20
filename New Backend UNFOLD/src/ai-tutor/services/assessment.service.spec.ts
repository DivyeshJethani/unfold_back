import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WeakTopicDetectionService } from './weak-topic-detection.service';
import { MistakeClassificationService } from './mistake-classification.service';
import { ConfidenceCalibrationService } from './confidence-calibration.service';
import { CreditService } from './credit.service';

describe('AssessmentService', () => {
  let service: AssessmentService;
  let prisma: any;
  let weakTopicService: any;
  let mistakeService: any;
  let confidenceService: any;
  let creditService: any;

  beforeEach(async () => {
    prisma = {
      topic: {
        findUnique: jest.fn(),
      },
      quizQuestion: {
        findMany: jest.fn(),
      },
      quizAttempt: {
        create: jest.fn(),
        update: jest.fn(),
      },
      quizAnswer: {
        create: jest.fn(),
      },
    };

    weakTopicService = {
      applySignal: jest.fn().mockResolvedValue({ topicId: 'top-1', masteryScore: 0.75 }),
      buildSignalFromQuizAttempt: jest.fn().mockReturnValue({ score: 1.0 }),
    };

    mistakeService = {
      classifyAndPersist: jest.fn().mockResolvedValue({ mistakeType: 'CALCULATION' }),
    };

    confidenceService = {
      recordOutcome: jest.fn().mockResolvedValue({ id: 'conf-rec-1' }),
    };

    creditService = {
      award: jest.fn().mockResolvedValue({ amount: 10 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: WeakTopicDetectionService, useValue: weakTopicService },
        { provide: MistakeClassificationService, useValue: mistakeService },
        { provide: ConfidenceCalibrationService, useValue: confidenceService },
        { provide: CreditService, useValue: creditService },
      ],
    }).compile();

    service = module.get<AssessmentService>(AssessmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submitQuizAttempt', () => {
    const validParams = {
      studentId: 'student-1',
      topicId: 'top-1',
      answers: [
        {
          questionId: 'q-1',
          selectedOptionId: 'opt-b',
          timeTakenMs: 12000,
          predictedConfidence: 0.9,
          workingText: 'v = u + at -> 20/5 = 4',
        },
        {
          questionId: 'q-2',
          selectedOptionId: 'opt-a', // wrong answer
          timeTakenMs: 8000,
          predictedConfidence: 0.4,
        },
      ],
    };

    it('should successfully submit quiz attempt, grade answers, record confidence, and persist data without leaking correct answers', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'top-1', name: 'Kinematics' });
      prisma.quizQuestion.findMany.mockResolvedValue([
        { id: 'q-1', correctOptionId: 'opt-b' },
        { id: 'q-2', correctOptionId: 'opt-c' },
      ]);
      prisma.quizAttempt.create.mockResolvedValue({ id: 'attempt-1', studentId: 'student-1' });
      prisma.quizAnswer.create
        .mockResolvedValueOnce({ id: 'ans-1', questionId: 'q-1', isCorrect: true, timeTakenMs: 12000 })
        .mockResolvedValueOnce({ id: 'ans-2', questionId: 'q-2', isCorrect: false, timeTakenMs: 8000 });
      prisma.quizAttempt.update.mockResolvedValue({ id: 'attempt-1', score: 0.5 });

      const result = await service.submitQuizAttempt(validParams);

      // Verify attempt creation
      expect(prisma.quizAttempt.create).toHaveBeenCalledWith({
        data: { studentId: 'student-1' },
      });

      // Verify answers persistence with correctness and timing
      expect(prisma.quizAnswer.create).toHaveBeenCalledTimes(2);
      expect(prisma.quizAnswer.create).toHaveBeenNthCalledWith(1, {
        data: {
          attemptId: 'attempt-1',
          questionId: 'q-1',
          selectedOptionId: 'opt-b',
          isCorrect: true,
          timeTakenMs: 12000,
          workingText: 'v = u + at -> 20/5 = 4',
        },
      });
      expect(prisma.quizAnswer.create).toHaveBeenNthCalledWith(2, {
        data: {
          attemptId: 'attempt-1',
          questionId: 'q-2',
          selectedOptionId: 'opt-a',
          isCorrect: false,
          timeTakenMs: 8000,
          workingText: undefined,
        },
      });

      // Verify confidence records persisted
      expect(confidenceService.recordOutcome).toHaveBeenCalledTimes(2);
      expect(confidenceService.recordOutcome).toHaveBeenNthCalledWith(1, {
        studentId: 'student-1',
        topicId: 'top-1',
        refType: 'QUIZ_QUESTION',
        refId: 'ans-1',
        predictedConfidence: 0.9,
        wasCorrect: true,
      });

      // Verify mistake classification called for wrong answer
      expect(mistakeService.classifyAndPersist).toHaveBeenCalledWith('ans-2');

      // Verify credits awarded
      expect(creditService.award).toHaveBeenCalled();

      // Verify returned results (no correctOptionId leaked)
      expect(result.attemptId).toBe('attempt-1');
      expect(result.score).toBe(0.5);
      expect(result.correctCount).toBe(1);
      expect(result.total).toBe(2);
      expect(result.answerResults).toEqual([
        { questionId: 'q-1', isCorrect: true, mistakeType: 'NONE' },
        { questionId: 'q-2', isCorrect: false, mistakeType: 'CALCULATION' },
      ]);
      expect((result as any).correctOptionId).toBeUndefined();
      expect((result.answerResults[0] as any).correctOptionId).toBeUndefined();
    });

    it('should throw NotFoundException if topic does not exist', async () => {
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.submitQuizAttempt(validParams)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if questions are not found', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'top-1' });
      prisma.quizQuestion.findMany.mockResolvedValue([{ id: 'q-1', correctOptionId: 'opt-b' }]); // missing q-2

      await expect(service.submitQuizAttempt(validParams)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
