import { OrderStatus, Prisma } from '@prisma/client';

/**
 * What counts as revenue, in one place.
 *
 * An order is "committed" once it is paid or owed (COD) and not unwound:
 * PENDING is placed-but-unpaid, and CANCELLED/RETURNED money is not earned.
 * The dashboard and the reports both read this — if they each kept their own
 * list, the admin would eventually see two different revenue figures for the
 * same period and have no way to tell which was right.
 */
export const COMMITTED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

export const committedOrderWhere: Prisma.OrderWhereInput = {
  status: { in: COMMITTED_ORDER_STATUSES },
};

/** Money is stored as Prisma Decimal; totals are summed as numbers. */
export function sumDecimal(values: (Prisma.Decimal | number | null | undefined)[]): number {
  return values.reduce<number>((sum, value) => sum + Number(value ?? 0), 0);
}
