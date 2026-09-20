export interface JwtPayload {
  sub: string;
  studentId?: string;
  email: string;
  role: string;
}

export interface AuthenticatedUser {
  userId: string;
  studentId: string;
  email: string;
  role: string;
}
