import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './types/jwt-payload.type';

const ADMIN_ROLES: Role[] = [Role.STAFF, Role.SUPER_ADMIN];

export interface SafeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        phone: dto.phone ?? null,
        role: Role.CUSTOMER,
      },
    });

    return this.issueSession(user);
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
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
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
      role: user.role,
    };
  }
}
