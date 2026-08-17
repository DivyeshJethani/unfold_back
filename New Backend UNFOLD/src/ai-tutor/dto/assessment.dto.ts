import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class QuizAnswerInputDto {
  @ApiProperty() @IsString() questionId: string;
  @ApiProperty() @IsString() selectedOptionId: string;
  @ApiProperty() @IsInt() @Min(0) timeTakenMs: number;

  @ApiProperty({ required: false, description: 'Free-text working — enables mistake-type classification when wrong' })
  @IsOptional() @IsString() workingText?: string;

  @ApiProperty({ required: false, description: '0..1 self-reported confidence, captured before grading' })
  @IsOptional() @IsNumber() @Min(0) @Max(1) predictedConfidence?: number;
}

export class SubmitQuizAttemptDto {
  @ApiProperty() @IsString() topicId: string;
  @ApiProperty({ type: [QuizAnswerInputDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuizAnswerInputDto)
  answers: QuizAnswerInputDto[];
}
