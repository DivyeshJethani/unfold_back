import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TeachingFormatService } from '../services/teaching-format.service';
import { RecordFormatOutcomeDto } from '../dto/teaching-format.dto';
import { CurrentStudentId } from '../decorators/current-student.decorator';

@ApiTags('teaching-format')
@Controller('teaching-format')
export class TeachingFormatController {
  constructor(private readonly formatService: TeachingFormatService) {}

  @Get('recommend')
  @ApiOperation({ summary: 'Recommend which format (text/video/diagram/example/simulation) to teach this topic in next' })
  async recommend(@CurrentStudentId() studentId: string, @Query('topicId') topicId: string) {
    return this.formatService.recommendFormat(studentId, topicId);
  }

  @Post('outcome')
  @ApiOperation({ summary: 'Record how well a student did on the post-format check, to update the format bandit' })
  async recordOutcome(@CurrentStudentId() studentId: string, @Body() dto: RecordFormatOutcomeDto) {
    return this.formatService.recordOutcome({ studentId, topicId: dto.topicId, format: dto.format as any, score: dto.score });
  }
}
