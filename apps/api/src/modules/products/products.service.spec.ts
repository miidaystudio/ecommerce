import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const prismaMock = {
    product: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    productVariant: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    productImage: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    category: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(ProductsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const baseDto = {
      name: 'Linen Table Runner',
      description: 'A slow, textured linen runner.',
      categoryId: 'cat-1',
      variants: [
        { sku: 'LTR-OAT', name: 'Oat', price: 1490, compareAtPrice: 1890, stock: 12, isDefault: true },
        { sku: 'LTR-CHR', name: 'Charcoal', price: 1290, stock: 0, isDefault: false },
      ],
    };

    it('rejects a duplicate slug', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'existing', slug: 'linen-table-runner' });

      await expect(service.create(baseDto as never)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects duplicate SKUs within the same request', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      const dto = {
        ...baseDto,
        variants: [
          { sku: 'DUPE', name: 'A', price: 100, stock: 1 },
          { sku: 'DUPE', name: 'B', price: 100, stock: 1 },
        ],
      };

      await expect(service.create(dto as never)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a SKU already used by another product', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.productVariant.findMany.mockResolvedValue([{ sku: 'LTR-OAT' }]);

      await expect(service.create(baseDto as never)).rejects.toBeInstanceOf(ConflictException);
    });

    it('derives displayPrice/displayCompareAtPrice from the default variant and inStock from any variant with stock', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.productVariant.findMany.mockResolvedValue([]);
      prismaMock.product.create.mockResolvedValue({
        id: 'p1',
        images: [],
        variants: [],
        category: { id: 'cat-1', name: 'Cat', slug: 'cat' },
        brand: null,
      });

      await service.create(baseDto as never);

      const createArgs = prismaMock.product.create.mock.calls[0][0];
      expect(createArgs.data.displayPrice).toBe(1490);
      expect(createArgs.data.displayCompareAtPrice).toBe(1890);
      expect(createArgs.data.inStock).toBe(true);
      expect(createArgs.data.status).toBe(ProductStatus.DRAFT);
    });

    it('falls back to the cheapest variant when none is marked default', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.productVariant.findMany.mockResolvedValue([]);
      prismaMock.product.create.mockResolvedValue({
        id: 'p1',
        images: [],
        variants: [],
        category: { id: 'cat-1', name: 'Cat', slug: 'cat' },
        brand: null,
      });

      const dto = {
        ...baseDto,
        variants: [
          { sku: 'A', name: 'A', price: 500, stock: 3 },
          { sku: 'B', name: 'B', price: 300, stock: 0 },
        ],
      };

      await service.create(dto as never);

      const createArgs = prismaMock.product.create.mock.calls[0][0];
      expect(createArgs.data.displayPrice).toBe(300);
      expect(createArgs.data.inStock).toBe(true);
    });

    it('marks inStock false when every variant is out of stock', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);
      prismaMock.productVariant.findMany.mockResolvedValue([]);
      prismaMock.product.create.mockResolvedValue({
        id: 'p1',
        images: [],
        variants: [],
        category: { id: 'cat-1', name: 'Cat', slug: 'cat' },
        brand: null,
      });

      const dto = {
        ...baseDto,
        variants: [{ sku: 'OOS', name: 'Sold out', price: 500, stock: 0, isDefault: true }],
      };

      await service.create(dto as never);

      const createArgs = prismaMock.product.create.mock.calls[0][0];
      expect(createArgs.data.inStock).toBe(false);
    });
  });

  describe('getPublicBySlug', () => {
    it('throws NotFoundException for a DRAFT product (public visibility)', async () => {
      prismaMock.product.findUnique.mockResolvedValue({
        id: 'p1',
        slug: 'x',
        status: ProductStatus.DRAFT,
      });

      await expect(service.getPublicBySlug('x')).rejects.toThrow('Product not found');
    });
  });
});
