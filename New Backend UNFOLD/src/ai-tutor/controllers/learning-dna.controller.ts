import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LearningDnaService } from '../services/learning-dna.service';
import { CurrentStudentId } from '../decorators/current-student.decorator';

@ApiTags('learning-dna')
@Controller('learning-dna')
export class LearningDnaController {
  constructor(private readonly learningDnaService: LearningDnaService) {}

  @Get('profile')
  @ApiOperation({ summary: "Recompute and return the current student's full Learning DNA profile" })
  async profile(@CurrentStudentId() studentId: string) {
    return this.learningDnaService.recompute(studentId);
  }
}
