import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

export interface CouponView {
  id: string;
  code: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface PaginatedCoupons {
  items: CouponView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** A validated, server-computed discount. `discount` is the only figure the
 * order flow may use — the client never supplies or influences an amount. */
export interface AppliedCoupon {
  couponId: string;
  code: string;
  discount: number;
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Admin CRUD ---

  async list(page: number, pageSize: number, search?: string): Promise<PaginatedCoupons> {
    const where: Prisma.CouponWhereInput = search
      ? { code: { contains: search, mode: 'insensitive' } }
      : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coupon.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      items: rows.map((c) => this.toView(c)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getById(id: string): Promise<CouponView> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return this.toView(coupon);
  }

  async create(dto: CreateCouponDto): Promise<CouponView> {
    const code = dto.code.toUpperCase();
    this.assertValidRules(dto.discountType, dto.discountValue, dto.startsAt, dto.expiresAt);

    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('A coupon with this code already exists');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscount: dto.maxDiscount,
        minOrderValue: dto.minOrderValue,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return this.toView(coupon);
  }

  async update(id: string, dto: UpdateCouponDto): Promise<CouponView> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    const discountType = dto.discountType ?? existing.discountType;
    const discountValue = dto.discountValue ?? Number(existing.discountValue);
    this.assertValidRules(discountType, discountValue, dto.startsAt, dto.expiresAt);

    let code: string | undefined;
    if (dto.code) {
      code = dto.code.toUpperCase();
      const clash = await this.prisma.coupon.findUnique({ where: { code } });
      if (clash && clash.id !== id) {
        throw new ConflictException('A coupon with this code already exists');
      }
    }

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        code,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscount: dto.maxDiscount,
        minOrderValue: dto.minOrderValue,
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit,
        isActive: dto.isActive,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
    return this.toView(coupon);
  }

  async remove(id: string): Promise<{ success: true }> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }
    // Orders keep their snapshotted couponCode/discount (Order.couponId is
    // onDelete: SetNull), so deleting a coupon never rewrites order history.
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true };
  }

  // --- Validation / application ---

  /** Validates a coupon against the live cart subtotal and this user's own
   * redemption history, returning the server-computed discount. Throws a
   * BadRequest with a customer-safe reason if the coupon can't be applied.
   * Callers must never accept a discount figure from the client. */
  async validateForUser(code: string, userId: string, subtotal: number): Promise<AppliedCoupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('This coupon code is not valid');
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('This coupon is not active yet');
    }
    if (coupon.expiresAt && coupon.expiresAt <= now) {
      throw new BadRequestException('This coupon has expired');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    if (coupon.minOrderValue !== null && subtotal < Number(coupon.minOrderValue)) {
      throw new BadRequestException(`This coupon requires a minimum order of ₹${Number(coupon.minOrderValue)}`);
    }

    if (coupon.perUserLimit !== null) {
      const usedByUser = await this.prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } });
      if (usedByUser >= coupon.perUserLimit) {
        throw new BadRequestException('You have already used this coupon');
      }
    }

    const discount = this.computeDiscount(coupon, subtotal);
    if (discount <= 0) {
      throw new BadRequestException('This coupon does not apply to your cart');
    }

    return { couponId: coupon.id, code: coupon.code, discount };
  }

  /** Pure calculation, exported for testing. Always clamps to [0, subtotal] so
   * a discount can never exceed the cart or produce a negative order total. */
  computeDiscount(
    coupon: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscount'>,
    subtotal: number,
  ): number {
    const value = Number(coupon.discountValue);
    let discount =
      coupon.discountType === DiscountType.PERCENTAGE ? (subtotal * value) / 100 : value;

    if (coupon.maxDiscount !== null && coupon.maxDiscount !== undefined) {
      discount = Math.min(discount, Number(coupon.maxDiscount));
    }
    discount = Math.min(discount, subtotal);
    discount = Math.max(0, discount);

    return Math.round(discount * 100) / 100;
  }

  /** Records a redemption and bumps usedCount. Must be called inside the same
   * transaction that creates the order, so a failed order never consumes a use.
   * The conditional increment re-checks usageLimit at write time, closing the
   * race between validateForUser() and order creation. */
  async redeem(
    tx: Prisma.TransactionClient,
    couponId: string,
    userId: string,
    orderId: string,
    discountAmount: number,
  ): Promise<void> {
    const coupon = await tx.coupon.findUnique({ where: { id: couponId }, select: { usageLimit: true } });
    if (!coupon) {
      throw new BadRequestException('This coupon code is not valid');
    }

    const updated = await tx.coupon.updateMany({
      where:
        coupon.usageLimit === null
          ? { id: couponId }
          : { id: couponId, usedCount: { lt: coupon.usageLimit } },
      data: { usedCount: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }

    await tx.couponRedemption.create({
      data: { couponId, userId, orderId, discountAmount },
    });
  }

  private assertValidRules(
    discountType: DiscountType,
    discountValue: number,
    startsAt?: string,
    expiresAt?: string,
  ): void {
    if (discountValue <= 0) {
      throw new BadRequestException('Discount value must be greater than zero');
    }
    if (discountType === DiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException('A percentage discount cannot exceed 100%');
    }
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      throw new BadRequestException('Start date must be before the expiry date');
    }
  }

  private toView(coupon: Coupon): CouponView {
    return {
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      maxDiscount: coupon.maxDiscount === null ? null : Number(coupon.maxDiscount),
      minOrderValue: coupon.minOrderValue === null ? null : Number(coupon.minOrderValue),
      usageLimit: coupon.usageLimit,
      perUserLimit: coupon.perUserLimit,
      usedCount: coupon.usedCount,
      isActive: coupon.isActive,
      startsAt: coupon.startsAt?.toISOString() ?? null,
      expiresAt: coupon.expiresAt?.toISOString() ?? null,
      createdAt: coupon.createdAt.toISOString(),
    };
  }
}
