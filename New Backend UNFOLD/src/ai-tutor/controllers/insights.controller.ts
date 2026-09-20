import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { WeakTopicDetectionService } from '../services/weak-topic-detection.service';
import { TimetableService } from '../services/timetable.service';
import { AttentionSpanService } from '../services/attention-span.service';
import { BehavioralFeatureService } from '../services/behavioral-feature.service';
import { CurrentStudentId } from '../decorators/current-student.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BehavioralFeaturesResponseDto } from '../dto/behavioral-features.dto';

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(
    private readonly weakTopicService: WeakTopicDetectionService,
    private readonly timetableService: TimetableService,
    private readonly attentionService: AttentionSpanService,
    private readonly behavioralService: BehavioralFeatureService,
  ) {}

  @Get('behavior')
  @ApiOperation({ summary: "Extract and return the current student's fine-grained behavioral features" })
  @ApiResponse({ status: 200, type: BehavioralFeaturesResponseDto, description: 'Aggregated behavioral features' })
  async behavior(@CurrentStudentId() studentId: string) {
    return this.behavioralService.extractFeaturesForStudent(studentId);
  }

  @Get('behavioral-features')
  @ApiOperation({ summary: "Alias for GET /insights/behavior" })
  @ApiResponse({ status: 200, type: BehavioralFeaturesResponseDto })
  async behavioralFeatures(@CurrentStudentId() studentId: string) {
    return this.behavioralService.extractFeaturesForStudent(studentId);
  }

  @Get('weak-topics')
  @ApiOperation({ summary: "List the current student's weak topics, weakest first" })
  async weakTopics(@CurrentStudentId() studentId: string) { return this.weakTopicService.listWeakTopicsForStudent(studentId); }

  @Get('attention-profile')
  @ApiOperation({ summary: "Get the current student's attention/memory profile" })
  async attentionProfile(@CurrentStudentId() studentId: string) { return this.attentionService.recomputeForStudent(studentId); }

  @Get('timetable')
  @ApiOperation({ summary: "Generate today's personalized study timetable" })
  async timetable(@CurrentStudentId() studentId: string, @Query('date') date?: string) {
    return this.timetableService.generateDailyTimetable(studentId, date ? new Date(date) : undefined);
  }
}

