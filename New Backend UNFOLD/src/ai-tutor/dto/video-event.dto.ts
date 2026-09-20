import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export enum VideoEventTypeDto {
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  SEEK = 'SEEK',
  REWIND = 'REWIND',
  FORWARD = 'FORWARD',
  FAST_FORWARD = 'FAST_FORWARD',
  SKIP_SECTION = 'SKIP_SECTION',
  SPEED_CHANGE = 'SPEED_CHANGE',
  PROGRESS = 'PROGRESS',
  WATCH_PROGRESS = 'WATCH_PROGRESS',
  COMPLETE = 'COMPLETE',
  DROP_OFF = 'DROP_OFF',
  REPLAY = 'REPLAY',
}

export class RecordVideoEventDto {
  @ApiProperty({ enum: VideoEventTypeDto, description: 'Player event type' })
  @IsEnum(VideoEventTypeDto)
  eventType: VideoEventTypeDto;

  @ApiProperty({ description: 'Current playback position in seconds' })
  @IsInt()
  @Min(0)
  atSecond: number;

  @ApiProperty({ required: false, description: 'Target playback position in seconds (for seek/rewind/skip)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  toSecond?: number;

  @ApiProperty({ required: false, description: 'Playback speed multiplier (e.g. 1.0, 1.5, 2.0)' })
  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(5.0)
  playbackSpeed?: number;
}

