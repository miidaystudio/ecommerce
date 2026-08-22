import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CouponsService } from './coupons.service';

describe('CouponsService', () => {
  let service: CouponsService;

  const prismaMock = {
    $transaction: jest.fn(),
    coupon: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), updateMany: jest.fn() },
    couponRedemption: { count: jest.fn(), create: jest.fn() },
  };

  const txMock = {
    coupon: { findUnique: jest.fn(), updateMany: jest.fn() },
    couponRedemption: { create: jest.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CouponsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(CouponsService);
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(txMock) : Promise.all(arg as Promise<unknown>[]),
    );
  });

  function coupon(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'coupon-1',
      code: 'SAVE10',
      description: null,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      maxDiscount: null,
      minOrderValue: null,
      usageLimit: null,
      perUserLimit: null,
      usedCount: 0,
      isActive: true,
      startsAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  describe('computeDiscount — the money math', () => {
    it('applies a percentage discount', () => {
      expect(service.computeDiscount({ discountType: DiscountType.PERCENTAGE, discountValue: 10, maxDiscount: null } as never, 1000)).toBe(100);
    });

    it('applies a fixed discount', () => {
      expect(service.computeDiscount({ discountType: DiscountType.FIXED, discountValue: 250, maxDiscount: null } as never, 1000)).toBe(250);
    });

    it('caps a percentage discount at maxDiscount', () => {
      expect(service.computeDiscount({ discountType: DiscountType.PERCENTAGE, discountValue: 50, maxDiscount: 200 } as never, 1000)).toBe(200);
    });

    it('never lets a fixed discount exceed the subtotal (no negative order totals)', () => {
      expect(service.computeDiscount({ discountType: DiscountType.FIXED, discountValue: 5000, maxDiscount: null } as never, 800)).toBe(800);
    });

    it('never returns a negative discount even for nonsense stored values', () => {
      expect(service.computeDiscount({ discountType: DiscountType.FIXED, discountValue: -500, maxDiscount: null } as never, 1000)).toBe(0);
    });

    it('rounds to two decimal places rather than leaking float noise into money', () => {
      // 999 * 33.33% = 332.9667
      expect(service.computeDiscount({ discountType: DiscountType.PERCENTAGE, discountValue: 33.33, maxDiscount: null } as never, 999)).toBe(332.97);
    });
  });

  describe('validateForUser — enforcement', () => {
    it('rejects an unknown code', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(null);
      await expect(service.validateForUser('NOPE', 'user-1', 1000)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an inactive coupon', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon({ isActive: false }));
      await expect(service.validateForUser('SAVE10', 'user-1', 1000)).rejects.toThrow('not valid');
    });

    it('rejects a coupon whose start date is in the future', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon({ startsAt: new Date(Date.now() + 86_400_000) }));
      await expect(service.validateForUser('SAVE10', 'user-1', 1000)).rejects.toThrow('not active yet');
    });

    it('rejects an expired coupon', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon({ expiresAt: new Date(Date.now() - 1000) }));
      await expect(service.validateForUser('SAVE10', 'user-1', 1000)).rejects.toThrow('expired');
    });

    it('rejects a coupon that has hit its global usage limit', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon({ usageLimit: 5, usedCount: 5 }));
      await expect(service.validateForUser('SAVE10', 'user-1', 1000)).rejects.toThrow('usage limit');
    });

    it('rejects when the cart is below minOrderValue', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon({ minOrderValue: 2000 }));
      await expect(service.validateForUser('SAVE10', 'user-1', 1000)).rejects.toThrow('minimum order');
    });

    it('rejects when this user has already hit their per-user limit', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon({ perUserLimit: 1 }));
      prismaMock.couponRedemption.count.mockResolvedValue(1);
      await expect(service.validateForUser('SAVE10', 'user-1', 1000)).rejects.toThrow('already used');
    });

    it('counts per-user usage scoped to that user, not globally', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon({ perUserLimit: 1 }));
      prismaMock.couponRedemption.count.mockResolvedValue(0);

      await service.validateForUser('SAVE10', 'user-1', 1000);

      expect(prismaMock.couponRedemption.count).toHaveBeenCalledWith({
        where: { couponId: 'coupon-1', userId: 'user-1' },
      });
    });

    it('rejects a coupon that computes to a zero discount', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon({ discountType: DiscountType.FIXED, discountValue: 0 }));
      await expect(service.validateForUser('SAVE10', 'user-1', 1000)).rejects.toThrow('does not apply');
    });

    it('is case-insensitive on the code (lookup is normalised to uppercase)', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon());
      await service.validateForUser('save10', 'user-1', 1000);
      expect(prismaMock.coupon.findUnique).toHaveBeenCalledWith({ where: { code: 'SAVE10' } });
    });

    it('returns a server-computed discount for a valid coupon', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon());
      const result = await service.validateForUser('SAVE10', 'user-1', 1000);
      expect(result).toEqual({ couponId: 'coupon-1', code: 'SAVE10', discount: 100 });
    });
  });

  describe('redeem — race safety', () => {
    it('increments usedCount conditionally so a concurrent last-use loses', async () => {
      txMock.coupon.findUnique.mockResolvedValue({ usageLimit: 5 });
      txMock.coupon.updateMany.mockResolvedValue({ count: 1 });

      await service.redeem(txMock as never, 'coupon-1', 'user-1', 'order-1', 100);

      expect(txMock.coupon.updateMany).toHaveBeenCalledWith({
        where: { id: 'coupon-1', usedCount: { lt: 5 } },
        data: { usedCount: { increment: 1 } },
      });
      expect(txMock.couponRedemption.create).toHaveBeenCalled();
    });

    it('throws (rolling back the order) when the conditional increment matches nothing', async () => {
      txMock.coupon.findUnique.mockResolvedValue({ usageLimit: 5 });
      txMock.coupon.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.redeem(txMock as never, 'coupon-1', 'user-1', 'order-1', 100)).rejects.toThrow(
        'usage limit',
      );
      expect(txMock.couponRedemption.create).not.toHaveBeenCalled();
    });

    it('skips the usedCount guard for an unlimited coupon', async () => {
      txMock.coupon.findUnique.mockResolvedValue({ usageLimit: null });
      txMock.coupon.updateMany.mockResolvedValue({ count: 1 });

      await service.redeem(txMock as never, 'coupon-1', 'user-1', 'order-1', 100);

      expect(txMock.coupon.updateMany).toHaveBeenCalledWith({
        where: { id: 'coupon-1' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });

  describe('create — admin input validation', () => {
    it('rejects a percentage discount above 100%', async () => {
      await expect(
        service.create({ code: 'BAD', discountType: DiscountType.PERCENTAGE, discountValue: 150 } as never),
      ).rejects.toThrow('cannot exceed 100%');
    });

    it('rejects a zero or negative discount value', async () => {
      await expect(
        service.create({ code: 'BAD', discountType: DiscountType.FIXED, discountValue: 0 } as never),
      ).rejects.toThrow('greater than zero');
    });

    it('rejects a start date on or after the expiry date', async () => {
      await expect(
        service.create({
          code: 'BAD',
          discountType: DiscountType.FIXED,
          discountValue: 100,
          startsAt: '2026-12-01T00:00:00.000Z',
          expiresAt: '2026-11-01T00:00:00.000Z',
        } as never),
      ).rejects.toThrow('before the expiry');
    });

    it('rejects a duplicate code', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(coupon());
      await expect(
        service.create({ code: 'SAVE10', discountType: DiscountType.FIXED, discountValue: 100 } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('normalises the code to uppercase on create', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(null);
      prismaMock.coupon.create.mockResolvedValue(coupon({ code: 'NEWYEAR' }));

      await service.create({ code: 'newyear', discountType: DiscountType.FIXED, discountValue: 100 } as never);

      expect(prismaMock.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ code: 'NEWYEAR' }) }),
      );
    });
  });

  describe('getById', () => {
    it('throws NotFoundException for a missing coupon', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(null);
      await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
