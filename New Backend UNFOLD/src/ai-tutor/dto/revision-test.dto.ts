import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class RevisionTestResponseItemDto {
  @ApiProperty() questionId: string;
  @ApiProperty() @IsString() selectedOptionId: string;
}

export class SubmitRevisionTestDto {
  @ApiProperty({ type: [RevisionTestResponseItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => RevisionTestResponseItemDto)
  responses: RevisionTestResponseItemDto[];

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  freeTextExplanation?: string;
}
