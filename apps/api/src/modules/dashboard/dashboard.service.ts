import { Injectable } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { committedOrderWhere } from '../../common/utils/order-revenue';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

export interface DashboardSummary {
  rangeDays: number;
  revenue: number;
  previousRevenue: number;
  orderCount: number;
  newCustomerCount: number;
  avgOrderValue: number;
  lowStockCount: number;
  revenueByDay: { date: string; revenue: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerEmail: string;
    status: OrderStatus;
    total: number;
    createdAt: string;
  }[];
  topProducts: { productName: string; quantitySold: number; revenue: number }[];
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async getSummary(rangeDays: number): Promise<DashboardSummary> {
    const now = new Date();
    const rangeStart = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const previousRangeStart = new Date(rangeStart.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    // Shared with the reports module so both report the same revenue figure.
    const committedWhere = committedOrderWhere;

    const [currentOrders, previousOrders, newCustomerCount, lowStockCount, recentOrdersRaw, topProductsRaw] =
      await Promise.all([
        this.prisma.order.findMany({
          where: { ...committedWhere, createdAt: { gte: rangeStart } },
          select: { total: true, createdAt: true },
        }),
        this.prisma.order.findMany({
          where: { ...committedWhere, createdAt: { gte: previousRangeStart, lt: rangeStart } },
          select: { total: true },
        }),
        this.prisma.user.count({
          where: { role: 'CUSTOMER', createdAt: { gte: rangeStart } },
        }),
        this.inventory.countLowStock(),
        this.prisma.order.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { user: { select: { email: true } } },
        }),
        this.prisma.orderItem.groupBy({
          by: ['productName'],
          where: { order: { ...committedWhere, createdAt: { gte: rangeStart } } },
          _sum: { quantity: true, lineTotal: true },
          orderBy: { _sum: { lineTotal: 'desc' } },
          take: 5,
        }),
      ]);

    const revenue = currentOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const previousRevenue = previousOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const orderCount = currentOrders.length;

    const revenueByDay = this.bucketByDay(currentOrders, rangeStart, now);

    return {
      rangeDays,
      revenue,
      previousRevenue,
      orderCount,
      newCustomerCount,
      avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
      lowStockCount,
      revenueByDay,
      recentOrders: recentOrdersRaw.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerEmail: o.user.email,
        status: o.status,
        total: Number(o.total),
        createdAt: o.createdAt.toISOString(),
      })),
      topProducts: topProductsRaw.map((row) => ({
        productName: row.productName,
        quantitySold: row._sum.quantity ?? 0,
        revenue: Number(row._sum.lineTotal ?? 0),
      })),
    };
  }

  private bucketByDay(
    orders: { total: Prisma.Decimal; createdAt: Date }[],
    rangeStart: Date,
    rangeEnd: Date,
  ): { date: string; revenue: number }[] {
    const buckets = new Map<string, number>();
    // UTC throughout: orders are keyed by their UTC date below, so walking the
    // range in local time would pre-create keys shifted by a day wherever the
    // server isn't on UTC, and the chart would show a spurious extra day.
    const cursor = new Date(rangeStart);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setUTCHours(0, 0, 0, 0);

    while (cursor <= end) {
      buckets.set(cursor.toISOString().slice(0, 10), 0);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(order.total));
    }

    return Array.from(buckets.entries()).map(([date, revenue]) => ({ date, revenue }));
  }
}
