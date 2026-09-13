import { INestApplication, ValidationPipe } from '@nestjs/common';
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
  const testEmail = `otp_test_${stamp}@miiday.test`;
  const password = 'Password123!';
  const phone = '+91 98765 43210';

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

  describe('Registration and Phone Validation', () => {
    it('rejects registration with invalid phone format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `invalid_phone_${stamp}@miiday.test`,
          password,
          phone: '1234', // too short
        });
      expect(res.status).toBe(400);
    });

    it('creates unverified account and stores hashed OTP without leaking plaintext', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password,
          phone,
          firstName: 'Security',
          lastName: 'Tester',
        })
        .expect(201);

      expect(res.body.requiresVerification).toBe(true);
      expect(res.body.email).toBe(testEmail);
      expect(res.body.resendAvailableIn).toBe(60);

      // Plaintext OTP is NEVER returned in response
      expect(res.body).not.toHaveProperty('otp');
      expect(res.body).not.toHaveProperty('code');

      // Database verification
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      expect(user).toBeDefined();
      expect(user!.isVerified).toBe(false);
      expect(user!.emailVerifiedAt).toBeNull();
      expect(user!.phoneNumber).toBe(phone);

      const otpRecord = await prisma.otpVerification.findFirst({
        where: { userId: user!.id },
      });
      expect(otpRecord).toBeDefined();
      expect(otpRecord!.attempts).toBe(0);
      expect(otpRecord!.maxAttempts).toBe(5);
      // Hash is 64 hex characters (SHA-256 HMAC), never 4-digit plaintext
      expect(otpRecord!.otpHash).toHaveLength(64);
      expect(otpRecord!.otpHash).not.toMatch(/^\d{4}$/);
    });

    it('blocks login until account is verified', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password })
        .expect(403);

      expect(res.body.message).toMatch(/not verified/i);
    });
  });

  describe('Brute-force resistance & Attempt lockout', () => {
    it('increments attempts on wrong OTP and locks code after 5 consecutive failures', async () => {
      // Find what the actual OTP was from spy
      const lastCall = sendOtpSpy.mock.calls[sendOtpSpy.mock.calls.length - 1];
      const realOtp = lastCall[1];
      expect(realOtp).toMatch(/^\d{4}$/);

      // Attempt 1: wrong code
      const r1 = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: '0000' })
        .expect(400);
      expect(r1.body.message).toContain('4 attempts remaining');

      // Attempt 2: wrong code
      const r2 = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: '0001' })
        .expect(400);
      expect(r2.body.message).toContain('3 attempts remaining');

      // Attempt 3: wrong code
      const r3 = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: '0002' })
        .expect(400);
      expect(r3.body.message).toContain('2 attempts remaining');

      // Attempt 4: wrong code
      const r4 = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: '0003' })
        .expect(400);
      expect(r4.body.message).toContain('1 attempt remaining');

      // Attempt 5: locks code
      const r5 = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: '0004' })
        .expect(400);
      expect(r5.body.message).toMatch(/locked/i);

      // Attempt 6 with the REAL code is now REJECTED because code is locked!
      const r6 = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: realOtp })
        .expect(400);
      expect(r6.body.message).toMatch(/locked/i);
    });
  });

  describe('Cooldown & Resend Flow', () => {
    it('enforces 60-second cooldown on resend', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/resend-otp')
        .send({ email: testEmail })
        .expect(400);

      expect(res.body.message).toMatch(/wait.*second/i);
    });

    it('allows resend once cooldown passes, invalidating the old locked code', async () => {
      // Simulate cooldown expiry in DB
      const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
      await prisma.otpVerification.updateMany({
        where: { userId: user.id },
        data: { resendAvailableAt: new Date(Date.now() - 5000) },
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/resend-otp')
        .send({ email: testEmail })
        .expect(200);

      expect(res.body.resendAvailableIn).toBe(60);

      // Verify new OTP was sent
      const lastCall = sendOtpSpy.mock.calls[sendOtpSpy.mock.calls.length - 1];
      const newOtp = lastCall[1];
      expect(newOtp).toMatch(/^\d{4}$/);

      // Verify attempts reset to 0 in DB
      const freshOtp = await prisma.otpVerification.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(freshOtp.attempts).toBe(0);
    });
  });

  describe('Expiry handling', () => {
    it('rejects expired OTP', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
      const lastCall = sendOtpSpy.mock.calls[sendOtpSpy.mock.calls.length - 1];
      const currentOtp = lastCall[1];

      // Simulate expired timestamp
      await prisma.otpVerification.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: currentOtp })
        .expect(400);

      expect(res.body.message).toMatch(/expired/i);
    });
  });

  describe('Successful verification and single-use enforcement', () => {
    it('verifies valid code, activates account, issues session, and enforces single-use', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });

      // Reset cooldown and request fresh code
      await prisma.otpVerification.updateMany({
        where: { userId: user.id },
        data: { resendAvailableAt: new Date(Date.now() - 5000) },
      });

      await request(app.getHttpServer())
        .post('/api/auth/resend-otp')
        .send({ email: testEmail })
        .expect(200);

      const latestCall = sendOtpSpy.mock.calls[sendOtpSpy.mock.calls.length - 1];
      const freshCode = latestCall[1];

      // Verify successfully
      const res = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: freshCode })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.isVerified).toBe(true);

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.join(';')).toContain('refresh_token=');
      expect(cookies.join(';')).toContain('HttpOnly');

      // Database state
      const updatedUser = await prisma.user.findUniqueOrThrow({ where: { email: testEmail } });
      expect(updatedUser.isVerified).toBe(true);
      expect(updatedUser.emailVerifiedAt).not.toBeNull();

      // SINGLE-USE ENFORCEMENT: Re-submitting the same code now fails!
      await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ email: testEmail, otp: freshCode })
        .expect(400);

      // Subsequent login now works!
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password })
        .expect(200);

      expect(loginRes.body.accessToken).toBeDefined();
      expect(loginRes.body.user.isVerified).toBe(true);
    });
  });

  describe('Rate limiting on OTP endpoints', () => {
    it('throttles verify-otp when request rate exceeds limit', async () => {
      process.env.THROTTLE_OTP_VERIFY_LIMIT = '2';
      // 2 requests allowed
      await request(app.getHttpServer()).post('/api/auth/verify-otp').send({ email: testEmail, otp: '1111' });
      await request(app.getHttpServer()).post('/api/auth/verify-otp').send({ email: testEmail, otp: '1111' });
      // 3rd gets 429
      const res = await request(app.getHttpServer()).post('/api/auth/verify-otp').send({ email: testEmail, otp: '1111' });
      expect(res.status).toBe(429);
      process.env.THROTTLE_OTP_VERIFY_LIMIT = '100000';
    });

    it('throttles resend-otp when request rate exceeds limit', async () => {
      process.env.THROTTLE_OTP_RESEND_LIMIT = '2';
      await request(app.getHttpServer()).post('/api/auth/resend-otp').send({ email: testEmail });
      await request(app.getHttpServer()).post('/api/auth/resend-otp').send({ email: testEmail });
      const res = await request(app.getHttpServer()).post('/api/auth/resend-otp').send({ email: testEmail });
      expect(res.status).toBe(429);
      process.env.THROTTLE_OTP_RESEND_LIMIT = '100000';
    });
  });
});

