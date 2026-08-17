import { Test } from '@nestjs/testing';
import { ConfidenceCalibrationService } from './confidence-calibration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditService } from './credit.service';

describe('ConfidenceCalibrationService', () => {
  let service: ConfidenceCalibrationService;
  let prisma: any;
  let creditService: { award: jest.Mock };

  beforeEach(async () => {
    prisma = {
      confidenceRecord: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'r1', ...data })),
        findMany: jest.fn(),
      },
    };
    creditService = { award: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConfidenceCalibrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreditService, useValue: creditService },
      ],
    }).compile();
    service = moduleRef.get(ConfidenceCalibrationService);
  });

  describe('recordOutcome', () => {
    it('awards a credit bonus when confidence closely matches the outcome', async () => {
      await service.recordOutcome({
        studentId: 's1', topicId: 't1', refType: 'QUIZ_QUESTION', refId: 'q1',
        predictedConfidence: 0.95, wasCorrect: true, // error = 0.05, well under the 0.15 threshold
      });
      expect(creditService.award).toHaveBeenCalled();
    });

    it('does not award a bonus for poorly calibrated confidence', async () => {
      await service.recordOutcome({
        studentId: 's1', topicId: 't1', refType: 'QUIZ_QUESTION', refId: 'q1',
        predictedConfidence: 0.95, wasCorrect: false, // error = 0.95, badly overconfident
      });
      expect(creditService.award).not.toHaveBeenCalled();
    });

    it('rewards a confident, correct "I don\'t know" (low confidence, wrong answer) equally', async () => {
      await service.recordOutcome({
        studentId: 's1', topicId: 't1', refType: 'QUIZ_QUESTION', refId: 'q1',
        predictedConfidence: 0.1, wasCorrect: false, // error = 0.1, well-calibrated uncertainty
      });
      expect(creditService.award).toHaveBeenCalled();
    });
  });

  describe('computeCalibration', () => {
    it('returns a neutral prior with no data', async () => {
      prisma.confidenceRecord.findMany.mockResolvedValue([]);
      const result = await service.computeCalibration('s1');
      expect(result.bias).toBe('INSUFFICIENT_DATA');
      expect(result.sampleSize).toBe(0);
    });

    it('flags OVERCONFIDENT when stated confidence consistently exceeds actual accuracy', async () => {
      prisma.confidenceRecord.findMany.mockResolvedValue([
        { predictedConfidence: 0.9, wasCorrect: false },
        { predictedConfidence: 0.9, wasCorrect: false },
        { predictedConfidence: 0.9, wasCorrect: true },
      ]);
      const result = await service.computeCalibration('s1');
      expect(result.bias).toBe('OVERCONFIDENT');
    });

    it('flags UNDERCONFIDENT when stated confidence consistently trails actual accuracy', async () => {
      prisma.confidenceRecord.findMany.mockResolvedValue([
        { predictedConfidence: 0.2, wasCorrect: true },
        { predictedConfidence: 0.2, wasCorrect: true },
        { predictedConfidence: 0.2, wasCorrect: true },
      ]);
      const result = await service.computeCalibration('s1');
      expect(result.bias).toBe('UNDERCONFIDENT');
    });

    it('computes a perfect calibration score (1.0) for perfectly matched predictions', async () => {
      prisma.confidenceRecord.findMany.mockResolvedValue([
        { predictedConfidence: 1, wasCorrect: true },
        { predictedConfidence: 0, wasCorrect: false },
      ]);
      const result = await service.computeCalibration('s1');
      expect(result.calibrationScore).toBe(1);
      expect(result.bias).toBe('WELL_CALIBRATED');
    });
  });
});
