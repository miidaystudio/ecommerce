import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
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
const BCRYPT_ROUNDS = 12;

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
// After a code is locked out, the next one is held back much longer. Every new
// code brings a fresh set of attempts, so without this an attacker could keep
// cycling lock → resend and try 5 of the 10,000 codes every minute.
const OTP_LOCKOUT_COOLDOWN_MS = 15 * 60 * 1000;
const OTP_LOCKED_MESSAGE =
  'Too many incorrect attempts. This code is locked. Please request a new code.';

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
    const phone = (dto.phoneNumber ?? dto.phone ?? '').trim();
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (existing?.isVerified) {
      throw new ConflictException('Email is already registered');
    }

    // Re-registering an unverified email replaces its details. This is safe
    // only because verifyOtp also demands the current password: whoever set the
    // password must be the one who proves ownership of the inbox.
    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            firstName: dto.firstName ?? existing.firstName,
            lastName: dto.lastName ?? existing.lastName,
            phone,
            phoneNumber: phone,
          },
        })
      : await this.prisma.user.create({
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

    // Re-registering must not become a way around the resend cooldown.
    const waitSeconds = await this.resendWaitSeconds(user.id);
    if (waitSeconds === 0) {
      await this.issueOtpForUser(user);
    }

    return {
      message: 'Registration received. Please enter the verification code sent to your email.',
      email: user.email,
      requiresVerification: true,
      resendAvailableIn: waitSeconds || OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.isVerified) {
      throw new BadRequestException('Invalid verification request');
    }

    const otpRecord = await this.prisma.otpVerification.findFirst({
      where: { userId: user.id, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otpRecord) {
      throw new BadRequestException('No active verification code found. Please request a new one.');
    }
    if (otpRecord.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    // The attempt is reserved atomically before the code is checked. A plain
    // read-then-increment let parallel guesses all observe the same count and
    // run far past the five-attempt limit.
    const reserved = await this.prisma.otpVerification.updateMany({
      where: { id: otpRecord.id, attempts: { lt: otpRecord.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (reserved.count === 0) {
      throw new BadRequestException(OTP_LOCKED_MESSAGE);
    }

    // Both must match, and a failure doesn't say which: the code proves the
    // inbox, the password proves this is the person who registered.
    const [codeMatches, passwordMatches] = await Promise.all([
      Promise.resolve(this.verifyOtpHash(dto.otp, otpRecord.otpHash)),
      bcrypt.compare(dto.password, user.passwordHash),
    ]);

    if (!codeMatches || !passwordMatches) {
      const remaining = Math.max(0, otpRecord.maxAttempts - (otpRecord.attempts + 1));
      if (remaining === 0) {
        throw new BadRequestException(OTP_LOCKED_MESSAGE);
      }
      throw new BadRequestException(
        `Invalid verification code or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      );
    }

    const verifiedUser = await this.prisma.$transaction(async (tx) => {
      // Single use: only the request that actually removes the code may proceed.
      const consumed = await tx.otpVerification.deleteMany({ where: { id: otpRecord.id } });
      if (consumed.count === 0) {
        throw new BadRequestException('This verification code has already been used.');
      }
      return tx.user.update({
        where: { id: user.id },
        data: { isVerified: true, emailVerifiedAt: new Date() },
      });
    });

    return this.issueSession(verifiedUser);
  }

  async resendOtp(dto: ResendOtpDto): Promise<{ message: string; resendAvailableIn: number }> {
    const genericResponse = {
      message: 'If an unverified account exists for this email, a new code has been sent.',
      resendAvailableIn: OTP_RESEND_COOLDOWN_SECONDS,
    };

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.isVerified) {
      return genericResponse;
    }

    const waitSeconds = await this.resendWaitSeconds(user.id);
    if (waitSeconds > 0) {
      throw new BadRequestException(
        `Please wait ${waitSeconds} second${waitSeconds === 1 ? '' : 's'} before requesting another code.`,
      );
    }

    await this.issueOtpForUser(user);
    return genericResponse;
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

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    const [updatedUser] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return this.issueSession(updatedUser);
  }

  private async issueOtpForUser(user: { id: string; email: string }): Promise<void> {
    const otp = randomInt(1000, 10000).toString();
    const now = Date.now();

    const record = await this.prisma.$transaction(async (tx) => {
      await tx.otpVerification.deleteMany({ where: { userId: user.id } });
      return tx.otpVerification.create({
        data: {
          userId: user.id,
          otpHash: this.hashOtp(otp),
          expiresAt: new Date(now + OTP_TTL_MS),
          resendAvailableAt: new Date(now + OTP_RESEND_COOLDOWN_SECONDS * 1000),
          attempts: 0,
          maxAttempts: OTP_MAX_ATTEMPTS,
        },
      });
    });

    try {
      await this.emailService.sendOtpEmail(user.email, otp);
    } catch {
      // The code never reached the customer, so they must be able to ask again
      // straight away rather than sit out a cooldown for an email that failed.
      await this.prisma.otpVerification.deleteMany({ where: { id: record.id } });
      throw new ServiceUnavailableException(
        "We couldn't send your verification code right now. Please try again in a moment.",
      );
    }
  }

  private async resendWaitSeconds(userId: string): Promise<number> {
    const latest = await this.prisma.otpVerification.findFirst({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      return 0;
    }

    let availableAt = latest.resendAvailableAt.getTime();
    if (latest.attempts >= latest.maxAttempts) {
      availableAt = Math.max(availableAt, latest.updatedAt.getTime() + OTP_LOCKOUT_COOLDOWN_MS);
    }
    return Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
  }

  // Keyed with a purpose-specific derivative of the access secret, so a leaked
  // otp_verifications table can't be brute-forced (the key isn't in the DB) and
  // the OTP hash never shares a key with JWT signatures.
  private hashOtp(otp: string): string {
    const key = createHmac('sha256', this.config.getOrThrow<string>('jwt.accessSecret'))
      .update('otp-verification-v1')
      .digest();
    return createHmac('sha256', key).update(otp).digest('hex');
  }

  private verifyOtpHash(candidateOtp: string, storedHash: string): boolean {
    const candidate = Buffer.from(this.hashOtp(candidateOtp), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
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
      // jti keeps two refresh tokens issued in the same second distinct (iat/exp are
      // second-granular), since tokens are looked up by hash.
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
