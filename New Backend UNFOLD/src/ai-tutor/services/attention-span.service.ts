import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttentionEstimate } from '../interfaces/scoring.interface';
import { BEHAVIOR_WINDOW_DAYS } from '../ai-tutor.constants';

@Injectable()
export class AttentionSpanService {
  private readonly logger = new Logger(AttentionSpanService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recomputeForStudent(studentId: string): Promise<AttentionEstimate> {
    const since = new Date(Date.now() - BEHAVIOR_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const events = await this.prisma.videoInteractionEvent.findMany({
      where: { studentId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const attentionSpanSec = this.estimateAttentionSpan(events);
    const memoryRetentionScore = await this.estimateMemoryRetention(studentId, since);
    const { start, end } = this.estimateBestFocusWindow(events);

    await this.prisma.attentionProfile.upsert({
      where: { studentId },
      create: {
        studentId, estimatedAttentionSpanSec: attentionSpanSec, memoryRetentionScore,
        bestFocusWindowStart: start, bestFocusWindowEnd: end,
      },
      update: {
        estimatedAttentionSpanSec: attentionSpanSec, memoryRetentionScore,
        bestFocusWindowStart: start, bestFocusWindowEnd: end,
      },
    });

    return { studentId, estimatedAttentionSpanSec: attentionSpanSec, memoryRetentionScore, bestFocusWindowStart: start, bestFocusWindowEnd: end };
  }

  private estimateAttentionSpan(events: Array<{ eventType: string; atSecond: number; createdAt: Date }>): number {
    if (events.length === 0) return 900;

    const sessions: (typeof events)[] = [];
    let current: typeof events = [];
    let lastTs = 0;

    for (const e of events) {
      const ts = e.createdAt.getTime();
      if (current.length > 0 && ts - lastTs > 20 * 60 * 1000) {
        sessions.push(current);
        current = [];
      }
      current.push(e);
      lastTs = ts;
    }
    if (current.length) sessions.push(current);

    const degradationTimes: number[] = [];

    for (const session of sessions) {
      const start = session[0].createdAt.getTime();
      let seekBurst: Date[] = [];

      for (let i = 0; i < session.length; i++) {
        const e = session[i];

        if (e.eventType === 'DROP_OFF') {
          degradationTimes.push((e.createdAt.getTime() - start) / 1000);
          break;
        }
        if (e.eventType === 'PAUSE') {
          const next = session[i + 1];
          if (next && next.eventType === 'PLAY') {
            const gapSec = (next.createdAt.getTime() - e.createdAt.getTime()) / 1000;
            if (gapSec > 15) {
              degradationTimes.push((e.createdAt.getTime() - start) / 1000);
              break;
            }
          }
        }
        if (e.eventType === 'REWIND' || e.eventType === 'FAST_FORWARD') {
          seekBurst.push(e.createdAt);
          seekBurst = seekBurst.filter((d) => e.createdAt.getTime() - d.getTime() <= 30_000);
          if (seekBurst.length >= 3) {
            degradationTimes.push((e.createdAt.getTime() - start) / 1000);
            break;
          }
        }
      }
    }

    if (degradationTimes.length === 0) return 900;
    return Math.round(this.median(degradationTimes));
  }

  private async estimateMemoryRetention(studentId: string, since: Date): Promise<number> {
    const tests = await this.prisma.revisionTest.findMany({
      where: { studentId, createdAt: { gte: since }, score: { not: null } },
      orderBy: { createdAt: 'asc' },
      select: { lectureId: true, score: true, createdAt: true },
    });

    const byLecture = new Map<string, typeof tests>();
    for (const t of tests) {
      const arr = byLecture.get(t.lectureId) ?? [];
      arr.push(t);
      byLecture.set(t.lectureId, arr);
    }

    const ratios: number[] = [];
    for (const arr of byLecture.values()) {
      if (arr.length < 2) continue;
      const first = arr[0].score as number;
      const last = arr[arr.length - 1].score as number;
      if (first > 0) ratios.push(Math.min(1, last / first));
    }

    if (ratios.length === 0) return 0.5;
    return Number((ratios.reduce((a, b) => a + b, 0) / ratios.length).toFixed(2));
  }

  private estimateBestFocusWindow(events: Array<{ eventType: string; createdAt: Date }>): { start: number | null; end: number | null } {
    const completionsByHour = new Array(24).fill(0);
    const totalByHour = new Array(24).fill(0);

    for (const e of events) {
      const hour = e.createdAt.getHours();
      if (e.eventType === 'COMPLETE') completionsByHour[hour]++;
      if (e.eventType === 'PLAY') totalByHour[hour]++;
    }

    let bestHour = -1;
    let bestRate = -1;
    for (let h = 0; h < 24; h++) {
      if (totalByHour[h] < 2) continue;
      const rate = completionsByHour[h] / totalByHour[h];
      if (rate > bestRate) { bestRate = rate; bestHour = h; }
    }

    if (bestHour === -1) return { start: null, end: null };
    return { start: bestHour, end: (bestHour + 2) % 24 };
  }

  private median(nums: number[]): number {
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }
}
