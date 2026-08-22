import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InventoryAdjustmentReason, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface InventoryLineView {
  variantId: string;
  sku: string;
  variantName: string;
  productId: string;
  productName: string;
  stock: number;
  lowStock: boolean;
}

export interface PaginatedInventory {
  items: InventoryLineView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lowStockCount: number;
}

export interface AdjustmentView {
  id: string;
  variantId: string;
  change: number;
  reason: InventoryAdjustmentReason;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get lowStockThreshold(): number {
    return this.config.get<number>('inventory.lowStockThreshold') ?? 5;
  }

  /** Applies stock changes for a set of {variantId, quantity} lines (quantity is
   * subtracted from stock — pass a negative quantity to add stock back, e.g. on
   * cancellation) and keeps each affected Product's denormalized `inStock` flag
   * in sync, all within the caller's transaction. Clamps at 0 rather than going
   * negative: Razorpay orders don't reserve stock at creation (per arc.md — stock
   * is only deducted once payment is confirmed), so two concurrent buyers of the
   * last unit can both have their payments succeed. That's an accepted, logged
   * edge case of "confirm on payment" vs. "reserve on cart", not a bug here. */
  async adjustStock(
    tx: Prisma.TransactionClient,
    items: { variantId: string; quantity: number }[],
    orderId: string | undefined,
    reason: InventoryAdjustmentReason,
  ): Promise<void> {
    const productIds = new Set<string>();

    for (const item of items) {
      const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
      if (!variant) continue;

      const nextStock = variant.stock - item.quantity;
      const clamped = Math.max(0, nextStock);
      if (nextStock < 0) {
        this.logger.warn(
          `Oversold variant ${item.variantId}${orderId ? ` on order ${orderId}` : ''}: stock ${variant.stock}, needed ${item.quantity}`,
        );
      }

      await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: clamped } });
      await tx.inventoryAdjustment.create({
        data: { variantId: item.variantId, change: -item.quantity, reason, orderId },
      });
      productIds.add(variant.productId);
    }

    for (const productId of productIds) {
      const variants = await tx.productVariant.findMany({ where: { productId }, select: { stock: true } });
      const inStock = variants.some((v) => v.stock > 0);
      await tx.product.update({ where: { id: productId }, data: { inStock } });
    }
  }

  /** Standalone entry point for an admin-initiated stock correction/restock —
   * opens its own transaction (unlike adjustStock, which expects to run inside
   * one an order/payment flow already owns). delta > 0 adds stock, delta < 0
   * removes it (rejected if it would go negative — unlike order fulfillment,
   * there's no "oversold, log and move on" case for a manual correction). */
  async manualAdjust(variantId: string, delta: number, note?: string): Promise<AdjustmentView> {
    if (delta === 0) {
      throw new BadRequestException('Adjustment must be non-zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
      if (!variant) {
        throw new NotFoundException('Variant not found');
      }
      const nextStock = variant.stock + delta;
      if (nextStock < 0) {
        throw new BadRequestException(`Cannot remove ${Math.abs(delta)} — only ${variant.stock} in stock`);
      }

      await tx.productVariant.update({ where: { id: variantId }, data: { stock: nextStock } });

      const siblingStocks = await tx.productVariant.findMany({
        where: { productId: variant.productId, id: { not: variantId } },
        select: { stock: true },
      });
      const inStock = nextStock > 0 || siblingStocks.some((v) => v.stock > 0);
      await tx.product.update({ where: { id: variant.productId }, data: { inStock } });

      const adjustment = await tx.inventoryAdjustment.create({
        data: {
          variantId,
          change: delta,
          reason: delta > 0 ? InventoryAdjustmentReason.RESTOCK : InventoryAdjustmentReason.MANUAL,
          note,
        },
      });

      return this.toAdjustmentView(adjustment);
    });
  }

  async countLowStock(): Promise<number> {
    return this.prisma.productVariant.count({ where: { stock: { lte: this.lowStockThreshold } } });
  }

  async list(page: number, pageSize: number, search?: string): Promise<PaginatedInventory> {
    const where: Prisma.ProductVariantWhereInput = search
      ? {
          OR: [
            { sku: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { product: { name: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [variants, total, lowStockCount] = await this.prisma.$transaction([
      this.prisma.productVariant.findMany({
        where,
        include: { product: { select: { id: true, name: true } } },
        orderBy: { stock: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.count({ where: { stock: { lte: this.lowStockThreshold } } }),
    ]);

    return {
      items: variants.map((v) => ({
        variantId: v.id,
        sku: v.sku,
        variantName: v.name,
        productId: v.product.id,
        productName: v.product.name,
        stock: v.stock,
        lowStock: v.stock <= this.lowStockThreshold,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      lowStockCount,
    };
  }

  async listAdjustments(variantId: string, page: number, pageSize: number): Promise<{ items: AdjustmentView[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inventoryAdjustment.findMany({
        where: { variantId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventoryAdjustment.count({ where: { variantId } }),
    ]);
    return { items: rows.map((r) => this.toAdjustmentView(r)), total };
  }

  private toAdjustmentView(row: {
    id: string;
    variantId: string;
    change: number;
    reason: InventoryAdjustmentReason;
    orderId: string | null;
    note: string | null;
    createdAt: Date;
  }): AdjustmentView {
    return {
      id: row.id,
      variantId: row.variantId,
      change: row.change,
      reason: row.reason,
      orderId: row.orderId,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
