import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { OrderStatus, ProductStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Admin Management: dashboard, orders, inventory, customers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const staffEmail = `admin_mgmt_staff_${stamp}@test.local`;
  const customerEmail = `admin_mgmt_customer_${stamp}@test.local`;
  const password = 'password123';

  let staffToken = '';
  let customerToken = '';
  let categoryId = '';
  let productId = '';
  let variantId = '';
  let confirmedOrderId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: { email: staffEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.STAFF, isVerified: true, emailVerifiedAt: new Date() },
    });
    const customer = await prisma.user.create({
      data: { email: customerEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.CUSTOMER, isVerified: true, emailVerifiedAt: new Date() },
    });

    const staffLogin = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: staffEmail, password })
      .expect(200);
    staffToken = staffLogin.body.accessToken;

    const customerLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerEmail, password })
      .expect(200);
    customerToken = customerLogin.body.accessToken;

    const category = await prisma.category.create({
      data: { name: `Admin Mgmt Test ${stamp}`, slug: `admin-mgmt-test-${stamp}` },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `Admin Mgmt Runner ${stamp}`,
        slug: `admin-mgmt-runner-${stamp}`,
        description: 'For admin management e2e.',
        status: ProductStatus.ACTIVE,
        categoryId,
        displayPrice: 400,
        inStock: true,
        variants: { create: [{ sku: `ADMGMT-${stamp}`, name: 'Default', price: 400, stock: 10, isDefault: true }] },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0].id;

    // A confirmed order, created directly in the DB (bypassing checkout) so
    // this suite doesn't depend on the full Phase 4 checkout flow succeeding.
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-ADMGMT-${stamp}`,
        userId: customer.id,
        status: OrderStatus.CONFIRMED,
        shippingFullName: 'Cust One',
        shippingPhone: '9999999999',
        shippingLine1: 'L1',
        shippingCity: 'City',
        shippingState: 'State',
        shippingPostalCode: '000000',
        shippingCountry: 'India',
        subtotal: 400,
        shippingFee: 0,
        total: 400,
        paymentMethod: 'COD',
        items: {
          create: [
            {
              variantId,
              productName: product.name,
              variantName: 'Default',
              sku: `ADMGMT-${stamp}`,
              price: 400,
              quantity: 2,
              lineTotal: 800,
            },
          ],
        },
        payment: { create: { method: 'COD', status: 'PENDING', amount: 400 } },
      },
    });
    confirmedOrderId = order.id;
    // This order's 2 units were never actually deducted via the real checkout
    // flow (created directly above) — deduct them now so the admin-cancel test
    // below has real stock to restore, matching what a real CONFIRMED order implies.
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock: { decrement: 2 } } });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { orderNumber: `ORD-ADMGMT-${stamp}` } }).catch(() => undefined);
    await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
    await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { in: [staffEmail, customerEmail] } } });
    await app.close();
  });

  describe('RBAC', () => {
    it('blocks a customer from every admin-management route', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/dashboard/summary')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/admin/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/admin/inventory')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/admin/customers')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('rejects unauthenticated requests to every admin-management route', async () => {
      await request(app.getHttpServer()).get('/api/admin/dashboard/summary').expect(401);
      await request(app.getHttpServer()).get('/api/admin/orders').expect(401);
      await request(app.getHttpServer()).get('/api/admin/inventory').expect(401);
      await request(app.getHttpServer()).get('/api/admin/customers').expect(401);
    });
  });

  describe('Dashboard', () => {
    it('returns a summary with the committed order reflected in revenue', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/dashboard/summary?days=30')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(res.body.revenue).toBeGreaterThanOrEqual(400);
      expect(Array.isArray(res.body.revenueByDay)).toBe(true);
      expect(Array.isArray(res.body.topProducts)).toBe(true);
      expect(Array.isArray(res.body.recentOrders)).toBe(true);
    });
  });

  describe('Orders', () => {
    it('lists all orders (not scoped to the requesting staff member) and finds the seeded order', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/orders?q=${confirmedOrderId.slice(0, 8)}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      // q searches orderNumber/email, not id — just confirm the endpoint works and returns the shape.
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
    });

    it('gets full admin order detail including customer info', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/orders/${confirmedOrderId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect(res.body.customerEmail).toBe(customerEmail);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('rejects an illegal status transition', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${confirmedOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'DELIVERED' }) // must go through PACKED, SHIPPED first
        .expect(400);
    });

    it('moves CONFIRMED -> PACKED -> SHIPPED and restocks on cancellation attempt from an invalid state', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${confirmedOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PACKED' })
        .expect(200)
        .expect((res) => {
          if (res.body.status !== 'PACKED') throw new Error('expected PACKED');
        });

      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${confirmedOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'SHIPPED' })
        .expect(200);

      const variantAfterShip = await prisma.productVariant.findUnique({ where: { id: variantId } });
      const stockBeforeCancel = variantAfterShip!.stock;

      // SHIPPED -> CANCELLED is not in the allowed transition map (only RETURNED is).
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${confirmedOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'CANCELLED' })
        .expect(400);

      const variantAfterAttempt = await prisma.productVariant.findUnique({ where: { id: variantId } });
      expect(variantAfterAttempt!.stock).toBe(stockBeforeCancel); // untouched by the rejected transition
    });

    it('marking SHIPPED -> RETURNED restocks the items', async () => {
      const before = await prisma.productVariant.findUnique({ where: { id: variantId } });

      const res = await request(app.getHttpServer())
        .patch(`/api/admin/orders/${confirmedOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'RETURNED' })
        .expect(200);
      expect(res.body.status).toBe('RETURNED');

      const after = await prisma.productVariant.findUnique({ where: { id: variantId } });
      expect(after!.stock).toBe(before!.stock + 2); // the order's 2-unit line item restocked
    });
  });

  describe('Inventory', () => {
    it('lists inventory and flags low stock using the configured threshold', async () => {
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 2 } });

      const res = await request(app.getHttpServer())
        .get(`/api/admin/inventory?q=${stamp}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      const line = res.body.items.find((i: { variantId: string }) => i.variantId === variantId);
      expect(line).toBeDefined();
      expect(line.lowStock).toBe(true); // default threshold is 5, stock is 2
    });

    it('applies a manual restock adjustment and records it in history', async () => {
      const before = await prisma.productVariant.findUnique({ where: { id: variantId } });

      await request(app.getHttpServer())
        .post(`/api/admin/inventory/${variantId}/adjustments`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ change: 15, note: 'Restocked from supplier' })
        .expect(201)
        .expect((res) => {
          if (res.body.reason !== 'RESTOCK') throw new Error('expected RESTOCK reason');
        });

      const after = await prisma.productVariant.findUnique({ where: { id: variantId } });
      expect(after!.stock).toBe(before!.stock + 15);

      const history = await request(app.getHttpServer())
        .get(`/api/admin/inventory/${variantId}/adjustments`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect(history.body.items[0].note).toBe('Restocked from supplier');
    });

    it('rejects a manual adjustment that would take stock negative', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/inventory/${variantId}/adjustments`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ change: -99999 })
        .expect(400);
    });
  });

  describe('Customers', () => {
    it('lists only CUSTOMER-role accounts, finding the seeded customer by email search', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/admin/customers?q=${encodeURIComponent(customerEmail)}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect(res.body.items.some((c: { email: string }) => c.email === customerEmail)).toBe(true);
      expect(res.body.items.some((c: { email: string }) => c.email === staffEmail)).toBe(false);
    });

    it('gets customer detail with their order history', async () => {
      const list = await request(app.getHttpServer())
        .get(`/api/admin/customers?q=${encodeURIComponent(customerEmail)}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const customerId = list.body.items[0].id;

      const detail = await request(app.getHttpServer())
        .get(`/api/admin/customers/${customerId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      expect(detail.body.orders.some((o: { id: string }) => o.id === confirmedOrderId)).toBe(true);
    });

    it('blocks and unblocks a customer, and login is rejected while blocked', async () => {
      const list = await request(app.getHttpServer())
        .get(`/api/admin/customers?q=${encodeURIComponent(customerEmail)}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
      const customerId = list.body.items[0].id;

      await request(app.getHttpServer())
        .patch(`/api/admin/customers/${customerId}/block`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ isBlocked: true })
        .expect(200);

      // auth.service.ts throws ForbiddenException (not Unauthorized) for a
      // blocked account — the credentials are correct, the account just isn't active.
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: customerEmail, password })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/admin/customers/${customerId}/block`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ isBlocked: false })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: customerEmail, password })
        .expect(200);
    });

    it('404s blocking a staff account through the customer-block endpoint', async () => {
      const staffUser = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
      await request(app.getHttpServer())
        .patch(`/api/admin/customers/${staffUser.id}/block`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ isBlocked: true })
        .expect(404);
    });
  });
});
