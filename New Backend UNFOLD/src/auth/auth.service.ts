import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await this.hashPassword(dto.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          password: hashedPassword,
          name: dto.name?.trim() || null,
          role: 'STUDENT',
        },
      });

      const student = await tx.student.create({
        data: {
          userId: user.id,
          standardId: dto.standardId || '10',
          boardId: dto.boardId || 'CBSE',
          streamId: dto.streamId || 'SCIENCE',
        },
      });

      await tx.creditWallet.create({
        data: {
          studentId: student.id,
          balance: 0,
          lifetimeEarned: 0,
        },
      });

      await tx.attentionProfile.create({
        data: {
          studentId: student.id,
          estimatedAttentionSpanSec: 900,
          memoryRetentionScore: 0.5,
        },
      });

      return { user, student };
    });

    const payload: JwtPayload = {
      sub: result.user.id,
      studentId: result.student.id,
      email: result.user.email,
      role: result.user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
        createdAt: result.user.createdAt,
      },
      student: {
        id: result.student.id,
        standardId: result.student.standardId,
        boardId: result.student.boardId,
        streamId: result.student.streamId,
      },
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { student: true },
    });

    if (!user || !user.student) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await this.comparePassword(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      studentId: user.student.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      student: {
        id: user.student.id,
        standardId: user.student.standardId,
        boardId: user.student.boardId,
        streamId: user.student.streamId,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        student: {
          include: {
            creditWallet: true,
            attentionProfile: true,
          },
        },
      },
    });

    if (!user || !user.student) {
      throw new NotFoundException('User profile not found');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      student: {
        id: user.student.id,
        standardId: user.student.standardId,
        boardId: user.student.boardId,
        streamId: user.student.streamId,
        createdAt: user.student.createdAt,
        wallet: user.student.creditWallet,
        attentionProfile: user.student.attentionProfile,
      },
    };
  }
}
