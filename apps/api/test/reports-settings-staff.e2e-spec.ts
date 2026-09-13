import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, PaymentStatus, ProductStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';
import { SettingsService } from '../src/modules/settings/settings.service';

describe('Reports, settings and staff management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const superEmail = `p7_super_${stamp}@test.local`;
  const staffEmail = `p7_staff_${stamp}@test.local`;
  const customerEmail = `p7_customer_${stamp}@test.local`;
  const password = 'password123';

  let superToken = '';
  let staffToken = '';
  let customerToken = '';
  let superId = '';
  let staffId = '';
  const createdStaffIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const hash = await bcrypt.hash(password, 12);
    const superUser = await prisma.user.create({
      data: { email: superEmail, passwordHash: hash, role: Role.SUPER_ADMIN, isVerified: true, emailVerifiedAt: new Date() },
    });
    superId = superUser.id;
    const staffUser = await prisma.user.create({
      data: { email: staffEmail, passwordHash: hash, role: Role.STAFF, isVerified: true, emailVerifiedAt: new Date() },
    });
    staffId = staffUser.id;
    const customer = await prisma.user.create({
      data: { email: customerEmail, passwordHash: hash, role: Role.CUSTOMER, isVerified: true, emailVerifiedAt: new Date() },
    });

    superToken = (
      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ email: superEmail, password })
        .expect(200)
    ).body.accessToken;
    staffToken = (
      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ email: staffEmail, password })
        .expect(200)
    ).body.accessToken;
    customerToken = (
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: customerEmail, password })
        .expect(200)
    ).body.accessToken;

    // A committed order so the reports have something real to aggregate.
    const category = await prisma.category.create({
      data: { name: `P7 Cat ${stamp}`, slug: `p7-cat-${stamp}` },
    });
    const product = await prisma.product.create({
      data: {
        name: `P7 Runner ${stamp}`,
        slug: `p7-runner-${stamp}`,
        description: 'For Phase 7 e2e.',
        status: ProductStatus.ACTIVE,
        categoryId: category.id,
        displayPrice: 1000,
        inStock: true,
        variants: { create: [{ sku: `P7-${stamp}`, name: 'Default', price: 1000, stock: 50, isDefault: true }] },
      },
      include: { variants: true },
    });

    await prisma.order.create({
      data: {
        orderNumber: `ORD-P7-${stamp}`,
        userId: customer.id,
        status: OrderStatus.DELIVERED,
        shippingFullName: 'Test Buyer',
        shippingPhone: '9999999999',
        shippingLine1: 'L1',
        shippingCity: 'C',
        shippingState: 'S',
        shippingPostalCode: '000',
        shippingCountry: 'India',
        subtotal: 2000,
        discount: 200,
        shippingFee: 0,
        total: 1800,
        paymentMethod: PaymentMethod.COD,
        items: {
          create: [
            {
              variantId: product.variants[0].id,
              productName: product.name,
              variantName: 'Default',
              sku: `P7-${stamp}`,
              price: 1000,
              quantity: 2,
              lineTotal: 2000,
            },
          ],
        },
        payment: { create: { method: PaymentMethod.COD, status: PaymentStatus.PAID, amount: 1800 } },
      },
    });
  });

  afterAll(async () => {
    if (createdStaffIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdStaffIds } } });
    }
    await app?.close();
  });

  describe('Reports — access control', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/admin/reports/sales').expect(401);
    });

    it('rejects a customer', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/reports/sales')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('allows staff to read reports', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/reports/sales')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });
  });

  describe('Reports — sales', () => {
    it('reconciles gross, discount, shipping and net for the period', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/reports/sales')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);

      expect(res.body.totals.grossRevenue).toBeGreaterThanOrEqual(2000);
      expect(res.body.totals.discount).toBeGreaterThanOrEqual(200);
      // net = gross - discount + shipping, for every order in the window.
      expect(res.body.totals.netRevenue).toBeCloseTo(
        res.body.totals.grossRevenue - res.body.totals.discount + res.body.totals.shipping,
        2,
      );
    });

    it('rejects an inverted date range', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/reports/sales?from=2026-06-01&to=2026-01-01')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(400);
    });

    it('rejects a range wider than a year', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/reports/sales?from=2020-01-01&to=2026-01-01')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(400);
    });

    it('rejects a malformed date rather than silently defaulting', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/reports/sales?from=not-a-date')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(400);
    });

    it('accepts each groupBy value and rejects anything else', async () => {
      for (const groupBy of ['day', 'week', 'month']) {
        const res = await request(app.getHttpServer())
          .get(`/api/admin/reports/sales?groupBy=${groupBy}`)
          .set('Authorization', `Bearer ${superToken}`)
          .expect(200);
        expect(res.body.groupBy).toBe(groupBy);
      }

      await request(app.getHttpServer())
        .get('/api/admin/reports/sales?groupBy=century')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(400);
    });
  });

  describe('Reports — best sellers and customers', () => {
    it('lists best sellers by revenue', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/reports/best-sellers')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);

      const row = res.body.items.find((i: { productName: string }) => i.productName.includes(`P7 Runner ${stamp}`));
      expect(row).toBeDefined();
      expect(row.unitsSold).toBe(2);
      expect(row.revenue).toBe(2000);
    });

    it('lists top customers with their spend', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/reports/customers?limit=200')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);

      const row = res.body.items.find((i: { email: string }) => i.email === customerEmail);
      expect(row).toBeDefined();
      expect(row.orderCount).toBe(1);
      expect(row.totalSpend).toBe(1800);
      expect(res.body.totals.repeatRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Reports — CSV export', () => {
    it('returns CSV rather than JSON', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/reports/sales.csv')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.split('\r\n')[0]).toBe(
        'Period,Orders,Gross revenue,Discount,Shipping,Net revenue',
      );
    });

    it('still enforces access control on the CSV routes', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/reports/customers.csv')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('exports best sellers and customers as CSV', async () => {
      const best = await request(app.getHttpServer())
        .get('/api/admin/reports/best-sellers.csv')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      expect(best.text).toContain('Product,Units sold,Revenue,Order lines');

      const customers = await request(app.getHttpServer())
        .get('/api/admin/reports/customers.csv')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      expect(customers.text).toContain('Email,Name,Orders,Total spend');
    });
  });

  describe('Store settings', () => {
    it('exposes a public subset without authentication, omitting operational values', async () => {
      const res = await request(app.getHttpServer()).get('/api/settings').expect(200);

      expect(res.body.storeName).toBeDefined();
      expect(res.body).not.toHaveProperty('lowStockThreshold');
      expect(res.body).not.toHaveProperty('taxRatePercent');
    });

    it('lets staff read the full settings but not write them', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // prd.md: staff have no access to sensitive settings.
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ storeName: 'Staff should not be able to do this' })
        .expect(403);
    });

    it('rejects a customer outright', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('lets a super admin save a partial patch without resetting other fields', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);

      const updated = await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ storeName: `miiday ${stamp}` })
        .expect(200);

      expect(updated.body.storeName).toBe(`miiday ${stamp}`);
      expect(updated.body.flatShippingFee).toBe(before.body.flatShippingFee);
      expect(updated.body.lowStockThreshold).toBe(before.body.lowStockThreshold);
    });

    it('validates the values it is given', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ supportEmail: 'not-an-email' })
        .expect(400);

      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ taxRatePercent: 150 })
        .expect(400);

      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ flatShippingFee: -10 })
        .expect(400);

      // A currency the gateway isn't configured for would fail at pay time.
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ currency: 'XYZ' })
        .expect(400);
    });

    it('rejects unknown fields instead of ignoring them', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ razorpayKeySecret: 'stolen' })
        .expect(400);
    });
  });

  describe('Staff management — access control', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/api/admin/staff').expect(401);
    });

    it('rejects a customer', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    // The escalation that matters: if STAFF could reach this, any staff member
    // could promote themselves to SUPER_ADMIN.
    it('rejects STAFF on every staff-management route', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ email: `sneaky_${stamp}@test.local`, password: 'LongEnoughPass1', role: Role.SUPER_ADMIN })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/admin/staff/${staffId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ role: Role.SUPER_ADMIN })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/admin/staff/${superId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
  });

  describe('Staff management — behaviour', () => {
    it('lists only staff and super admins, never customers, and never a password hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/staff')
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);

      const emails = res.body.map((s: { email: string }) => s.email);
      expect(emails).toContain(staffEmail);
      expect(emails).toContain(superEmail);
      expect(emails).not.toContain(customerEmail);
      expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    });

    it('creates a staff account that can then sign in to the admin app', async () => {
      const newEmail = `p7_new_staff_${stamp}@test.local`;
      const created = await request(app.getHttpServer())
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: newEmail, password: 'LongEnoughPass1', role: Role.STAFF, firstName: 'New' })
        .expect(201);
      createdStaffIds.push(created.body.id);

      expect(created.body.role).toBe(Role.STAFF);
      expect(created.body).not.toHaveProperty('passwordHash');

      await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ email: newEmail, password: 'LongEnoughPass1' })
        .expect(200);
    });

    it('refuses to create a CUSTOMER through the staff endpoint', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: `p7_cust_attempt_${stamp}@test.local`, password: 'LongEnoughPass1', role: Role.CUSTOMER })
        .expect(400);
    });

    it('enforces a longer password for staff than for shoppers', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: `p7_shortpw_${stamp}@test.local`, password: 'short1', role: Role.STAFF })
        .expect(400);
    });

    it('refuses to reuse an existing account email rather than promoting it', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/staff')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ email: customerEmail, password: 'LongEnoughPass1', role: Role.SUPER_ADMIN })
        .expect(409);
    });

    it('refuses to let a super admin demote or block themselves', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/staff/${superId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ role: Role.STAFF })
        .expect(400);

      await request(app.getHttpServer())
        .patch(`/api/admin/staff/${superId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ isBlocked: true })
        .expect(400);
    });

    it('refuses to delete your own account', async () => {
      await request(app.getHttpServer())
        .delete(`/api/admin/staff/${superId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(400);
    });

    it('promotes and demotes another staff member, revoking their sessions', async () => {
      const promoted = await request(app.getHttpServer())
        .patch(`/api/admin/staff/${staffId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ role: Role.SUPER_ADMIN })
        .expect(200);
      expect(promoted.body.role).toBe(Role.SUPER_ADMIN);

      // Their refresh tokens are gone, so the role change can't be outlived by
      // an old session.
      const remainingTokens = await prisma.refreshToken.count({ where: { userId: staffId } });
      expect(remainingTokens).toBe(0);

      const demoted = await request(app.getHttpServer())
        .patch(`/api/admin/staff/${staffId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ role: Role.STAFF })
        .expect(200);
      expect(demoted.body.role).toBe(Role.STAFF);
    });

    it('404s for a customer id, so this endpoint cannot reach shopper accounts', async () => {
      const customer = await prisma.user.findUnique({ where: { email: customerEmail } });
      await request(app.getHttpServer())
        .patch(`/api/admin/staff/${customer?.id}`)
        .set('Authorization', `Bearer ${superToken}`)
        .send({ isBlocked: true })
        .expect(404);
    });
  });

  /**
   * The kill switch gets its own app instance with SettingsService overridden,
   * rather than toggling the real setting.
   *
   * `store_settings` is a single shared row, and Jest runs these suites in
   * parallel — flipping ordersEnabled off for even a moment would fail any
   * checkout another suite happened to be running at that instant. Overriding
   * the provider keeps the switch local to this app while still exercising the
   * real OrdersService over real HTTP.
   */
  describe('Orders kill switch', () => {
    let closedApp: INestApplication;
    let closedCustomerToken = '';
    let closedAddressId = '';

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SettingsService)
        .useValue({
          get: () =>
            Promise.resolve({
              storeName: 'miiday',
              supportEmail: 'support@miiday.test',
              supportPhone: null,
              addressLine: null,
              currency: 'INR',
              freeShippingThreshold: 999,
              flatShippingFee: 79,
              taxRatePercent: 0,
              lowStockThreshold: 5,
              ordersEnabled: false,
              maintenanceNotice: 'Closed for stocktake',
              updatedAt: null,
            }),
          getPublic: () => Promise.resolve({ ordersEnabled: false }),
          summarize: (subtotal: number, discount: number) =>
            Promise.resolve({ subtotal, discount, shippingFee: 79, total: subtotal - discount + 79, taxRatePercent: 0, taxIncluded: 0 }),
        })
        .compile();

      closedApp = moduleRef.createNestApplication<NestExpressApplication>();
      closedApp.setGlobalPrefix('api');
      closedApp.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
      );
      closedApp.useGlobalFilters(new AllExceptionsFilter());
      await closedApp.init();

      closedCustomerToken = (
        await request(closedApp.getHttpServer())
          .post('/api/auth/login')
          .send({ email: customerEmail, password })
          .expect(200)
      ).body.accessToken;

      closedAddressId = (
        await request(closedApp.getHttpServer())
          .post('/api/users/me/addresses')
          .set('Authorization', `Bearer ${closedCustomerToken}`)
          .send({
            fullName: 'Test Buyer',
            phone: '9999999999',
            line1: 'L1',
            city: 'C',
            state: 'S',
            postalCode: '000',
            country: 'India',
          })
          .expect(201)
      ).body.id;
    });

    afterAll(async () => {
      await closedApp?.close();
    });

    it('blocks checkout server-side and surfaces the maintenance notice', async () => {
      const blocked = await request(closedApp.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${closedCustomerToken}`)
        .send({ addressId: closedAddressId, paymentMethod: 'COD' })
        .expect(400);

      expect(JSON.stringify(blocked.body.message)).toContain('Closed for stocktake');
    });

    it('refuses before the cart is even examined, so an empty cart is not the reason', async () => {
      // The cart is empty here; an empty cart is also a 400, so the assertion
      // is on the message — the switch must be checked first.
      const blocked = await request(closedApp.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${closedCustomerToken}`)
        .send({ addressId: closedAddressId, paymentMethod: 'RAZORPAY' })
        .expect(400);

      expect(JSON.stringify(blocked.body.message)).toContain('Closed for stocktake');
      expect(JSON.stringify(blocked.body.message)).not.toContain('cart is empty');
    });
  });
});
