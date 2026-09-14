import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { ThrottlerStorage, ThrottlerStorageService, getStorageToken } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/common/email/email.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('OTP Verification & Registration Security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: ThrottlerStorageService;
  let sendOtpSpy: jest.SpyInstance;

  const stamp = Date.now();
  const password = 'Password123!';
  const phone = '+91 98765 43210';
  const email = (label: string) => `otp_test_${stamp}_${label}@miiday.test`;

  const lastOtpFor = (address: string): string => {
    const calls = sendOtpSpy.mock.calls.filter((call) => call[0] === address);
    return calls[calls.length - 1][1] as string;
  };

  const register = (address: string, pwd = password) =>
    request(app.getHttpServer()).post('/api/auth/register').send({ email: address, password: pwd, phoneNumber: phone });

  const verify = (address: string, otp: string, pwd = password) =>
    request(app.getHttpServer()).post('/api/auth/verify-otp').send({ email: address, otp, password: pwd });

  const resend = (address: string) =>
    request(app.getHttpServer()).post('/api/auth/resend-otp').send({ email: address });

  async function expireCooldown(address: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
    await prisma.otpVerification.updateMany({
      where: { userId: user.id },
      data: { resendAvailableAt: new Date(Date.now() - 5000), updatedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
  }

  beforeAll(async () => {
    sendOtpSpy = jest.spyOn(EmailService.prototype, 'sendOtpEmail');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get<ThrottlerStorage>(getStorageToken()) as ThrottlerStorageService;
  });

  afterEach(() => {
    storage?.storage?.clear();
  });

  afterAll(async () => {
    sendOtpSpy.mockRestore();
    await prisma.user.deleteMany({ where: { email: { contains: `otp_test_${stamp}` } } });
    await app.close();
  });

  describe('Registration and phone validation', () => {
    it('requires a phone number', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: email('nophone'), password })
        .expect(400);
    });

    it('rejects a phone number with too few digits, even when padded with separators', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: email('badphone'), password, phoneNumber: '(12) 34-5' })
        .expect(400);
    });

    it('accepts international formats and the legacy `phone` field', async () => {
      await register(email('intl')).expect(201);
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: email('legacy'), password, phone: '+44 20 7946 0958' })
        .expect(201);
    });

    it('creates an unverified account, stores only a hash, and never returns or logs the code', async () => {
      const logs: string[] = [];
      const capture = (...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      };
      const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
        jest.spyOn(Logger.prototype, level).mockImplementation(capture),
      );

      const res = await register(email('main')).expect(201);
      spies.forEach((spy) => spy.mockRestore());

      const otp = lastOtpFor(email('main'));
      expect(res.body.requiresVerification).toBe(true);
      expect(res.body.resendAvailableIn).toBe(60);
      expect(JSON.stringify(res.body)).not.toContain(otp);
      expect(logs.join('\n')).not.toContain(otp);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: email('main') } });
      expect(user.isVerified).toBe(false);
      const record = await prisma.otpVerification.findFirstOrThrow({ where: { userId: user.id } });
      expect(record.otpHash).toMatch(/^[0-9a-f]{64}$/);
      expect(record.otpHash).not.toContain(otp);
    });

    it('blocks login until the account is verified', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: email('main'), password })
        .expect(403);
      expect(res.body.message).toMatch(/not verified/i);
    });
  });

  describe('Brute-force resistance', () => {
    it('locks a code after 5 wrong attempts, after which even the right code is refused', async () => {
      const address = email('main');
      const realOtp = lastOtpFor(address);
      const wrong = realOtp === '0000' ? '1111' : '0000';

      for (const remaining of [4, 3, 2, 1]) {
        const res = await verify(address, wrong).expect(400);
        expect(res.body.message).toContain(`${remaining} attempt`);
      }
      expect((await verify(address, wrong).expect(400)).body.message).toMatch(/locked/i);
      expect((await verify(address, realOtp).expect(400)).body.message).toMatch(/locked/i);
    });

    it('holds a replacement code back after a lockout, well beyond the normal cooldown', async () => {
      const address = email('main');
      const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
      await prisma.otpVerification.updateMany({
        where: { userId: user.id },
        data: { resendAvailableAt: new Date(Date.now() - 5000) },
      });

      const res = await resend(address).expect(400);
      expect(res.body.message).toMatch(/wait (8|9)\d\d seconds/);
    });

    it('never lets parallel guesses exceed the attempt limit', async () => {
      const address = email('parallel');
      await register(address).expect(201);
      const realOtp = lastOtpFor(address);
      const guesses = Array.from({ length: 30 }, (_, i) => String(i).padStart(4, '0')).filter((g) => g !== realOtp);

      await Promise.all(guesses.map((guess) => verify(address, guess)));

      const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
      const record = await prisma.otpVerification.findFirstOrThrow({ where: { userId: user.id } });
      expect(record.attempts).toBe(5);
      expect((await verify(address, realOtp).expect(400)).body.message).toMatch(/locked/i);
    });
  });

  describe('Cooldown and resend', () => {
    it('enforces the resend cooldown server-side', async () => {
      const address = email('cooldown');
      await register(address).expect(201);
      expect((await resend(address).expect(400)).body.message).toMatch(/wait.*second/i);
    });

    it('does not let re-registering bypass the cooldown', async () => {
      const address = email('cooldown');
      const before = sendOtpSpy.mock.calls.length;
      await register(address).expect(201);
      expect(sendOtpSpy.mock.calls.length).toBe(before);
    });

    it('issues a fresh code with reset attempts once the cooldown has passed', async () => {
      const address = email('cooldown');
      await expireCooldown(address);
      const res = await resend(address).expect(200);
      expect(res.body.resendAvailableIn).toBe(60);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
      const record = await prisma.otpVerification.findFirstOrThrow({ where: { userId: user.id } });
      expect(record.attempts).toBe(0);
    });

    it('answers identically for unknown and already-verified emails', async () => {
      const unknown = await resend(email('nobody')).expect(200);
      await prisma.user.create({
        data: { email: email('verified'), passwordHash: 'x', isVerified: true, emailVerifiedAt: new Date() },
      });
      const verified = await resend(email('verified')).expect(200);
      expect(unknown.body).toEqual(verified.body);
    });
  });

  describe('Expiry', () => {
    it('rejects an expired code', async () => {
      const address = email('cooldown');
      const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
      await prisma.otpVerification.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect((await verify(address, lastOtpFor(address)).expect(400)).body.message).toMatch(/expired/i);
    });
  });

  describe('Account takeover via re-registration', () => {
    it("rejects the owner's code once someone else re-registers the email with a different password", async () => {
      const address = email('takeover');
      await register(address, 'VictimPass123!').expect(201);
      const victimCode = lastOtpFor(address);

      await register(address, 'AttackerPass123!').expect(201);

      // The inbox owner enters their code with their own password: the account
      // must not become verified under the attacker's password.
      await verify(address, victimCode, 'VictimPass123!').expect(400);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
      expect(user.isVerified).toBe(false);
    });

    it('lets the owner reclaim the email by re-registering, then verify', async () => {
      const address = email('takeover');
      await expireCooldown(address);
      await register(address, 'VictimPass123!').expect(201);

      const res = await verify(address, lastOtpFor(address), 'VictimPass123!').expect(200);
      expect(res.body.user.isVerified).toBe(true);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: address, password: 'AttackerPass123!' })
        .expect(401);
    });
  });

  describe('Successful verification and single use', () => {
    it('activates the account, issues a session, and refuses the same code again', async () => {
      const address = email('success');
      await register(address).expect(201);
      const code = lastOtpFor(address);

      const res = await verify(address, code).expect(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.isVerified).toBe(true);
      const cookies = (res.headers['set-cookie'] as unknown as string[]).join(';');
      expect(cookies).toContain('refresh_token=');
      expect(cookies).toContain('HttpOnly');

      await verify(address, code).expect(400);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
      expect(await prisma.otpVerification.count({ where: { userId: user.id } })).toBe(0);

      await request(app.getHttpServer()).post('/api/auth/login').send({ email: address, password }).expect(200);
    });

    it('lets only one of several simultaneous correct submissions succeed', async () => {
      const address = email('double');
      await register(address).expect(201);
      const code = lastOtpFor(address);

      const results = await Promise.all(Array.from({ length: 5 }, () => verify(address, code)));
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(results.every((r) => r.status === 200 || r.status === 400)).toBe(true);
    });
  });

  describe('Rate limiting on OTP endpoints', () => {
    it('throttles verify-otp', async () => {
      process.env.THROTTLE_OTP_VERIFY_LIMIT = '2';
      try {
        await verify(email('rl'), '1111');
        await verify(email('rl'), '1111');
        expect((await verify(email('rl'), '1111')).status).toBe(429);
      } finally {
        process.env.THROTTLE_OTP_VERIFY_LIMIT = '100000';
      }
    });

    it('throttles resend-otp', async () => {
      process.env.THROTTLE_OTP_RESEND_LIMIT = '2';
      try {
        await resend(email('rl'));
        await resend(email('rl'));
        expect((await resend(email('rl'))).status).toBe(429);
      } finally {
        process.env.THROTTLE_OTP_RESEND_LIMIT = '100000';
      }
    });
  });
});
