export interface VideoEngagementSummary {
  lectureId: string;
  studentId: string;
  totalDurationSec: number;
  watchedSec: number;
  rewindCount: number;
  rewindRegions: Array<{ fromSec: number; toSec: number; count: number }>;
  pauseCount: number;
  longPauseCount: number;
  skipCount: number;
  skippedRegions: Array<{ fromSec: number; toSec: number }>;
  completed: boolean;
  droppedOffAtSec: number | null;
}

export interface WeaknessSignal {
  source: 'EXAM' | 'QUIZ' | 'VIDEO' | 'REVISION_TEST' | 'PEER_TEACHING' | 'SPACED_RETENTION';
  topicId: string;
  studentId: string;
  strengthDelta: number;
  confidence: number;
  occurredAt: Date;
  meta?: Record<string, unknown>;
}

export interface TopicMasteryUpdateResult {
  studentId: string;
  topicId: string;
  previousScore: number;
  newScore: number;
  previousLevel: string;
  newLevel: string;
  needsReview: boolean;
  triggeredAiTeachback: boolean;
  triggeredPeerEscalation: boolean;
}

export interface NemotronEvaluationRequest {
  topicName: string;
  referenceExplanation?: string;
  studentExplanation: string;
  mode: 'TEACHBACK_EVALUATION' | 'REVISION_TEST_GRADING' | 'FOLLOWUP_GENERATION' | 'MISTAKE_CLASSIFICATION';
}

export interface NemotronEvaluationResult {
  qualityScore: number;
  conceptsCovered: string[];
  conceptsMissed: string[];
  misconceptions: string[];
  feedbackForStudent: string;
  followUpQuestions?: string[];
  raw?: unknown;
}

export interface AttentionEstimate {
  studentId: string;
  estimatedAttentionSpanSec: number;
  memoryRetentionScore: number;
  bestFocusWindowStart: number | null;
  bestFocusWindowEnd: number | null;
}

/** A single classified mistake, independent of the raw right/wrong grading. */
export interface MistakeClassification {
  mistakeType: 'NONE' | 'CONCEPT' | 'CALCULATION' | 'MEMORY' | 'LOGIC' | 'CARELESS';
  confidence: number; // 0..1, how sure the classifier is
  rationale: string;
}

export interface LearningDnaSnapshot {
  studentId: string;
  learningSpeed: number;
  memoryRetention: number;
  attentionSpanSec: number;
  problemSolvingScore: number;
  confidenceCalibration: number;
  resilienceScore: number;
  preferredFormat: 'TEXT' | 'VIDEO' | 'DIAGRAM' | 'EXAMPLE' | 'SIMULATION' | null;
  dominantMistakePattern: 'CONCEPT' | 'CALCULATION' | 'MEMORY' | 'LOGIC' | 'CARELESS' | null;
  summary: string;
}
