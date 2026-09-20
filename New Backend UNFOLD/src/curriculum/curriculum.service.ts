import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all available subjects with topic counts.
   */
  async findAllSubjects() {
    return this.prisma.subject.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { topics: true },
        },
      },
    });
  }

  /**
   * Get a subject by ID along with its ordered topics.
   */
  async findSubjectById(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
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

    if (!subject) {
      throw new NotFoundException(`Subject with ID "${id}" not found`);
    }

    return subject;
  }

  /**
   * List all topics belonging to a specific subject.
   */
  async findTopicsBySubjectId(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID "${subjectId}" not found`);
    }

    return this.prisma.topic.findMany({
      where: { subjectId },
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
  }

  /**
   * Get a topic by ID including subject metadata and associated lectures.
   */
  async findTopicById(id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
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

    if (!topic) {
      throw new NotFoundException(`Topic with ID "${id}" not found`);
    }

    return topic;
  }

  /**
   * List all lectures for a specific topic.
   */
  async findLecturesByTopicId(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new NotFoundException(`Topic with ID "${topicId}" not found`);
    }

    return this.prisma.lecture.findMany({
      where: { topicId },
    });
  }

  /**
   * Get student-facing quiz questions for a topic.
   * CRITICAL SECURITY: correctOptionId and grading-sensitive fields are omitted.
   */
  async findQuestionsByTopicId(topicId: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
    });

    if (!topic) {
      throw new NotFoundException(`Topic with ID "${topicId}" not found`);
    }

    return this.prisma.quizQuestion.findMany({
      where: { topicId },
      select: {
        id: true,
        topicId: true,
        prompt: true,
        options: true,
        difficulty: true,
      },
    });
  }

  /**
   * Get lecture details by ID with parent topic and subject info.
   */
  async findLectureById(id: string) {
    const lecture = await this.prisma.lecture.findUnique({
      where: { id },
      include: {
        topic: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!lecture) {
      throw new NotFoundException(`Lecture with ID "${id}" not found`);
    }

    return lecture;
  }
}
