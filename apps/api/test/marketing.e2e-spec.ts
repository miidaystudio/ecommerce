import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DiscountType, OrderStatus, ProductStatus, ReviewStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RazorpayService } from '../src/modules/payments/razorpay.service';

// Only the outbound Razorpay API call is stubbed (the dev placeholder keys are
// not a real account); signature verification is inherited untouched. Same
// approach as orders-payments.e2e-spec.
class TestRazorpayService extends RazorpayService {
  private counter = 0;

  async createOrder(amountInPaise: number, receipt: string) {
    this.counter += 1;
    return { id: `order_test_${receipt}_${this.counter}`, amount: amountInPaise, currency: 'INR' };
  }
}

describe('Marketing: coupons, reviews, banners (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const staffEmail = `mkt_staff_${stamp}@test.local`;
  const customerEmail = `mkt_customer_${stamp}@test.local`;
  const customerBEmail = `mkt_customer_b_${stamp}@test.local`;
  const password = 'password123';

  let staffToken = '';
  let customerToken = '';
  let customerBToken = '';
  let customerId = '';
  let categoryId = '';
  let productId = '';
  let variantId = '';
  let addressId = '';
  const createdCouponIds: string[] = [];
  const createdBannerIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RazorpayService)
      .useClass(TestRazorpayService)
      .compile();
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
      data: { email: customerEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.CUSTOMER, firstName: 'Cust', isVerified: true, emailVerifiedAt: new Date() },
    });
    customerId = customer.id;
    await prisma.user.create({
      data: { email: customerBEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.CUSTOMER, isVerified: true, emailVerifiedAt: new Date() },
    });

    staffToken = (
      await request(app.getHttpServer()).post('/api/auth/admin/login').send({ email: staffEmail, password }).expect(200)
    ).body.accessToken;
    customerToken = (
      await request(app.getHttpServer()).post('/api/auth/login').send({ email: customerEmail, password }).expect(200)
    ).body.accessToken;
    customerBToken = (
      await request(app.getHttpServer()).post('/api/auth/login').send({ email: customerBEmail, password }).expect(200)
    ).body.accessToken;

    const category = await prisma.category.create({
      data: { name: `Mkt Test ${stamp}`, slug: `mkt-test-${stamp}` },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `Mkt Runner ${stamp}`,
        slug: `mkt-runner-${stamp}`,
        description: 'For marketing e2e.',
        status: ProductStatus.ACTIVE,
        categoryId,
        displayPrice: 1000,
        inStock: true,
        variants: { create: [{ sku: `MKT-${stamp}`, name: 'Default', price: 1000, stock: 100, isDefault: true }] },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0].id;

    addressId = (
      await request(app.getHttpServer())
        .post('/api/users/me/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ fullName: 'Cust', phone: '9999999999', line1: '1 St', city: 'City', state: 'ST', postalCode: '000000' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [staffEmail, customerEmail, customerBEmail] } },
    });
    await prisma.order.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } }).catch(() => undefined);
    await prisma.coupon.deleteMany({ where: { id: { in: createdCouponIds } } }).catch(() => undefined);
    await prisma.banner.deleteMany({ where: { id: { in: createdBannerIds } } }).catch(() => undefined);
    await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
    await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { in: [staffEmail, customerEmail, customerBEmail] } } });
    await app.close();
  });

  async function createCoupon(body: Record<string, unknown>): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/admin/coupons')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(body)
      .expect(201);
    createdCouponIds.push(res.body.id);
    return res.body.id;
  }

  async function addToCart(token: string, quantity: number) {
    await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId, quantity })
      .expect(201);
  }

  async function clearCart(token: string) {
    await request(app.getHttpServer()).delete('/api/cart/me').set('Authorization', `Bearer ${token}`).expect(200);
  }

  describe('Coupon admin RBAC & validation', () => {
    it('blocks customers from coupon administration', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/coupons')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: 'HACK', discountType: 'FIXED', discountValue: 100 })
        .expect(403);
    });

    it('rejects a zero or negative discount value at the DTO boundary', async () => {
      for (const discountValue of [0, -50]) {
        await request(app.getHttpServer())
          .post('/api/admin/coupons')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ code: `BAD${stamp}`, discountType: 'FIXED', discountValue })
          .expect(400);
      }
    });

    it('rejects a percentage discount over 100%', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ code: `OVER${stamp}`, discountType: 'PERCENTAGE', discountValue: 150 })
        .expect(400);
    });

    it('rejects a malformed coupon code', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ code: 'has spaces!', discountType: 'FIXED', discountValue: 100 })
        .expect(400);
    });

    it('rejects a duplicate code', async () => {
      await createCoupon({ code: `DUP${stamp}`, discountType: 'FIXED', discountValue: 100 });
      await request(app.getHttpServer())
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ code: `DUP${stamp}`, discountType: 'FIXED', discountValue: 100 })
        .expect(409);
    });
  });

  describe('Coupon preview & application', () => {
    it('previews a valid coupon against the server-side cart subtotal', async () => {
      await createCoupon({ code: `TEN${stamp}`, discountType: 'PERCENTAGE', discountValue: 10 });
      await addToCart(customerToken, 2); // subtotal 2000

      const res = await request(app.getHttpServer())
        .post('/api/coupons/preview')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: `TEN${stamp}` })
        .expect(201);

      expect(res.body.discount).toBe(200); // 10% of 2000, computed server-side
      await clearCart(customerToken);
    });

    it('rejects an expired coupon at preview', async () => {
      await createCoupon({
        code: `EXP${stamp}`,
        discountType: 'FIXED',
        discountValue: 100,
        expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
      });
      await addToCart(customerToken, 1);

      await request(app.getHttpServer())
        .post('/api/coupons/preview')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: `EXP${stamp}` })
        .expect(400);

      await clearCart(customerToken);
    });

    it('rejects a coupon below its minimum order value', async () => {
      await createCoupon({ code: `MIN${stamp}`, discountType: 'FIXED', discountValue: 100, minOrderValue: 5000 });
      await addToCart(customerToken, 1); // subtotal 1000

      await request(app.getHttpServer())
        .post('/api/coupons/preview')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ code: `MIN${stamp}` })
        .expect(400);

      await clearCart(customerToken);
    });

    it('applies the coupon at checkout using a server-computed discount, ignoring any client-sent amount', async () => {
      await createCoupon({ code: `CHK${stamp}`, discountType: 'PERCENTAGE', discountValue: 25 });
      await addToCart(customerToken, 2); // subtotal 2000

      const res = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        // discount/total here are attacker-supplied noise — forbidNonWhitelisted
        // means the request is rejected outright rather than silently honoured.
        .send({ addressId, paymentMethod: 'COD', couponCode: `CHK${stamp}`, discount: 9999, total: 1 })
        .expect(400);

      // Same order without the injected fields succeeds with the real discount.
      const ok = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, paymentMethod: 'COD', couponCode: `CHK${stamp}` })
        .expect(201);

      expect(ok.body.order.discount).toBe(500); // 25% of 2000
      expect(ok.body.order.couponCode).toBe(`CHK${stamp}`);
      expect(ok.body.order.total).toBe(1500); // 2000 - 500 + 0 shipping (over threshold)
    });

    it('caps a fixed discount at the subtotal so an order total can never go negative', async () => {
      await createCoupon({ code: `HUGE${stamp}`, discountType: 'FIXED', discountValue: 999999 });
      await addToCart(customerToken, 1); // subtotal 1000

      const res = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, paymentMethod: 'COD', couponCode: `HUGE${stamp}` })
        .expect(201);

      expect(res.body.order.discount).toBe(1000);
      expect(res.body.order.total).toBeGreaterThanOrEqual(0);
    });

    // Razorpay refuses amounts under ₹1, so a fully-discounted order must not be
    // handed to the gateway — it would leave a PENDING order that can never be paid.
    it('settles a fully-discounted RAZORPAY order server-side instead of creating an unpayable one', async () => {
      await createCoupon({ code: `ALLOFF${stamp}`, discountType: 'PERCENTAGE', discountValue: 100 });
      await addToCart(customerToken, 1); // subtotal 1000, over the free-shipping threshold

      const res = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, paymentMethod: 'RAZORPAY', couponCode: `ALLOFF${stamp}` })
        .expect(201);

      expect(res.body.order.total).toBe(0);
      expect(res.body.razorpay).toBeNull();
      expect(res.body.order.status).toBe('CONFIRMED');

      // Nothing is owed, so retrying payment is refused rather than passed on.
      await request(app.getHttpServer())
        .post(`/api/orders/me/${res.body.order.id}/retry-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(400);
    });

    it('enforces the per-user limit across separate orders, but not across different users', async () => {
      await createCoupon({ code: `ONCE${stamp}`, discountType: 'FIXED', discountValue: 50, perUserLimit: 1 });

      await addToCart(customerToken, 1);
      await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, paymentMethod: 'COD', couponCode: `ONCE${stamp}` })
        .expect(201);

      // Same customer, second attempt — rejected.
      await addToCart(customerToken, 1);
      await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, paymentMethod: 'COD', couponCode: `ONCE${stamp}` })
        .expect(400);
      await clearCart(customerToken);

      // A different customer is unaffected by the first customer's usage.
      const addressB = (
        await request(app.getHttpServer())
          .post('/api/users/me/addresses')
          .set('Authorization', `Bearer ${customerBToken}`)
          .send({ fullName: 'B', phone: '8888888888', line1: '2 St', city: 'City', state: 'ST', postalCode: '000000' })
          .expect(201)
      ).body.id;
      await addToCart(customerBToken, 1);
      await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ addressId: addressB, paymentMethod: 'COD', couponCode: `ONCE${stamp}` })
        .expect(201);
    });

    it('enforces the global usage limit and increments usedCount only on a real order', async () => {
      const couponId = await createCoupon({
        code: `LIMIT${stamp}`,
        discountType: 'FIXED',
        discountValue: 50,
        usageLimit: 1,
      });

      await addToCart(customerToken, 1);
      await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, paymentMethod: 'COD', couponCode: `LIMIT${stamp}` })
        .expect(201);

      const after = await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } });
      expect(after.usedCount).toBe(1);

      // Limit now exhausted — even a different customer is refused.
      await addToCart(customerBToken, 1);
      const addressB = (
        await request(app.getHttpServer())
          .get('/api/users/me/addresses')
          .set('Authorization', `Bearer ${customerBToken}`)
          .expect(200)
      ).body[0].id;
      await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ addressId: addressB, paymentMethod: 'COD', couponCode: `LIMIT${stamp}` })
        .expect(400);
      await clearCart(customerBToken);
    });

    it('does not consume a coupon use for an unpaid Razorpay order', async () => {
      const couponId = await createCoupon({
        code: `PEND${stamp}`,
        discountType: 'FIXED',
        discountValue: 50,
        usageLimit: 5,
      });
      await addToCart(customerToken, 1);

      await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ addressId, paymentMethod: 'RAZORPAY', couponCode: `PEND${stamp}` })
        .expect(201);

      const after = await prisma.coupon.findUniqueOrThrow({ where: { id: couponId } });
      expect(after.usedCount).toBe(0); // only confirmPayment() redeems it
      await clearCart(customerToken);
    });
  });

  describe('Reviews', () => {
    let reviewId = '';

    it('requires authentication to write a review', async () => {
      await request(app.getHttpServer())
        .put(`/api/products/${productId}/reviews/mine`)
        .send({ rating: 5, body: 'anon' })
        .expect(401);
    });

    it('rejects an out-of-range rating', async () => {
      for (const rating of [0, 6]) {
        await request(app.getHttpServer())
          .put(`/api/products/${productId}/reviews/mine`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ rating, body: 'bad rating' })
          .expect(400);
      }
    });

    it('creates a review in PENDING and keeps it out of the public list', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/products/${productId}/reviews/mine`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ rating: 5, title: 'Lovely', body: 'Really nice quality.' })
        .expect(200);
      expect(res.body.status).toBe(ReviewStatus.PENDING);
      reviewId = res.body.id;

      const publicList = await request(app.getHttpServer())
        .get(`/api/products/${productId}/reviews`)
        .expect(200);
      expect(publicList.body.items).toHaveLength(0);
    });

    it('blocks a customer from moderating reviews', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'APPROVED' })
        .expect(403);
    });

    it('publishes the review once staff approve it and updates the product rating', async () => {
      await request(app.getHttpServer())
        .patch(`/api/admin/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'APPROVED' })
        .expect(200);

      const publicList = await request(app.getHttpServer())
        .get(`/api/products/${productId}/reviews`)
        .expect(200);
      expect(publicList.body.items).toHaveLength(1);
      expect(publicList.body.items[0].authorName).toBe('Cust');

      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      expect(Number(product.ratingAverage)).toBe(5);
      expect(product.ratingCount).toBe(1);
    });

    it('never exposes the reviewer email on the public endpoint', async () => {
      const publicList = await request(app.getHttpServer())
        .get(`/api/products/${productId}/reviews`)
        .expect(200);
      expect(JSON.stringify(publicList.body)).not.toContain(customerEmail);
    });

    it('sends an edited review back to PENDING and drops it from the public average', async () => {
      await request(app.getHttpServer())
        .put(`/api/products/${productId}/reviews/mine`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ rating: 1, body: 'Changed my mind.' })
        .expect(200)
        .expect((res) => {
          if (res.body.status !== ReviewStatus.PENDING) throw new Error('edit should re-enter moderation');
        });

      const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      expect(product.ratingCount).toBe(0);
    });

    it('keeps one review per customer per product (upsert, not duplicate)', async () => {
      const count = await prisma.review.count({ where: { productId, userId: customerId } });
      expect(count).toBe(1);
    });
  });

  describe('Banners', () => {
    it('blocks customers from banner administration', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ title: 'Nope' })
        .expect(403);
    });

    it('lets staff create a banner and exposes only active ones publicly', async () => {
      const active = await request(app.getHttpServer())
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ title: `Active ${stamp}`, position: 1, isActive: true })
        .expect(201);
      createdBannerIds.push(active.body.id);

      const hidden = await request(app.getHttpServer())
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ title: `Hidden ${stamp}`, position: 2, isActive: false })
        .expect(201);
      createdBannerIds.push(hidden.body.id);

      const publicList = await request(app.getHttpServer()).get('/api/banners').expect(200);
      const titles = publicList.body.map((b: { title: string }) => b.title);
      expect(titles).toContain(`Active ${stamp}`);
      expect(titles).not.toContain(`Hidden ${stamp}`);
    });

    // Banner URLs are rendered into an href/src on the public storefront, so a
    // script-bearing URL stored by staff would be XSS against every visitor.
    it.each([
      ['javascript:alert(1)', 'linkUrl'],
      ['javascript:alert(1)', 'imageUrl'],
      ['data:text/html,<script>alert(1)</script>', 'imageUrl'],
      ['//evil.example.com/x', 'linkUrl'],
      ['vbscript:msgbox(1)', 'linkUrl'],
    ])('refuses %p as a banner %s', async (url, field) => {
      await request(app.getHttpServer())
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ title: `Probe ${stamp}`, [field]: url })
        .expect(400);
    });

    it('accepts a relative path and an absolute https URL', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          title: `Safe urls ${stamp}`,
          linkUrl: '/products?category=x',
          imageUrl: 'https://cdn.example.com/a.png',
          isActive: false,
        })
        .expect(201);
      createdBannerIds.push(created.body.id);

      expect(created.body.linkUrl).toBe('/products?category=x');
      expect(created.body.imageUrl).toBe('https://cdn.example.com/a.png');
    });

    it('refuses an unsafe URL on update too, not just on create', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/admin/banners')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ title: `Update probe ${stamp}`, isActive: false })
        .expect(201);
      createdBannerIds.push(created.body.id);

      await request(app.getHttpServer())
        .patch(`/api/admin/banners/${created.body.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ linkUrl: 'javascript:alert(1)' })
        .expect(400);
    });
  });

  describe('Related & recently-viewed products', () => {
    it('returns same-category products excluding the one being viewed', async () => {
      const sibling = await prisma.product.create({
        data: {
          name: `Mkt Sibling ${stamp}`,
          slug: `mkt-sibling-${stamp}`,
          description: 'Sibling.',
          status: ProductStatus.ACTIVE,
          categoryId,
          displayPrice: 500,
          inStock: true,
          variants: { create: [{ sku: `MKT-SIB-${stamp}`, name: 'Default', price: 500, stock: 5, isDefault: true }] },
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/products/mkt-runner-${stamp}/related`)
        .expect(200);

      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).toContain(sibling.id);
      expect(ids).not.toContain(productId);

      await prisma.product.delete({ where: { id: sibling.id } });
    });

    it('resolves recently-viewed ids, silently dropping unknown ones', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/products/recently-viewed?ids=${productId},00000000-0000-0000-0000-000000000000`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(productId);
    });

    it('returns an empty list when no ids are supplied', async () => {
      const res = await request(app.getHttpServer()).get('/api/products/recently-viewed').expect(200);
      expect(res.body).toEqual([]);
    });
  });
});
