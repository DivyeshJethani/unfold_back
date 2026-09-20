import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CurriculumService } from './curriculum.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('curriculum')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @Get('subjects')
  @ApiOperation({ summary: 'List all subjects with topic counts' })
  @ApiResponse({ status: 200, description: 'List of subjects retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - valid JWT token required' })
  async getSubjects() {
    return this.curriculumService.findAllSubjects();
  }

  @Get('subjects/:subjectId')
  @ApiOperation({ summary: 'Get subject details by ID including topic list' })
  @ApiResponse({ status: 200, description: 'Subject details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - valid JWT token required' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  async getSubjectById(@Param('subjectId') subjectId: string) {
    return this.curriculumService.findSubjectById(subjectId);
  }

  @Get('subjects/:subjectId/topics')
  @ApiOperation({ summary: 'List all topics for a specific subject' })
  @ApiResponse({ status: 200, description: 'Topics for subject retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - valid JWT token required' })
  @ApiResponse({ status: 404, description: 'Subject not found' })
  async getTopicsBySubject(@Param('subjectId') subjectId: string) {
    return this.curriculumService.findTopicsBySubjectId(subjectId);
  }

  @Get('topics/:topicId')
  @ApiOperation({ summary: 'Get topic details by ID including subject and lectures' })
  @ApiResponse({ status: 200, description: 'Topic details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - valid JWT token required' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getTopicById(@Param('topicId') topicId: string) {
    return this.curriculumService.findTopicById(topicId);
  }

  @Get('topics/:topicId/lectures')
  @ApiOperation({ summary: 'List all lectures for a specific topic' })
  @ApiResponse({ status: 200, description: 'Lectures for topic retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - valid JWT token required' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getLecturesByTopic(@Param('topicId') topicId: string) {
    return this.curriculumService.findLecturesByTopicId(topicId);
  }

  @Get('topics/:topicId/questions')
  @ApiOperation({
    summary: 'List quiz questions for a topic (sanitized: correct answers strictly omitted)',
  })
  @ApiResponse({ status: 200, description: 'Sanitized quiz questions retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - valid JWT token required' })
  @ApiResponse({ status: 404, description: 'Topic not found' })
  async getQuestionsByTopic(@Param('topicId') topicId: string) {
    return this.curriculumService.findQuestionsByTopicId(topicId);
  }

  @Get('lectures/:lectureId')
  @ApiOperation({ summary: 'Get lecture details by ID including parent topic and subject' })
  @ApiResponse({ status: 200, description: 'Lecture details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - valid JWT token required' })
  @ApiResponse({ status: 404, description: 'Lecture not found' })
  async getLectureById(@Param('lectureId') lectureId: string) {
    return this.curriculumService.findLectureById(lectureId);
  }
}
