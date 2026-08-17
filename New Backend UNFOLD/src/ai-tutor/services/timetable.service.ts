import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttentionSpanService } from './attention-span.service';
import { WeakTopicDetectionService } from './weak-topic-detection.service';

export interface TimetableBlock {
  subjectId: string; subjectName: string; topicId: string; topicName: string;
  startMinute: number; durationMinutes: number;
  reason: 'WEAK_TOPIC_REVIEW' | 'SPACED_REVIEW' | 'NEW_LECTURE' | 'REVISION_TEST';
}

export interface DailyTimetable {
  studentId: string; date: string; windowStartHour: number; windowEndHour: number;
  blocks: TimetableBlock[]; breakMinutes: number;
}

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attentionService: AttentionSpanService,
    private readonly weakTopicService: WeakTopicDetectionService,
  ) {}

  async generateDailyTimetable(studentId: string, date: Date = new Date()): Promise<DailyTimetable> {
    const [profile, weakTopics] = await Promise.all([
      this.getOrComputeProfile(studentId),
      this.weakTopicService.listWeakTopicsForStudent(studentId),
    ]);

    const blockMinutes = Math.min(45, Math.max(10, Math.round(profile.estimatedAttentionSpanSec / 60)));
    const breakMinutes = Math.round(5 + (1 - profile.memoryRetentionScore) * 10);

    const windowStartHour = profile.bestFocusWindowStart ?? 16;
    const windowEndHour = profile.bestFocusWindowEnd != null
      ? profile.bestFocusWindowStart! < profile.bestFocusWindowEnd
        ? profile.bestFocusWindowStart! + 3
        : profile.bestFocusWindowEnd
      : 19;

    const totalMinutesAvailable = Math.max(30, (windowEndHour - windowStartHour) * 60);

    const blocks: TimetableBlock[] = [];
    let cursor = 0;

    const topWeak = weakTopics.slice(0, 4);
    for (const wt of topWeak) {
      if (cursor + blockMinutes > totalMinutesAvailable) break;
      blocks.push({
        subjectId: wt.topic.subjectId, subjectName: wt.topic.subject.name,
        topicId: wt.topicId, topicName: wt.topic.name,
        startMinute: cursor, durationMinutes: blockMinutes, reason: 'WEAK_TOPIC_REVIEW',
      });
      cursor += blockMinutes + breakMinutes;
    }

    if (cursor < totalMinutesAvailable) {
      const dueForReview = await this.prisma.topicMastery.findMany({
        where: {
          studentId, needsReview: false,
          lastEvaluatedAt: { lt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        },
        include: { topic: { include: { subject: true } } },
        orderBy: { lastEvaluatedAt: 'asc' },
        take: 2,
      });

      for (const t of dueForReview) {
        if (cursor + blockMinutes > totalMinutesAvailable) break;
        blocks.push({
          subjectId: t.topic.subjectId, subjectName: t.topic.subject.name,
          topicId: t.topicId, topicName: t.topic.name,
          startMinute: cursor, durationMinutes: Math.round(blockMinutes * 0.6), reason: 'SPACED_REVIEW',
        });
        cursor += Math.round(blockMinutes * 0.6) + breakMinutes;
      }
    }

    return { studentId, date: date.toISOString().slice(0, 10), windowStartHour, windowEndHour, blocks, breakMinutes };
  }

  private async getOrComputeProfile(studentId: string) {
    const existing = await this.prisma.attentionProfile.findUnique({ where: { studentId } });
    if (existing) return existing;
    return this.attentionService.recomputeForStudent(studentId);
  }
}
