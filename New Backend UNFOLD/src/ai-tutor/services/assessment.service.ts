import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeakTopicDetectionService } from './weak-topic-detection.service';
import { MistakeClassificationService } from './mistake-classification.service';
import { ConfidenceCalibrationService } from './confidence-calibration.service';
import { CreditService } from './credit.service';
import { CREDIT_AMOUNTS } from '../ai-tutor.constants';

interface AnswerInput {
  questionId: string;
  selectedOptionId: string;
  timeTakenMs: number;
  workingText?: string;
  predictedConfidence?: number; // 0..1, optional — only recorded if provided
}

/**
 * Orchestrates a full quiz submission: grades each answer, classifies the
 * mistake behind every wrong one, records confidence calibration where
 * provided, folds the aggregate score into topic mastery, and pays out
 * credits. This is the concrete endpoint that makes the "mistake types"
 * and "confidence" ideas from the vision doc actually happen, rather than
 * living as disconnected services.
 */
@Injectable()
export class AssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weakTopicService: WeakTopicDetectionService,
    private readonly mistakeService: MistakeClassificationService,
    private readonly confidenceService: ConfidenceCalibrationService,
    private readonly creditService: CreditService,
  ) {}

  async submitQuizAttempt(params: { studentId: string; topicId: string; answers: AnswerInput[] }) {
    const topic = await this.prisma.topic.findUnique({ where: { id: params.topicId } });
    if (!topic) throw new NotFoundException('Topic not found');

    const questionIds = params.answers.map((a) => a.questionId);
    const questions = await this.prisma.quizQuestion.findMany({ where: { id: { in: questionIds } } });
    if (questions.length !== questionIds.length) {
      throw new NotFoundException('One or more quiz questions not found');
    }
    const correctById = new Map(questions.map((q) => [q.id, q.correctOptionId]));

    const attempt = await this.prisma.quizAttempt.create({ data: { studentId: params.studentId } });

    let correctCount = 0;
    const answerResults: Array<{ questionId: string; isCorrect: boolean; mistakeType: string }> = [];

    for (const a of params.answers) {
      const isCorrect = correctById.get(a.questionId) === a.selectedOptionId;
      if (isCorrect) correctCount++;

      const created = await this.prisma.quizAnswer.create({
        data: {
          attemptId: attempt.id,
          questionId: a.questionId,
          selectedOptionId: a.selectedOptionId,
          isCorrect,
          timeTakenMs: a.timeTakenMs,
          workingText: a.workingText,
        },
      });

      let mistakeType = 'NONE';
      if (!isCorrect) {
        const classification = await this.mistakeService.classifyAndPersist(created.id);
        mistakeType = classification.mistakeType;
      }
      answerResults.push({ questionId: a.questionId, isCorrect, mistakeType });

      if (a.predictedConfidence != null) {
        await this.confidenceService.recordOutcome({
          studentId: params.studentId,
          topicId: params.topicId,
          refType: 'QUIZ_QUESTION',
          refId: created.id,
          predictedConfidence: a.predictedConfidence,
          wasCorrect: isCorrect,
        });
      }
    }

    const score = params.answers.length > 0 ? correctCount / params.answers.length : 0;

    await this.prisma.quizAttempt.update({ where: { id: attempt.id }, data: { finishedAt: new Date(), score } });

    const masteryUpdate = await this.weakTopicService.applySignal(
      this.weakTopicService.buildSignalFromQuizAttempt({ studentId: params.studentId, topicId: params.topicId, score }),
    );

    if (correctCount > 0) {
      await this.creditService.award({
        studentId: params.studentId,
        amount: correctCount * CREDIT_AMOUNTS.QUIZ_COMPLETED_PER_CORRECT,
        reason: 'QUIZ_COMPLETED',
        refId: attempt.id,
      });
    }

    return { attemptId: attempt.id, score, correctCount, total: params.answers.length, answerResults, masteryUpdate };
  }
}
