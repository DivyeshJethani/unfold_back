import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CurriculumService } from './curriculum.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CurriculumService', () => {
  let service: CurriculumService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      subject: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      topic: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      lecture: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      quizQuestion: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurriculumService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CurriculumService>(CurriculumService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllSubjects', () => {
    it('should return a list of all subjects ordered by name with topic counts', async () => {
      const mockSubjects = [
        { id: 'sub-1', name: 'Mathematics', code: 'MATH101', _count: { topics: 5 } },
        { id: 'sub-2', name: 'Physics', code: 'PHY101', _count: { topics: 3 } },
      ];
      prisma.subject.findMany.mockResolvedValue(mockSubjects);

      const result = await service.findAllSubjects();

      expect(prisma.subject.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { topics: true },
          },
        },
      });
      expect(result).toEqual(mockSubjects);
    });
  });

  describe('findSubjectById', () => {
    it('should return subject details with ordered topics', async () => {
      const mockSubject = {
        id: 'sub-physics-01',
        name: 'Physics',
        code: 'PHY101',
        topics: [
          { id: 'top-1', name: 'Kinematics', order: 1, _count: { lectures: 2, quizQuestions: 4 } },
          { id: 'top-2', name: "Newton's Laws", order: 2, _count: { lectures: 1, quizQuestions: 2 } },
        ],
      };
      prisma.subject.findUnique.mockResolvedValue(mockSubject);

      const result = await service.findSubjectById('sub-physics-01');

      expect(prisma.subject.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub-physics-01' },
        include: {
          topics: {
            orderBy: { order: 'asc' },
            include: {
              _count: {
                select: {
                  lectures: true,
                  quizQuestions: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(mockSubject);
    });

    it('should throw NotFoundException if subject does not exist', async () => {
      prisma.subject.findUnique.mockResolvedValue(null);

      await expect(service.findSubjectById('non-existent-sub')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findTopicsBySubjectId', () => {
    it('should return topics for a valid subject', async () => {
      prisma.subject.findUnique.mockResolvedValue({ id: 'sub-1', name: 'Physics' });
      const mockTopics = [
        { id: 'top-1', name: 'Kinematics', subjectId: 'sub-1', order: 1, _count: { lectures: 1, quizQuestions: 2 } },
      ];
      prisma.topic.findMany.mockResolvedValue(mockTopics);

      const result = await service.findTopicsBySubjectId('sub-1');

      expect(prisma.subject.findUnique).toHaveBeenCalledWith({ where: { id: 'sub-1' } });
      expect(prisma.topic.findMany).toHaveBeenCalledWith({
        where: { subjectId: 'sub-1' },
        orderBy: { order: 'asc' },
        include: {
          _count: {
            select: {
              lectures: true,
              quizQuestions: true,
            },
          },
        },
      });
      expect(result).toEqual(mockTopics);
    });

    it('should throw NotFoundException if parent subject is missing', async () => {
      prisma.subject.findUnique.mockResolvedValue(null);

      await expect(service.findTopicsBySubjectId('missing-sub')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findTopicById', () => {
    it('should return topic with subject and lectures', async () => {
      const mockTopic = {
        id: 'top-1',
        name: 'Kinematics',
        order: 1,
        subject: { id: 'sub-1', name: 'Physics', code: 'PHY101' },
        lectures: [{ id: 'lec-1', title: 'Intro to Velocity', durationSec: 600 }],
        _count: { quizQuestions: 5 },
      };
      prisma.topic.findUnique.mockResolvedValue(mockTopic);

      const result = await service.findTopicById('top-1');

      expect(prisma.topic.findUnique).toHaveBeenCalledWith({
        where: { id: 'top-1' },
        include: {
          subject: true,
          lectures: true,
          _count: {
            select: {
              quizQuestions: true,
            },
          },
        },
      });
      expect(result).toEqual(mockTopic);
    });

    it('should throw NotFoundException if topic does not exist', async () => {
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.findTopicById('non-existent-topic')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findLecturesByTopicId', () => {
    it('should return lectures for a valid topic', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'top-1', name: 'Kinematics' });
      const mockLectures = [
        { id: 'lec-1', topicId: 'top-1', title: '1D Motion', videoUrl: 'https://video.mp4', durationSec: 720 },
      ];
      prisma.lecture.findMany.mockResolvedValue(mockLectures);

      const result = await service.findLecturesByTopicId('top-1');

      expect(prisma.topic.findUnique).toHaveBeenCalledWith({ where: { id: 'top-1' } });
      expect(prisma.lecture.findMany).toHaveBeenCalledWith({ where: { topicId: 'top-1' } });
      expect(result).toEqual(mockLectures);
    });

    it('should throw NotFoundException if parent topic is missing', async () => {
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.findLecturesByTopicId('missing-topic')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findQuestionsByTopicId (Sanitization & Security)', () => {
    it('should query only safe fields and NEVER return correctOptionId or answer keys', async () => {
      prisma.topic.findUnique.mockResolvedValue({ id: 'top-1', name: 'Kinematics' });
      const sanitizedQuestions = [
        {
          id: 'q-1',
          topicId: 'top-1',
          prompt: 'What is acceleration?',
          options: [{ id: 'opt-a', text: 'dv/dt' }, { id: 'opt-b', text: 'dx/dt' }],
          difficulty: 0.4,
        },
      ];
      prisma.quizQuestion.findMany.mockResolvedValue(sanitizedQuestions);

      const result = await service.findQuestionsByTopicId('top-1');

      // Verify Prisma was called with explicit field selection omitting correctOptionId
      expect(prisma.quizQuestion.findMany).toHaveBeenCalledWith({
        where: { topicId: 'top-1' },
        select: {
          id: true,
          topicId: true,
          prompt: true,
          options: true,
          difficulty: true,
        },
      });

      expect(result).toEqual(sanitizedQuestions);
      expect((result[0] as any).correctOptionId).toBeUndefined();
      expect((result[0] as any).solution).toBeUndefined();
    });

    it('should throw NotFoundException if topic is missing', async () => {
      prisma.topic.findUnique.mockResolvedValue(null);

      await expect(service.findQuestionsByTopicId('missing-topic')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findLectureById', () => {
    it('should return lecture details with topic and subject info', async () => {
      const mockLecture = {
        id: 'lec-1',
        topicId: 'top-1',
        title: 'Velocity Intro',
        videoUrl: 'https://video.mp4',
        durationSec: 600,
        topic: {
          id: 'top-1',
          name: 'Kinematics',
          subject: { id: 'sub-1', name: 'Physics' },
        },
      };
      prisma.lecture.findUnique.mockResolvedValue(mockLecture);

      const result = await service.findLectureById('lec-1');

      expect(prisma.lecture.findUnique).toHaveBeenCalledWith({
        where: { id: 'lec-1' },
        include: {
          topic: {
            include: {
              subject: true,
            },
          },
        },
      });
      expect(result).toEqual(mockLecture);
    });

    it('should throw NotFoundException if lecture is not found', async () => {
      prisma.lecture.findUnique.mockResolvedValue(null);

      await expect(service.findLectureById('missing-lec')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
