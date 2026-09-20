import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StruggleBehaviorService } from '../services/struggle-behavior.service';
import { LogStruggleEventDto } from '../dto/struggle.dto';
import { CurrentStudentId } from '../decorators/current-student.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('struggle-behavior')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('struggle')
export class StruggleController {
  constructor(private readonly struggleService: StruggleBehaviorService) {}

  @Post('events')
  @ApiOperation({ summary: 'Log a reaction to difficulty (retried, used hint, gave up, etc.)' })
  async logEvent(@CurrentStudentId() studentId: string, @Body() dto: LogStruggleEventDto) {
    return this.struggleService.logEvent({
      studentId, topicId: dto.topicId, questionId: dto.questionId,
      action: dto.action as any, secondsStuckBefore: dto.secondsStuckBefore,
    });
  }

  @Get('resilience-score')
  @ApiOperation({ summary: "Get the current student's resilience/persistence score" })
  async resilienceScore(@CurrentStudentId() studentId: string) {
    const [score, breakdown] = await Promise.all([
      this.struggleService.computeResilienceScore(studentId),
      this.struggleService.getActionBreakdown(studentId),
    ]);
    return { resilienceScore: score, breakdown };
  }
}
