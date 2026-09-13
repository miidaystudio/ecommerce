import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/database/prisma.service';

describe('Product Image Upload & Storage (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let staffToken: string;
  let customerToken: string;
  let productId: string;
  let categoryId: string;

  const password = 'Password#123';
  const staffEmail = 'img-staff@example.com';
  const customerEmail = 'img-customer@example.com';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up any leftovers
    await prisma.user.deleteMany({
      where: { email: { in: [staffEmail, customerEmail] } },
    });

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email: staffEmail,
        passwordHash,
        firstName: 'Staff',
        lastName: 'User',
        role: Role.STAFF,
        isVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash,
        firstName: 'Cust',
        lastName: 'User',
        role: Role.CUSTOMER,
        isVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    const category = await prisma.category.create({
      data: {
        name: 'Image Test Category',
        slug: 'image-test-category',
      },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Image Test Product',
        slug: 'image-test-product',
        description: 'Testing image upload',
        categoryId,
        variants: {
          create: [
            {
              sku: 'IMG-TEST-001',
              name: 'Default',
              price: 500,
              stock: 10,
              isDefault: true,
            },
          ],
        },
      },
    });
    productId = product.id;

    // Login to obtain valid tokens
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
      await prisma.productImage.deleteMany({ where: { productId } });
      await prisma.productVariant.deleteMany({ where: { productId } });
      await prisma.product.deleteMany({ where: { id: productId } });
    }
    if (categoryId) {
      await prisma.category.deleteMany({ where: { id: categoryId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [staffEmail, customerEmail] } },
    });
    await app.close();
  });

  it('rejects unauthenticated upload request with 401', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/products/${productId}/images`)
      .attach('file', Buffer.from('fake-png-content'), 'test.png')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('rejects customer upload request with 403 Forbidden', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${customerToken}`)
      .attach('file', Buffer.from('fake-png-content'), 'test.png')
      .expect(HttpStatus.FORBIDDEN);
  });

  it('rejects unsupported file type (text file) with 400 Bad Request', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('file', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('allows staff to upload an image and returns updated product with image', async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG magic header
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    const res = await request(app.getHttpServer())
      .post(`/api/admin/products/${productId}/images`)
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('file', pngBuffer, { filename: 'product-photo.png', contentType: 'image/png' })
      .expect(HttpStatus.CREATED);

    expect(res.body).toHaveProperty('id', productId);
    expect(res.body.images).toBeInstanceOf(Array);
    expect(res.body.images.length).toBeGreaterThan(0);

    const uploaded = res.body.images[0];
    expect(uploaded.url).toBeDefined();

    // Verify in database
    const dbImage = await prisma.productImage.findUnique({
      where: { id: uploaded.id },
    });
    expect(dbImage).not.toBeNull();
    expect(dbImage?.url).toBe(uploaded.url);

    // Delete image
    await request(app.getHttpServer())
      .delete(`/api/admin/products/${productId}/images/${uploaded.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(HttpStatus.OK);

    const deleted = await prisma.productImage.findUnique({
      where: { id: uploaded.id },
    });
    expect(deleted).toBeNull();
  });
});
