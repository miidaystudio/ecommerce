import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  mustChangePassword?: boolean;
}
