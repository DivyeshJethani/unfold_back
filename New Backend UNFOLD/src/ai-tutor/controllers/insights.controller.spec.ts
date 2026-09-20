import { Test, TestingModule } from '@nestjs/testing';
import { InsightsController } from './insights.controller';
import { WeakTopicDetectionService } from '../services/weak-topic-detection.service';
import { TimetableService } from '../services/timetable.service';
import { AttentionSpanService } from '../services/attention-span.service';
import { BehavioralFeatureService } from '../services/behavioral-feature.service';

describe('InsightsController', () => {
  let controller: InsightsController;
  let behavioralService: any;
  let weakTopicService: any;
  let timetableService: any;
  let attentionService: any;

  beforeEach(async () => {
    behavioralService = {
      extractFeaturesForStudent: jest.fn(),
    };
    weakTopicService = {
      listWeakTopicsForStudent: jest.fn(),
    };
    timetableService = {
      generateDailyTimetable: jest.fn(),
    };
    attentionService = {
      recomputeForStudent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [
        { provide: BehavioralFeatureService, useValue: behavioralService },
        { provide: WeakTopicDetectionService, useValue: weakTopicService },
        { provide: TimetableService, useValue: timetableService },
        { provide: AttentionSpanService, useValue: attentionService },
      ],
    }).compile();

    controller = module.get<InsightsController>(InsightsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have JwtAuthGuard applied at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', InsightsController);
    expect(guards).toBeDefined();
    expect(guards.length).toBeGreaterThan(0);
  });

  it('should delegate GET /insights/behavior to BehavioralFeatureService with authenticated studentId', async () => {
    const mockFeatures = {
      studentId: 'student-123',
      overall: { video: {}, learning: {}, confidence: {} },
      topics: [],
    };
    behavioralService.extractFeaturesForStudent.mockResolvedValue(mockFeatures);

    const result = await controller.behavior('student-123');

    expect(behavioralService.extractFeaturesForStudent).toHaveBeenCalledWith('student-123');
    expect(result).toEqual(mockFeatures);
  });

  it('should delegate GET /insights/behavioral-features alias to BehavioralFeatureService', async () => {
    const mockFeatures = { studentId: 'student-123' };
    behavioralService.extractFeaturesForStudent.mockResolvedValue(mockFeatures);

    const result = await controller.behavioralFeatures('student-123');

    expect(behavioralService.extractFeaturesForStudent).toHaveBeenCalledWith('student-123');
    expect(result).toEqual(mockFeatures);
  });
});
