import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudyGroupService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureGroupsForStudent(studentId: string, subjectIds: string[]) {
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });

    const groups: Array<Awaited<ReturnType<typeof this.prisma.studyGroup.findFirstOrThrow>>> = [];
    for (const subjectId of subjectIds) {
      const subject = await this.prisma.subject.findUniqueOrThrow({ where: { id: subjectId } });

      let group = await this.prisma.studyGroup.findFirst({
        where: { subjectId, standardId: student.standardId, boardId: student.boardId },
      });

      if (!group) {
        group = await this.prisma.studyGroup.create({
          data: { name: `${subject.name} — Standard ${student.standardId}`, subjectId, standardId: student.standardId, boardId: student.boardId },
        });
      }

      await this.prisma.studyGroupMember.upsert({
        where: { studyGroupId_studentId: { studyGroupId: group.id, studentId } },
        create: { studyGroupId: group.id, studentId }, update: {},
      });

      groups.push(group);
    }
    return groups;
  }

  async getGroupsForStudent(studentId: string) {
    return this.prisma.studyGroupMember.findMany({
      where: { studentId }, include: { studyGroup: { include: { members: true } } },
    });
  }
}
