import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FORMAT_EFFECTIVENESS_ALPHA,
  FORMAT_EXPLORATION_EPSILON,
  FORMAT_MIN_ATTEMPTS_FOR_CONFIDENCE,
} from '../ai-tutor.constants';

const ALL_FORMATS = ['TEXT', 'VIDEO', 'DIAGRAM', 'EXAMPLE', 'SIMULATION'] as const;
type Format = (typeof ALL_FORMATS)[number];

/**
 * Instead of asking "are you a visual learner?", we actually serve the same
 * concept through different formats and measure the result — this is a
 * simple multi-armed-bandit: each format is an "arm", its avgScore (EWMA of
 * post-format check performance) is its estimated value, and we balance
 * exploiting the best-known format against continuing to explore the
 * others (a student's best format can change per-subject, or over time).
 */
@Injectable()
export class TeachingFormatService {
  constructor(private readonly prisma: PrismaService) {}

  async recordOutcome(params: { studentId: string; topicId: string; format: Format; score: number }) {
    const existing = await this.prisma.formatEffectiveness.findUnique({
      where: { studentId_topicId_format: { studentId: params.studentId, topicId: params.topicId, format: params.format as any } },
    });

    const prevAvg = existing?.avgScore ?? 0.5;
    const newAvg = prevAvg + FORMAT_EFFECTIVENESS_ALPHA * (params.score - prevAvg);

    return this.prisma.formatEffectiveness.upsert({
      where: { studentId_topicId_format: { studentId: params.studentId, topicId: params.topicId, format: params.format as any } },
      create: { studentId: params.studentId, topicId: params.topicId, format: params.format as any, attempts: 1, avgScore: params.score },
      update: { attempts: { increment: 1 }, avgScore: newAvg, lastUsedAt: new Date() },
    });
  }

  /**
   * Epsilon-greedy recommendation:
   *  - if a format has literally never been tried for this student+topic,
   *    try it first (cold start needs coverage before comparison means anything)
   *  - otherwise, with probability epsilon, deliberately explore a
   *    non-best format (so a lucky first result doesn't lock in forever)
   *  - otherwise, exploit: return the highest-avgScore format among those
   *    with enough attempts to be trustworthy
   */
  async recommendFormat(studentId: string, topicId: string): Promise<{ format: Format; reason: string }> {
    const rows = await this.prisma.formatEffectiveness.findMany({ where: { studentId, topicId } });
    const triedFormats = new Set(rows.map((r) => r.format as Format));

    const untried = ALL_FORMATS.filter((f) => !triedFormats.has(f));
    if (untried.length > 0) {
      return { format: untried[0], reason: 'Not yet tried for this student/topic — exploring for coverage' };
    }

    if (Math.random() < FORMAT_EXPLORATION_EPSILON) {
      const randomFormat = ALL_FORMATS[Math.floor(Math.random() * ALL_FORMATS.length)];
      return { format: randomFormat, reason: 'Exploration step — re-testing to avoid locking in too early' };
    }

    const trustworthy = rows.filter((r) => r.attempts >= FORMAT_MIN_ATTEMPTS_FOR_CONFIDENCE);
    const pool = trustworthy.length > 0 ? trustworthy : rows;
    const best = pool.sort((a, b) => b.avgScore - a.avgScore)[0];

    return { format: (best?.format as Format) ?? 'TEXT', reason: 'Best-performing format so far for this student/topic' };
  }

  /** Aggregate across all topics — used by the Learning DNA profile's "preferredFormat" trait. */
  async getOverallPreferredFormat(studentId: string): Promise<Format | null> {
    const rows = await this.prisma.formatEffectiveness.findMany({
      where: { studentId, attempts: { gte: FORMAT_MIN_ATTEMPTS_FOR_CONFIDENCE } },
    });
    if (rows.length === 0) return null;

    const byFormat = new Map<Format, { total: number; count: number }>();
    for (const r of rows) {
      const cur = byFormat.get(r.format as Format) ?? { total: 0, count: 0 };
      cur.total += r.avgScore;
      cur.count += 1;
      byFormat.set(r.format as Format, cur);
    }

    let best: Format | null = null;
    let bestAvg = -1;
    for (const [format, { total, count }] of byFormat.entries()) {
      const avg = total / count;
      if (avg > bestAvg) { bestAvg = avg; best = format; }
    }
    return best;
  }
}
