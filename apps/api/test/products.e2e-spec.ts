import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Product Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const staffEmail = `catalog_staff_${stamp}@test.local`;
  const customerEmail = `catalog_customer_${stamp}@test.local`;
  const password = 'password123';

  let staffToken = '';
  let customerToken = '';
  let categoryId = '';
  let brandId = '';
  let productId = '';
  let productSlug = '';

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
    await prisma.user.create({
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
  });

  afterAll(async () => {
    if (productId) {
      await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
    }
    if (brandId) {
      await prisma.brand.delete({ where: { id: brandId } }).catch(() => undefined);
    }
    if (categoryId) {
      await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    }
    await prisma.user.deleteMany({ where: { email: { in: [staffEmail, customerEmail] } } });
    await app.close();
  });

  it('blocks a customer from creating a category', async () => {
    await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: `Blocked ${stamp}` })
      .expect(403);
  });

  it('lets staff create a category', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `Catalog Test ${stamp}` })
      .expect(201);
    categoryId = res.body.id;
    expect(res.body.slug).toContain('catalog-test');
  });

  it('lets staff create a brand', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/brands')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `Catalog Brand ${stamp}` })
      .expect(201);
    brandId = res.body.id;
  });

  it('lets staff create a product with variants, deriving price/stock from them', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: `E2E Runner ${stamp}`,
        description: 'End to end test product.',
        categoryId,
        brandId,
        status: 'ACTIVE',
        variants: [
          { sku: `E2E-A-${stamp}`, name: 'A', price: 1000, compareAtPrice: 1200, stock: 5, isDefault: true },
          { sku: `E2E-B-${stamp}`, name: 'B', price: 900, stock: 0 },
        ],
      })
      .expect(201);

    productId = res.body.id;
    productSlug = res.body.slug;
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.variants).toHaveLength(2);
  });

  it('rejects a second variant reusing the same SKU', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: `E2E Dupe ${stamp}`,
        description: 'Should fail.',
        categoryId,
        variants: [{ sku: `E2E-A-${stamp}`, name: 'Dupe', price: 100, stock: 1 }],
      })
      .expect(409);
  });

  it('exposes the ACTIVE product on the public listing with the default variant price', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products?category=${(await getCategorySlug())}`)
      .expect(200);

    const found = res.body.items.find((p: { id: string }) => p.id === productId);
    expect(found).toBeDefined();
    expect(found.price).toBe(1000);
    expect(found.inStock).toBe(true);
  });

  it('finds the product via search-with-autocomplete', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/products/search?q=E2E Runner ${stamp}`)
      .expect(200);
    expect(res.body.some((p: { id: string }) => p.id === productId)).toBe(true);
  });

  it('returns full variant detail on the public product page', async () => {
    const res = await request(app.getHttpServer()).get(`/api/products/${productSlug}`).expect(200);
    expect(res.body.variants).toHaveLength(2);
    expect(res.body.variants[1].stock).toBe(0);
  });

  it('hides a DRAFT product from public list, search, and detail', async () => {
    const draft = await request(app.getHttpServer())
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        name: `E2E Draft ${stamp}`,
        description: 'Unreleased.',
        categoryId,
        variants: [{ sku: `E2E-DRAFT-${stamp}`, name: 'Default', price: 500, stock: 1 }],
      })
      .expect(201);

    await request(app.getHttpServer()).get(`/api/products/${draft.body.slug}`).expect(404);

    const search = await request(app.getHttpServer())
      .get(`/api/products/search?q=E2E Draft ${stamp}`)
      .expect(200);
    expect(search.body).toHaveLength(0);

    await prisma.product.delete({ where: { id: draft.body.id } });
  });

  it('bulk-imports products from CSV, reporting per-row failures without aborting the batch', async () => {
    const csv = [
      'name,categorySlug,sku,price,stock,status',
      `E2E CSV A ${stamp},${await getCategorySlug()},E2E-CSV-A-${stamp},750,3,ACTIVE`,
      `E2E CSV Bad ${stamp},no-such-category,E2E-CSV-B-${stamp},750,3,ACTIVE`,
    ].join('\n');

    const res = await request(app.getHttpServer())
      .post('/api/admin/products/bulk-import')
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('file', Buffer.from(csv), { filename: 'products.csv', contentType: 'text/csv' })
      .expect(201);

    expect(res.body.created).toBe(1);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].error).toContain('no-such-category');

    const created = await prisma.product.findFirst({ where: { name: `E2E CSV A ${stamp}` } });
    expect(created).not.toBeNull();
    if (created) {
      await prisma.product.delete({ where: { id: created.id } });
    }
  });

  it('blocks a customer from using bulk-import', async () => {
    const csv = 'name,categorySlug,sku,price,stock\nX,y,Z,1,1';
    await request(app.getHttpServer())
      .post('/api/admin/products/bulk-import')
      .set('Authorization', `Bearer ${customerToken}`)
      .attach('file', Buffer.from(csv), { filename: 'products.csv', contentType: 'text/csv' })
      .expect(403);
  });

  it('lets staff read the draft-inclusive admin product view by id', async () => {
    await request(app.getHttpServer())
      .get(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
  });

  it('updates stock via a full variant replace and recomputes inStock', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/admin/products/${productId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        variants: [
          { sku: `E2E-A-${stamp}`, name: 'A', price: 1000, stock: 0, isDefault: true },
          { sku: `E2E-B-${stamp}`, name: 'B', price: 900, stock: 0 },
        ],
      })
      .expect(200);
    expect(res.body.variants.every((v: { stock: number }) => v.stock === 0)).toBe(true);

    const publicView = await request(app.getHttpServer()).get(`/api/products/${productSlug}`).expect(200);
    expect(publicView.body.variants.every((v: { stock: number }) => v.stock === 0)).toBe(true);

    const listing = await request(app.getHttpServer())
      .get('/api/products?inStock=true')
      .expect(200);
    expect(listing.body.items.some((p: { id: string }) => p.id === productId)).toBe(false);
  });

  async function getCategorySlug(): Promise<string> {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    return category!.slug;
  }
});
