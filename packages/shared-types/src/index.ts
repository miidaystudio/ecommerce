export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: UserRole;
}

export interface SessionResponse {
  accessToken: string;
  user: AuthUser;
}

export interface UserAddress {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'up' | 'down';
}
