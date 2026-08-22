import { Injectable, Logger } from '@nestjs/common';
import { InventoryAdjustmentReason, Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

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
    orderId: string,
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
          `Oversold variant ${item.variantId} on order ${orderId}: stock ${variant.stock}, needed ${item.quantity}`,
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
}
