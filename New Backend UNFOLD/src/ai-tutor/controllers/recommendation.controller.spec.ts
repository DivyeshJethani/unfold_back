import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from '../services/recommendation.service';

describe('RecommendationController', () => {
  let controller: RecommendationController;
  let service: any;

  const mockRecommendations = [
    {
      id: 'rec-student-1-top-1-lecture',
      topicId: 'top-1',
      topicName: 'Kinematics',
      subjectId: 'sub-1',
      subjectName: 'Physics',
      activityType: 'LECTURE',
      resourceId: 'lec-1',
      resourceTitle: 'Kinematics Intro',
      resourceType: 'VIDEO',
      score: 0.85,
      priority: 0.85,
      rationale: 'Recommended because topic mastery is low and flagged for review.',
      reason: 'Recommended because topic mastery is low and flagged for review.',
      signals: {
        masteryScore: 0.25,
        masteryLevel: 'WEAK',
        needsReview: true,
        trajectoryTrend: 'STABLE',
        struggleSignal: null,
        rewatchRate: null,
        completionRate: null,
        recentAccuracy: null,
        dominantMistakeType: null,
        preferredFormat: null,
        hasSufficientData: true,
      },
    },
  ];

  beforeEach(async () => {
    service = {
      getRecommendations: jest.fn().mockResolvedValue(mockRecommendations),
      getNextRecommendation: jest.fn().mockResolvedValue(mockRecommendations[0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationController],
      providers: [{ provide: RecommendationService, useValue: service }],
    }).compile();

    controller = module.get<RecommendationController>(RecommendationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /recommendations', () => {
    it('delegates to RecommendationService using authenticated student ID', async () => {
      const studentId = 'authenticated-student-123';
      const query = { limit: 3, subjectId: 'sub-1' };

      const result = await controller.getRecommendations(studentId, query);

      expect(service.getRecommendations).toHaveBeenCalledWith(studentId, query);
      expect(result).toEqual(mockRecommendations);
    });
  });

  describe('GET /recommendations/next', () => {
    it('delegates to RecommendationService using authenticated student ID', async () => {
      const studentId = 'authenticated-student-123';

      const result = await controller.getNextRecommendation(studentId);

      expect(service.getNextRecommendation).toHaveBeenCalledWith(studentId);
      expect(result).toEqual(mockRecommendations[0]);
    });
  });
});
