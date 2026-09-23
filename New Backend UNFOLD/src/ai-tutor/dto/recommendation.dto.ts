import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class RecommendationSignalsDto {
  @ApiPropertyOptional({ description: 'Current mastery score on topic (0..1), null if no mastery data' })
  masteryScore: number | null;

  @ApiProperty({ description: 'Mastery level or NO_DATA', enum: ['WEAK', 'DEVELOPING', 'PROFICIENT', 'STRONG', 'NO_DATA'] })
  masteryLevel: 'WEAK' | 'DEVELOPING' | 'PROFICIENT' | 'STRONG' | 'NO_DATA';

  @ApiProperty({ description: 'Whether the topic is flagged as needing review' })
  needsReview: boolean;

  @ApiProperty({ description: 'Trajectory trend', enum: ['IMPROVING', 'DECLINING', 'STABLE', 'INSUFFICIENT_DATA'] })
  trajectoryTrend: 'IMPROVING' | 'DECLINING' | 'STABLE' | 'INSUFFICIENT_DATA';

  @ApiPropertyOptional({ description: 'Change in mastery score from prior evaluation' })
  masteryDelta?: number | null;

  @ApiPropertyOptional({ description: 'Behavioral struggle signal score (0..1)' })
  struggleSignal: number | null;

  @ApiPropertyOptional({ description: 'Video rewatch rate / rewind density' })
  rewatchRate: number | null;

  @ApiPropertyOptional({ description: 'Video completion rate (0..1)' })
  completionRate: number | null;

  @ApiPropertyOptional({ description: 'Recent quiz accuracy (0..1)' })
  recentAccuracy: number | null;

  @ApiPropertyOptional({ description: 'Dominant mistake classification if any' })
  dominantMistakeType: string | null;

  @ApiPropertyOptional({ description: "Student's preferred teaching format if known" })
  preferredFormat: string | null;

  @ApiProperty({ description: 'Whether sufficient learner evidence exists for this topic' })
  hasSufficientData: boolean;
}

export class RecommendationScoreBreakdownDto {
  @ApiProperty({ description: 'Curricular progression base relevance (0.10..0.40)' })
  baseRelevance: number;

  @ApiProperty({ description: 'Signal contribution from low mastery (0..0.35)' })
  weakTopicSignal: number;

  @ApiProperty({ description: 'Urgency bonus if flagged for review (0 or 0.20)' })
  reviewUrgency: number;

  @ApiProperty({ description: 'Longitudinal trajectory bonus or decay penalty (-0.05..0.15)' })
  trajectorySignal: number;

  @ApiProperty({ description: 'Telemetry struggle bonus (0..0.25)' })
  behavioralStruggleSignal: number;

  @ApiProperty({ description: 'Bonus for matching preferred format (0 or 0.10)' })
  formatMatchBonus: number;

  @ApiProperty({ description: 'Penalty if topic is already proficient/mastered (0..0.45)' })
  masteredPenalty: number;

  @ApiProperty({ description: 'Final clamped priority score (0..1)' })
  finalScore: number;
}

export class RecommendationItemDto {
  @ApiProperty({ description: 'Unique identifier for the recommendation' })
  id: string;

  @ApiProperty({ description: 'Associated topic ID' })
  topicId: string;

  @ApiProperty({ description: 'Associated topic title/name' })
  topicName: string;

  @ApiProperty({ description: 'Associated subject ID' })
  subjectId: string;

  @ApiProperty({ description: 'Associated subject title/name' })
  subjectName: string;

  @ApiProperty({
    description: 'Type of recommended activity',
    enum: ['LECTURE', 'PRACTICE_QUIZ', 'TEACHING_CONTENT', 'REVIEW'],
  })
  activityType: 'LECTURE' | 'PRACTICE_QUIZ' | 'TEACHING_CONTENT' | 'REVIEW';

  @ApiPropertyOptional({ description: 'ID of the specific curriculum resource if available' })
  resourceId: string | null;

  @ApiProperty({ description: 'Title of the recommended resource/activity' })
  resourceTitle: string;

  @ApiProperty({
    description: 'Type of resource',
    enum: ['VIDEO', 'QUIZ', 'TEXT', 'DIAGRAM', 'SIMULATION', 'EXAMPLE', 'CONCEPT_STUDY'],
  })
  resourceType: string;

  @ApiProperty({ description: 'Recommendation priority score between 0 and 1' })
  score: number;

  @ApiProperty({ description: 'Alias for score (0..1) for frontend display' })
  priority: number;

  @ApiProperty({ description: 'Deterministic explainable rationale explaining WHY this was recommended' })
  rationale: string;

  @ApiProperty({ description: 'Alias for rationale for frontend display' })
  reason: string;

  @ApiProperty({ type: RecommendationSignalsDto, description: 'Learner signals contributing to recommendation' })
  signals: RecommendationSignalsDto;

  @ApiPropertyOptional({ type: RecommendationScoreBreakdownDto, description: 'Transparent mathematical score breakdown' })
  scoreBreakdown?: RecommendationScoreBreakdownDto;
}

export class RecommendationQueryDto {
  @ApiPropertyOptional({ description: 'Maximum number of recommendations to return', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;

  @ApiPropertyOptional({ description: 'Filter recommendations by subject ID' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ description: 'Filter recommendations by topic ID' })
  @IsOptional()
  @IsString()
  topicId?: string;
}
