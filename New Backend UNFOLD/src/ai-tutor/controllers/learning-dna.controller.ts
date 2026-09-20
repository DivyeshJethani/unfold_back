import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { LearningDnaService } from '../services/learning-dna.service';
import { CurrentStudentId } from '../decorators/current-student.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('learning-dna')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('learning-dna')
export class LearningDnaController {
  constructor(private readonly learningDnaService: LearningDnaService) {}

  @Get('profile')
  @ApiOperation({ summary: "Recompute and return the current student's full Learning DNA profile" })
  async profile(@CurrentStudentId() studentId: string) {
    return this.learningDnaService.recompute(studentId);
  }

  @Get('history')
  @ApiOperation({ summary: "Get authenticated student's topic mastery evaluation history" })
  @ApiQuery({ name: 'topicId', required: false, type: String })
  async history(
    @CurrentStudentId() studentId: string,
    @Query('topicId') topicId?: string,
  ) {
    return this.learningDnaService.getMasteryHistory(studentId, topicId);
  }

  @Get('trajectory')
  @ApiOperation({ summary: "Get longitudinal mastery trajectory analysis for the authenticated student" })
  async trajectory(@CurrentStudentId() studentId: string) {
    return this.learningDnaService.getLongitudinalSignals(studentId);
  }
}

