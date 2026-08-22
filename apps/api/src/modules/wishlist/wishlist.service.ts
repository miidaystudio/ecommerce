import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

const WISHLIST_ITEM_INCLUDE = {
  product: {
    include: {
      images: { orderBy: { position: 'asc' as const }, take: 1 },
    },
  },
} satisfies Prisma.WishlistItemInclude;

type WishlistItemWithRelations = Prisma.WishlistItemGetPayload<{ include: typeof WISHLIST_ITEM_INCLUDE }>;

export interface WishlistItemView {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAtPrice: number | null;
    inStock: boolean;
    available: boolean;
  };
  image: { url: string; altText: string | null } | null;
}

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<WishlistItemView[]> {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: WISHLIST_ITEM_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return items.map((item) => this.toView(item));
  }

  async addItem(userId: string, dto: AddWishlistItemDto): Promise<WishlistItemView[]> {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }

    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId: dto.productId } },
      create: { userId, productId: dto.productId },
      update: {},
    });

    return this.list(userId);
  }

  async removeItem(userId: string, productId: string): Promise<WishlistItemView[]> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return this.list(userId);
  }

  private toView(item: WishlistItemWithRelations): WishlistItemView {
    return {
      id: item.id,
      productId: item.productId,
      product: {
        id: item.product.id,
        name: item.product.name,
        slug: item.product.slug,
        price: Number(item.product.displayPrice),
        compareAtPrice: item.product.displayCompareAtPrice ? Number(item.product.displayCompareAtPrice) : null,
        inStock: item.product.inStock,
        available: item.product.status === ProductStatus.ACTIVE,
      },
      image: item.product.images[0]
        ? { url: item.product.images[0].url, altText: item.product.images[0].altText }
        : null,
    };
  }
}
