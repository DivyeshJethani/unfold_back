import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: any;
  let configService: any;

  beforeEach(async () => {
    prisma = {
      student: {
        findUnique: jest.fn(),
      },
    };

    configService = {
      get: jest.fn().mockImplementation((key, defaultVal) => defaultVal || 'test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should validate and return authenticated user when payload contains studentId', async () => {
    const payload = {
      sub: 'u1',
      studentId: 's1',
      email: 'student@example.com',
      role: 'STUDENT',
    };

    const result = await strategy.validate(payload);
    expect(result).toEqual({
      userId: 'u1',
      studentId: 's1',
      email: 'student@example.com',
      role: 'STUDENT',
    });
  });

  it('should lookup student when payload does not contain studentId', async () => {
    const payload = {
      sub: 'u1',
      email: 'student@example.com',
      role: 'STUDENT',
    };

    prisma.student.findUnique.mockResolvedValue({ id: 's-found' });

    const result = await strategy.validate(payload);
    expect(prisma.student.findUnique).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      select: { id: true },
    });
    expect(result.studentId).toBe('s-found');
  });

  it('should throw UnauthorizedException when payload has no sub', async () => {
    await expect(strategy.validate({} as any)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when student profile is not found', async () => {
    const payload = {
      sub: 'u1',
      email: 'student@example.com',
      role: 'STUDENT',
    };

    prisma.student.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
