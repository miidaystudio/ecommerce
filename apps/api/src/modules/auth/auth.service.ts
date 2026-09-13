import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../database/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtPayload } from './types/jwt-payload.type';

const ADMIN_ROLES: Role[] = [Role.STAFF, Role.SUPER_ADMIN];

export interface SafeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  phoneNumber: string | null;
  role: Role;
  isVerified: boolean;
  mustChangePassword: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser;
}

export interface RegisterResult {
  message: string;
  email: string;
  requiresVerification: boolean;
  resendAvailableIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const phone = this.normalizePhone(dto);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existing) {
      if (existing.isVerified) {
        throw new ConflictException('Email is already registered');
      }

      // Re-registering with an unverified email updates details and issues a fresh OTP
      const passwordHash = await bcrypt.hash(dto.password, 12);
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          firstName: dto.firstName ?? existing.firstName,
          lastName: dto.lastName ?? existing.lastName,
          phone,
          phoneNumber: phone,
        },
      });

      await this.issueOtpForUser(updated);

      return {
        message: 'Registration pending verification. Please enter the OTP sent to your email.',
        email: updated.email,
        requiresVerification: true,
        resendAvailableIn: 60,
      };
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        phone,
        phoneNumber: phone,
        role: Role.CUSTOMER,
        isVerified: false,
      },
    });

    await this.issueOtpForUser(user);

    return {
      message: 'Registration successful. Please enter the OTP sent to your email.',
      email: user.email,
      requiresVerification: true,
      resendAvailableIn: 60,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('Invalid verification request');
    }

    if (user.isVerified) {
      throw new BadRequestException('Account is already verified. Please sign in.');
    }

    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('No active verification code found. Please request a new one.');
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      throw new BadRequestException(
        'Maximum verification attempts exceeded. This code is locked. Please request a new code.',
      );
    }

    if (otpRecord.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    const matches = this.verifyOtpHash(dto.otp, otpRecord.otpHash);
    if (!matches) {
      const newAttempts = otpRecord.attempts + 1;
      await this.prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: newAttempts },
      });

      const remaining = Math.max(0, otpRecord.maxAttempts - newAttempts);
      if (remaining === 0) {
        throw new BadRequestException(
          'Maximum verification attempts exceeded. This code is locked. Please request a new code.',
        );
      }

      throw new BadRequestException(
        `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    // Correct OTP: update user to verified and delete the single-use OTP
    const [verifiedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      this.prisma.otpVerification.delete({
        where: { id: otpRecord.id },
      }),
    ]);

    return this.issueSession(verifiedUser);
  }

  async resendOtp(dto: ResendOtpDto): Promise<{ message: string; resendAvailableIn: number }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      // Return success without leaking account existence
      return {
        message: 'If an unverified account exists for this email, a new code has been sent.',
        resendAvailableIn: 60,
      };
    }

    if (user.isVerified) {
      throw new BadRequestException('Account is already verified. Please sign in.');
    }

    const activeOtp = await this.prisma.otpVerification.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (activeOtp && activeOtp.resendAvailableAt.getTime() > Date.now()) {
      const remainingSeconds = Math.ceil((activeOtp.resendAvailableAt.getTime() - Date.now()) / 1000);
      throw new BadRequestException(
        `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'} before requesting another code.`,
      );
    }

    await this.issueOtpForUser(user);

    return {
      message: 'A new verification code has been sent to your email.',
      resendAvailableIn: 60,
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.validateCredentials(dto.email, dto.password);
    return this.issueSession(user);
  }

  async adminLogin(dto: LoginDto): Promise<AuthResult> {
    const user = await this.validateCredentials(dto.email, dto.password);
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Not an admin account');
    }
    return this.issueSession(user);
  }

  async refresh(presentedToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(presentedToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.isBlocked) {
      throw new UnauthorizedException('Account is not active');
    }

    const tokens = await this.buildTokens(user);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(tokens.refreshToken),
          expiresAt: this.decodeExpiry(tokens.refreshToken),
        },
      }),
    ]);

    return { ...tokens, user: this.toSafeUser(user) };
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) {
      return;
    }
    const tokenHash = this.hashToken(presentedToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    // Revoke all existing refresh tokens so old sessions cannot be refreshed
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(updatedUser);
  }

  private async issueOtpForUser(user: { id: string; email: string }): Promise<void> {
    const otp = this.generateOtp();
    const otpHash = this.hashOtp(otp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    const resendAvailableAt = new Date(now.getTime() + 60 * 1000); // 60 seconds

    await this.prisma.$transaction([
      this.prisma.otpVerification.deleteMany({
        where: { userId: user.id },
      }),
      this.prisma.otpVerification.create({
        data: {
          userId: user.id,
          otpHash,
          expiresAt,
          resendAvailableAt,
          attempts: 0,
          maxAttempts: 5,
        },
      }),
    ]);

    await this.emailService.sendOtpEmail(user.email, otp);
  }

  private generateOtp(): string {
    return randomInt(1000, 10000).toString();
  }

  private hashOtp(otp: string): string {
    const secret = this.config.getOrThrow<string>('jwt.accessSecret');
    return createHmac('sha256', secret).update(otp).digest('hex');
  }

  private verifyOtpHash(candidateOtp: string, storedHash: string): boolean {
    const candidateHash = this.hashOtp(candidateOtp);
    const candidateBuf = Buffer.from(candidateHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (candidateBuf.length !== storedBuf.length) {
      return false;
    }
    return timingSafeEqual(candidateBuf, storedBuf);
  }

  private normalizePhone(dto: RegisterDto): string {
    const raw = dto.phoneNumber ?? dto.phone;
    if (!raw || !raw.trim()) {
      throw new BadRequestException('Phone number is required');
    }
    const trimmed = raw.trim();
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      throw new BadRequestException('Phone number must contain between 7 and 15 digits');
    }
    return trimmed;
  }

  private async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.isBlocked) {
      throw new ForbiddenException('Account is blocked');
    }
    if (!user.isVerified) {
      throw new ForbiddenException('Account is not verified. Please verify your email with the OTP sent.');
    }
    return user;
  }

  private async issueSession(user: User): Promise<AuthResult> {
    const tokens = await this.buildTokens(user);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(tokens.refreshToken),
        expiresAt: this.decodeExpiry(tokens.refreshToken),
      },
    });
    return { ...tokens, user: this.toSafeUser(user) };
  }

  private async buildTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessTtl', '15m'),
      }),
      // jti guarantees each refresh token is unique even when two are issued in the
      // same second with an otherwise identical payload (iat/exp are second-granular).
      this.jwt.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<string>('jwt.refreshTtl', '7d'),
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private decodeExpiry(token: string): Date {
    const decoded = this.jwt.decode(token) as { exp?: number } | null;
    if (!decoded?.exp) {
      throw new UnauthorizedException('Malformed token');
    }
    return new Date(decoded.exp * 1000);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      phoneNumber: user.phoneNumber ?? user.phone,
      role: user.role,
      isVerified: user.isVerified,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
