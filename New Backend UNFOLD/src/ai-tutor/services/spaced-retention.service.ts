import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeakTopicDetectionService } from './weak-topic-detection.service';
import { SPACED_RETENTION_INTERVALS_DAYS } from '../ai-tutor.constants';

/**
 * Implements "test today, then again in 2 days, 7 days, 30 days" from the
 * vision doc — a proper forgetting-curve measurement instead of only
 * comparing two arbitrary revision-test attempts (which is what
 * AttentionSpanService's memoryRetentionScore approximates today). This
 * service is the scheduler + resolver; AttentionSpanService still owns the
 * single rolled-up retention number for the dashboard.
 */
@Injectable()
export class SpacedRetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weakTopicService: WeakTopicDetectionService,
  ) {}

  /** Call once, right after a student first reaches PROFICIENT+ on a topic. */
  async scheduleChecksForTopic(studentId: string, topicId: string, firstMasteredAt: Date = new Date()) {
    const rows = await Promise.all(
      SPACED_RETENTION_INTERVALS_DAYS.map((days) =>
        this.prisma.spacedRetentionCheck.create({
          data: {
            studentId,
            topicId,
            intervalDays: days,
            scheduledFor: new Date(firstMasteredAt.getTime() + days * 24 * 60 * 60 * 1000),
          },
        }),
      ),
    );
    return rows;
  }

  async getDueChecks(studentId: string) {
    return this.prisma.spacedRetentionCheck.findMany({
      where: { studentId, completedAt: null, scheduledFor: { lte: new Date() } },
      include: { topic: { include: { subject: true } } },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async resolveCheck(checkId: string, score: number) {
    const check = await this.prisma.spacedRetentionCheck.findUnique({ where: { id: checkId } });
    if (!check) throw new NotFoundException('Spaced retention check not found');

    await this.prisma.spacedRetentionCheck.update({
      where: { id: checkId },
      data: { completedAt: new Date(), score },
    });

    const masteryUpdate = await this.weakTopicService.applySignal(
      this.weakTopicService.buildSignalFromSpacedRetention({
        studentId: check.studentId,
        topicId: check.topicId,
        score,
        intervalDays: check.intervalDays,
      }),
    );

    return { check, masteryUpdate };
  }

  /** Forgetting-curve shape for one topic: score at each interval, oldest evidence first. */
  async getForgettingCurve(studentId: string, topicId: string) {
    const checks = await this.prisma.spacedRetentionCheck.findMany({
      where: { studentId, topicId, completedAt: { not: null } },
      orderBy: { intervalDays: 'asc' },
      select: { intervalDays: true, score: true, completedAt: true },
    });
    return checks;
  }
}
