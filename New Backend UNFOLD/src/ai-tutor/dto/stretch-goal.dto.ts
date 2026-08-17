import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, Min } from 'class-validator';

export class EvaluateStretchGoalDto {
  @ApiProperty() @IsString() subjectId: string;
  @ApiProperty({ description: 'The percentage goal the student stated, e.g. 80' })
  @IsNumber() @Min(0) @Max(100) originalGoalPercent: number;
}
