import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Admin Bootstrap & Seeding (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const seedEmail = `seeded_admin_${stamp}@test.local`;
  const temporaryPassword = 'InitialSeedPassword#123';
  const newStrongPassword = 'BrandNewSuperAdminPassword#456';

  let initialAccessToken = '';
  let refreshedAccessToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: seedEmail } });
    await app.close();
  });

  describe('1. CLI Seed Script Execution & Idempotency', () => {
    it('executes prisma/seed.ts via CLI to create the initial SUPER_ADMIN account', () => {
      const scriptPath = path.resolve(__dirname, '../prisma/seed.ts');
      const env = {
        ...process.env,
        SEED_ADMIN_EMAIL: seedEmail,
        SEED_ADMIN_PASSWORD: temporaryPassword,
      };

      // Run via npx ts-node directly to simulate `npm run seed:admin`
      const output = execSync(`npx ts-node "${scriptPath}"`, {
        env,
        encoding: 'utf-8',
        cwd: path.resolve(__dirname, '..'),
      });

      expect(output).toContain('Successfully created SUPER_ADMIN account');
      expect(output).toContain(seedEmail);
      expect(output).toContain('Forced password change enabled');
      // Crucial security requirement: confirm the plaintext password is never printed in output
      expect(output).not.toContain(temporaryPassword);
    });

    it('creates database record with Role.SUPER_ADMIN, isVerified=true, and mustChangePassword=true', async () => {
      const admin = await prisma.user.findUnique({ where: { email: seedEmail } });
      expect(admin).not.toBeNull();
      expect(admin?.role).toBe(Role.SUPER_ADMIN);
      expect(admin?.isVerified).toBe(true);
      expect(admin?.emailVerifiedAt).not.toBeNull();
      expect(admin?.mustChangePassword).toBe(true);
    });

    it('is strictly idempotent — subsequent run no-ops cleanly with exit code 0 without creating duplicates', () => {
      const scriptPath = path.resolve(__dirname, '../prisma/seed.ts');
      const env = {
        ...process.env,
        SEED_ADMIN_EMAIL: seedEmail,
        SEED_ADMIN_PASSWORD: temporaryPassword,
      };

      const output = execSync(`npx ts-node "${scriptPath}"`, {
        env,
        encoding: 'utf-8',
        cwd: path.resolve(__dirname, '..'),
      });

      expect(output).toContain('already exists');
      expect(output).toContain('Skipping creation cleanly');
      expect(output).not.toContain(temporaryPassword);
    });
  });

  describe('2. First Login with Seeded Credentials', () => {
    it('authenticates seeded admin and returns session with mustChangePassword=true', async () => {
      const res = await agent
        .post('/api/auth/admin/login')
        .send({ email: seedEmail, password: temporaryPassword })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(seedEmail);
      expect(res.body.user.role).toBe(Role.SUPER_ADMIN);
      expect(res.body.user.mustChangePassword).toBe(true);

      initialAccessToken = res.body.accessToken;
    });
  });

  describe('3. Non-Bypassable Protection on Protected Endpoints', () => {
    it('blocks access to protected admin routes while mustChangePassword is true', async () => {
      // Attempting to call staff management endpoint
      const staffRes = await agent
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .expect(403);

      expect(staffRes.body.message).toContain('Password change required on first login');

      // Attempting to call orders endpoint
      const ordersRes = await agent
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .expect(403);

      expect(ordersRes.body.message).toContain('Password change required on first login');

      // Attempting to call settings endpoint
      const settingsRes = await agent
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .expect(403);

      expect(settingsRes.body.message).toContain('Password change required on first login');
    });

    it('allows access to whitelisted endpoints (me, logout)', async () => {
      const meRes = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .expect(200);

      expect(meRes.body.email).toBe(seedEmail);
      expect(meRes.body.mustChangePassword).toBe(true);
    });
  });

  describe('4. Forced Password Change Flow & Unlocking', () => {
    it('rejects password change if current password is wrong', async () => {
      const res = await agent
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .send({
          currentPassword: 'WrongPassword#999',
          newPassword: newStrongPassword,
        })
        .expect(400);

      expect(res.body.message).toContain('Current password is incorrect');
    });

    it('rejects password change if new password is identical to current password', async () => {
      const res = await agent
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: temporaryPassword,
        })
        .expect(400);

      expect(res.body.message).toContain('New password must be different from current password');
    });

    it('rejects password change if new password is too short (<8 chars)', async () => {
      await agent
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: 'short',
        })
        .expect(400);
    });

    it('successfully changes password, sets mustChangePassword=false, and issues fresh tokens', async () => {
      const res = await agent
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .send({
          currentPassword: temporaryPassword,
          newPassword: newStrongPassword,
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.mustChangePassword).toBe(false);

      refreshedAccessToken = res.body.accessToken;

      // Verify in DB
      const userInDb = await prisma.user.findUnique({ where: { email: seedEmail } });
      expect(userInDb?.mustChangePassword).toBe(false);
    });

    it('disallows login with old temporary password', async () => {
      await agent
        .post('/api/auth/admin/login')
        .send({ email: seedEmail, password: temporaryPassword })
        .expect(401);
    });

    it('allows login with new password and returns mustChangePassword=false', async () => {
      const res = await agent
        .post('/api/auth/admin/login')
        .send({ email: seedEmail, password: newStrongPassword })
        .expect(200);

      expect(res.body.user.mustChangePassword).toBe(false);
    });

    it('unblocks access to all administrative endpoints once password is changed', async () => {
      const staffRes = await agent
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${refreshedAccessToken}`)
        .expect(200);

      expect(Array.isArray(staffRes.body)).toBe(true);
    });
  });
});
