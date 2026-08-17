import { Test } from '@nestjs/testing';
import { StruggleBehaviorService } from './struggle-behavior.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('StruggleBehaviorService.computeResilienceScore', () => {
  let service: StruggleBehaviorService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { struggleEvent: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [StruggleBehaviorService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(StruggleBehaviorService);
  });

  it('returns a neutral 0.5 prior when there is no behavior data yet', async () => {
    prisma.struggleEvent.findMany.mockResolvedValue([]);
    const score = await service.computeResilienceScore('s1');
    expect(score).toBe(0.5);
  });

  it('scores near 1.0 for a student who consistently persists to a correct answer', async () => {
    prisma.struggleEvent.findMany.mockResolvedValue([
      { action: 'PERSISTED_TO_CORRECT' }, { action: 'PERSISTED_TO_CORRECT' }, { action: 'PERSISTED_TO_CORRECT' },
    ]);
    const score = await service.computeResilienceScore('s1');
    expect(score).toBe(1.0);
  });

  it('scores 0 for a student who always gives up', async () => {
    prisma.struggleEvent.findMany.mockResolvedValue([
      { action: 'GAVE_UP' }, { action: 'GAVE_UP' },
    ]);
    const score = await service.computeResilienceScore('s1');
    expect(score).toBe(0);
  });

  it('weighs switching strategy as meaningfully more resilient than passively viewing the solution', async () => {
    prisma.struggleEvent.findMany.mockResolvedValue([{ action: 'SWITCHED_METHOD' }]);
    const switchScore = await service.computeResilienceScore('s1');
    prisma.struggleEvent.findMany.mockResolvedValue([{ action: 'VIEWED_SOLUTION' }]);
    const viewScore = await service.computeResilienceScore('s1');
    expect(switchScore).toBeGreaterThan(viewScore);
  });

  it('a weak topic + high resilience is distinguishable from a weak topic + low resilience', async () => {
    // this is the exact distinction the doc calls out as needing different interventions
    prisma.struggleEvent.findMany.mockResolvedValue([
      { action: 'RETRIED' }, { action: 'SWITCHED_METHOD' }, { action: 'PERSISTED_TO_CORRECT' },
    ]);
    const highResilience = await service.computeResilienceScore('s1');
    prisma.struggleEvent.findMany.mockResolvedValue([{ action: 'GAVE_UP' }, { action: 'GAVE_UP' }]);
    const lowResilience = await service.computeResilienceScore('s2');
    expect(highResilience).toBeGreaterThan(0.6);
    expect(lowResilience).toBeLessThan(0.3);
  });
});
