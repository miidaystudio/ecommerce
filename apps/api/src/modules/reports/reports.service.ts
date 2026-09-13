import { BadRequestException, Injectable } from '@nestjs/common';
import { committedOrderWhere, sumDecimal } from '../../common/utils/order-revenue';
import { PrismaService } from '../../database/prisma.service';
import { ReportRangeQueryDto, ReportGroupBy } from './dto/report-range-query.dto';

export interface SalesReportBucket {
  period: string;
  orderCount: number;
  grossRevenue: number;
  discount: number;
  shipping: number;
  netRevenue: number;
}

export interface SalesReport {
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  totals: {
    orderCount: number;
    grossRevenue: number;
    discount: number;
    shipping: number;
    netRevenue: number;
    avgOrderValue: number;
    unitsSold: number;
  };
  buckets: SalesReportBucket[];
}

export interface BestSellerRow {
  productName: string;
  unitsSold: number;
  revenue: number;
  orderCount: number;
}

export interface BestSellersReport {
  from: string;
  to: string;
  items: BestSellerRow[];
}

export interface CustomerReportRow {
  userId: string;
  email: string;
  name: string | null;
  orderCount: number;
  totalSpend: number;
  avgOrderValue: number;
  firstOrderAt: string;
  lastOrderAt: string;
}

export interface CustomerReport {
  from: string;
  to: string;
  totals: {
    customersWithOrders: number;
    newCustomers: number;
    returningCustomers: number;
    repeatRate: number;
  };
  items: CustomerReportRow[];
}

