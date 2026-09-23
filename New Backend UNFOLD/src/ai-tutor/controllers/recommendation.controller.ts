import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentStudentId } from '../decorators/current-student.decorator';
import { RecommendationItemDto, RecommendationQueryDto } from '../dto/recommendation.dto';
import { RecommendationService } from '../services/recommendation.service';

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get()
  @ApiOperation({
    summary: 'Get personalized, adaptive recommendations for the authenticated student',
  })
  @ApiResponse({
    status: 200,
    type: [RecommendationItemDto],
    description: 'Ranked list of recommendations based on student learning state',
  })
  async getRecommendations(
    @CurrentStudentId() studentId: string,
    @Query() query: RecommendationQueryDto,
  ): Promise<RecommendationItemDto[]> {
    return this.recommendationService.getRecommendations(studentId, query);
  }

  @Get('next')
  @ApiOperation({
    summary: 'Get the single highest-priority recommendation for the authenticated student next',
  })
  @ApiResponse({
    status: 200,
    type: RecommendationItemDto,
    description: 'Single highest priority recommendation or null',
  })
  async getNextRecommendation(
    @CurrentStudentId() studentId: string,
  ): Promise<RecommendationItemDto | null> {
    return this.recommendationService.getNextRecommendation(studentId);
  }
}
