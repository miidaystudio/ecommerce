import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WishlistService } from './wishlist.service';

describe('WishlistService', () => {
  let service: WishlistService;

  const prismaMock = {
    product: { findUnique: jest.fn() },
    wishlistItem: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [WishlistService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = moduleRef.get(WishlistService);
    jest.clearAllMocks();
    prismaMock.wishlistItem.findMany.mockResolvedValue([]);
  });

  describe('addItem', () => {
    it('throws NotFoundException when the product does not exist', async () => {
      prismaMock.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem('user-1', { productId: 'missing' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException for a non-ACTIVE product (same visibility rule as the public catalog)', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', status: ProductStatus.DRAFT });

      await expect(service.addItem('user-1', { productId: 'p1' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('upserts idempotently for an ACTIVE product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', status: ProductStatus.ACTIVE });
      prismaMock.wishlistItem.upsert.mockResolvedValue({});

      await service.addItem('user-1', { productId: 'p1' });

      expect(prismaMock.wishlistItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_productId: { userId: 'user-1', productId: 'p1' } },
        }),
      );
    });
  });

  describe('list', () => {
    it('marks a product unavailable once it is no longer ACTIVE, without dropping it from the list', async () => {
      prismaMock.wishlistItem.findMany.mockResolvedValue([
        {
          id: 'w1',
          productId: 'p1',
          product: {
            id: 'p1',
            name: 'Archived Thing',
            slug: 'archived-thing',
            status: ProductStatus.ARCHIVED,
            displayPrice: 500,
            displayCompareAtPrice: null,
            inStock: false,
            images: [],
          },
        },
      ]);

      const result = await service.list('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].product.available).toBe(false);
    });
  });
});
