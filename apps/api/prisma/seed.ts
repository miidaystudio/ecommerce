import { Prisma, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Values already in the environment win over .env files. Never use `override`:
// it would silently redirect an explicit DATABASE_URL (a CI job, a local test
// database) to whatever database the .env file names.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const BCRYPT_ROUNDS = 12;

async function seedAdmin(): Promise<void> {
  const emailRaw = process.env.SEED_ADMIN_EMAIL;
  const passwordRaw = process.env.SEED_ADMIN_PASSWORD;

  if (!emailRaw || !emailRaw.trim() || !passwordRaw || !passwordRaw.trim()) {
    console.error(
      '[seed:admin] Error: Both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD environment variables must be defined.',
    );
    process.exit(1);
  }

  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error('[seed:admin] Error: SEED_ADMIN_EMAIL does not match valid email syntax.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('[seed:admin] Error: SEED_ADMIN_PASSWORD must be at least 8 characters long.');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.log(
        `[seed:admin] Account with email '${email}' already exists (role: ${existing.role}). Skipping creation cleanly.`,
      );
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        role: Role.SUPER_ADMIN,
        isVerified: true,
        emailVerifiedAt: new Date(),
        mustChangePassword: true,
      },
    });

    console.log(`[seed:admin] Successfully created SUPER_ADMIN account: ${email}`);
    console.log(
      '[seed:admin] Forced password change enabled. Admin must change password upon first login.',
    );
  } catch (error) {
    // A concurrent run created the account between the lookup and the insert.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      console.log(`[seed:admin] Account with email '${email}' already exists. Skipping creation cleanly.`);
      return;
    }
    console.error(
      '[seed:admin] Error executing admin seed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

void seedAdmin();
