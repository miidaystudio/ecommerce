import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthenticatedUser, JwtPayload } from '../../modules/auth/types/jwt-payload.type';

/**
 * Chooses what the rate limit is counted against: the verified user when the
 * request carries a valid access token, the client IP otherwise.
 *
 * IP alone is wrong in both directions on authenticated routes: customers
 * behind one NAT (an office, a mobile carrier) would share a bucket and lock
 * each other out, while an attacker holding a token could rotate IPs freely.
 *
 * The token is *verified* here, not just decoded. This guard is global and
 * Nest runs global guards before route guards, so `req.user` isn't populated
 * yet and the guard has to establish the identity itself. Verification matters
 * both ways:
 *  - an unverified `sub` could be forged to exhaust a victim's bucket, and
 *  - keying on the raw token (the previous approach) let a caller reset their
 *    own bucket just by refreshing it — which is why /auth/refresh had to sit in
 *    the strict auth tier, where legitimate page reloads then tripped it.
 * Keyed on the verified user id, neither is possible, and a refreshed token
 * lands in the same bucket as the old one.
 *
 * Anonymous requests (login, register, refresh) fall back to IP, which is only
 * meaningful if TRUST_PROXY is set correctly for the deployment — see main.ts.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  private readonly jwt = new JwtService();

  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Request): Promise<string> {
    const user = req.user as AuthenticatedUser | undefined;
    if (user?.id) {
      return `user:${user.id}`;
    }

    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim();
      if (token.length > 0) {
        try {
          const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
            secret: this.config.getOrThrow<string>('jwt.accessSecret'),
          });
          if (payload?.sub) {
            return `user:${payload.sub}`;
          }
        } catch {
          // Invalid or expired: not an identity. Counted against the IP instead;
          // JwtAuthGuard will reject the request itself.
        }
      }
    }

    const forwarded = Array.isArray(req.ips) && req.ips.length > 0 ? req.ips[0] : undefined;
    return `ip:${forwarded ?? req.ip ?? 'unknown'}`;
  }
}
