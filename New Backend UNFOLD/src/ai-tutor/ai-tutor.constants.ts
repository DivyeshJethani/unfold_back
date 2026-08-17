export const AI_TUTOR_QUEUE = 'ai-tutor-processing';

export const JOB_NAMES = {
  EVALUATE_REVISION_TEST: 'evaluate-revision-test',
  EVALUATE_PEER_TEACHING: 'evaluate-peer-teaching',
  RECOMPUTE_TOPIC_MASTERY: 'recompute-topic-mastery',
  GENERATE_TIMETABLE: 'generate-timetable',
  GENERATE_FOLLOWUP_QUESTIONS: 'generate-followup-questions',
  SCHEDULE_SPACED_RETENTION_CHECKS: 'schedule-spaced-retention-checks',
  RECOMPUTE_LEARNING_DNA: 'recompute-learning-dna',
} as const;

export const MASTERY_THRESHOLDS = {
  WEAK: 0.4,
  DEVELOPING: 0.65,
  PROFICIENT: 0.85,
};

export const MASTERY_EWMA_ALPHA = 0.35;

export const AI_TEACHBACK_ESCALATION_THRESHOLD = 2;

export const CREDIT_AMOUNTS = {
  QUIZ_COMPLETED_PER_CORRECT: 2,
  REVISION_TEST_PASSED: 10,
  TAUGHT_AI_SUCCESSFULLY: 15,
  TAUGHT_PEER_SUCCESSFULLY: 25,
  PEER_IMPROVED_BONUS: 20,
  STREAK_BONUS_PER_DAY: 5,
  WELL_CALIBRATED_CONFIDENCE: 5,
};

export const VIDEO_SIGNAL_WEIGHTS = {
  rewindDensity: 0.35,
  pauseDensity: 0.15,
  skipDensity: -0.2,
  dropOffPenalty: 0.3,
};

export const BEHAVIOR_WINDOW_DAYS = 21;

/** Days after first exposure to a topic that we schedule a memory check-in. */
export const SPACED_RETENTION_INTERVALS_DAYS = [2, 7, 30];

/** EWMA smoothing for per-format effectiveness tracking. */
export const FORMAT_EFFECTIVENESS_ALPHA = 0.4;

/**
 * Epsilon for the format recommender's explore/exploit balance: this
 * fraction of the time we deliberately try a format that *isn't* currently
 * the best-scoring one, so the system doesn't lock in a first impression
 * ("video worked once, so video forever") without re-testing.
 */
export const FORMAT_EXPLORATION_EPSILON = 0.2;

/** Minimum attempts on a format before we trust its average enough to rely on it. */
export const FORMAT_MIN_ATTEMPTS_FOR_CONFIDENCE = 3;

/** How far above a student's stated goal their trajectory must project before we suggest a stretch goal. */
export const STRETCH_GOAL_TRIGGER_MARGIN_PERCENT = 8;
