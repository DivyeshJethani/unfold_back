import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Placeholder for the real auth wiring (JWT + Clerk guard, resolving the
 * authenticated user to their Student record) which belongs to the
 * "backend core" phase. Reads req.user.studentId, which a ClerkAuthGuard
 * would populate — controllers already assume this contract so swapping in
 * the real guard later requires no controller changes.
 */
export const CurrentStudentId = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return req.user?.studentId;
});
