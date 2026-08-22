import { createHmac } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, PaymentStatus, ProductStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RazorpayService } from '../src/modules/payments/razorpay.service';

// Real signature verification, no live network call to Razorpay: createOrder is
// stubbed (it would otherwise hit the real Razorpay API with the dev placeholder
// test keys, which aren't a real account), but verifyWebhookSignature /
// verifyPaymentSignature / keyId are inherited unchanged from the real service,
// so this suite exercises genuine HMAC verification against the app's actual
// configured secrets — not a mock of the security-critical part.
class TestRazorpayService extends RazorpayService {
  private counter = 0;

  async createOrder(amountInPaise: number, receipt: string) {
    this.counter += 1;
    return { id: `order_test_${receipt}_${this.counter}`, amount: amountInPaise, currency: 'INR' };
  }
}

// Must match apps/api/.env's RAZORPAY_WEBHOOK_SECRET (dev placeholder, not a
// real secret) — used to compute genuine signatures the same way Razorpay would.
const WEBHOOK_SECRET = 'placeholder_test_webhook_secret';
const KEY_SECRET = 'placeholder_test_key_secret';

function signWebhook(rawBody: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

function signPayment(orderId: string, paymentId: string): string {
  return createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

describe('Orders & Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const customerAEmail = `orders_a_${stamp}@test.local`;
  const customerBEmail = `orders_b_${stamp}@test.local`;
  const password = 'password123';

  let customerAToken = '';
  let customerBToken = '';
  let categoryId = '';
  let productId = '';
  let variantId = '';
  let addressId = '';
  let addressIdB = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RazorpayService)
      .useClass(TestRazorpayService)
      .compile();

    // Mirrors main.ts's raw-body wiring for the webhook route — e2e tests build
    // their own app instance and don't go through main.ts's bootstrap().
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    app.use('/api/payments/webhook/razorpay', express.raw({ type: '*/*' }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: { email: customerAEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.CUSTOMER },
    });
    await prisma.user.create({
      data: { email: customerBEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.CUSTOMER },
    });

    const loginA = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerAEmail, password })
      .expect(200);
    customerAToken = loginA.body.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: customerBEmail, password })
      .expect(200);
    customerBToken = loginB.body.accessToken;

    const category = await prisma.category.create({
      data: { name: `Orders Test ${stamp}`, slug: `orders-test-${stamp}` },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `Orders Test Runner ${stamp}`,
        slug: `orders-test-runner-${stamp}`,
        description: 'For orders/payments e2e.',
        status: ProductStatus.ACTIVE,
        categoryId,
        displayPrice: 500,
        inStock: true,
        variants: { create: [{ sku: `ORD-${stamp}`, name: 'Default', price: 500, stock: 5, isDefault: true }] },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0].id;

    const address = await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ fullName: 'Cust A', phone: '9999999999', line1: '1 Test St', city: 'Testville', state: 'TS', postalCode: '000000' })
      .expect(201);
    addressId = address.body.id;

    const addressB = await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ fullName: 'Cust B', phone: '8888888888', line1: '2 Test St', city: 'Testville', state: 'TS', postalCode: '000000' })
      .expect(201);
    addressIdB = addressB.body.id;
  });

  afterAll(async () => {
    // Order.user has no onDelete: Cascade (orders must survive a user record
    // being edited elsewhere) — orders have to be deleted explicitly before the
    // test users, or the FK constraint blocks the user delete below.
    const testUsers = await prisma.user.findMany({ where: { email: { in: [customerAEmail, customerBEmail] } } });
    await prisma.order.deleteMany({ where: { userId: { in: testUsers.map((u) => u.id) } } }).catch(() => undefined);
    await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
    await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { in: [customerAEmail, customerBEmail] } } });
    await app.close();
  });

  async function addToCart(token: string, qty = 1) {
    await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId, quantity: qty })
      .expect(201);
  }

  it('requires authentication for every order route', async () => {
    await request(app.getHttpServer()).get('/api/orders/me').expect(401);
    await request(app.getHttpServer()).post('/api/orders/me').send({ addressId, paymentMethod: 'COD' }).expect(401);
  });

  it('rejects checkout with an empty cart', async () => {
    await request(app.getHttpServer())
      .post('/api/orders/me')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ addressId: addressIdB, paymentMethod: PaymentMethod.COD })
      .expect(400);
  });

  it("rejects checkout with another user's address (IDOR)", async () => {
    await addToCart(customerBToken);
    await request(app.getHttpServer())
      .post('/api/orders/me')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ addressId, paymentMethod: PaymentMethod.COD }) // addressId belongs to customer A
      .expect(404);
    await request(app.getHttpServer())
      .delete('/api/cart/me')
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(200);
  });

  describe('COD checkout', () => {
    let codOrderId = '';

    it('confirms immediately, deducts stock, and clears the cart', async () => {
      await addToCart(customerAToken, 2);

      const res = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ addressId, paymentMethod: PaymentMethod.COD })
        .expect(201);

      expect(res.body.razorpay).toBeNull();
      expect(res.body.order.status).toBe(OrderStatus.CONFIRMED);
      expect(res.body.order.paymentMethod).toBe(PaymentMethod.COD);
      codOrderId = res.body.order.id;

      const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      expect(variant!.stock).toBe(3); // 5 - 2

      const cart = await request(app.getHttpServer())
        .get('/api/cart/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);
      expect(cart.body.items).toHaveLength(0);
    });

    it('appears in order history and detail for the owner, and is invisible to another user', async () => {
      const list = await request(app.getHttpServer())
        .get('/api/orders/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);
      expect(list.body.items.some((o: { id: string }) => o.id === codOrderId)).toBe(true);

      await request(app.getHttpServer())
        .get(`/api/orders/me/${codOrderId}`)
        .set('Authorization', `Bearer ${customerBToken}`)
        .expect(404);
    });

    it('restores stock when the customer cancels a CONFIRMED order', async () => {
      await request(app.getHttpServer())
        .patch(`/api/orders/me/${codOrderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200)
        .expect((res) => {
          if (res.body.status !== OrderStatus.CANCELLED) throw new Error('order not cancelled');
        });

      const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      expect(variant!.stock).toBe(5); // restored

      await request(app.getHttpServer())
        .patch(`/api/orders/me/${codOrderId}/cancel`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(400); // already cancelled, cannot cancel again
    });
  });

  describe('Razorpay checkout + webhook confirmation', () => {
    let rzpOrderId = '';
    let razorpayOrderId = '';

    it('creates a PENDING order without deducting stock, and returns Razorpay order details', async () => {
      await addToCart(customerAToken, 1);

      const res = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ addressId, paymentMethod: PaymentMethod.RAZORPAY })
        .expect(201);

      expect(res.body.order.status).toBe(OrderStatus.PENDING);
      expect(res.body.razorpay).toBeTruthy();
      expect(res.body.razorpay.keyId).toBe('rzp_test_placeholder');
      rzpOrderId = res.body.order.id;
      razorpayOrderId = res.body.razorpay.razorpayOrderId;

      const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      expect(variant!.stock).toBe(5); // unchanged — not deducted pre-payment
    });

    it('rejects a webhook with an invalid signature and leaves the order untouched', async () => {
      const body = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_fake', order_id: razorpayOrderId } } },
      });

      await request(app.getHttpServer())
        .post('/api/payments/webhook/razorpay')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', 'not-a-real-signature')
        .send(body)
        .expect(401);

      const order = await prisma.order.findUnique({ where: { id: rzpOrderId } });
      expect(order!.status).toBe(OrderStatus.PENDING);
    });

    it('confirms the order on a genuinely-signed webhook: deducts stock, clears the cart', async () => {
      const paymentId = `pay_test_${stamp}`;
      const body = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId } } },
      });
      const signature = signWebhook(body);

      await request(app.getHttpServer())
        .post('/api/payments/webhook/razorpay')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', signature)
        .send(body)
        .expect(200);

      const order = await prisma.order.findUnique({ where: { id: rzpOrderId }, include: { payment: true } });
      expect(order!.status).toBe(OrderStatus.CONFIRMED);
      expect(order!.payment!.status).toBe(PaymentStatus.PAID);

      const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      expect(variant!.stock).toBe(4); // 5 - 1, deducted only now

      const cart = await request(app.getHttpServer())
        .get('/api/cart/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .expect(200);
      expect(cart.body.items).toHaveLength(0);
    });

    it('is idempotent: a duplicate webhook for the same payment does not deduct stock twice', async () => {
      const paymentId = `pay_test_${stamp}`;
      const body = JSON.stringify({
        event: 'payment.captured',
        payload: { payment: { entity: { id: paymentId, order_id: razorpayOrderId } } },
      });
      const signature = signWebhook(body);

      await request(app.getHttpServer())
        .post('/api/payments/webhook/razorpay')
        .set('Content-Type', 'application/json')
        .set('X-Razorpay-Signature', signature)
        .send(body)
        .expect(200);

      const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
      expect(variant!.stock).toBe(4); // unchanged from the first (successful) webhook
    });
  });

  describe('Razorpay checkout + client-side verify-payment', () => {
    it('confirms via a signature-verified return-from-checkout call, independent of the webhook', async () => {
      await addToCart(customerAToken, 1);

      const created = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ addressId, paymentMethod: PaymentMethod.RAZORPAY })
        .expect(201);

      const orderId = created.body.order.id;
      const razorpayOrderId = created.body.razorpay.razorpayOrderId;
      const paymentId = `pay_verify_${stamp}`;
      const signature = signPayment(razorpayOrderId, paymentId);

      const res = await request(app.getHttpServer())
        .post(`/api/orders/me/${orderId}/verify-payment`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ razorpayOrderId, razorpayPaymentId: paymentId, razorpaySignature: signature })
        .expect(201);

      expect(res.body.status).toBe(OrderStatus.CONFIRMED);
    });

    it('rejects a forged signature on verify-payment', async () => {
      await addToCart(customerAToken, 1);

      const created = await request(app.getHttpServer())
        .post('/api/orders/me')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ addressId, paymentMethod: PaymentMethod.RAZORPAY })
        .expect(201);

      const orderId = created.body.order.id;
      const razorpayOrderId = created.body.razorpay.razorpayOrderId;

      await request(app.getHttpServer())
        .post(`/api/orders/me/${orderId}/verify-payment`)
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ razorpayOrderId, razorpayPaymentId: 'pay_forged', razorpaySignature: 'totally-fake' })
        .expect(400);

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      expect(order!.status).toBe(OrderStatus.PENDING);
    });
  });

  it('rejects checkout when the cart quantity now exceeds live stock', async () => {
    // Reset to a known stock level first — prior tests in this suite have
    // already moved this variant's stock around.
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 10 } });

    await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ variantId, quantity: 3 })
      .expect(201);

    // Simulates stock being depleted by someone else between add-to-cart and checkout.
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 1 } });

    const res = await request(app.getHttpServer())
      .post('/api/orders/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ addressId, paymentMethod: PaymentMethod.COD })
      .expect(400);
    expect(res.body.message.join(' ')).toContain('left in stock');

    await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 5 } });
    await request(app.getHttpServer())
      .delete('/api/cart/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
  });
});
