import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, PaymentStatus, ProductStatus } from '@prisma/client';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../database/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { RazorpayService } from '../payments/razorpay.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const prismaMock = {
    address: { findUnique: jest.fn() },
    cartItem: { findMany: jest.fn(), deleteMany: jest.fn() },
    order: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    payment: { update: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const razorpayMock = { createOrder: jest.fn(), verifyPaymentSignature: jest.fn(), keyId: 'rzp_test_key' };
  const paymentsServiceMock = { confirmPayment: jest.fn() };
  const inventoryMock = { adjustStock: jest.fn() };
  const emailMock = { send: jest.fn() };
  const couponsMock = { validateForUser: jest.fn(), redeem: jest.fn() };
  const configMock = {
    get: jest.fn((key: string) => (key === 'payments.freeShippingThreshold' ? 999 : key === 'payments.flatShippingFee' ? 79 : undefined)),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RazorpayService, useValue: razorpayMock },
        { provide: PaymentsService, useValue: paymentsServiceMock },
        { provide: InventoryService, useValue: inventoryMock },
        { provide: EmailService, useValue: emailMock },
        { provide: ConfigService, useValue: configMock },
        { provide: CouponsService, useValue: couponsMock },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock));
  });

  const address = { id: 'addr-1', userId: 'user-1', fullName: 'A B', phone: '9999999999', line1: 'L1', line2: null, city: 'C', state: 'S', postalCode: '000', country: 'India' };

  function cartLine(overrides: Partial<{ price: number; stock: number; status: ProductStatus; quantity: number }> = {}) {
    return {
      variantId: 'variant-1',
      quantity: overrides.quantity ?? 1,
      variant: {
        id: 'variant-1',
        sku: 'SKU-1',
        name: 'Default',
        attributes: null,
        price: overrides.price ?? 500,
        stock: overrides.stock ?? 10,
        product: { id: 'product-1', name: 'Test Product', status: overrides.status ?? ProductStatus.ACTIVE },
      },
    };
  }

  describe('create', () => {
    it('404s when the address does not belong to the requesting user', async () => {
      prismaMock.address.findUnique.mockResolvedValue({ ...address, userId: 'someone-else' });

      await expect(
        service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty cart', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([]);

      await expect(
        service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('re-validates live stock server-side and rejects checkout if a cart line now exceeds it', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ stock: 1, quantity: 5 })]);

      await expect(
        service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('re-validates the product is still ACTIVE, never trusting cart state alone', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ status: ProductStatus.ARCHIVED })]);

      await expect(
        service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('COD: confirms immediately, deducts stock in the same transaction, clears the cart, never touches Razorpay', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      const line = cartLine({ price: 400, quantity: 2 });
      prismaMock.cartItem.findMany.mockResolvedValue([line]);
      prismaMock.order.create.mockResolvedValue({
        id: 'order-1',
        total: 879,
        items: [{ variantId: 'variant-1', quantity: 2 }],
        createdAt: new Date(),
      });

      const result = await service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD });

      expect(razorpayMock.createOrder).not.toHaveBeenCalled();
      expect(inventoryMock.adjustStock).toHaveBeenCalledWith(
        prismaMock,
        [{ variantId: 'variant-1', quantity: 2 }],
        'order-1',
        'ORDER_PLACED',
      );
      expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(result.razorpay).toBeNull();

      const createArgs = prismaMock.order.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe(OrderStatus.CONFIRMED);
      expect(createArgs.data.subtotal).toBe(800);
      expect(createArgs.data.shippingFee).toBe(79); // below the 999 free-shipping threshold
      expect(createArgs.data.total).toBe(879);
    });

    it('applies free shipping once the subtotal meets the threshold', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ price: 1200, quantity: 1 })]);
      prismaMock.order.create.mockResolvedValue({ id: 'order-1', total: 1200, items: [], createdAt: new Date() });

      await service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD });

      const createArgs = prismaMock.order.create.mock.calls[0][0];
      expect(createArgs.data.shippingFee).toBe(0);
      expect(createArgs.data.total).toBe(1200);
    });

    it('RAZORPAY: creates the order PENDING, does NOT deduct stock or clear the cart, and creates a matching Razorpay order', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ price: 500, quantity: 1 })]);
      prismaMock.order.create.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-20260822-ABC123',
        total: 579,
        items: [],
        createdAt: new Date(),
      });
      razorpayMock.createOrder.mockResolvedValue({ id: 'order_rzp_1', amount: 57900, currency: 'INR' });

      const result = await service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.RAZORPAY });

      expect(inventoryMock.adjustStock).not.toHaveBeenCalled();
      expect(prismaMock.cartItem.deleteMany).not.toHaveBeenCalled();
      expect(razorpayMock.createOrder).toHaveBeenCalledWith(57900, expect.stringMatching(/^ORD-\d{8}-[0-9A-F]{6}$/));
      expect(result.razorpay).toEqual({
        keyId: 'rzp_test_key',
        razorpayOrderId: 'order_rzp_1',
        amount: 57900,
        currency: 'INR',
      });

      const createArgs = prismaMock.order.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe(OrderStatus.PENDING);
    });
  });

  describe('cancelMine', () => {
    it('404s for another user\'s order', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'order-1', userId: 'someone-else', status: OrderStatus.PENDING, items: [] });

      await expect(service.cancelMine('user-1', 'order-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects cancelling an order that has already shipped', async () => {
      prismaMock.order.findUnique.mockResolvedValue({ id: 'order-1', userId: 'user-1', status: OrderStatus.SHIPPED, items: [] });

      await expect(service.cancelMine('user-1', 'order-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('restocks items when cancelling a CONFIRMED order (stock was already deducted)', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.CONFIRMED,
        items: [{ variantId: 'variant-1', quantity: 2 }],
        payment: { id: 'payment-1', status: PaymentStatus.PAID },
      });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        id: 'order-1',
        items: [],
        payment: {},
        createdAt: new Date(),
      });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@test.com' });

      await service.cancelMine('user-1', 'order-1');

      expect(inventoryMock.adjustStock).toHaveBeenCalledWith(
        prismaMock,
        [{ variantId: 'variant-1', quantity: -2 }],
        'order-1',
        'ORDER_CANCELLED',
      );
    });

    it('does NOT restock a still-PENDING order (stock was never deducted for it)', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        items: [{ variantId: 'variant-1', quantity: 2 }],
        payment: { id: 'payment-1', status: PaymentStatus.PENDING },
      });
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-1', items: [], payment: {}, createdAt: new Date() });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@test.com' });

      await service.cancelMine('user-1', 'order-1');

      expect(inventoryMock.adjustStock).not.toHaveBeenCalled();
    });
  });

  describe('verifyPaymentSignature', () => {
    it('rejects when the razorpayOrderId does not match the order\'s own payment record (cross-order replay attempt)', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        payment: { razorpayOrderId: 'order_real' },
      });

      await expect(
        service.verifyPaymentSignature('user-1', 'order-1', 'order_forged', 'pay_1', 'sig_1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(razorpayMock.verifyPaymentSignature).not.toHaveBeenCalled();
    });

    it('rejects an invalid signature and never calls confirmPayment', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        payment: { razorpayOrderId: 'order_real' },
      });
      razorpayMock.verifyPaymentSignature.mockReturnValue(false);

      await expect(
        service.verifyPaymentSignature('user-1', 'order-1', 'order_real', 'pay_1', 'bad_sig'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(paymentsServiceMock.confirmPayment).not.toHaveBeenCalled();
    });

    it('confirms payment only once the signature is cryptographically valid', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        payment: { razorpayOrderId: 'order_real' },
      });
      razorpayMock.verifyPaymentSignature.mockReturnValue(true);
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-1', items: [], payment: {}, createdAt: new Date() });

      await service.verifyPaymentSignature('user-1', 'order-1', 'order_real', 'pay_1', 'good_sig');

      expect(paymentsServiceMock.confirmPayment).toHaveBeenCalledWith('order_real', 'pay_1', 'good_sig');
    });
  });

  describe('adminUpdateStatus', () => {
    function orderWith(status: OrderStatus) {
      return {
        id: 'order-1',
        userId: 'user-1',
        status,
        orderNumber: 'ORD-1',
        items: [{ variantId: 'variant-1', quantity: 2 }],
        payment: {},
      };
    }

    it('throws NotFoundException for a missing order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(null);
      await expect(service.adminUpdateStatus('missing', OrderStatus.PACKED)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it.each([
      [OrderStatus.PENDING, OrderStatus.PACKED],
      [OrderStatus.CONFIRMED, OrderStatus.SHIPPED], // skipping PACKED
      [OrderStatus.CANCELLED, OrderStatus.PACKED], // terminal state
      [OrderStatus.DELIVERED, OrderStatus.PACKED], // backwards
    ])('rejects an illegal transition from %s to %s', async (from, to) => {
      prismaMock.order.findUnique.mockResolvedValue(orderWith(from));
      await expect(service.adminUpdateStatus('order-1', to)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows CONFIRMED -> PACKED -> SHIPPED -> DELIVERED without restocking', async () => {
      prismaMock.order.findUnique.mockResolvedValue(orderWith(OrderStatus.CONFIRMED));
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...orderWith(OrderStatus.PACKED),
        createdAt: new Date(),
        user: { email: 'c@test.local', firstName: 'C', lastName: null },
      });

      await service.adminUpdateStatus('order-1', OrderStatus.PACKED);

      expect(inventoryMock.adjustStock).not.toHaveBeenCalled();
      expect(prismaMock.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.PACKED },
      });
    });

    it('restocks inventory when an admin cancels a CONFIRMED order', async () => {
      prismaMock.order.findUnique.mockResolvedValue(orderWith(OrderStatus.CONFIRMED));
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...orderWith(OrderStatus.CANCELLED),
        createdAt: new Date(),
        user: { email: 'c@test.local', firstName: 'C', lastName: null },
      });

      await service.adminUpdateStatus('order-1', OrderStatus.CANCELLED);

      expect(inventoryMock.adjustStock).toHaveBeenCalledWith(
        prismaMock,
        [{ variantId: 'variant-1', quantity: -2 }],
        'order-1',
        'ORDER_CANCELLED',
      );
    });

    it('restocks inventory when a DELIVERED order is marked RETURNED', async () => {
      prismaMock.order.findUnique.mockResolvedValue(orderWith(OrderStatus.DELIVERED));
      prismaMock.order.findUniqueOrThrow.mockResolvedValue({
        ...orderWith(OrderStatus.RETURNED),
        createdAt: new Date(),
        user: { email: 'c@test.local', firstName: 'C', lastName: null },
      });

      await service.adminUpdateStatus('order-1', OrderStatus.RETURNED);

      expect(inventoryMock.adjustStock).toHaveBeenCalledWith(
        prismaMock,
        [{ variantId: 'variant-1', quantity: -2 }],
        'order-1',
        'RESTOCK',
      );
    });
  });
});
