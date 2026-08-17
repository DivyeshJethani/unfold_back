import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StretchGoalService } from '../services/stretch-goal.service';
import { EvaluateStretchGoalDto } from '../dto/stretch-goal.dto';
import { CurrentStudentId } from '../decorators/current-student.decorator';

@ApiTags('stretch-goals')
@Controller('stretch-goals')
export class StretchGoalController {
  constructor(private readonly stretchGoalService: StretchGoalService) {}

  @Post('evaluate')
  @ApiOperation({ summary: 'Check whether the student is tracking meaningfully above their stated goal' })
  async evaluate(@CurrentStudentId() studentId: string, @Body() dto: EvaluateStretchGoalDto) {
    return this.stretchGoalService.evaluate(studentId, dto.subjectId, dto.originalGoalPercent);
  }

  @Post(':id/respond')
  @ApiOperation({ summary: 'Accept or decline a suggested stretch goal' })
  async respond(@Param('id') id: string, @Body() body: { accept: boolean }) {
    return this.stretchGoalService.respond(id, body.accept);
  }

  @Get('mine')
  @ApiOperation({ summary: "List the current student's stretch goals" })
  async mine(@CurrentStudentId() studentId: string) {
    return this.stretchGoalService.listForStudent(studentId);
  }
}
