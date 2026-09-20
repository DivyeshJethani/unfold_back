import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      student: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      creditWallet: {
        create: jest.fn(),
      },
      attentionProfile: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prisma);
      }),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('password hashing and comparison', () => {
    it('should hash a password and verify it correctly', async () => {
      const rawPassword = 'Password123!';
      const hash = await service.hashPassword(rawPassword);

      expect(hash).toBeDefined();
      expect(hash).not.toEqual(rawPassword);

      const isMatch = await service.comparePassword(rawPassword, hash);
      expect(isMatch).toBe(true);

      const isWrongMatch = await service.comparePassword('WrongPassword', hash);
      expect(isWrongMatch).toBe(false);
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'student@example.com',
      password: 'password123',
      name: 'Test Student',
      standardId: '10',
      boardId: 'CBSE',
      streamId: 'SCIENCE',
    };

    it('should successfully register a new student and return token and profile without password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const mockUser = {
        id: 'user-uuid-1',
        email: 'student@example.com',
        name: 'Test Student',
        password: 'hashed-password',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockStudent = {
        id: 'student-uuid-1',
        userId: 'user-uuid-1',
        standardId: '10',
        boardId: 'CBSE',
        streamId: 'SCIENCE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.create.mockResolvedValue(mockUser);
      prisma.student.create.mockResolvedValue(mockStudent);
      prisma.creditWallet.create.mockResolvedValue({ id: 'wallet-1', studentId: 'student-uuid-1', balance: 0 });
      prisma.attentionProfile.create.mockResolvedValue({ id: 'attn-1', studentId: 'student-uuid-1' });

      const result = await service.register(registerDto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'student@example.com' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.student.create).toHaveBeenCalled();
      expect(prisma.creditWallet.create).toHaveBeenCalled();
      expect(prisma.attentionProfile.create).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-uuid-1',
        studentId: 'student-uuid-1',
        email: 'student@example.com',
        role: 'STUDENT',
      });

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe('user-uuid-1');
      expect(result.user.email).toBe('student@example.com');
      expect((result.user as any).password).toBeUndefined();
      expect(result.student.id).toBe('student-uuid-1');
    });

    it('should throw ConflictException if email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-id', email: 'student@example.com' });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'student@example.com',
      password: 'password123',
    };

    it('should successfully log in with valid credentials', async () => {
      const hashedPassword = await service.hashPassword('password123');
      const mockUser = {
        id: 'user-uuid-1',
        email: 'student@example.com',
        name: 'Test Student',
        password: hashedPassword,
        role: 'STUDENT',
        createdAt: new Date(),
        student: {
          id: 'student-uuid-1',
          standardId: '10',
          boardId: 'CBSE',
          streamId: 'SCIENCE',
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.user.id).toBe('user-uuid-1');
      expect(result.student.id).toBe('student-uuid-1');
      expect((result.user as any).password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hashedPassword = await service.hashPassword('differentPassword');
      const mockUser = {
        id: 'user-uuid-1',
        email: 'student@example.com',
        password: hashedPassword,
        role: 'STUDENT',
        student: { id: 'student-uuid-1' },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMe', () => {
    it('should return user and student details with wallet and attentionProfile', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'student@example.com',
        name: 'Test Student',
        password: 'hashed-secret',
        role: 'STUDENT',
        createdAt: new Date(),
        updatedAt: new Date(),
        student: {
          id: 'student-uuid-1',
          standardId: '10',
          boardId: 'CBSE',
          streamId: 'SCIENCE',
          createdAt: new Date(),
          creditWallet: { balance: 50, lifetimeEarned: 100 },
          attentionProfile: { estimatedAttentionSpanSec: 900, memoryRetentionScore: 0.8 },
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getMe('user-uuid-1');

      expect(result.user.id).toBe('user-uuid-1');
      expect(result.user.email).toBe('student@example.com');
      expect((result.user as any).password).toBeUndefined();
      expect(result.student.id).toBe('student-uuid-1');
      expect(result.student.wallet?.balance).toBe(50);
      expect(result.student.attentionProfile?.memoryRetentionScore).toBe(0.8);
    });

    it('should throw NotFoundException if user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
