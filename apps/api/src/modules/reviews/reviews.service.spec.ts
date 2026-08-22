import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus, ProductStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;

  const prismaMock = {
    $transaction: jest.fn(),
    review: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    product: { findUnique: jest.fn(), update: jest.fn() },
    orderItem: { count: jest.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(ReviewsService);
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: Promise<unknown>[]) => Promise.all(arg));
    prismaMock.review.aggregate.mockResolvedValue({ _avg: { rating: 0 }, _count: { rating: 0 } });
    prismaMock.product.update.mockResolvedValue({});
  });

  const reviewRow = {
    id: 'r1',
    productId: 'p1',
    rating: 5,
    title: 'Great',
    body: 'Lovely product',
    status: ReviewStatus.APPROVED,
    isVerifiedPurchase: true,
    createdAt: new Date(),
    user: { firstName: 'Ada', lastName: 'Lovelace' },
  };

  describe('listForProduct', () => {
    it('only ever queries APPROVED reviews — pending/rejected are never public', async () => {
      prismaMock.review.findMany.mockResolvedValue([]);
      prismaMock.review.count.mockResolvedValue(0);

      await service.listForProduct('p1', 1, 20);

      expect(prismaMock.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: 'p1', status: ReviewStatus.APPROVED } }),
      );
    });

    it('exposes only a display name, never the reviewer email', async () => {
      prismaMock.review.findMany.mockResolvedValue([reviewRow]);
      prismaMock.review.count.mockResolvedValue(1);

      const result = await service.listForProduct('p1', 1, 20);

      expect(result.items[0].authorName).toBe('Ada Lovelace');
      expect(JSON.stringify(result.items[0])).not.toContain('@');
    });

    it('falls back to a generic name when the reviewer has no name set', async () => {
      prismaMock.review.findMany.mockResolvedValue([{ ...reviewRow, user: { firstName: null, lastName: null } }]);
      prismaMock.review.count.mockResolvedValue(1);

      const result = await service.listForProduct('p1', 1, 20);
      expect(result.items[0].authorName).toBe('Verified shopper');
    });
  });

  describe('upsert', () => {
    it('404s for a non-ACTIVE product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', status: ProductStatus.DRAFT });
      await expect(service.upsert('u1', 'p1', { rating: 5, body: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forces status back to PENDING so an edit cannot bypass moderation', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', status: ProductStatus.ACTIVE });
      prismaMock.orderItem.count.mockResolvedValue(0);
      prismaMock.review.upsert.mockResolvedValue(reviewRow);

      await service.upsert('u1', 'p1', { rating: 4, body: 'edited' });

      const args = prismaMock.review.upsert.mock.calls[0][0];
      expect(args.create.status).toBe(ReviewStatus.PENDING);
      expect(args.update.status).toBe(ReviewStatus.PENDING);
    });

    it('marks isVerifiedPurchase only when the user has a DELIVERED order for the product', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', status: ProductStatus.ACTIVE });
      prismaMock.orderItem.count.mockResolvedValue(1);
      prismaMock.review.upsert.mockResolvedValue(reviewRow);

      await service.upsert('u1', 'p1', { rating: 5, body: 'bought it' });

      expect(prismaMock.orderItem.count).toHaveBeenCalledWith({
        where: { variant: { productId: 'p1' }, order: { userId: 'u1', status: { in: [OrderStatus.DELIVERED] } } },
      });
      expect(prismaMock.review.upsert.mock.calls[0][0].create.isVerifiedPurchase).toBe(true);
    });

    it('recomputes the product rating after a write', async () => {
      prismaMock.product.findUnique.mockResolvedValue({ id: 'p1', status: ProductStatus.ACTIVE });
      prismaMock.orderItem.count.mockResolvedValue(0);
      prismaMock.review.upsert.mockResolvedValue(reviewRow);

      await service.upsert('u1', 'p1', { rating: 5, body: 'x' });

      expect(prismaMock.product.update).toHaveBeenCalled();
    });
  });

  describe('recomputeProductRating', () => {
    it('averages only APPROVED reviews', async () => {
      prismaMock.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 2 } });

      await service.recomputeProductRating('p1');

      expect(prismaMock.review.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: 'p1', status: ReviewStatus.APPROVED } }),
      );
      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { ratingAverage: 4.5, ratingCount: 2 },
      });
    });

    it('resets to zero when the last approved review is removed', async () => {
      prismaMock.review.aggregate.mockResolvedValue({ _avg: { rating: null }, _count: { rating: 0 } });

      await service.recomputeProductRating('p1');

      expect(prismaMock.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { ratingAverage: 0, ratingCount: 0 },
      });
    });
  });

  describe('summaryForProduct', () => {
    it('builds a per-star breakdown and average from approved reviews', async () => {
      prismaMock.review.groupBy.mockResolvedValue([
        { rating: 5, _count: { rating: 3 } },
        { rating: 4, _count: { rating: 1 } },
      ]);

      const summary = await service.summaryForProduct('p1');

      expect(summary.ratingCount).toBe(4);
      expect(summary.ratingAverage).toBe(4.75);
      expect(summary.breakdown[5]).toBe(3);
      expect(summary.breakdown[1]).toBe(0);
    });
  });

  describe('moderate', () => {
    it('404s for a missing review', async () => {
      prismaMock.review.findUnique.mockResolvedValue(null);
      await expect(service.moderate('missing', { status: ReviewStatus.APPROVED })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
