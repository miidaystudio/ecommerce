import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  function buildGuard(required: Role[] | undefined): RolesGuard {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it('allows when no roles are required', () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });

  it('allows a user whose role matches', () => {
    const guard = buildGuard([Role.SUPER_ADMIN, Role.STAFF]);
    expect(guard.canActivate(contextWithUser({ id: '1', role: Role.STAFF }))).toBe(true);
  });

  it('rejects a user whose role does not match', () => {
    const guard = buildGuard([Role.SUPER_ADMIN]);
    expect(() => guard.canActivate(contextWithUser({ id: '1', role: Role.CUSTOMER }))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when there is no authenticated user', () => {
    const guard = buildGuard([Role.STAFF]);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
