import { Test } from '@nestjs/testing';
import { StretchGoalService } from './stretch-goal.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StretchGoalService.evaluate', () => {
  let service: StretchGoalService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { topicMastery: { findMany: jest.fn() }, stretchGoal: { create: jest.fn().mockImplementation(({ data }) => data) } };
    const moduleRef = await Test.createTestingModule({
      providers: [StretchGoalService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(StretchGoalService);
  });

  it('does not suggest a stretch goal with no mastery data yet', async () => {
    prisma.topicMastery.findMany.mockResolvedValue([]);
    const result = await service.evaluate('s1', 'sub1', 80);
    expect(result.suggested).toBe(false);
  });

  it('does not suggest a stretch goal when mastery is close to (or below) the stated goal', async () => {
    prisma.topicMastery.findMany.mockResolvedValue([{ masteryScore: 0.8 }, { masteryScore: 0.78 }]); // ~79% avg vs 80% goal
    const result = await service.evaluate('s1', 'sub1', 80);
    expect(result.suggested).toBe(false);
  });

  it('suggests a stretch goal when current mastery meaningfully exceeds the stated goal', async () => {
    prisma.topicMastery.findMany.mockResolvedValue([{ masteryScore: 0.95 }, { masteryScore: 0.93 }]); // ~94% avg vs 80% goal
    const result = await service.evaluate('s1', 'sub1', 80);
    expect(result.suggested).toBe(true);
    expect(result.projectedCapabilityPercent).toBeGreaterThan(80);
  });
});
