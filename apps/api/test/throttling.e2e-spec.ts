import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService, getStorageToken } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Rate limiting (Phase 7). The tier resolvers read process.env at request
 * time, so each test can tighten a limit around itself instead of needing a
 * separately-configured app per tier.
 *
 * Counters are cleared between tests: buckets are keyed per route, and a test
 * that deliberately exhausts one would otherwise leak a 429 into whatever ran
 * next against the same route.
 */
describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: ThrottlerStorageService;
  const stamp = Date.now();

  let customerToken: string;
  let otherToken: string;

  // setup-e2e.ts raises these for every other suite; each test narrows them.
  const originalLimits = {
    auth: process.env.THROTTLE_AUTH_LIMIT,
    sensitive: process.env.THROTTLE_SENSITIVE_LIMIT,
    default: process.env.THROTTLE_DEFAULT_LIMIT,
  };

  function restoreLimits(): void {
    process.env.THROTTLE_AUTH_LIMIT = originalLimits.auth;
    process.env.THROTTLE_SENSITIVE_LIMIT = originalLimits.sensitive;
    process.env.THROTTLE_DEFAULT_LIMIT = originalLimits.default;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get<ThrottlerStorage>(getStorageToken()) as ThrottlerStorageService;

    // Accounts are created up front, at the raised limits, so no later test's
    // deliberate exhaustion of the register bucket can starve this setup.
    const seedCustomer = async (label: string) => {
      const email = `throttle-${label}-${stamp}@test.com`;
      const pass = 'Passw0rd!23';
      await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(pass, 12),
          firstName: 'Throttle',
          lastName: label,
          phone: '9999999999',
          phoneNumber: '9999999999',
          role: Role.CUSTOMER,
          isVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: pass })
        .expect(200);
      return res.body.accessToken;
    };

    customerToken = await seedCustomer('cust');
    otherToken = await seedCustomer('other');
    storage.storage.clear();
  });

  afterAll(async () => {
    restoreLimits();
    await prisma?.user.deleteMany({ where: { email: { contains: `throttle-` } } });
    await app?.close();
  });

  afterEach(() => {
    restoreLimits();
    storage.storage.clear();
  });

  describe('auth tier', () => {
    it('stops repeated failed logins with 429 once the limit is reached', async () => {
      process.env.THROTTLE_AUTH_LIMIT = '3';

      const attempt = () =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: `nobody-${stamp}@test.com`, password: 'WrongPassw0rd!' });

      // Wrong credentials, so these are 401s — the point is that they are
      // counted, and a password guesser gets cut off rather than being allowed
      // to keep going indefinitely.
      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(401);

      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(blocked.headers['retry-after']).toBeDefined();
    });

    it('limits registration too, so the account table cannot be flooded', async () => {
      process.env.THROTTLE_AUTH_LIMIT = '2';

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: `flood-a-${stamp}@test.com`, password: 'Passw0rd!23', firstName: 'A', lastName: 'B', phone: '9999999999' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: `flood-b-${stamp}@test.com`, password: 'Passw0rd!23', firstName: 'A', lastName: 'B', phone: '9999999999' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: `flood-c-${stamp}@test.com`, password: 'Passw0rd!23', firstName: 'A', lastName: 'B', phone: '9999999999' })
        .expect(429);
    });

    it('throttles OTP verification endpoint to prevent brute-force attacks', async () => {
      process.env.THROTTLE_OTP_VERIFY_LIMIT = '2';

      const verifyAttempt = () =>
        request(app.getHttpServer())
          .post('/api/auth/verify-otp')
          .send({ email: `nobody-${stamp}@test.com`, otp: '1234' });

      expect((await verifyAttempt()).status).toBe(400);
      expect((await verifyAttempt()).status).toBe(400);
      const blocked = await verifyAttempt();
      expect(blocked.status).toBe(429);
    });

    it('throttles OTP resend endpoint to prevent inbox flooding', async () => {
      process.env.THROTTLE_OTP_RESEND_LIMIT = '2';

      const resendAttempt = () =>
        request(app.getHttpServer())
          .post('/api/auth/resend-otp')
          .send({ email: `nobody-${stamp}@test.com` });

      expect((await resendAttempt()).status).toBe(200);
      expect((await resendAttempt()).status).toBe(200);
      const blocked = await resendAttempt();
      expect(blocked.status).toBe(429);
    });

    it('also limits the admin login route, not just the customer one', async () => {
      process.env.THROTTLE_AUTH_LIMIT = '2';

      const attempt = () =>
        request(app.getHttpServer())
          .post('/api/auth/admin/login')
          .send({ email: `noadmin-${stamp}@test.com`, password: 'WrongPassw0rd!' });

      await attempt();
      await attempt();
      expect((await attempt()).status).toBe(429);
    });

    // The app calls /auth/refresh on every full page load to restore a session,
    // so the strict auth tier signed real users out; a refresh token can't be
    // guessed anyway (signed JWT + hashed DB record).
    it('does not hold /auth/refresh to the strict auth limit', async () => {
      process.env.THROTTLE_AUTH_LIMIT = '1';

      for (let i = 0; i < 4; i += 1) {
        const res = await request(app.getHttpServer()).post('/api/auth/refresh');
        expect(res.status).toBe(401);
      }
    });

    it('keeps buckets per route, so a throttled login does not block the catalog', async () => {
      process.env.THROTTLE_AUTH_LIMIT = '1';

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `other-${stamp}@test.com`, password: 'WrongPassw0rd!' })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: `other-${stamp}@test.com`, password: 'WrongPassw0rd!' })
        .expect(429);

      await request(app.getHttpServer()).get('/api/products').expect(200);
    });
  });

  describe('sensitive tier', () => {
    it('caps coupon-code guessing on /coupons/preview', async () => {
      process.env.THROTTLE_SENSITIVE_LIMIT = '3';

      const guess = (n: number) =>
        request(app.getHttpServer())
          .post('/api/coupons/preview')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ code: `GUESS${n}` });

      // Unknown codes are 400s; the limit is what stops enumeration.
      for (let n = 1; n <= 3; n += 1) {
        expect((await guess(n)).status).toBe(400);
      }

      expect((await guess(4)).status).toBe(429);
    });

    it('gives each caller their own bucket, so one customer cannot lock out another', async () => {
      process.env.THROTTLE_SENSITIVE_LIMIT = '2';

      const guessAs = (token: string, n: number) =>
        request(app.getHttpServer())
          .post('/api/coupons/preview')
          .set('Authorization', `Bearer ${token}`)
          .send({ code: `SHARED${n}` });

      // Exhaust the first customer.
      await guessAs(customerToken, 1);
      await guessAs(customerToken, 2);
      expect((await guessAs(customerToken, 3)).status).toBe(429);

      // The second customer is untouched, despite the identical source address.
      expect((await guessAs(otherToken, 1)).status).toBe(400);
    });

    it('keeps the same bucket across a new access token for the same user, so re-authenticating cannot reset it', async () => {
      process.env.THROTTLE_SENSITIVE_LIMIT = '2';

      const guess = (token: string, n: number) =>
        request(app.getHttpServer())
          .post('/api/coupons/preview')
          .set('Authorization', `Bearer ${token}`)
          .send({ code: `RESET${n}` });

      expect((await guess(customerToken, 1)).status).toBe(400);
      expect((await guess(customerToken, 2)).status).toBe(400);

      // A brand-new access token for the same account.
      const fresh = (
        await request(app.getHttpServer())
          .post('/api/auth/login')
          .send({ email: `throttle-cust-${stamp}@test.com`, password: 'Passw0rd!23' })
          .expect(200)
      ).body.accessToken as string;
      expect(fresh).not.toBe(customerToken);

      expect((await guess(fresh, 3)).status).toBe(429);
    });

    it("does not let a forged token (valid-looking, wrong signature) land in a real user's bucket", async () => {
      process.env.THROTTLE_SENSITIVE_LIMIT = '1';

      // Exhaust nothing for the real user; send a token signed with a guessed secret.
      const [header, payload] = customerToken.split('.');
      const forged = `${header}.${payload}.invalidsignature`;
      await request(app.getHttpServer())
        .post('/api/coupons/preview')
        .set('Authorization', `Bearer ${forged}`)
        .send({ code: 'FORGED1' })
        .expect(401);

      // The real user's bucket is untouched by the forged request.
      expect(
        (
          await request(app.getHttpServer())
            .post('/api/coupons/preview')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({ code: 'REAL1' })
        ).status,
      ).toBe(400);
    });

    it('caps review writes so the moderation queue cannot be flooded', async () => {
      process.env.THROTTLE_SENSITIVE_LIMIT = '2';

      const write = () =>
        request(app.getHttpServer())
          .put(`/api/products/00000000-0000-0000-0000-000000000000/reviews/mine`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ rating: 5, body: 'Flooding the queue.' });

      // The product id is deliberately nonexistent — these 404 — but the
      // request is still counted, which is what stops the flood.
      await write();
      await write();
      expect((await write()).status).toBe(429);
    });

    it('caps order creation, since COD orders deduct stock as soon as they are placed', async () => {
      process.env.THROTTLE_SENSITIVE_LIMIT = '2';

      // Invalid bodies are rejected by validation after the throttle guard has
      // already counted them, so no cart or address setup is needed.
      const place = () =>
        request(app.getHttpServer())
          .post('/api/orders/me')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({});

      expect((await place()).status).toBe(400);
      expect((await place()).status).toBe(400);
      expect((await place()).status).toBe(429);
    });
  });

  describe('exemptions', () => {
    it('never throttles the health check, however often it is polled', async () => {
      process.env.THROTTLE_DEFAULT_LIMIT = '1';

      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer()).get('/api/health').expect(200);
      }
    });

    it('never throttles the Razorpay webhook — a 429 would look like a failed delivery and could drop a payment confirmation', async () => {
      process.env.THROTTLE_DEFAULT_LIMIT = '1';

      // An invalid signature is rejected with 401 every time; never 429.
      for (let i = 0; i < 5; i += 1) {
        const res = await request(app.getHttpServer())
          .post('/api/payments/webhook/razorpay')
          .set('X-Razorpay-Signature', 'bogus')
          .send({ event: 'payment.captured' });
        expect(res.status).toBe(401);
      }
    });

    it('never throttles logout — a user who cannot log out keeps a live session', async () => {
      process.env.THROTTLE_DEFAULT_LIMIT = '1';

      for (let i = 0; i < 5; i += 1) {
        await request(app.getHttpServer()).post('/api/auth/logout').expect(200);
      }
    });
  });
});
