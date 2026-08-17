import { Test } from '@nestjs/testing';
import { TeachingFormatService } from './teaching-format.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TeachingFormatService', () => {
  let service: TeachingFormatService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      formatEffectiveness: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockImplementation(({ create, update }) => ({ ...create, ...update })),
        findMany: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [TeachingFormatService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TeachingFormatService);
  });

  describe('recommendFormat', () => {
    it('recommends an untried format first for cold-start coverage', async () => {
      prisma.formatEffectiveness.findMany.mockResolvedValue([
        { format: 'TEXT', avgScore: 0.9, attempts: 5 },
      ]);
      const result = await service.recommendFormat('s1', 't1');
      expect(result.format).not.toBe('TEXT');
      expect(result.reason).toMatch(/not yet tried/i);
    });

    it('recommends the highest-scoring trustworthy format once all formats have been tried', async () => {
      prisma.formatEffectiveness.findMany.mockResolvedValue([
        { format: 'TEXT', avgScore: 0.4, attempts: 5 },
        { format: 'VIDEO', avgScore: 0.9, attempts: 5 },
        { format: 'DIAGRAM', avgScore: 0.5, attempts: 5 },
        { format: 'EXAMPLE', avgScore: 0.6, attempts: 5 },
        { format: 'SIMULATION', avgScore: 0.3, attempts: 5 },
      ]);
      // force exploitation path deterministically
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const result = await service.recommendFormat('s1', 't1');
      randomSpy.mockRestore();
      expect(result.format).toBe('VIDEO');
    });

    it('ignores formats with too few attempts to be trustworthy, when a trustworthy one exists', async () => {
      prisma.formatEffectiveness.findMany.mockResolvedValue([
        { format: 'TEXT', avgScore: 0.99, attempts: 1 }, // lucky one-shot, shouldn't win
        { format: 'VIDEO', avgScore: 0.7, attempts: 5 },
        { format: 'DIAGRAM', avgScore: 0.6, attempts: 5 },
        { format: 'EXAMPLE', avgScore: 0.5, attempts: 5 },
        { format: 'SIMULATION', avgScore: 0.4, attempts: 5 },
      ]);
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const result = await service.recommendFormat('s1', 't1');
      randomSpy.mockRestore();
      expect(result.format).toBe('VIDEO');
    });
  });

  describe('recordOutcome — EWMA update', () => {
    it('moves the running average toward a new score rather than overwriting it', async () => {
      prisma.formatEffectiveness.findUnique.mockResolvedValue({ avgScore: 0.5, attempts: 3 });
      await service.recordOutcome({ studentId: 's1', topicId: 't1', format: 'VIDEO', score: 1.0 });
      const upsertCall = prisma.formatEffectiveness.upsert.mock.calls[0][0];
      expect(upsertCall.update.avgScore).toBeGreaterThan(0.5);
      expect(upsertCall.update.avgScore).toBeLessThan(1.0);
    });
  });

  describe('getOverallPreferredFormat', () => {
    it('returns null when there is not enough trustworthy data yet', async () => {
      prisma.formatEffectiveness.findMany.mockResolvedValue([]);
      const result = await service.getOverallPreferredFormat('s1');
      expect(result).toBeNull();
    });

    it('picks the format with the highest average score across topics', async () => {
      prisma.formatEffectiveness.findMany.mockResolvedValue([
        { format: 'TEXT', avgScore: 0.5, attempts: 4 },
        { format: 'SIMULATION', avgScore: 0.85, attempts: 4 },
        { format: 'SIMULATION', avgScore: 0.75, attempts: 4 },
      ]);
      const result = await service.getOverallPreferredFormat('s1');
      expect(result).toBe('SIMULATION');
    });
  });
});
