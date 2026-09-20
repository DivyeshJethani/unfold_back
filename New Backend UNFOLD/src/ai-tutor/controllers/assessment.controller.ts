import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentService } from '../services/assessment.service';
import { SubmitQuizAttemptDto } from '../dto/assessment.dto';
import { CurrentStudentId } from '../decorators/current-student.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('assessment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assessment')
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Post('quiz-attempts')
  @ApiOperation({
    summary:
      'Submit a full quiz attempt — grades each answer, classifies the mistake type behind wrong ' +
      'ones, records confidence calibration where provided, updates mastery, and pays credits.',
  })
  async submit(@CurrentStudentId() studentId: string, @Body() dto: SubmitQuizAttemptDto) {
    return this.assessmentService.submitQuizAttempt({ studentId, topicId: dto.topicId, answers: dto.answers });
  }
}
