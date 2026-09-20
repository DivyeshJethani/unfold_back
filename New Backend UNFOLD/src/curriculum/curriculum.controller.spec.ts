import { Test, TestingModule } from '@nestjs/testing';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';

describe('CurriculumController', () => {
  let controller: CurriculumController;
  let service: any;

  beforeEach(async () => {
    service = {
      findAllSubjects: jest.fn(),
      findSubjectById: jest.fn(),
      findTopicsBySubjectId: jest.fn(),
      findTopicById: jest.fn(),
      findLecturesByTopicId: jest.fn(),
      findQuestionsByTopicId: jest.fn(),
      findLectureById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurriculumController],
      providers: [{ provide: CurriculumService, useValue: service }],
    }).compile();

    controller = module.get<CurriculumController>(CurriculumController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have JwtAuthGuard applied at controller level', () => {
    const guards = Reflect.getMetadata('__guards__', CurriculumController);
    expect(guards).toBeDefined();
    expect(guards.length).toBeGreaterThan(0);
  });

  it('should delegate getSubjects to service.findAllSubjects', async () => {
    const mockSubjects = [{ id: 'sub-1', name: 'Physics' }];
    service.findAllSubjects.mockResolvedValue(mockSubjects);

    const result = await controller.getSubjects();
    expect(service.findAllSubjects).toHaveBeenCalled();
    expect(result).toEqual(mockSubjects);
  });

  it('should delegate getSubjectById to service.findSubjectById', async () => {
    const mockSubject = { id: 'sub-1', name: 'Physics' };
    service.findSubjectById.mockResolvedValue(mockSubject);

    const result = await controller.getSubjectById('sub-1');
    expect(service.findSubjectById).toHaveBeenCalledWith('sub-1');
    expect(result).toEqual(mockSubject);
  });

  it('should delegate getTopicsBySubject to service.findTopicsBySubjectId', async () => {
    const mockTopics = [{ id: 'top-1', name: 'Kinematics' }];
    service.findTopicsBySubjectId.mockResolvedValue(mockTopics);

    const result = await controller.getTopicsBySubject('sub-1');
    expect(service.findTopicsBySubjectId).toHaveBeenCalledWith('sub-1');
    expect(result).toEqual(mockTopics);
  });

  it('should delegate getTopicById to service.findTopicById', async () => {
    const mockTopic = { id: 'top-1', name: 'Kinematics' };
    service.findTopicById.mockResolvedValue(mockTopic);

    const result = await controller.getTopicById('top-1');
    expect(service.findTopicById).toHaveBeenCalledWith('top-1');
    expect(result).toEqual(mockTopic);
  });

  it('should delegate getLecturesByTopic to service.findLecturesByTopicId', async () => {
    const mockLectures = [{ id: 'lec-1', title: '1D Motion' }];
    service.findLecturesByTopicId.mockResolvedValue(mockLectures);

    const result = await controller.getLecturesByTopic('top-1');
    expect(service.findLecturesByTopicId).toHaveBeenCalledWith('top-1');
    expect(result).toEqual(mockLectures);
  });

  it('should delegate getQuestionsByTopic to service.findQuestionsByTopicId', async () => {
    const mockQuestions = [{ id: 'q-1', prompt: 'Solve for x' }];
    service.findQuestionsByTopicId.mockResolvedValue(mockQuestions);

    const result = await controller.getQuestionsByTopic('top-1');
    expect(service.findQuestionsByTopicId).toHaveBeenCalledWith('top-1');
    expect(result).toEqual(mockQuestions);
  });

  it('should delegate getLectureById to service.findLectureById', async () => {
    const mockLecture = { id: 'lec-1', title: '1D Motion' };
    service.findLectureById.mockResolvedValue(mockLecture);

    const result = await controller.getLectureById('lec-1');
    expect(service.findLectureById).toHaveBeenCalledWith('lec-1');
    expect(result).toEqual(mockLecture);
  });
});
