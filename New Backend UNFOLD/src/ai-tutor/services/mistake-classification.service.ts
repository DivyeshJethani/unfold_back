import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NemotronService } from './nemotron.service';
import { MistakeClassification } from '../interfaces/scoring.interface';

/**
 * Classifies a WRONG answer into why it was wrong — concept, calculation,
 * memory, logic, or careless — because "60% and 60%" from two students can
 * mean completely different things (see the platform vision doc).
 *
 * Strategy: cheap, fast heuristics first (no network call, no cost), and
 * only fall back to Nemotron when the student left "working" text that's
 * substantial enough to be worth an LLM's judgement but the heuristic is
 * genuinely ambiguous. This keeps grading fast for the common cases (MCQ
 * guesses, blank workings) and reserves the expensive call for when it
 * actually adds signal.
 */
@Injectable()
export class MistakeClassificationService {
  private readonly logger = new Logger(MistakeClassificationService.name);

  // Rough expected-time bands; a real system would calibrate these per
  // question from historical timing data instead of a flat constant.
  private static readonly FAST_GUESS_MS = 4000;
  private static readonly FORMULA_HINTS = ['formula', '=', 'theorem', 'law of', 'identity'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly nemotron: NemotronService,
  ) {}

  /** Pure heuristic classifier — no I/O, unit-testable in isolation. */
  classifyHeuristically(input: {
    isCorrect: boolean;
    timeTakenMs: number;
    workingText?: string | null;
  }): MistakeClassification {
    if (input.isCorrect) {
      return { mistakeType: 'NONE', confidence: 1, rationale: 'Answer was correct' };
    }

    const working = (input.workingText ?? '').trim();

    // No working shown + answered very fast → looks like a guess, not a
    // reasoned (even if wrong) attempt. We call this CARELESS rather than
    // CONCEPT because we can't distinguish "didn't know" from "didn't try"
    // without more evidence — CARELESS is the safer default, and a
    // low confidence score tells the caller this is a weak inference.
    if (working.length === 0 && input.timeTakenMs < MistakeClassificationService.FAST_GUESS_MS) {
      return {
        mistakeType: 'CARELESS',
        confidence: 0.35,
        rationale: 'No working shown and answered unusually fast — looks like a rushed guess',
      };
    }

    // No working shown but took a normal/long time → they engaged with the
    // problem but couldn't produce a method at all. That's more consistent
    // with a genuine concept gap than a slip.
    if (working.length === 0) {
      return {
        mistakeType: 'CONCEPT',
        confidence: 0.4,
        rationale: 'Spent real time on the question but produced no working — possible concept gap',
      };
    }

    // Working present and mentions a formula/rule by name/symbol, but still
    // wrong → likely remembered the wrong formula, i.e. a memory slip
    // rather than not understanding the concept at all.
    const mentionsFormula = MistakeClassificationService.FORMULA_HINTS.some((h) =>
      working.toLowerCase().includes(h),
    );
    if (mentionsFormula) {
      return {
        mistakeType: 'MEMORY',
        confidence: 0.45,
        rationale: 'Working references a formula/rule, suggesting the wrong one was recalled',
      };
    }

    // Working is mostly numeric (digits, operators) → they picked a method
    // and executed it, so the error is more likely arithmetic than
    // conceptual. This is a coarse check; ambiguous cases fall through to
    // Nemotron below.
    const digitRatio = (working.match(/[0-9]/g)?.length ?? 0) / Math.max(working.length, 1);
    if (digitRatio > 0.25) {
      return {
        mistakeType: 'CALCULATION',
        confidence: 0.4,
        rationale: 'Working is numeric-heavy — likely an arithmetic/algebra slip in an otherwise reasonable method',
      };
    }

    // Ambiguous: substantial text working that doesn't clearly fall into
    // any of the above. Worth spending a Nemotron call on.
    return { mistakeType: 'LOGIC', confidence: 0.25, rationale: 'Inconclusive from heuristics alone' };
  }

  /**
   * Full classification: heuristic first; if confidence is low AND there's
   * enough free text to reason about, escalate to Nemotron for a better
   * read. Returns whichever result is more confident.
   */
  async classify(input: {
    topicName: string;
    isCorrect: boolean;
    timeTakenMs: number;
    workingText?: string | null;
  }): Promise<MistakeClassification> {
    const heuristic = this.classifyHeuristically(input);

    const worthEscalating =
      !input.isCorrect && heuristic.confidence < 0.4 && (input.workingText?.trim().length ?? 0) > 15;

    if (!worthEscalating) return heuristic;

    try {
      const evaluation = await this.nemotron.evaluateExplanation({
        topicName: input.topicName,
        studentExplanation: input.workingText!,
        mode: 'MISTAKE_CLASSIFICATION',
      });
      const firstWord = evaluation.feedbackForStudent.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z]/g, '');
      const validTypes = ['CONCEPT', 'CALCULATION', 'MEMORY', 'LOGIC', 'CARELESS'];
      const mistakeType = validTypes.includes(firstWord) ? (firstWord as MistakeClassification['mistakeType']) : heuristic.mistakeType;

      return { mistakeType, confidence: Math.max(0.5, evaluation.qualityScore), rationale: evaluation.feedbackForStudent };
    } catch (err) {
      this.logger.warn(`Nemotron mistake-classification escalation failed, falling back to heuristic: ${err}`);
      return heuristic;
    }
  }

  /**
   * Persists the classification on the QuizAnswer, then recomputes the
   * topic's dominant mistake pattern (simple majority vote over the last
   * 20 wrong answers on that topic) so TopicMastery.dominantMistakeType
   * stays current for the dashboard/timetable to read cheaply.
   */
  async classifyAndPersist(quizAnswerId: string): Promise<MistakeClassification> {
    const answer = await this.prisma.quizAnswer.findUniqueOrThrow({
      where: { id: quizAnswerId },
      include: { question: { include: { topic: true } } },
    });

    const result = await this.classify({
      topicName: answer.question.topic.name,
      isCorrect: answer.isCorrect,
      timeTakenMs: answer.timeTakenMs,
      workingText: answer.workingText,
    });

    await this.prisma.quizAnswer.update({
      where: { id: quizAnswerId },
      data: { mistakeType: result.mistakeType },
    });

    if (result.mistakeType !== 'NONE') {
      await this.recomputeDominantMistakeType(
        (await this.prisma.quizAttempt.findUniqueOrThrow({ where: { id: answer.attemptId } })).studentId,
        answer.question.topicId,
      );
    }

    return result;
  }

  private async recomputeDominantMistakeType(studentId: string, topicId: string) {
    const recentWrongAnswers = await this.prisma.quizAnswer.findMany({
      where: {
        isCorrect: false,
        mistakeType: { not: 'NONE' },
        question: { topicId },
        attempt: { studentId },
      },
      orderBy: { id: 'desc' },
      take: 20,
    });

    if (recentWrongAnswers.length === 0) return;

    const counts = new Map<string, number>();
    for (const a of recentWrongAnswers) counts.set(a.mistakeType, (counts.get(a.mistakeType) ?? 0) + 1);
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    await this.prisma.topicMastery.updateMany({
      where: { studentId, topicId },
      data: { dominantMistakeType: dominant as any },
    });
  }
}
