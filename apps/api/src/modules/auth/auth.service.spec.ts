import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHmac } from 'node:crypto';
import { EmailService } from '../../common/email/email.service';
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
    phone: '9876543210',
    phoneNumber: '9876543210',
    role: Role.CUSTOMER,
    isBlocked: false,
    isVerified: true,
    emailVerifiedAt: new Date(),
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Mirrors AuthService's purpose-derived OTP key for the mocked 'test-secret'.
function otpHash(otp: string): string {
  const key = createHmac('sha256', 'test-secret').update('otp-verification-v1').digest();
  return createHmac('sha256', key).update(otp).digest('hex');
}

function otpRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'otp-1',
    userId: 'user-1',
    otpHash: otpHash('9999'),
    expiresAt: new Date(Date.now() + 5 * 60_000),
    attempts: 0,
    maxAttempts: 5,
    resendAvailableAt: new Date(Date.now() - 1000),
    consumedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    otpVerification: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    refreshToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let emailService: { sendOtpEmail: jest.Mock; send: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      otpVerification: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation((ops: unknown) => {
        if (typeof ops === 'function') {
          return ops(prisma);
        }
        return Array.isArray(ops) ? Promise.all(ops) : Promise.resolve(ops);
      }),
    };

    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    } as unknown as JwtService;

    const config = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
      get: jest.fn().mockReturnValue('15m'),
    } as unknown as ConfigService;

    emailService = {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      config,
      emailService as unknown as EmailService,
    );
    jest.clearAllMocks();
    bcryptMock.hash.mockResolvedValue('hashed' as never);
  });

  describe('register', () => {
    it('rejects a duplicate email if already verified', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: true }));
      await expect(
        service.register({ email: 'a@b.com', password: 'password1', phoneNumber: '+919876543210' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates an unverified customer, stores only a hashed OTP, and dispatches email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue(null);

      const result = await service.register({
        email: 'a@b.com',
        password: 'password1',
        phoneNumber: '+91 98765 43210',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: Role.CUSTOMER,
            isVerified: false,
            phoneNumber: '+91 98765 43210',
          }),
        }),
      );
      const sentOtp = emailService.sendOtpEmail.mock.calls[0][1] as string;
      expect(sentOtp).toMatch(/^\d{4}$/);
      const stored = prisma.otpVerification.create.mock.calls[0][0].data;
      expect(stored.otpHash).toBe(otpHash(sentOtp));
      expect(stored.otpHash).not.toContain(sentOtp);
      expect(stored.maxAttempts).toBe(5);
      expect(result).toEqual(expect.objectContaining({ requiresVerification: true, resendAvailableIn: 60 }));
      expect(JSON.stringify(result)).not.toContain(sentOtp);
    });

    it('re-registering an unverified email inside the cooldown updates details but sends no new code', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.user.update.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue(
        otpRow({ resendAvailableAt: new Date(Date.now() + 40_000) }),
      );

      const res = await service.register({ email: 'a@b.com', password: 'password2', phoneNumber: '+919876543210' });

      expect(prisma.user.update).toHaveBeenCalled();
      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
      expect(res.resendAvailableIn).toBeGreaterThan(30);
    });

    it('surfaces an email failure and removes the undelivered code so the customer can retry at once', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue(null);
      prisma.otpVerification.create.mockResolvedValue({ id: 'otp-new' });
      emailService.sendOtpEmail.mockRejectedValue(new Error('Resend down'));

      await expect(
        service.register({ email: 'a@b.com', password: 'password1', phoneNumber: '+919876543210' }),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.otpVerification.deleteMany).toHaveBeenLastCalledWith({ where: { id: 'otp-new' } });
    });
  });

  describe('verifyOtp', () => {
    const rawOtp = '4321';
    const dto = { email: 'a@b.com', otp: rawOtp, password: 'password1' };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue(otpRow({ otpHash: otpHash(rawOtp) }));
      prisma.otpVerification.updateMany.mockResolvedValue({ count: 1 });
      bcryptMock.compare.mockResolvedValue(true as never);
      prisma.user.update.mockResolvedValue(buildUser({ isVerified: true }));
    });

    it('rejects unknown and already-verified users with the same message', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.verifyOtp(dto)).rejects.toThrow('Invalid verification request');
      prisma.user.findUnique.mockResolvedValueOnce(buildUser({ isVerified: true }));
      await expect(service.verifyOtp(dto)).rejects.toThrow('Invalid verification request');
    });

    it('rejects when no active OTP exists', async () => {
      prisma.otpVerification.findFirst.mockResolvedValue(null);
      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired OTP without spending an attempt', async () => {
      prisma.otpVerification.findFirst.mockResolvedValue(otpRow({ otpHash: otpHash(rawOtp), expiresAt: new Date(Date.now() - 1000) }));
      await expect(service.verifyOtp(dto)).rejects.toThrow(/expired/i);
      expect(prisma.otpVerification.updateMany).not.toHaveBeenCalled();
    });

    it('reserves the attempt atomically before comparing, so parallel guesses cannot exceed the limit', async () => {
      await service.verifyOtp(dto);
      expect(prisma.otpVerification.updateMany).toHaveBeenCalledWith({
        where: { id: 'otp-1', attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
    });

    it('refuses once the conditional reservation finds the code already exhausted', async () => {
      prisma.otpVerification.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.verifyOtp(dto)).rejects.toThrow(/locked/i);
      expect(bcryptMock.compare).not.toHaveBeenCalled();
    });

    it('reports remaining attempts on a wrong code', async () => {
      prisma.otpVerification.findFirst.mockResolvedValue(otpRow({ otpHash: otpHash(rawOtp), attempts: 2 }));
      await expect(service.verifyOtp({ ...dto, otp: '0000' })).rejects.toThrow(/2 attempts remaining/i);
    });

    it('locks on the fifth failure', async () => {
      prisma.otpVerification.findFirst.mockResolvedValue(otpRow({ otpHash: otpHash(rawOtp), attempts: 4 }));
      await expect(service.verifyOtp({ ...dto, otp: '0000' })).rejects.toThrow(/locked/i);
    });

    it('rejects a correct code with the wrong password, so a re-registration cannot hijack the account', async () => {
      bcryptMock.compare.mockResolvedValue(false as never);
      await expect(service.verifyOtp(dto)).rejects.toThrow(/Invalid verification code or password/);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('verifies, consumes the code exactly once, and issues a session', async () => {
      prisma.user.update.mockResolvedValue(buildUser({ isVerified: true }));

      const result = await service.verifyOtp(dto);

      expect(prisma.otpVerification.deleteMany).toHaveBeenCalledWith({ where: { id: 'otp-1' } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ isVerified: true }),
      });
      expect(result.user.isVerified).toBe(true);
    });

    it('fails a second concurrent use of the same code instead of issuing another session', async () => {
      prisma.otpVerification.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.verifyOtp(dto)).rejects.toThrow(/already been used/);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resendOtp', () => {
    it('returns the same generic response for unknown and already-verified emails', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      const unknown = await service.resendOtp({ email: 'unknown@b.com' });
      prisma.user.findUnique.mockResolvedValueOnce(buildUser({ isVerified: true }));
      const verified = await service.resendOtp({ email: 'a@b.com' });
      expect(verified).toEqual(unknown);
      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('enforces the cooldown server-side', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue(otpRow({ resendAvailableAt: new Date(Date.now() + 45_000) }));
      await expect(service.resendOtp({ email: 'a@b.com' })).rejects.toThrow(/wait/i);
      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('holds a new code back for 15 minutes after a lockout', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue(
        otpRow({ attempts: 5, resendAvailableAt: new Date(Date.now() - 60_000), updatedAt: new Date(Date.now() - 60_000) }),
      );
      await expect(service.resendOtp({ email: 'a@b.com' })).rejects.toThrow(/wait 8\d\d seconds/);
    });

    it('issues a replacement code once permitted', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue(otpRow({ resendAvailableAt: new Date(Date.now() - 5000) }));

      const res = await service.resendOtp({ email: 'a@b.com' });

      expect(prisma.otpVerification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith('a@b.com', expect.stringMatching(/^\d{4}$/));
      expect(res.resendAvailableIn).toBe(60);
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

    it('rejects an unverified account', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      bcryptMock.compare.mockResolvedValue(true as never);
      await expect(service.login({ email: 'a@b.com', password: 'password1' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects a blocked account', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isBlocked: true }));
      bcryptMock.compare.mockResolvedValue(true as never);
      await expect(service.login({ email: 'a@b.com', password: 'password1' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('issues a session on valid credentials for a verified account', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: true }));
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

  describe('changePassword', () => {
    it('throws NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.changePassword('unknown-id', {
          currentPassword: 'oldPassword123',
          newPassword: 'newPassword456!',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if current password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ id: 'user-1', passwordHash: 'hashed' }));
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'wrongPassword',
          newPassword: 'newPassword456!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if new password is identical to current password', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ id: 'user-1', passwordHash: 'hashed' }));
      bcryptMock.compare.mockResolvedValue(true as never);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'samePassword123',
          newPassword: 'samePassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully changes password, sets mustChangePassword to false, revokes tokens, and issues fresh session', async () => {
      const userBefore = buildUser({ id: 'user-1', passwordHash: 'oldHash', mustChangePassword: true });
      const userAfter = buildUser({ id: 'user-1', passwordHash: 'newHash', mustChangePassword: false });

      prisma.user.findUnique.mockResolvedValue(userBefore);
      bcryptMock.compare.mockResolvedValue(true as never);
      bcryptMock.hash.mockResolvedValue('newHash' as never);
      prisma.user.update.mockResolvedValue(userAfter);

      const result = await service.changePassword('user-1', {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword456!',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          passwordHash: 'newHash',
          mustChangePassword: false,
        },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.mustChangePassword).toBe(false);
    });
  });
});
