import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SpacedRetentionService } from '../services/spaced-retention.service';
import { CurrentStudentId } from '../decorators/current-student.decorator';

@ApiTags('spaced-retention')
@Controller('spaced-retention')
export class SpacedRetentionController {
  constructor(private readonly spacedRetentionService: SpacedRetentionService) {}

  @Get('due')
  @ApiOperation({ summary: "List the current student's due memory check-ins (2/7/30-day schedule)" })
  async due(@CurrentStudentId() studentId: string) {
    return this.spacedRetentionService.getDueChecks(studentId);
  }

  @Post(':checkId/resolve')
  @ApiOperation({ summary: 'Submit the result of a spaced-retention check-in' })
  async resolve(@Param('checkId') checkId: string, @Body() body: { score: number }) {
    return this.spacedRetentionService.resolveCheck(checkId, body.score);
  }

  @Get('forgetting-curve')
  @ApiOperation({ summary: 'Get the recorded 2/7/30-day scores for one topic (the actual forgetting curve shape)' })
  async curve(@CurrentStudentId() studentId: string, @Query('topicId') topicId: string) {
    return this.spacedRetentionService.getForgettingCurve(studentId, topicId);
  }
}
