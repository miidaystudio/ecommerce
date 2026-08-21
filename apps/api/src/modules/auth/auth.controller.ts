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
import { CookieOptions, Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { AuthResult, AuthService, SafeUser } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
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
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.authService.register(dto);
    return this.respondWithSession(result, res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.authService.login(dto);
    return this.respondWithSession(result, res);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.authService.adminLogin(dto);
    return this.respondWithSession(result, res);
  }

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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const token = req.cookies?.[this.cookieName] as string | undefined;
    await this.authService.logout(token);
    res.clearCookie(this.cookieName, { path: '/' });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private respondWithSession(result: AuthResult, res: Response): SessionResponse {
    res.cookie(this.cookieName, result.refreshToken, this.buildCookieOptions(result.refreshToken));
    return { accessToken: result.accessToken, user: result.user };
  }

  private buildCookieOptions(refreshToken: string): CookieOptions {
    const decoded = this.jwt.decode(refreshToken) as { exp?: number } | null;
    const maxAge = decoded?.exp
      ? Math.max(decoded.exp * 1000 - Date.now(), 0)
      : undefined;
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('jwt.cookieSecure', false),
      sameSite: 'lax',
      path: '/',
      maxAge,
    };
  }
}
