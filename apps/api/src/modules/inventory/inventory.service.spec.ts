import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { InventoryAdjustmentReason } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const txMock = {
    productVariant: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    inventoryAdjustment: { create: jest.fn() },
    product: { update: jest.fn() },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    productVariant: { count: jest.fn(), findMany: jest.fn() },
    inventoryAdjustment: { findMany: jest.fn(), count: jest.fn() },
  };

  const configMock = { get: jest.fn(() => 5) }; // lowStockThreshold = 5

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = moduleRef.get(InventoryService);
    jest.clearAllMocks();
    configMock.get.mockReturnValue(5);
    prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => unknown)(txMock);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  describe('adjustStock (used inside order/payment transactions)', () => {
    it('decrements stock and logs a negative adjustment for a normal order', async () => {
      txMock.productVariant.findUnique.mockResolvedValue({ id: 'v1', stock: 10, productId: 'p1' });
      txMock.productVariant.findMany.mockResolvedValue([{ stock: 8 }]);

      await service.adjustStock(
        txMock as never,
        [{ variantId: 'v1', quantity: 2 }],
        'order-1',
        InventoryAdjustmentReason.ORDER_PLACED,
      );

      expect(txMock.productVariant.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { stock: 8 } });
      expect(txMock.inventoryAdjustment.create).toHaveBeenCalledWith({
        data: { variantId: 'v1', change: -2, reason: InventoryAdjustmentReason.ORDER_PLACED, orderId: 'order-1' },
      });
    });

    it('increments stock back for a cancellation (negative quantity input)', async () => {
      txMock.productVariant.findUnique.mockResolvedValue({ id: 'v1', stock: 3, productId: 'p1' });
      txMock.productVariant.findMany.mockResolvedValue([{ stock: 5 }]);

      await service.adjustStock(
        txMock as never,
        [{ variantId: 'v1', quantity: -2 }],
        'order-1',
        InventoryAdjustmentReason.ORDER_CANCELLED,
      );

      expect(txMock.productVariant.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { stock: 5 } });
      expect(txMock.inventoryAdjustment.create).toHaveBeenCalledWith({
        data: { variantId: 'v1', change: 2, reason: InventoryAdjustmentReason.ORDER_CANCELLED, orderId: 'order-1' },
      });
    });

    it('clamps at 0 instead of going negative on an oversell, but still logs the true adjustment', async () => {
      txMock.productVariant.findUnique.mockResolvedValue({ id: 'v1', stock: 1, productId: 'p1' });
      txMock.productVariant.findMany.mockResolvedValue([{ stock: 0 }]);

      await service.adjustStock(
        txMock as never,
        [{ variantId: 'v1', quantity: 3 }],
        'order-1',
        InventoryAdjustmentReason.ORDER_PLACED,
      );

      expect(txMock.productVariant.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { stock: 0 } });
    });

    it('recomputes Product.inStock to false once every variant is at 0', async () => {
      txMock.productVariant.findUnique.mockResolvedValue({ id: 'v1', stock: 1, productId: 'p1' });
      txMock.productVariant.findMany.mockResolvedValue([{ stock: 0 }, { stock: 0 }]);

      await service.adjustStock(txMock as never, [{ variantId: 'v1', quantity: 1 }], 'order-1', 'ORDER_PLACED' as never);

      expect(txMock.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { inStock: false } });
    });

    it('recomputes Product.inStock to true if any sibling variant still has stock', async () => {
      txMock.productVariant.findUnique.mockResolvedValue({ id: 'v1', stock: 1, productId: 'p1' });
      txMock.productVariant.findMany.mockResolvedValue([{ stock: 0 }, { stock: 4 }]);

      await service.adjustStock(txMock as never, [{ variantId: 'v1', quantity: 1 }], 'order-1', 'ORDER_PLACED' as never);

      expect(txMock.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { inStock: true } });
    });
  });

  describe('manualAdjust (standalone admin correction/restock)', () => {
    it('throws BadRequestException for a zero delta', async () => {
      await expect(service.manualAdjust('v1', 0)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException for a missing variant', async () => {
      txMock.productVariant.findUnique.mockResolvedValue(null);
      await expect(service.manualAdjust('missing', 5)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a decrease that would take stock negative', async () => {
      txMock.productVariant.findUnique.mockResolvedValue({ id: 'v1', stock: 3, productId: 'p1' });
      await expect(service.manualAdjust('v1', -10)).rejects.toBeInstanceOf(BadRequestException);
      expect(txMock.productVariant.update).not.toHaveBeenCalled();
    });

    it('records a positive delta as RESTOCK', async () => {
      txMock.productVariant.findUnique.mockResolvedValue({ id: 'v1', stock: 3, productId: 'p1' });
      txMock.productVariant.findMany.mockResolvedValue([]);
      txMock.inventoryAdjustment.create.mockResolvedValue({
        id: 'adj-1',
        variantId: 'v1',
        change: 10,
        reason: InventoryAdjustmentReason.RESTOCK,
        orderId: null,
        note: 'Fresh stock',
        createdAt: new Date(),
      });

      const result = await service.manualAdjust('v1', 10, 'Fresh stock');

      expect(txMock.productVariant.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { stock: 13 } });
      expect(txMock.inventoryAdjustment.create).toHaveBeenCalledWith({
        data: { variantId: 'v1', change: 10, reason: InventoryAdjustmentReason.RESTOCK, note: 'Fresh stock' },
      });
      expect(result.reason).toBe(InventoryAdjustmentReason.RESTOCK);
    });

    it('records a negative delta as MANUAL and allows a valid reduction', async () => {
      txMock.productVariant.findUnique.mockResolvedValue({ id: 'v1', stock: 10, productId: 'p1' });
      txMock.productVariant.findMany.mockResolvedValue([]);
      txMock.inventoryAdjustment.create.mockResolvedValue({
        id: 'adj-2',
        variantId: 'v1',
        change: -4,
        reason: InventoryAdjustmentReason.MANUAL,
        orderId: null,
        note: 'Damaged units',
        createdAt: new Date(),
      });

      await service.manualAdjust('v1', -4, 'Damaged units');

      expect(txMock.productVariant.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { stock: 6 } });
      expect(txMock.inventoryAdjustment.create).toHaveBeenCalledWith({
        data: { variantId: 'v1', change: -4, reason: InventoryAdjustmentReason.MANUAL, note: 'Damaged units' },
      });
    });
  });

  describe('list', () => {
    it('flags a variant as lowStock once it is at or below the configured threshold', async () => {
      prismaMock.productVariant.findMany.mockResolvedValue([
        { id: 'v1', sku: 'A', name: 'A', stock: 5, product: { id: 'p1', name: 'Product A' } },
        { id: 'v2', sku: 'B', name: 'B', stock: 20, product: { id: 'p1', name: 'Product A' } },
      ]);
      prismaMock.productVariant.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

      const result = await service.list(1, 20);

      expect(result.items[0].lowStock).toBe(true); // stock 5 <= threshold 5
      expect(result.items[1].lowStock).toBe(false);
      expect(result.lowStockCount).toBe(1);
    });
  });

  describe('countLowStock', () => {
    it('counts variants at or below the threshold', async () => {
      prismaMock.productVariant.count.mockResolvedValue(3);
      const count = await service.countLowStock();
      expect(count).toBe(3);
      expect(prismaMock.productVariant.count).toHaveBeenCalledWith({ where: { stock: { lte: 5 } } });
    });
  });
});
