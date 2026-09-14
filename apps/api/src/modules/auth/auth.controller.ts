import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import {
  AUTH_THROTTLE,
  OTP_RESEND_THROTTLE,
  OTP_VERIFY_THROTTLE,
} from '../../config/throttle.config';
import { AllowPendingPasswordChange } from '../../common/decorators/allow-pending-password-change.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { AuthResult, AuthService, RegisterResult, SafeUser } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshRequestUser } from './strategies/jwt-refresh.strategy';
import { AuthenticatedUser } from './types/jwt-payload.type';

interface SessionResponse {
  accessToken: string;
  user: SafeUser;
}

@Controller('auth')
export class AuthController {
  private readonly cookieName: string;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {
    this.cookieName = this.config.get<string>('jwt.refreshCookieName', 'refresh_token');
  }

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<RegisterResult> {
    return this.authService.register(dto);
  }

  @Post('verify-otp')
  @Throttle(OTP_VERIFY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.authService.verifyOtp(dto);
    return this.respondWithSession(result, res);
  }

  @Post('resend-otp')
  @Throttle(OTP_RESEND_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async resendOtp(
    @Body() dto: ResendOtpDto,
  ): Promise<{ message: string; resendAvailableIn: number }> {
    return this.authService.resendOtp(dto);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.authService.login(dto);
    return this.respondWithSession(result, res);
  }

  @Post('admin/login')
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async adminLogin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.authService.adminLogin(dto);
    return this.respondWithSession(result, res);
  }

  // Default tier, not the strict auth tier. A refresh token can't be guessed —
  // it is a signed JWT that is also matched against a hashed DB record — and
  // the app calls this on every full page load, so the 8/min auth limit signed
  // real users out. Refreshing no longer resets any rate-limit bucket (they are
  // keyed on the verified user id — see ThrottlerBehindProxyGuard).
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(
    @CurrentUser() user: RefreshRequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.authService.refresh(user.refreshToken);
    return this.respondWithSession(result, res);
  }

  @Post('change-password')
  @Throttle(AUTH_THROTTLE)
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.authService.changePassword(user.id, dto);
    return this.respondWithSession(result, res);
  }

  @Post('logout')
  @SkipThrottle()
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const token = req.cookies?.[this.cookieName] as string | undefined;
    await this.authService.logout(token);
    // Must repeat the attributes the cookie was set with: browsers ignore a
    // cross-site clearing Set-Cookie that isn't also SameSite=None; Secure.
    const { maxAge: _maxAge, ...clearOptions } = this.buildCookieOptions();
    res.clearCookie(this.cookieName, clearOptions);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowPendingPasswordChange()
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private respondWithSession(result: AuthResult, res: Response): SessionResponse {
    res.cookie(this.cookieName, result.refreshToken, this.buildCookieOptions(result.refreshToken));
    return { accessToken: result.accessToken, user: result.user };
  }

  private buildCookieOptions(refreshToken?: string): CookieOptions {
    const decoded = refreshToken ? (this.jwt.decode(refreshToken) as { exp?: number } | null) : null;
    const maxAge = decoded?.exp ? Math.max(decoded.exp * 1000 - Date.now(), 0) : undefined;
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>('jwt.refreshCookieSameSite', 'lax');
    return {
      httpOnly: true,
      // Browsers reject SameSite=None without Secure, so None always implies it.
      secure: sameSite === 'none' || this.config.get<boolean>('jwt.cookieSecure', false),
      sameSite,
      path: '/',
      maxAge,
    };
  }
}
