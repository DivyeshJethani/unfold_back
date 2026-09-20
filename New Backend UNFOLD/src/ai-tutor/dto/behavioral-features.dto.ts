import { ApiProperty } from '@nestjs/swagger';

export class VideoBehaviorFeaturesDto {
  @ApiProperty({ description: 'Total active watch time across all lectures in seconds' })
  totalWatchTimeSec: number;

  @ApiProperty({ description: 'Count of unique lectures the student has interacted with' })
  uniqueLecturesWatched: number;

  @ApiProperty({ description: 'Count of lectures fully completed' })
  completedLecturesCount: number;

  @ApiProperty({ description: 'Proportion of interacted lectures completed (0..1)' })
  completionRate: number;

  @ApiProperty({ description: 'Total count of pause events' })
  totalPauses: number;

  @ApiProperty({ description: 'Pause events per minute of active watch time' })
  pauseFrequencyPerMin: number;

  @ApiProperty({ description: 'Total count of rewind events' })
  totalRewinds: number;

  @ApiProperty({ description: 'Total count of forward / fast forward / skip events' })
  totalForwards: number;

  @ApiProperty({ description: 'Total count of direct seek / timeline jump events' })
  totalSeeks: number;

  @ApiProperty({ description: 'Total count of replay events' })
  totalReplays: number;

  @ApiProperty({ description: 'Average playback speed multiplier (e.g. 1.0, 1.25)' })
  avgPlaybackSpeed: number;

  @ApiProperty({ description: 'Rewatch / rewind tendency relative to unique lectures' })
  rewatchTendency: number;

  @ApiProperty({ description: 'Proportion of lectures ending with drop-off (0..1)' })
  dropOffRate: number;
}

export class LearningBehaviorFeaturesDto {
  @ApiProperty({ description: 'Total count of quiz attempts' })
  quizzesAttempted: number;

  @ApiProperty({ description: 'Total count of individual questions answered' })
  questionsAttempted: number;

  @ApiProperty({ description: 'Overall quiz accuracy proportion (0..1)' })
  accuracy: number;

  @ApiProperty({ description: 'Average response latency per question in milliseconds' })
  avgTimeTakenMs: number;

  @ApiProperty({ description: 'Recent accuracy across latest 10 answers (0..1)' })
  recentAccuracy: number;

  @ApiProperty({
    enum: ['IMPROVING', 'STABLE', 'DECLINING', 'INSUFFICIENT_DATA'],
    description: 'Performance trend comparison between recent and historical accuracy',
  })
  performanceTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';

  @ApiProperty({ description: 'Dominant mistake pattern across classified mistakes' })
  dominantMistakeType: string;
}

export class ConfidenceBehaviorFeaturesDto {
  @ApiProperty({ description: 'Brier calibration score (1 - Brier MSE), 0..1 where 1 is perfect' })
  calibrationScore: number;

  @ApiProperty({ description: 'Average predicted confidence self-reported prior to grading (0..1)' })
  avgPredictedConfidence: number;

  @ApiProperty({ description: 'Average actual accuracy on confidence-tracked questions (0..1)' })
  avgActualAccuracy: number;

  @ApiProperty({
    enum: ['OVERCONFIDENT', 'UNDERCONFIDENT', 'WELL_CALIBRATED', 'INSUFFICIENT_DATA'],
    description: 'Calibration bias classification',
  })
  calibrationBias: 'OVERCONFIDENT' | 'UNDERCONFIDENT' | 'WELL_CALIBRATED' | 'INSUFFICIENT_DATA';

  @ApiProperty({ description: 'Sample size of confidence records evaluated' })
  sampleSize: number;
}

export class OverallBehaviorFeaturesDto {
  @ApiProperty({ type: VideoBehaviorFeaturesDto })
  video: VideoBehaviorFeaturesDto;

  @ApiProperty({ type: LearningBehaviorFeaturesDto })
  learning: LearningBehaviorFeaturesDto;

  @ApiProperty({ type: ConfidenceBehaviorFeaturesDto })
  confidence: ConfidenceBehaviorFeaturesDto;

  @ApiProperty({ description: 'Composite engagement score (0..1)' })
  engagementScore: number;

  @ApiProperty({ description: 'Persistence / resilience score under difficulty (0..1)' })
  resilienceScore: number;
}

export class TopicBehaviorFeaturesDto {
  @ApiProperty()
  topicId: string;

  @ApiProperty()
  topicName: string;

  @ApiProperty()
  subjectId: string;

  @ApiProperty()
  subjectName: string;

  @ApiProperty({ description: 'Current EWMA topic mastery score (0..1)' })
  masteryScore: number;

  @ApiProperty({ enum: ['WEAK', 'DEVELOPING', 'PROFICIENT', 'STRONG'] })
  masteryLevel: string;

  @ApiProperty({ description: 'Whether this topic currently requires review' })
  needsReview: boolean;

  @ApiProperty({ description: 'Count of quiz attempts on this topic' })
  quizzesAttempted: number;

  @ApiProperty({ description: 'Count of questions answered on this topic' })
  questionsAttempted: number;

  @ApiProperty({ description: 'Quiz accuracy proportion on this topic (0..1)' })
  quizAccuracy: number;

  @ApiProperty({ description: 'Average time taken per question on this topic in ms' })
  avgQuestionTimeMs: number;

  @ApiProperty({ description: 'Total count of video interaction events for this topic' })
  videoEventsCount: number;

  @ApiProperty({ description: 'Video lecture completion rate for this topic (0..1)' })
  videoCompletionRate: number;

  @ApiProperty({ description: 'Rewatch / rewind frequency on this topic' })
  rewatchRate: number;

  @ApiProperty({ description: 'Topic-level struggle signal indicator (0..1)' })
  struggleSignal: number;

  @ApiProperty({ enum: ['HIGH', 'MEDIUM', 'LOW'], description: 'Engagement level on this topic' })
  engagementSignal: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class BehavioralFeaturesResponseDto {
  @ApiProperty({ description: 'Authenticated student ID' })
  studentId: string;

  @ApiProperty({ description: 'ISO timestamp when features were calculated' })
  generatedAt: string;

  @ApiProperty({ type: OverallBehaviorFeaturesDto })
  overall: OverallBehaviorFeaturesDto;

  @ApiProperty({ type: [TopicBehaviorFeaturesDto] })
  topics: TopicBehaviorFeaturesDto[];
}
