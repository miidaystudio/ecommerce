import { Test } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const prismaMock = {
    order: { findMany: jest.fn(), groupBy: jest.fn() },
    orderItem: { groupBy: jest.fn() },
    user: { count: jest.fn() },
  };
  const inventoryMock = { countLowStock: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InventoryService, useValue: inventoryMock },
      ],
    }).compile();
    service = moduleRef.get(DashboardService);
    jest.clearAllMocks();

    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.orderItem.groupBy.mockResolvedValue([]);
    prismaMock.user.count.mockResolvedValue(0);
    inventoryMock.countLowStock.mockResolvedValue(0);
  });

  it('only counts committed orders (CONFIRMED and later) toward revenue, never PENDING/CANCELLED', async () => {
    await service.getSummary(30);

    const where = prismaMock.order.findMany.mock.calls[0][0].where;
    expect(where.status.in).toEqual([
      OrderStatus.CONFIRMED,
      OrderStatus.PACKED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ]);
    expect(where.status.in).not.toContain(OrderStatus.PENDING);
    expect(where.status.in).not.toContain(OrderStatus.CANCELLED);
  });

  it('sums order totals for revenue and computes avgOrderValue safely (no divide-by-zero)', async () => {
    prismaMock.order.findMany
      .mockResolvedValueOnce([
        { total: 500, createdAt: new Date() },
        { total: 300, createdAt: new Date() },
      ])
      .mockResolvedValueOnce([]); // previous period, empty
    const emptySummary = await service.getSummary(30);
    expect(emptySummary.revenue).toBe(800);
    expect(emptySummary.orderCount).toBe(2);
    expect(emptySummary.avgOrderValue).toBe(400);

    prismaMock.order.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const zero = await service.getSummary(30);
    expect(zero.avgOrderValue).toBe(0);
  });

  it('passes the low-stock count straight through from InventoryService', async () => {
    inventoryMock.countLowStock.mockResolvedValue(7);
    const result = await service.getSummary(30);
    expect(result.lowStockCount).toBe(7);
  });

  it('buckets revenue by day across the full requested range, including days with no orders', async () => {
    const today = new Date();
    prismaMock.order.findMany
      .mockResolvedValueOnce([{ total: 100, createdAt: today }])
      .mockResolvedValueOnce([]);

    const result = await service.getSummary(7);

    expect(result.revenueByDay.length).toBeGreaterThanOrEqual(7);
    const todayKey = today.toISOString().slice(0, 10);
    const todayBucket = result.revenueByDay.find((b) => b.date === todayKey);
    expect(todayBucket?.revenue).toBe(100);
  });
});
