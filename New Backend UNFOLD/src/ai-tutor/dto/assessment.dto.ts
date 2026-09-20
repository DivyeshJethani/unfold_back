import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class QuizAnswerInputDto {
  @ApiProperty({ description: 'UUID or ID of the quiz question' })
  @IsString()
  questionId: string;

  @ApiProperty({ description: 'ID of the selected option (e.g. opt-a)' })
  @IsString()
  selectedOptionId: string;

  @ApiProperty({ description: 'Time taken in milliseconds to answer the question' })
  @IsInt()
  @Min(0)
  timeTakenMs: number;

  @ApiProperty({ required: false, description: 'Free-text working — enables mistake-type classification when wrong' })
  @IsOptional()
  @IsString()
  workingText?: string;

  @ApiProperty({ required: false, description: '0..1 self-reported confidence, captured before grading' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  predictedConfidence?: number;
}

export class SubmitQuizAttemptDto {
  @ApiProperty({ description: 'UUID or ID of the topic being assessed' })
  @IsString()
  topicId: string;

  @ApiProperty({ type: [QuizAnswerInputDto], description: 'List of answered quiz questions' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInputDto)
  answers: QuizAnswerInputDto[];
}

