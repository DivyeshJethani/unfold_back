import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SubmitAiTeachbackDto {
  @ApiProperty() topicId: string;
  @ApiProperty() @IsString() @MinLength(20, { message: 'Explanation is too short to evaluate meaningfully' }) explanation: string;
}

export class ResolvePeerSessionDto {
  @ApiProperty() tuteePostSessionScore: number;
}

export class RedeemRewardDto {
  @ApiProperty() rewardItemId: string;
}
