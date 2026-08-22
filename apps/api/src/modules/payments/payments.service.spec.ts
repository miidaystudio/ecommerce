import { Test } from '@nestjs/testing';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../database/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService.confirmPayment — idempotency (security/correctness critical)', () => {
  let service: PaymentsService;

  const prismaMock = {
    payment: { findUnique: jest.fn(), update: jest.fn() },
    order: { update: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const inventoryMock = { adjustStock: jest.fn() };
  const emailMock = { send: jest.fn() };
  const couponsMock = { redeem: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InventoryService, useValue: inventoryMock },
        { provide: EmailService, useValue: emailMock },
        { provide: CouponsService, useValue: couponsMock },
      ],
    }).compile();

    service = moduleRef.get(PaymentsService);
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock));
  });

  const pendingPayment = {
    id: 'payment-1',
    status: PaymentStatus.PENDING,
    order: {
      id: 'order-1',
      userId: 'user-1',
      orderNumber: 'ORD-20260822-ABC123',
      total: 500,
      status: OrderStatus.PENDING,
      items: [{ variantId: 'variant-1', quantity: 2 }],
    },
  };

  it('does nothing for an unknown razorpayOrderId (no matching payment)', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(null);

    await service.confirmPayment('order_unknown', 'pay_1', 'sig_1');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(inventoryMock.adjustStock).not.toHaveBeenCalled();
  });

  it('on first confirmation: marks the payment PAID, deducts stock, confirms the order, and clears the cart', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(pendingPayment);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@test.com', firstName: 'A' });

    await service.confirmPayment('order_A', 'pay_A', 'sig_A');

    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-1' },
        data: expect.objectContaining({ status: PaymentStatus.PAID, razorpayPaymentId: 'pay_A' }),
      }),
    );
    expect(inventoryMock.adjustStock).toHaveBeenCalledWith(
      prismaMock,
      [{ variantId: 'variant-1', quantity: 2 }],
      'order-1',
      'ORDER_PLACED',
    );
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: OrderStatus.CONFIRMED },
    });
    expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(emailMock.send).toHaveBeenCalledTimes(1);
  });

  it('is a no-op on a second call for the same payment (webhook retry / duplicate verify race) — stock is never double-deducted', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({ ...pendingPayment, status: PaymentStatus.PAID });

    await service.confirmPayment('order_A', 'pay_A', 'sig_A');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(inventoryMock.adjustStock).not.toHaveBeenCalled();
    expect(prismaMock.cartItem.deleteMany).not.toHaveBeenCalled();
    expect(emailMock.send).not.toHaveBeenCalled();
  });

  it('markFailed sets FAILED status but never touches an already-PAID payment', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({ id: 'payment-1', status: PaymentStatus.PAID });

    await service.markFailed('order_A', 'card declined');

    expect(prismaMock.payment.update).not.toHaveBeenCalled();
  });

  it('markFailed updates a still-pending payment', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({ id: 'payment-1', status: PaymentStatus.PENDING });

    await service.markFailed('order_A', 'card declined');

    expect(prismaMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PaymentStatus.FAILED, failureReason: 'card declined' },
    });
  });
});
