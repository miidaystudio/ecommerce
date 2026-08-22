import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, ProductStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { UpsertReviewDto } from './dto/upsert-review.dto';

export interface ReviewView {
  id: string;
  productId: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  authorName: string;
  createdAt: string;
}

export interface AdminReviewView extends ReviewView {
  productName: string;
  authorEmail: string;
}

export interface PaginatedReviews<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductReviewSummary {
  ratingAverage: number;
  ratingCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public product reviews — only APPROVED ones are ever exposed. */
  async listForProduct(productId: string, page: number, pageSize: number): Promise<PaginatedReviews<ReviewView>> {
    const where: Prisma.ReviewWhereInput = { productId, status: ReviewStatus.APPROVED };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toView(r)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async summaryForProduct(productId: string): Promise<ProductReviewSummary> {
    const grouped = await this.prisma.review.groupBy({
      by: ['rating'],
      where: { productId, status: ReviewStatus.APPROVED },
      _count: { rating: true },
    });

    const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let count = 0;
    for (const row of grouped) {
      const rating = row.rating as 1 | 2 | 3 | 4 | 5;
      breakdown[rating] = row._count.rating;
      sum += rating * row._count.rating;
      count += row._count.rating;
    }

    return {
      ratingAverage: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
      ratingCount: count,
      breakdown,
    };
  }

  async getMineForProduct(userId: string, productId: string): Promise<ReviewView | null> {
    const review = await this.prisma.review.findUnique({
      where: { productId_userId: { productId, userId } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    return review ? this.toView(review) : null;
  }

  /** Create or replace this user's review for a product. Always lands back in
   * PENDING — an edit can't sneak past moderation by reusing an approved row. */
  async upsert(userId: string, productId: string, dto: UpsertReviewDto): Promise<ReviewView> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }

    const isVerifiedPurchase = await this.hasPurchased(userId, productId);

    const review = await this.prisma.review.upsert({
      where: { productId_userId: { productId, userId } },
      create: {
        productId,
        userId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        isVerifiedPurchase,
        status: ReviewStatus.PENDING,
      },
      update: {
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        isVerifiedPurchase,
        status: ReviewStatus.PENDING,
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    // An edit to a previously-approved review removes it from the public
    // average until it's re-approved.
    await this.recomputeProductRating(productId);

    return this.toView(review);
  }

  async removeMine(userId: string, productId: string): Promise<{ success: true }> {
    const existing = await this.prisma.review.findUnique({ where: { productId_userId: { productId, userId } } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }
    await this.prisma.review.delete({ where: { id: existing.id } });
    await this.recomputeProductRating(productId);
    return { success: true };
  }

  // --- Admin moderation ---

  async listAll(
    page: number,
    pageSize: number,
    status?: ReviewStatus,
  ): Promise<PaginatedReviews<AdminReviewView>> {
    const where: Prisma.ReviewWhereInput = status ? { status } : {};

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          product: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        ...this.toView(r),
        productName: r.product.name,
        authorEmail: r.user.email,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async moderate(id: string, dto: ModerateReviewDto): Promise<AdminReviewView> {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }

    const review = await this.prisma.review.update({
      where: { id },
      data: { status: dto.status },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        product: { select: { name: true } },
      },
    });

    await this.recomputeProductRating(review.productId);

    return { ...this.toView(review), productName: review.product.name, authorEmail: review.user.email };
  }

  async remove(id: string): Promise<{ success: true }> {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Review not found');
    }
    await this.prisma.review.delete({ where: { id } });
    await this.recomputeProductRating(existing.productId);
    return { success: true };
  }

  /** Keeps Product.ratingAverage/ratingCount in sync with APPROVED reviews only —
   * same denormalization rationale as displayPrice/inStock. */
  async recomputeProductRating(productId: string): Promise<void> {
    const aggregate = await this.prisma.review.aggregate({
      where: { productId, status: ReviewStatus.APPROVED },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        ratingAverage: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      },
    });
  }

  private async hasPurchased(userId: string, productId: string): Promise<boolean> {
    const count = await this.prisma.orderItem.count({
      where: {
        variant: { productId },
        order: { userId, status: { in: [OrderStatus.DELIVERED] } },
      },
    });
    return count > 0;
  }

  private toView(review: {
    id: string;
    productId: string;
    rating: number;
    title: string | null;
    body: string;
    status: ReviewStatus;
    isVerifiedPurchase: boolean;
    createdAt: Date;
    user: { firstName: string | null; lastName: string | null };
  }): ReviewView {
    const name = [review.user.firstName, review.user.lastName].filter(Boolean).join(' ');
    return {
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      status: review.status,
      isVerifiedPurchase: review.isVerifiedPurchase,
      // Only a display name is ever exposed publicly — never the reviewer's email.
      authorName: name || 'Verified shopper',
      createdAt: review.createdAt.toISOString(),
    };
  }
}
