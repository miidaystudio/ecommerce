import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/common/email/email.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Auth & Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let sendOtpSpy: jest.SpyInstance;

  const stamp = Date.now();
  const customerEmail = `customer_${stamp}@test.local`;
  const staffEmail = `staff_${stamp}@test.local`;
  const password = 'password123';

  let accessToken = '';

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
    agent = request.agent(app.getHttpServer());

    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash: await bcrypt.hash(password, 12),
        role: Role.STAFF,
        isVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    sendOtpSpy.mockRestore();
    await prisma.user.deleteMany({ where: { email: { in: [customerEmail, staffEmail] } } });
    await app.close();
  });

  it('registers a customer requiring phone number, dispatches OTP, and rejects login until verified', async () => {
    // 1. Missing phone fails validation
    await agent
      .post('/api/auth/register')
      .send({ email: customerEmail, password, firstName: 'Cust' })
      .expect(400);

    // 2. Successful registration with phone number
    const regRes = await agent
      .post('/api/auth/register')
      .send({ email: customerEmail, password, firstName: 'Cust', phone: '+919876543210' })
      .expect(201);

    expect(regRes.body.requiresVerification).toBe(true);
    expect(regRes.body.email).toBe(customerEmail);
    expect(regRes.body.resendAvailableIn).toBe(60);
    expect(regRes.headers['set-cookie']).toBeUndefined();

    // 3. Login before verification is rejected
    await agent
      .post('/api/auth/login')
      .send({ email: customerEmail, password })
      .expect(403);

    // 4. Verification with invalid OTP is rejected
    await agent
      .post('/api/auth/verify-otp')
      .send({ email: customerEmail, otp: '0000', password })
      .expect(400);

    // 5. Get the OTP intercepted by EmailService spy
    expect(sendOtpSpy).toHaveBeenCalled();
    const lastCall = sendOtpSpy.mock.calls[sendOtpSpy.mock.calls.length - 1];
    const otpSent = lastCall[1];
    expect(otpSent).toMatch(/^\d{4}$/);

    // 6. Verify with valid OTP
    const verifyRes = await agent
      .post('/api/auth/verify-otp')
      .send({ email: customerEmail, otp: otpSent, password })
      .expect(200);

    expect(verifyRes.body.accessToken).toEqual(expect.any(String));
    expect(verifyRes.body.user.role).toBe(Role.CUSTOMER);
    expect(verifyRes.body.user.isVerified).toBe(true);
    expect(verifyRes.body.user.phoneNumber).toBe('+919876543210');
    expect(verifyRes.body.user).not.toHaveProperty('passwordHash');

    const cookies = verifyRes.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('refresh_token=');
    expect(cookies.join(';')).toContain('HttpOnly');
    accessToken = verifyRes.body.accessToken;
  });

  it('rejects an unauthenticated profile request', async () => {
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('returns the profile for an authenticated request', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(customerEmail);
  });

  it('rejects unknown fields via DTO whitelist', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'SUPER_ADMIN' })
      .expect(400);
  });

  it('creates the first address as default', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Cust Omer',
        phone: '9999999999',
        line1: '1 Test St',
        city: 'Testville',
        state: 'TS',
        postalCode: '000000',
      })
      .expect(201);
    expect(res.body.isDefault).toBe(true);
  });

  it('rotates tokens on refresh using the cookie', async () => {
    const res = await agent.post('/api/auth/refresh').expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('handles consecutive refreshes without token-hash collisions', async () => {
    await agent.post('/api/auth/refresh').expect(200);
    await agent.post('/api/auth/refresh').expect(200);
  });

  it('rejects a customer at the admin login', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: customerEmail, password })
      .expect(403);
  });

  it('allows a staff account at the admin login', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: staffEmail, password })
      .expect(200);
    expect(res.body.user.role).toBe(Role.STAFF);
  });

  it('invalidates the session after logout', async () => {
    await agent.post('/api/auth/logout').expect(200);
    await agent.post('/api/auth/refresh').expect(401);
  });
});
