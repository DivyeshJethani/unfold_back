import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, AuthenticatedUser } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'cognify-dev-jwt-secret-key'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    let studentId = payload.studentId;

    if (!studentId) {
      const student = await this.prisma.student.findUnique({
        where: { userId: payload.sub },
        select: { id: true },
      });
      if (student) {
        studentId = student.id;
      }
    }

    if (!studentId) {
      throw new UnauthorizedException('Student profile not found for user');
    }

    return {
      userId: payload.sub,
      studentId,
      email: payload.email,
      role: payload.role,
    };
  }
}
