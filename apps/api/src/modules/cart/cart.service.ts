import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PriceSummary, SettingsService } from '../settings/settings.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const CART_ITEM_INCLUDE = {
  variant: {
    include: {
      product: {
        include: {
          images: { orderBy: { position: 'asc' as const }, take: 1 },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{ include: typeof CART_ITEM_INCLUDE }>;

export interface CartItemView {
  id: string;
  variantId: string;
  quantity: number;
  price: number;
  compareAtPrice: number | null;
  lineTotal: number;
  stock: number;
  available: boolean;
  product: { id: string; name: string; slug: string };
  variant: { name: string; attributes: Record<string, string> | null };
  image: { url: string; altText: string | null } | null;
}

export interface CartResponse {
  items: CartItemView[];
  subtotal: number;
  itemCount: number;
}

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Prices a set of lines for display — the cart page's subtotal, shipping and
   * tax-inclusive GST — through the same SettingsService.summarize() that
   * order creation uses.
   *
   * Lines for unknown variants or non-ACTIVE products are left out rather than
   * failing the whole quote; checkout re-validates every line for real before
   * anything is charged.
   */
  async quote(lines: { variantId: string; quantity: number }[]): Promise<PriceSummary> {
    // Repeated variant ids are merged, so a duplicated line can't be priced twice.
    const quantities = new Map<string, number>();
    for (const line of lines) {
      quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);
    }

    const variants = quantities.size
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: [...quantities.keys()] }, product: { status: ProductStatus.ACTIVE } },
          select: { id: true, price: true },
        })
      : [];

    const subtotal = variants.reduce(
      (sum, variant) => sum + Number(variant.price) * (quantities.get(variant.id) ?? 0),
      0,
    );
    return this.settings.summarize(Math.round(subtotal * 100) / 100, 0);
  }

  async getCart(userId: string): Promise<CartResponse> {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: CART_ITEM_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return this.toCartResponse(items);
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<CartResponse> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true },
    });
    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }
    if (variant.product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('This product is not currently available');
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_variantId: { userId, variantId: dto.variantId } },
    });
    const requestedQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (variant.stock === 0) {
      throw new BadRequestException('This item is out of stock');
    }
    if (requestedQuantity > variant.stock) {
      throw new BadRequestException(`Only ${variant.stock} left in stock`);
    }

    await this.prisma.cartItem.upsert({
      where: { userId_variantId: { userId, variantId: dto.variantId } },
      create: {
        userId,
        variantId: dto.variantId,
        quantity: dto.quantity,
        priceSnapshot: variant.price,
      },
      update: {
        quantity: requestedQuantity,
        priceSnapshot: variant.price,
      },
    });

    return this.getCart(userId);
  }

  async updateItem(userId: string, variantId: string, dto: UpdateCartItemDto): Promise<CartResponse> {
    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_variantId: { userId, variantId } },
      include: { variant: true },
    });
    if (!existing) {
      throw new NotFoundException('Cart item not found');
    }
    if (dto.quantity > existing.variant.stock) {
      throw new BadRequestException(`Only ${existing.variant.stock} left in stock`);
    }

    await this.prisma.cartItem.update({
      where: { userId_variantId: { userId, variantId } },
      data: { quantity: dto.quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, variantId: string): Promise<CartResponse> {
    await this.prisma.cartItem.deleteMany({ where: { userId, variantId } });
    return this.getCart(userId);
  }

  async clear(userId: string): Promise<{ success: true }> {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return { success: true };
  }

  private toCartResponse(items: CartItemWithRelations[]): CartResponse {
    const views: CartItemView[] = items.map((item) => {
      const price = Number(item.variant.price);
      return {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        price,
        compareAtPrice: item.variant.compareAtPrice ? Number(item.variant.compareAtPrice) : null,
        lineTotal: price * item.quantity,
        stock: item.variant.stock,
        available: item.variant.product.status === ProductStatus.ACTIVE,
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          slug: item.variant.product.slug,
        },
        variant: {
          name: item.variant.name,
          attributes: (item.variant.attributes as Record<string, string> | null) ?? null,
        },
        image: item.variant.product.images[0]
          ? { url: item.variant.product.images[0].url, altText: item.variant.product.images[0].altText }
          : null,
      };
    });

    return {
      items: views,
      subtotal: views.reduce((sum, item) => sum + item.lineTotal, 0),
      itemCount: views.reduce((sum, item) => sum + item.quantity, 0),
    };
  }
}
