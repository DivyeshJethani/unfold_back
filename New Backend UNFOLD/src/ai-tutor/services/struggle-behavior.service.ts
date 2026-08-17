import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BEHAVIOR_WINDOW_DAYS } from '../ai-tutor.constants';

const ACTION_WEIGHTS: Record<string, number> = {
  PERSISTED_TO_CORRECT: 1.0, // kept working and got there unaided — the strongest positive signal
  SWITCHED_METHOD: 0.7,      // adaptive: recognized the first approach wasn't working
  RETRIED: 0.6,               // tried again without changing approach — some persistence
  USED_HINT: 0.5,             // healthy self-regulation, not penalized, not rewarded either
  VIEWED_SOLUTION: 0.3,       // leans toward avoidance, but not treated as failure
  GAVE_UP: 0.0,                // the only clearly negative outcome
};

/**
 * "What does a student do when they get stuck?" — logged as one event per
 * observed reaction, independent of whether they eventually got the right
 * answer. This produces a resilience/persistence score that's meant to sit
 * alongside mastery, not replace it: a student can be WEAK on a topic but
 * HIGH resilience (they keep trying, they just need more time), which is a
 * very different intervention than WEAK + low resilience (they give up
 * fast and need confidence-building before more content).
 */
@Injectable()
export class StruggleBehaviorService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(params: {
    studentId: string;
    topicId: string;
    questionId?: string;
    action: keyof typeof ACTION_WEIGHTS;
    secondsStuckBefore: number;
  }) {
    return this.prisma.struggleEvent.create({
      data: {
        studentId: params.studentId,
        topicId: params.topicId,
        questionId: params.questionId,
        action: params.action as any,
        secondsStuckBefore: params.secondsStuckBefore,
      },
    });
  }

  async computeResilienceScore(studentId: string, windowDays = BEHAVIOR_WINDOW_DAYS): Promise<number> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const events = await this.prisma.struggleEvent.findMany({
      where: { studentId, createdAt: { gte: since } },
    });

    if (events.length === 0) return 0.5; // neutral prior, not enough evidence yet

    const total = events.reduce((sum, e) => sum + (ACTION_WEIGHTS[e.action] ?? 0.5), 0);
    return Number((total / events.length).toFixed(2));
  }

  /** Breakdown by action type — useful for the dashboard ("you use hints a lot but rarely give up"). */
  async getActionBreakdown(studentId: string, windowDays = BEHAVIOR_WINDOW_DAYS) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const events = await this.prisma.struggleEvent.findMany({ where: { studentId, createdAt: { gte: since } } });

    const counts: Record<string, number> = {};
    for (const e of events) counts[e.action] = (counts[e.action] ?? 0) + 1;
    return counts;
  }
}
