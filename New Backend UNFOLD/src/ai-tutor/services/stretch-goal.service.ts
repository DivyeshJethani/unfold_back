import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { STRETCH_GOAL_TRIGGER_MARGIN_PERCENT } from '../ai-tutor.constants';

/**
 * "You've reached your goal — want to aim higher?" per the vision doc.
 * Deliberately simple and honest about it: we compare the student's
 * CURRENT average mastery across the subject's topics against their stated
 * goal. If they're already meaningfully ahead of what they asked for, we
 * suggest a stretch target. This is a snapshot comparison, not a trend
 * projection (a true trajectory projection needs mastery-score history
 * over time, which — same caveat as learningSpeed in LearningDnaService —
 * we don't store yet). Framed as an invitation, never a requirement.
 */
@Injectable()
export class StretchGoalService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(studentId: string, subjectId: string, originalGoalPercent: number) {
    const masteryRows = await this.prisma.topicMastery.findMany({
      where: { studentId, topic: { subjectId } },
    });

    if (masteryRows.length === 0) {
      return { suggested: false, reason: 'Not enough data on this subject yet' };
    }

    const avgMasteryPercent = (masteryRows.reduce((s, r) => s + r.masteryScore, 0) / masteryRows.length) * 100;

    if (avgMasteryPercent < originalGoalPercent + STRETCH_GOAL_TRIGGER_MARGIN_PERCENT) {
      return { suggested: false, projectedCapabilityPercent: Math.round(avgMasteryPercent) };
    }

    const goal = await this.prisma.stretchGoal.create({
      data: {
        studentId,
        subjectId,
        originalGoalPercent,
        projectedCapabilityPercent: avgMasteryPercent,
      },
    });

    return { suggested: true, goal, projectedCapabilityPercent: Math.round(avgMasteryPercent) };
  }

  async respond(stretchGoalId: string, accept: boolean) {
    return this.prisma.stretchGoal.update({
      where: { id: stretchGoalId },
      data: { status: accept ? 'ACCEPTED' : 'DECLINED', resolvedAt: new Date() },
    });
  }

  async listForStudent(studentId: string) {
    return this.prisma.stretchGoal.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' } });
  }
}
