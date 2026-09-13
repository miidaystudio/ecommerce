import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const prismaMock = {
    order: { findMany: jest.fn(), groupBy: jest.fn() },
    orderItem: { groupBy: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(ReportsService);
    jest.clearAllMocks();
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.groupBy.mockResolvedValue([]);
    prismaMock.orderItem.groupBy.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);
  });

  function order(overrides: {
    createdAt: string;
    subtotal?: number;
    discount?: number;
    shippingFee?: number;
    total?: number;
    quantities?: number[];
  }) {
    const subtotal = overrides.subtotal ?? 1000;
    const discount = overrides.discount ?? 0;
    const shippingFee = overrides.shippingFee ?? 0;
    return {
      subtotal,
      discount,
      shippingFee,
      total: overrides.total ?? subtotal - discount + shippingFee,
      createdAt: new Date(overrides.createdAt),
      items: (overrides.quantities ?? [1]).map((quantity) => ({ quantity })),
    };
  }

  describe('range handling', () => {
    it('rejects a range where "from" is after "to"', async () => {
      await expect(
        service.salesReport({ from: '2026-03-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a range longer than a year, so one request cannot scan the whole table', async () => {
      await expect(
        service.salesReport({ from: '2020-01-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('includes the whole of the "to" day rather than stopping at its midnight', async () => {
      await service.salesReport({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-31T00:00:00.000Z' });

      const where = prismaMock.order.findMany.mock.calls[0][0].where;
      const upperBound = where.createdAt.lte as Date;
      // An order placed late on the 31st must still be counted.
      expect(upperBound.getHours()).toBe(23);
      expect(upperBound.getMinutes()).toBe(59);
    });

    it('defaults to the last 30 days when no range is given', async () => {
      await service.salesReport({});

      const where = prismaMock.order.findMany.mock.calls[0][0].where;
      const spanDays =
        ((where.createdAt.lte as Date).getTime() - (where.createdAt.gte as Date).getTime()) /
        (24 * 60 * 60 * 1000);
      expect(spanDays).toBeGreaterThan(29);
      expect(spanDays).toBeLessThan(32);
    });

    it('only ever counts committed orders — never PENDING, CANCELLED or RETURNED', async () => {
      await service.salesReport({});

      const statuses = prismaMock.order.findMany.mock.calls[0][0].where.status.in as OrderStatus[];
      expect(statuses).toEqual([
        OrderStatus.CONFIRMED,
        OrderStatus.PACKED,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
      ]);
      expect(statuses).not.toContain(OrderStatus.PENDING);
      expect(statuses).not.toContain(OrderStatus.CANCELLED);
      expect(statuses).not.toContain(OrderStatus.RETURNED);
    });
  });

  describe('salesReport', () => {
    it('totals gross, discount, shipping and net separately so a discounted period reconciles', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        order({ createdAt: '2026-03-02T10:00:00.000Z', subtotal: 1000, discount: 100, shippingFee: 79 }),
        order({ createdAt: '2026-03-02T12:00:00.000Z', subtotal: 500, discount: 0, shippingFee: 79 }),
      ]);

      const report = await service.salesReport({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-31T00:00:00.000Z',
      });

      expect(report.totals.orderCount).toBe(2);
      expect(report.totals.grossRevenue).toBe(1500);
      expect(report.totals.discount).toBe(100);
      expect(report.totals.shipping).toBe(158);
      // gross - discount + shipping
      expect(report.totals.netRevenue).toBe(1558);
      expect(report.totals.avgOrderValue).toBe(779);
    });

    it('reports zero rather than dividing by zero when a period has no orders', async () => {
      const report = await service.salesReport({});
      expect(report.totals.orderCount).toBe(0);
      expect(report.totals.avgOrderValue).toBe(0);
      expect(report.buckets).toEqual([]);
    });

    it('sums units sold across order lines', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        order({ createdAt: '2026-03-02T10:00:00.000Z', quantities: [2, 3] }),
        order({ createdAt: '2026-03-03T10:00:00.000Z', quantities: [1] }),
      ]);

      const report = await service.salesReport({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-31T00:00:00.000Z',
      });
      expect(report.totals.unitsSold).toBe(6);
    });

    it('groups by day', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        order({ createdAt: '2026-03-02T10:00:00.000Z', subtotal: 100 }),
        order({ createdAt: '2026-03-02T18:00:00.000Z', subtotal: 200 }),
        order({ createdAt: '2026-03-05T10:00:00.000Z', subtotal: 300 }),
      ]);

      const report = await service.salesReport({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-31T00:00:00.000Z',
        groupBy: 'day',
      });

      expect(report.buckets).toHaveLength(2);
      expect(report.buckets[0]).toMatchObject({ period: '2026-03-02', orderCount: 2, netRevenue: 300 });
      expect(report.buckets[1]).toMatchObject({ period: '2026-03-05', orderCount: 1, netRevenue: 300 });
    });

    it('groups by month', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        order({ createdAt: '2026-01-15T10:00:00.000Z', subtotal: 100 }),
        order({ createdAt: '2026-01-28T10:00:00.000Z', subtotal: 200 }),
        order({ createdAt: '2026-02-03T10:00:00.000Z', subtotal: 300 }),
      ]);

      const report = await service.salesReport({
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-02-28T00:00:00.000Z',
        groupBy: 'month',
      });

      expect(report.buckets.map((b) => b.period)).toEqual(['2026-01', '2026-02']);
      expect(report.buckets[0].orderCount).toBe(2);
    });

    it('groups a week onto its Monday, including a Sunday order', async () => {
      // 2026-03-08 is a Sunday; its ISO week begins Monday 2026-03-02.
      prismaMock.order.findMany.mockResolvedValue([
        order({ createdAt: '2026-03-04T10:00:00.000Z', subtotal: 100 }),
        order({ createdAt: '2026-03-08T10:00:00.000Z', subtotal: 200 }),
      ]);

      const report = await service.salesReport({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-31T00:00:00.000Z',
        groupBy: 'week',
      });

      expect(report.buckets).toHaveLength(1);
      expect(report.buckets[0]).toMatchObject({ period: '2026-03-02', orderCount: 2 });
    });

    it('returns buckets in chronological order', async () => {
      prismaMock.order.findMany.mockResolvedValue([
        order({ createdAt: '2026-03-20T10:00:00.000Z' }),
        order({ createdAt: '2026-03-02T10:00:00.000Z' }),
        order({ createdAt: '2026-03-11T10:00:00.000Z' }),
      ]);

      const report = await service.salesReport({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-31T00:00:00.000Z',
      });

      const periods = report.buckets.map((b) => b.period);
      expect(periods).toEqual([...periods].sort());
    });
  });

  describe('bestSellers', () => {
    it('groups by the order-item name snapshot, so a renamed product still reports correctly', async () => {
      prismaMock.orderItem.groupBy.mockResolvedValue([
        { productName: 'Linen Runner', _sum: { quantity: 10, lineTotal: 14900 }, _count: { _all: 7 } },
      ]);

      const report = await service.bestSellers({});

      expect(prismaMock.orderItem.groupBy.mock.calls[0][0].by).toEqual(['productName']);
      expect(report.items[0]).toEqual({
        productName: 'Linen Runner',
        unitsSold: 10,
        revenue: 14900,
        orderCount: 7,
      });
    });

    it('defaults to a bounded result set and honours an explicit limit', async () => {
      await service.bestSellers({});
      expect(prismaMock.orderItem.groupBy.mock.calls[0][0].take).toBe(20);

      await service.bestSellers({ limit: 5 });
      expect(prismaMock.orderItem.groupBy.mock.calls[1][0].take).toBe(5);
    });

    it('treats a product with no recorded quantity as zero rather than NaN', async () => {
      prismaMock.orderItem.groupBy.mockResolvedValue([
        { productName: 'Odd row', _sum: { quantity: null, lineTotal: null }, _count: { _all: 0 } },
      ]);

      const report = await service.bestSellers({});
      expect(report.items[0].unitsSold).toBe(0);
      expect(report.items[0].revenue).toBe(0);
    });
  });

  describe('customerReport', () => {
    it('ranks customers by spend and resolves their email and name', async () => {
      prismaMock.order.groupBy.mockResolvedValue([
        {
          userId: 'user-1',
          _sum: { total: 5000 },
          _count: { _all: 2 },
          _min: { createdAt: new Date('2026-03-02T10:00:00.000Z') },
          _max: { createdAt: new Date('2026-03-20T10:00:00.000Z') },
        },
      ]);
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'a@test.com', firstName: 'Ada', lastName: 'Lovelace' },
      ]);

      const report = await service.customerReport({});

      expect(report.items[0]).toMatchObject({
        userId: 'user-1',
        email: 'a@test.com',
        name: 'Ada Lovelace',
        orderCount: 2,
        totalSpend: 5000,
        avgOrderValue: 2500,
      });
    });

    it('computes the repeat rate from customers with more than one order in the window', async () => {
      prismaMock.order.groupBy.mockResolvedValue([
        { userId: 'user-1', _sum: { total: 100 }, _count: { _all: 3 }, _min: {}, _max: {} },
        { userId: 'user-2', _sum: { total: 100 }, _count: { _all: 1 }, _min: {}, _max: {} },
        { userId: 'user-3', _sum: { total: 100 }, _count: { _all: 2 }, _min: {}, _max: {} },
        { userId: 'user-4', _sum: { total: 100 }, _count: { _all: 1 }, _min: {}, _max: {} },
      ]);

      const report = await service.customerReport({});

      expect(report.totals.customersWithOrders).toBe(4);
      expect(report.totals.returningCustomers).toBe(2);
      expect(report.totals.repeatRate).toBe(50);
    });

    it('reports a zero repeat rate instead of dividing by zero when nobody ordered', async () => {
      const report = await service.customerReport({});
      expect(report.totals.customersWithOrders).toBe(0);
      expect(report.totals.repeatRate).toBe(0);
    });

    it('falls back to a null name when the customer never set one', async () => {
      prismaMock.order.groupBy.mockResolvedValue([
        { userId: 'user-1', _sum: { total: 100 }, _count: { _all: 1 }, _min: {}, _max: {} },
      ]);
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'user-1', email: 'a@test.com', firstName: null, lastName: null },
      ]);

      const report = await service.customerReport({});
      expect(report.items[0].name).toBeNull();
    });

    it('counts new customers by registration date, not by order activity', async () => {
      prismaMock.user.count.mockResolvedValue(7);

      const report = await service.customerReport({});

      expect(prismaMock.user.count.mock.calls[0][0].where.role).toBe('CUSTOMER');
      expect(report.totals.newCustomers).toBe(7);
    });
  });
});
