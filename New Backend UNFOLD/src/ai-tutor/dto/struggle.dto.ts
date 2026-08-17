import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum StruggleActionDto {
  RETRIED = 'RETRIED', USED_HINT = 'USED_HINT', SWITCHED_METHOD = 'SWITCHED_METHOD',
  VIEWED_SOLUTION = 'VIEWED_SOLUTION', GAVE_UP = 'GAVE_UP', PERSISTED_TO_CORRECT = 'PERSISTED_TO_CORRECT',
}

export class LogStruggleEventDto {
  @ApiProperty() @IsString() topicId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() questionId?: string;
  @ApiProperty({ enum: StruggleActionDto }) @IsEnum(StruggleActionDto) action: StruggleActionDto;
  @ApiProperty() @IsInt() @Min(0) secondsStuckBefore: number;
}
