import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DiscountType, ProductStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { includedTax } from '../src/common/utils/tax';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Tax-inclusive GST and the server-computed price quotes (2026-09-13).
 *
 * The tax rate lives on the shared store_settings row. Changing it is safe
 * alongside the other suites because GST is only a breakdown of a total — no
 * total anywhere changes with the rate — and the original rate is restored.
 */
describe('Pricing: tax-inclusive GST and price quotes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const password = 'password123';
  const superEmail = `tax_super_${stamp}@test.local`;
  const customerEmail = `tax_customer_${stamp}@test.local`;

  let superToken = '';
  let customerToken = '';
  let variantId = '';
  let archivedVariantId = '';
  let addressId = '';
  let originalRate: number | undefined;

  const PRICE = 590;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const hash = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { email: superEmail, passwordHash: hash, role: Role.SUPER_ADMIN, isVerified: true, emailVerifiedAt: new Date() } });
    await prisma.user.create({ data: { email: customerEmail, passwordHash: hash, role: Role.CUSTOMER, isVerified: true, emailVerifiedAt: new Date() } });

    superToken = (
      await request(app.getHttpServer()).post('/api/auth/admin/login').send({ email: superEmail, password }).expect(200)
    ).body.accessToken;
    customerToken = (
      await request(app.getHttpServer()).post('/api/auth/login').send({ email: customerEmail, password }).expect(200)
    ).body.accessToken;

    const category = await prisma.category.create({ data: { name: `Tax Cat ${stamp}`, slug: `tax-cat-${stamp}` } });
    const product = await prisma.product.create({
      data: {
        name: `Tax Runner ${stamp}`,
        slug: `tax-runner-${stamp}`,
        description: 'For tax e2e.',
        status: ProductStatus.ACTIVE,
        categoryId: category.id,
        displayPrice: PRICE,
        inStock: true,
        variants: { create: [{ sku: `TAX-${stamp}`, name: 'Default', price: PRICE, stock: 100, isDefault: true }] },
      },
      include: { variants: true },
    });
    variantId = product.variants[0].id;

    const archived = await prisma.product.create({
      data: {
        name: `Tax Archived ${stamp}`,
        slug: `tax-archived-${stamp}`,
        description: 'Archived — must not be priced.',
        status: ProductStatus.ARCHIVED,
        categoryId: category.id,
        displayPrice: 9999,
        inStock: true,
        variants: { create: [{ sku: `TAXA-${stamp}`, name: 'Default', price: 9999, stock: 5, isDefault: true }] },
      },
      include: { variants: true },
    });
    archivedVariantId = archived.variants[0].id;

    addressId = (
      await request(app.getHttpServer())
        .post('/api/users/me/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fullName: 'Tax Buyer', phone: '9999999999', line1: 'L1', city: 'C', state: 'S', postalCode: '000', country: 'India' })
        .expect(201)
    ).body.id;

    const current = await request(app.getHttpServer())
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);
    originalRate = current.body.taxRatePercent;

    await request(app.getHttpServer())
      .patch('/api/admin/settings')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ taxRatePercent: 18 })
      .expect(200);
  });

  afterAll(async () => {
    if (originalRate !== undefined) {
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ taxRatePercent: originalRate });
    }
    await app?.close();
  });

  async function fillCart(quantity: number): Promise<void> {
    await request(app.getHttpServer()).delete('/api/cart/me').set('Authorization', `Bearer ${customerToken}`);
    await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ variantId, quantity })
      .expect(201);
  }

  describe('POST /cart/quote (public)', () => {
    it('works without authentication, so a guest cart can show GST', async () => {
      await request(app.getHttpServer())
        .post('/api/cart/quote')
        .send({ items: [{ variantId, quantity: 1 }] })
        .expect(200);
    });

    it('prices from the live variant price and splits out the GST contained in the total', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cart/quote')
        .send({ items: [{ variantId, quantity: 2 }] })
        .expect(200);

      expect(res.body.subtotal).toBe(PRICE * 2);
      expect(res.body.total).toBe(res.body.subtotal - res.body.discount + res.body.shippingFee);
      expect(res.body.taxRatePercent).toBe(18);
      // Tax-inclusive: GST is inside the total, never added to it.
      expect(res.body.taxIncluded).toBe(includedTax(res.body.total, 18));
      expect(res.body.taxIncluded).toBeLessThan(res.body.total);
    });

    it('rejects a client-supplied price outright rather than using or ignoring it', async () => {
      await request(app.getHttpServer())
        .post('/api/cart/quote')
        .send({ items: [{ variantId, quantity: 1, price: 1 }], total: 1 })
        .expect(400);
    });

    it('does not price archived products', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/cart/quote')
        .send({ items: [{ variantId: archivedVariantId, quantity: 1 }] })
        .expect(200);
      expect(res.body.subtotal).toBe(0);
    });

    it('validates line shape and caps the number of lines', async () => {
      await request(app.getHttpServer())
        .post('/api/cart/quote')
        .send({ items: [{ variantId: 'not-a-uuid', quantity: 1 }] })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/cart/quote')
        .send({ items: [{ variantId, quantity: 0 }] })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/cart/quote')
        .send({ items: Array.from({ length: 101 }, () => ({ variantId, quantity: 1 })) })
        .expect(400);
    });
  });

  describe('GET /orders/me/quote', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).get('/api/orders/me/quote').expect(401);
    });

    it('is routed as the quote, not captured by /orders/me/:id', async () => {
      await fillCart(1);
      const res = await request(app.getHttpServer())
        .get('/api/orders/me/quote')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('taxIncluded');
    });

    it('applies a valid coupon, re-validated server-side', async () => {
      await fillCart(2);
      const code = `TAXOFF${stamp}`.slice(0, 32).toUpperCase();
      await prisma.coupon.create({
        data: { code, discountType: DiscountType.FIXED, discountValue: 100, isActive: true },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/orders/me/quote?couponCode=${code}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(res.body.discount).toBe(100);
      expect(res.body.couponCode).toBe(code);
      expect(res.body.taxIncluded).toBe(includedTax(res.body.total, 18));
    });

    it('refuses an unknown coupon instead of quoting as if it applied', async () => {
      await fillCart(1);
      await request(app.getHttpServer())
        .get('/api/orders/me/quote?couponCode=NOSUCHCODE')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(400);
    });
  });

  describe('Orders record the GST snapshot', () => {
    let orderId = '';
    let quoted: { subtotal: number; shippingFee: number; total: number; taxIncluded: number };

    it('charges exactly what the checkout quote showed, with GST recorded but not added', async () => {
      await fillCart(3);
      quoted = (
        await request(app.getHttpServer())
          .get('/api/orders/me/quote')
          .set('Authorization', `Bearer ${customerToken}`)
          .expect(200)
      ).body;

      const created = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, paymentMethod: 'COD' })
        .expect(201);

      const order = created.body.order;
      orderId = order.id;
      expect(order.subtotal).toBe(quoted.subtotal);
      expect(order.shippingFee).toBe(quoted.shippingFee);
      expect(order.total).toBe(quoted.total);
      expect(order.taxAmount).toBe(quoted.taxIncluded);
      expect(order.taxRatePercent).toBe(18);
      // Total is unchanged by tax: subtotal − discount + shipping.
      expect(order.total).toBe(order.subtotal - order.discount + order.shippingFee);
    });

    it('exposes the GST on the customer order detail and the admin order detail', async () => {
      const mine = await request(app.getHttpServer())
        .get(`/api/orders/me/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
      expect(mine.body.taxAmount).toBe(quoted.taxIncluded);

      const admin = await request(app.getHttpServer())
        .get(`/api/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${superToken}`)
        .expect(200);
      expect(admin.body.taxAmount).toBe(quoted.taxIncluded);
      expect(admin.body.taxRatePercent).toBe(18);
    });

    it('keeps the rate in force at order time after the store rate changes', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ taxRatePercent: 5 })
        .expect(200);

      const detail = await request(app.getHttpServer())
        .get(`/api/orders/me/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      expect(detail.body.taxRatePercent).toBe(18);
      expect(detail.body.taxAmount).toBe(quoted.taxIncluded);

      // New quotes use the new rate.
      const fresh = await request(app.getHttpServer())
        .post('/api/cart/quote')
        .send({ items: [{ variantId, quantity: 1 }] })
        .expect(200);
      expect(fresh.body.taxRatePercent).toBe(5);

      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', `Bearer ${superToken}`)
        .send({ taxRatePercent: 18 })
        .expect(200);
    });
  });
});
