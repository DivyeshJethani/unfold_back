import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from '../services/assessment.service';
import { SubmitQuizAttemptDto } from '../dto/assessment.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('AssessmentController', () => {
  let controller: AssessmentController;
  let service: any;

  beforeEach(async () => {
    service = {
      submitQuizAttempt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentController],
      providers: [{ provide: AssessmentService, useValue: service }],
    }).compile();

    controller = module.get<AssessmentController>(AssessmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have JwtAuthGuard applied at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', AssessmentController);
    expect(guards).toBeDefined();
    expect(guards.length).toBeGreaterThan(0);
  });

  it('should delegate submit to AssessmentService with authenticated studentId', async () => {
    const dto: SubmitQuizAttemptDto = {
      topicId: 'top-1',
      answers: [
        {
          questionId: 'q-1',
          selectedOptionId: 'opt-b',
          timeTakenMs: 5000,
          predictedConfidence: 0.8,
        },
      ],
    };

    const expectedResponse = {
      attemptId: 'attempt-1',
      score: 1.0,
      correctCount: 1,
      total: 1,
      answerResults: [{ questionId: 'q-1', isCorrect: true, mistakeType: 'NONE' }],
    };

    service.submitQuizAttempt.mockResolvedValue(expectedResponse);

    const result = await controller.submit('student-authenticated-1', dto);

    expect(service.submitQuizAttempt).toHaveBeenCalledWith({
      studentId: 'student-authenticated-1',
      topicId: 'top-1',
      answers: dto.answers,
    });
    expect(result).toEqual(expectedResponse);
  });
});
