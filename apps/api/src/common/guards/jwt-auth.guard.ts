import { ExecutionContext, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../../modules/auth/types/jwt-payload.type';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  constructor(@Optional() private readonly reflector?: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const parentCanActivate = (await super.canActivate(context)) as boolean;
    if (!parentCanActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (user?.mustChangePassword) {
      const allowed = this.reflector?.getAllAndOverride<boolean | undefined>(
        ALLOW_PENDING_PASSWORD_CHANGE_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!allowed) {
        throw new ForbiddenException(
          'Password change required on first login before accessing the application',
        );
      }
    }

    return true;
  }
}
