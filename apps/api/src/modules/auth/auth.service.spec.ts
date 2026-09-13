import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
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
import { RegisterDto } from './dto/register.dto';

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

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    otpVerification: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
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
        delete: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation((ops) => {
        if (Array.isArray(ops)) {
          return Promise.all(ops);
        }
        return Promise.resolve(ops);
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
    it('requires a phone number', async () => {
      await expect(
        service.register({ email: 'a@b.com', password: 'password1' } as unknown as RegisterDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a phone number with invalid digit count', async () => {
      await expect(
        service.register({ email: 'a@b.com', password: 'password1', phoneNumber: '123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate email if already verified', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: true }));
      await expect(
        service.register({ email: 'a@b.com', password: 'password1', phoneNumber: '+919876543210' }),
      ).rejects.toThrow(ConflictException);
    });

    it('updates an unverified account and sends a new OTP if re-registering', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.user.update.mockResolvedValue(buildUser({ isVerified: false }));

      const res = await service.register({
        email: 'a@b.com',
        password: 'new-password1',
        phoneNumber: '+919876543210',
      });

      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.otpVerification.deleteMany).toHaveBeenCalled();
      expect(prisma.otpVerification.create).toHaveBeenCalled();
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith('a@b.com', expect.any(String));
      expect(res.requiresVerification).toBe(true);
    });

    it('creates an unverified customer, stores hashed OTP, and dispatches email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(buildUser({ isVerified: false }));

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
            phone: '+91 98765 43210',
            phoneNumber: '+91 98765 43210',
          }),
        }),
      );
      expect(prisma.otpVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            attempts: 0,
            maxAttempts: 5,
            otpHash: expect.any(String),
          }),
        }),
      );
      expect(emailService.sendOtpEmail).toHaveBeenCalledWith('a@b.com', expect.stringMatching(/^\d{4}$/));
      expect(result.requiresVerification).toBe(true);
      expect(result.email).toBe('a@b.com');
    });
  });

  describe('verifyOtp', () => {
    const rawOtp = '4321';
    const hashedOtp = createHmac('sha256', 'test-secret').update(rawOtp).digest('hex');

    it('rejects an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.verifyOtp({ email: 'unknown@b.com', otp: '1234' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an already verified user', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: true }));
      await expect(service.verifyOtp({ email: 'a@b.com', otp: '1234' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when no active OTP exists', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue(null);
      await expect(service.verifyOtp({ email: 'a@b.com', otp: '1234' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects when OTP is expired', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-1',
        userId: 'user-1',
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() - 1000),
        attempts: 0,
        maxAttempts: 5,
      });

      await expect(service.verifyOtp({ email: 'a@b.com', otp: rawOtp })).rejects.toThrow(
        /expired/i,
      );
    });

    it('rejects when OTP is already locked at 5 attempts', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-1',
        userId: 'user-1',
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() + 60000),
        attempts: 5,
        maxAttempts: 5,
      });

      await expect(service.verifyOtp({ email: 'a@b.com', otp: rawOtp })).rejects.toThrow(
        /locked/i,
      );
    });

    it('increments attempts on incorrect OTP and reports remaining attempts', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-1',
        userId: 'user-1',
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() + 60000),
        attempts: 2,
        maxAttempts: 5,
      });

      await expect(service.verifyOtp({ email: 'a@b.com', otp: '0000' })).rejects.toThrow(
        /2 attempts remaining/i,
      );
      expect(prisma.otpVerification.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { attempts: 3 },
      });
    });

    it('locks OTP upon 5th failed attempt', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-1',
        userId: 'user-1',
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() + 60000),
        attempts: 4,
        maxAttempts: 5,
      });

      await expect(service.verifyOtp({ email: 'a@b.com', otp: '0000' })).rejects.toThrow(
        /locked/i,
      );
      expect(prisma.otpVerification.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { attempts: 5 },
      });
    });

    it('successfully verifies with correct OTP, updates user, deletes OTP, and returns session tokens', async () => {
      const unverifiedUser = buildUser({ isVerified: false });
      const verifiedUser = buildUser({ isVerified: true });
      prisma.user.findUnique.mockResolvedValue(unverifiedUser);
      prisma.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-1',
        userId: 'user-1',
        otpHash: hashedOtp,
        expiresAt: new Date(Date.now() + 60000),
        attempts: 1,
        maxAttempts: 5,
      });
      prisma.$transaction.mockResolvedValue([verifiedUser, { id: 'otp-1' }]);

      const result = await service.verifyOtp({ email: 'a@b.com', otp: rawOtp });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: expect.objectContaining({ isVerified: true }),
      });
      expect(prisma.otpVerification.delete).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user.isVerified).toBe(true);
    });
  });

  describe('resendOtp', () => {
    it('returns generic success for unknown email (no enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await service.resendOtp({ email: 'unknown@b.com' });
      expect(res.resendAvailableIn).toBe(60);
      expect(emailService.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('rejects already verified user', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: true }));
      await expect(service.resendOtp({ email: 'a@b.com' })).rejects.toThrow(BadRequestException);
    });

    it('rejects if cooldown is active', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-1',
        userId: 'user-1',
        resendAvailableAt: new Date(Date.now() + 45000),
      });

      await expect(service.resendOtp({ email: 'a@b.com' })).rejects.toThrow(/wait/i);
    });

    it('generates new OTP and resets cooldown when permitted', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser({ isVerified: false }));
      prisma.otpVerification.findFirst.mockResolvedValue({
        id: 'otp-1',
        userId: 'user-1',
        resendAvailableAt: new Date(Date.now() - 5000),
      });

      const res = await service.resendOtp({ email: 'a@b.com' });

      expect(prisma.otpVerification.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(prisma.otpVerification.create).toHaveBeenCalled();
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
