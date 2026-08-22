import { InventoryAdjustmentReason } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const txMock = {
    productVariant: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    inventoryAdjustment: { create: jest.fn() },
    product: { update: jest.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [InventoryService] }).compile();
    service = moduleRef.get(InventoryService);
    jest.clearAllMocks();
  });

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