const MAX_RANGE_DAYS = 366;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the requested window to a concrete [from, to) pair.
   *
   * `to` is pushed to the end of its day so a range like 1st–31st includes
   * orders placed on the 31st; an exclusive midnight bound would silently drop
   * a whole day of revenue.
   */
  private resolveRange(query: ReportRangeQueryDto): { from: Date; to: Date } {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Provide valid from/to dates');
    }
    if (from > to) {
      throw new BadRequestException('The "from" date must not be after the "to" date');
    }

    const exclusiveTo = new Date(to);
    exclusiveTo.setHours(23, 59, 59, 999);

    const spanDays = (exclusiveTo.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (spanDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Reports cover at most ${MAX_RANGE_DAYS} days at a time`);
    }

    return { from, to: exclusiveTo };
  }

  /**
   * Bucket key for a date: the day, the ISO week's Monday, or the month.
   *
   * All arithmetic is in UTC, deliberately. Mixing local-time getters with
   * `toISOString()` labels a bucket with the wrong date wherever the server
   * isn't on UTC — east of Greenwich, local Monday midnight is still Sunday in
   * UTC, so a week would be reported as starting a day early.
   */
  private periodKey(date: Date, groupBy: ReportGroupBy): string {
    if (groupBy === 'month') {
      return date.toISOString().slice(0, 7);
    }
    if (groupBy === 'week') {
      const monday = new Date(date);
      monday.setUTCHours(0, 0, 0, 0);
      // getUTCDay(): 0 = Sunday, so Sunday steps back six days, not none.
      const offset = (monday.getUTCDay() + 6) % 7;
      monday.setUTCDate(monday.getUTCDate() - offset);
      return monday.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  }

  async salesReport(query: ReportRangeQueryDto): Promise<SalesReport> {
    const { from, to } = this.resolveRange(query);
    const groupBy = query.groupBy ?? 'day';

    const orders = await this.prisma.order.findMany({
      where: { ...committedOrderWhere, createdAt: { gte: from, lte: to } },
      select: {
        subtotal: true,
        discount: true,
        shippingFee: true,
        total: true,
        createdAt: true,
        items: { select: { quantity: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, SalesReportBucket>();
    for (const order of orders) {
      const period = this.periodKey(order.createdAt, groupBy);
      const bucket =
        buckets.get(period) ??
        { period, orderCount: 0, grossRevenue: 0, discount: 0, shipping: 0, netRevenue: 0 };

      bucket.orderCount += 1;
      bucket.grossRevenue += Number(order.subtotal);
      bucket.discount += Number(order.discount);
      bucket.shipping += Number(order.shippingFee);
      bucket.netRevenue += Number(order.total);
      buckets.set(period, bucket);
    }

    const rounded = Array.from(buckets.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((bucket) => ({
        ...bucket,
        grossRevenue: round2(bucket.grossRevenue),
        discount: round2(bucket.discount),
        shipping: round2(bucket.shipping),
        netRevenue: round2(bucket.netRevenue),
      }));

    const grossRevenue = sumDecimal(orders.map((o) => o.subtotal));
    const discount = sumDecimal(orders.map((o) => o.discount));
    const shipping = sumDecimal(orders.map((o) => o.shippingFee));
    const netRevenue = sumDecimal(orders.map((o) => o.total));
    const unitsSold = orders.reduce(
      (sum, order) => sum + order.items.reduce((n, item) => n + item.quantity, 0),
      0,
    );

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      groupBy,
      totals: {
        orderCount: orders.length,
        grossRevenue: round2(grossRevenue),
        discount: round2(discount),
        shipping: round2(shipping),
        netRevenue: round2(netRevenue),
        avgOrderValue: orders.length > 0 ? round2(netRevenue / orders.length) : 0,
        unitsSold,
      },
      buckets: rounded,
    };
  }

  async bestSellers(query: ReportRangeQueryDto): Promise<BestSellersReport> {
    const { from, to } = this.resolveRange(query);
    const limit = query.limit ?? 20;

    // Grouped by the OrderItem.productName *snapshot*, not a live product
    // relation — so a renamed or deleted product still reports correctly for
    // the period it actually sold in.
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productName'],
      where: { order: { ...committedOrderWhere, createdAt: { gte: from, lte: to } } },
      _sum: { quantity: true, lineTotal: true },
      _count: { _all: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: limit,
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      items: rows.map((row) => ({
        productName: row.productName,
        unitsSold: row._sum.quantity ?? 0,
        revenue: round2(Number(row._sum.lineTotal ?? 0)),
        orderCount: row._count._all,
      })),
    };
  }

  async customerReport(query: ReportRangeQueryDto): Promise<CustomerReport> {
    const { from, to } = this.resolveRange(query);
    const limit = query.limit ?? 20;

    const grouped = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { ...committedOrderWhere, createdAt: { gte: from, lte: to } },
      _sum: { total: true },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
      orderBy: { _sum: { total: 'desc' } },
    });

    const top = grouped.slice(0, limit);
    const users = await this.prisma.user.findMany({
      where: { id: { in: top.map((row) => row.userId) } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    // "Returning" means more than one committed order *in this window* — a
    // customer whose second order falls outside it is not counted here, which
    // is what makes the repeat rate a property of the period rather than of
    // all time.
    const returningCustomers = grouped.filter((row) => row._count._all > 1).length;
    const customersWithOrders = grouped.length;

    const newCustomers = await this.prisma.user.count({
      where: { role: 'CUSTOMER', createdAt: { gte: from, lte: to } },
    });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totals: {
        customersWithOrders,
        newCustomers,
        returningCustomers,
        repeatRate: customersWithOrders > 0 ? round2((returningCustomers / customersWithOrders) * 100) : 0,
      },
      items: top.map((row) => {
        const user = userById.get(row.userId);
        const orderCount = row._count._all;
        const totalSpend = Number(row._sum.total ?? 0);
        const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');

        return {
          userId: row.userId,
          email: user?.email ?? 'unknown',
          name: name.length > 0 ? name : null,
          orderCount,
          totalSpend: round2(totalSpend),
          avgOrderValue: orderCount > 0 ? round2(totalSpend / orderCount) : 0,
          firstOrderAt: (row._min.createdAt ?? from).toISOString(),
          lastOrderAt: (row._max.createdAt ?? to).toISOString(),
        };
      }),
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
