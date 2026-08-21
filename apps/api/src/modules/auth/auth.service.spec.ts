import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs');

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'a@b.com',
    passwordHash: 'hashed',
    firstName: null,
    lastName: null,
    phone: null,
    role: Role.CUSTOMER,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation((ops) => Promise.resolve(ops)),
    };

    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    } as unknown as JwtService;

    const config = {
      getOrThrow: jest.fn().mockReturnValue('secret'),
      get: jest.fn().mockReturnValue('15m'),
    } as unknown as ConfigService;

    service = new AuthService(prisma as unknown as PrismaService, jwt, config);
    jest.clearAllMocks();
    bcryptMock.hash.mockResolvedValue('hashed' as never);
  });

  describe('register', () => {
    it('rejects a duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      await expect(service.register({ email: 'a@b.com', password: 'password1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates a customer and issues a session', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser());

      const result = await service.register({ email: 'a@b.com', password: 'password1' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: Role.CUSTOMER }) }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'x@y.com', password: 'password1' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      bcryptMock.compare.mockResolvedValue(false as never);
      await expect(service.login({ email: 'a@b.com', password: 'nope' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a blocked account', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isBlocked: true }));
      bcryptMock.compare.mockResolvedValue(true as never);
      await expect(service.login({ email: 'a@b.com', password: 'password1' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('issues a session on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      bcryptMock.compare.mockResolvedValue(true as never);
      const result = await service.login({ email: 'a@b.com', password: 'password1' });
      expect(result.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('adminLogin', () => {
    it('rejects a customer', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: Role.CUSTOMER }));
      bcryptMock.compare.mockResolvedValue(true as never);
      await expect(service.adminLogin({ email: 'a@b.com', password: 'password1' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows staff', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ role: Role.STAFF }));
      bcryptMock.compare.mockResolvedValue(true as never);
      const result = await service.adminLogin({ email: 'a@b.com', password: 'password1' });
      expect(result.user.role).toBe(Role.STAFF);
    });
  });

  describe('refresh', () => {
    it('rejects a revoked or missing token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException);
    });

    it('rotates tokens for a valid refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const result = await service.refresh('token');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('logout', () => {
    it('is a no-op without a token', async () => {
      await service.logout(undefined);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('revokes a presented token', async () => {
      await service.logout('token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    });
  });
});
