import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsString, Max, Min } from 'class-validator';

export enum TeachingFormatDto {
  TEXT = 'TEXT', VIDEO = 'VIDEO', DIAGRAM = 'DIAGRAM', EXAMPLE = 'EXAMPLE', SIMULATION = 'SIMULATION',
}

export class RecordFormatOutcomeDto {
  @ApiProperty() @IsString() topicId: string;
  @ApiProperty({ enum: TeachingFormatDto }) @IsEnum(TeachingFormatDto) format: TeachingFormatDto;
  @ApiProperty({ description: 'Post-format check score, 0..1' }) @IsNumber() @Min(0) @Max(1) score: number;
}
