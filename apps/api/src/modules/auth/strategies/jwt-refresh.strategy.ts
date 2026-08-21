import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt-payload.type';

export interface RefreshRequestUser {
  id: string;
  email: string;
  role: JwtPayload['role'];
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  private readonly cookieName: string;

  constructor(config: ConfigService) {
    const cookieName = config.get<string>('jwt.refreshCookieName', 'refresh_token');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request): string | null => req?.cookies?.[cookieName] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
    this.cookieName = cookieName;
  }

  validate(req: Request, payload: JwtPayload): RefreshRequestUser {
    const refreshToken = req?.cookies?.[this.cookieName];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    return { id: payload.sub, email: payload.email, role: payload.role, refreshToken };
  }
}
