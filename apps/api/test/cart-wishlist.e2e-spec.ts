import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ProductStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Cart & Wishlist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const customerAEmail = `cart_a_${stamp}@test.local`;
  const customerBEmail = `cart_b_${stamp}@test.local`;
  const password = 'password123';

  let customerAToken = '';
  let customerBToken = '';
  let categoryId = '';
  let productId = '';
  let inStockVariantId = '';
  let lowStockVariantId = '';
  let draftProductId = '';
  let draftVariantId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    await prisma.user.create({
      data: { email: customerAEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.CUSTOMER, isVerified: true, emailVerifiedAt: new Date() },
    });
    await prisma.user.create({
      data: { email: customerBEmail, passwordHash: await bcrypt.hash(password, 12), role: Role.CUSTOMER, isVerified: true, emailVerifiedAt: new Date() },
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

    const category = await prisma.category.create({ data: { name: `Cart Test ${stamp}`, slug: `cart-test-${stamp}` } });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `Cart Test Runner ${stamp}`,
        slug: `cart-test-runner-${stamp}`,
        description: 'For cart/wishlist e2e.',
        status: ProductStatus.ACTIVE,
        categoryId,
        displayPrice: 500,
        inStock: true,
        variants: {
          create: [
            { sku: `CART-INSTOCK-${stamp}`, name: 'In stock', price: 500, stock: 10, isDefault: true },
            { sku: `CART-LOWSTOCK-${stamp}`, name: 'Low stock', price: 700, stock: 2 },
          ],
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    inStockVariantId = product.variants.find((v) => v.stock === 10)!.id;
    lowStockVariantId = product.variants.find((v) => v.stock === 2)!.id;

    const draftProduct = await prisma.product.create({
      data: {
        name: `Cart Test Draft ${stamp}`,
        slug: `cart-test-draft-${stamp}`,
        description: 'Should be unaddable.',
        status: ProductStatus.DRAFT,
        categoryId,
        displayPrice: 300,
        variants: { create: [{ sku: `CART-DRAFT-${stamp}`, name: 'Default', price: 300, stock: 5, isDefault: true }] },
      },
      include: { variants: true },
    });
    draftProductId = draftProduct.id;
    draftVariantId = draftProduct.variants[0].id;
  });

  afterAll(async () => {
    // User has onDelete: Cascade on cartItems/wishlistItems, so deleting the test
    // users below also cleans up everything they added.
    await prisma.product.deleteMany({ where: { id: { in: [productId, draftProductId] } } }).catch(() => undefined);
    await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { in: [customerAEmail, customerBEmail] } } });
    await app.close();
  });

  it('requires authentication for every cart and wishlist route', async () => {
    await request(app.getHttpServer()).get('/api/cart/me').expect(401);
    await request(app.getHttpServer()).post('/api/cart/me/items').send({ variantId: inStockVariantId, quantity: 1 }).expect(401);
    await request(app.getHttpServer()).get('/api/wishlist/me').expect(401);
  });

  it('starts with an empty cart', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/cart/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(res.body).toEqual({ items: [], subtotal: 0, itemCount: 0 });
  });

  it('adds an item and computes price/lineTotal/subtotal from the live variant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ variantId: inStockVariantId, quantity: 2 })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ variantId: inStockVariantId, quantity: 2, price: 500, lineTotal: 1000 });
    expect(res.body.subtotal).toBe(1000);
    expect(res.body.itemCount).toBe(2);
  });

  it('adding the same variant again sums quantities instead of duplicating rows', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ variantId: inStockVariantId, quantity: 1 })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
  });

  it('rejects adding more than available stock', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ variantId: lowStockVariantId, quantity: 3 })
      .expect(400);
    expect(res.body.message).toContain('Only 2 left in stock');
  });

  it('rejects adding a variant whose product is DRAFT (not customer-visible)', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ variantId: draftVariantId, quantity: 1 })
      .expect(400);
  });

  it('updates quantity, rejecting anything above stock', async () => {
    await request(app.getHttpServer())
      .patch(`/api/cart/me/items/${inStockVariantId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ quantity: 5 })
      .expect(200)
      .expect((res) => {
        if (res.body.items[0].quantity !== 5) throw new Error('quantity not updated');
      });

    await request(app.getHttpServer())
      .patch(`/api/cart/me/items/${inStockVariantId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ quantity: 999 })
      .expect(400);
  });

  it('404s updating a cart item that was never added', async () => {
    await request(app.getHttpServer())
      .patch(`/api/cart/me/items/${lowStockVariantId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ quantity: 1 })
      .expect(404);
  });

  it("keeps each customer's cart isolated", async () => {
    const bCart = await request(app.getHttpServer())
      .get('/api/cart/me')
      .set('Authorization', `Bearer ${customerBToken}`)
      .expect(200);
    expect(bCart.body.items).toHaveLength(0);
  });

  it('flags a cart item unavailable (without dropping it) once its product is archived', async () => {
    await prisma.product.update({ where: { id: productId }, data: { status: ProductStatus.ARCHIVED } });

    const res = await request(app.getHttpServer())
      .get('/api/cart/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(res.body.items[0].available).toBe(false);

    await prisma.product.update({ where: { id: productId }, data: { status: ProductStatus.ACTIVE } });
  });

  it('removes a single item, then clears the whole cart', async () => {
    await request(app.getHttpServer())
      .delete(`/api/cart/me/items/${inStockVariantId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200)
      .expect((res) => {
        if (res.body.items.length !== 0) throw new Error('item not removed');
      });

    await request(app.getHttpServer())
      .post('/api/cart/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ variantId: inStockVariantId, quantity: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/api/cart/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/cart/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('wishlist: adds, is idempotent, lists, and 404s a DRAFT product', async () => {
    await request(app.getHttpServer())
      .post('/api/wishlist/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ productId: draftProductId })
      .expect(404);

    const first = await request(app.getHttpServer())
      .post('/api/wishlist/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ productId })
      .expect(201);
    expect(first.body).toHaveLength(1);

    const second = await request(app.getHttpServer())
      .post('/api/wishlist/me/items')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ productId })
      .expect(201);
    expect(second.body).toHaveLength(1); // idempotent, not duplicated

    const list = await request(app.getHttpServer())
      .get('/api/wishlist/me')
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200);
    expect(list.body[0].productId).toBe(productId);

    await request(app.getHttpServer())
      .delete(`/api/wishlist/me/items/${productId}`)
      .set('Authorization', `Bearer ${customerAToken}`)
      .expect(200)
      .expect((res) => {
        if (res.body.length !== 0) throw new Error('item not removed');
      });
  });
});
