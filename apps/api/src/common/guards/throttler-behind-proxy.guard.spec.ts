import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ThrottlerBehindProxyGuard } from './throttler-behind-proxy.guard';

const ACCESS_SECRET = 'test-access-secret';

// getTracker is protected; this exposes it without loosening the guard itself.
class TestableGuard extends ThrottlerBehindProxyGuard {
  constructor() {
    const config = { getOrThrow: () => ACCESS_SECRET } as unknown as ConfigService;
    // The tracker logic reads nothing off the throttler deps.
    super({ throttlers: [] }, {} as never, {} as never, config);
  }

  track(req: Partial<Request>): Promise<string> {
    return this.getTracker(req as Request);
  }
}

describe('ThrottlerBehindProxyGuard.getTracker', () => {
  let guard: TestableGuard;
  const jwt = new JwtService();
  const sign = (sub: string, secret = ACCESS_SECRET, expiresIn: string | number = '15m') =>
    jwt.sign({ sub, email: `${sub}@test.com`, role: 'CUSTOMER' }, { secret, expiresIn });

  beforeEach(() => {
    guard = new TestableGuard();
  });

  it('keys on the authenticated user when one is already attached', async () => {
    await expect(
      guard.track({ user: { id: 'user-1', email: 'a@test.com', role: 'CUSTOMER' }, ip: '1.2.3.4' } as never),
    ).resolves.toBe('user:user-1');
  });

  it('verifies the bearer token and keys on its user id (global guards run before JwtAuthGuard)', async () => {
    const tracker = await guard.track({ headers: { authorization: `Bearer ${sign('user-7')}` }, ip: '1.2.3.4' } as never);
    expect(tracker).toBe('user:user-7');
  });

  it('puts a refreshed token in the same bucket as the old one, so refreshing cannot reset a limit', async () => {
    const first = await guard.track({ headers: { authorization: `Bearer ${sign('user-7')}` } } as never);
    const refreshed = await guard.track({ headers: { authorization: `Bearer ${sign('user-7', ACCESS_SECRET, '30m')}` } } as never);
    expect(refreshed).toBe(first);
  });

  it('gives two different users two different buckets on the same IP', async () => {
    const a = await guard.track({ headers: { authorization: `Bearer ${sign('user-a')}` }, ip: '1.2.3.4' } as never);
    const b = await guard.track({ headers: { authorization: `Bearer ${sign('user-b')}` }, ip: '1.2.3.4' } as never);
    expect(a).not.toBe(b);
  });

  it('refuses a token signed with the wrong secret, so a forged sub cannot target a victim’s bucket', async () => {
    const forged = sign('victim-user', 'attacker-chosen-secret');
    await expect(guard.track({ headers: { authorization: `Bearer ${forged}` }, ip: '6.6.6.6' } as never)).resolves.toBe(
      'ip:6.6.6.6',
    );
  });

  it('refuses an unsigned token that merely decodes to a user id', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: 'victim-user' })).toString('base64url');
    await expect(
      guard.track({ headers: { authorization: `Bearer ${header}.${body}.` }, ip: '6.6.6.6' } as never),
    ).resolves.toBe('ip:6.6.6.6');
  });

  it('falls back to IP for an expired token', async () => {
    const expired = sign('user-7', ACCESS_SECRET, -10);
    await expect(guard.track({ headers: { authorization: `Bearer ${expired}` }, ip: '1.2.3.4' } as never)).resolves.toBe(
      'ip:1.2.3.4',
    );
  });

  it('never puts the raw token in the tracker key', async () => {
    const token = sign('user-7');
    const tracker = await guard.track({ headers: { authorization: `Bearer ${token}` } } as never);
    expect(tracker).not.toContain(token);
  });

  it('uses the forwarded client IP when Express has been told to trust the proxy', async () => {
    await expect(guard.track({ ips: ['9.9.9.9', '10.0.0.1'], ip: '10.0.0.1', headers: {} } as never)).resolves.toBe(
      'ip:9.9.9.9',
    );
  });

  it('falls back to the socket IP when there is no proxy chain', async () => {
    await expect(guard.track({ ips: [], ip: '1.2.3.4', headers: {} } as never)).resolves.toBe('ip:1.2.3.4');
  });

  it('ignores a malformed Authorization header rather than keying on it', async () => {
    await expect(guard.track({ headers: { authorization: 'Bearer ' }, ip: '1.2.3.4' } as never)).resolves.toBe('ip:1.2.3.4');
    await expect(guard.track({ headers: { authorization: 'Basic abc123' }, ip: '1.2.3.4' } as never)).resolves.toBe('ip:1.2.3.4');
    await expect(guard.track({ headers: { authorization: 'Bearer not.a.jwt' }, ip: '1.2.3.4' } as never)).resolves.toBe('ip:1.2.3.4');
  });

  it('still returns a usable key when nothing identifies the caller', async () => {
    await expect(guard.track({ headers: {} } as never)).resolves.toBe('ip:unknown');
  });
});
