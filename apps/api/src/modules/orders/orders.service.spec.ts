import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, PaymentStatus, ProductStatus } from '@prisma/client';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../database/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { RazorpayService } from '../payments/razorpay.service';
import { includedTax } from '../../common/utils/tax';
import { SettingsService } from '../settings/settings.service';
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
  // Pricing lives in SettingsService.summarize(). This stand-in mirrors it with
  // the previous env defaults (free shipping from 999, flat 79) and an 18%
  // tax-inclusive GST rate, so the existing money expectations still hold.
  const TAX_RATE = 18;
  function realisticSummary(subtotal: number, discount: number) {
    const shippingFee = subtotal >= 999 ? 0 : 79;
    const total = Math.max(0, subtotal - discount) + shippingFee;
    return Promise.resolve({
      subtotal,
      discount,
      shippingFee,
      total,
      taxRatePercent: TAX_RATE,
      taxIncluded: includedTax(total, TAX_RATE),
    });
  }
  const settingsMock = {
    get: jest.fn(),
    summarize: jest.fn(realisticSummary),
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
        { provide: CouponsService, useValue: couponsMock },
        { provide: SettingsService, useValue: settingsMock },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock));
    settingsMock.get.mockResolvedValue({ ordersEnabled: true, maintenanceNotice: null });
    settingsMock.summarize.mockImplementation(realisticSummary);
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

    it('refuses to place an order while the store has orders switched off', async () => {
      settingsMock.get.mockResolvedValue({
        ordersEnabled: false,
        maintenanceNotice: 'Back on Monday',
      });
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine()]);

      await expect(
        service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD }),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Checked before anything is written or charged.
      expect(prismaMock.order.create).not.toHaveBeenCalled();
      expect(razorpayMock.createOrder).not.toHaveBeenCalled();
      expect(inventoryMock.adjustStock).not.toHaveBeenCalled();
    });

    it('takes shipping and the total from store-settings pricing rather than computing them itself', async () => {
      settingsMock.summarize.mockResolvedValue({
        subtotal: 100,
        discount: 0,
        shippingFee: 25,
        total: 125,
        taxRatePercent: 5,
        taxIncluded: 5.95,
      });
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ price: 100, quantity: 1 })]);
      prismaMock.order.create.mockResolvedValue({ id: 'order-1', total: 125, items: [], createdAt: new Date() });

      await service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD });

      expect(settingsMock.summarize).toHaveBeenCalledWith(100, 0);
      const createArgs = prismaMock.order.create.mock.calls[0][0];
      expect(createArgs.data.shippingFee).toBe(25);
      expect(createArgs.data.total).toBe(125);
    });

    // Prices are tax-inclusive. The GST is recorded on the order as the portion
    // of the total that is tax, with the rate in force at the time. It must
    // never change the total itself.
    it('snapshots the GST contained in the total, with its rate, without adding it to the total', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ price: 1180, quantity: 1 })]);
      prismaMock.order.create.mockResolvedValue({ id: 'order-1', total: 1180, items: [], createdAt: new Date() });

      await service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD });

      const data = prismaMock.order.create.mock.calls[0][0].data;
      expect(data.total).toBe(1180);
      expect(data.taxRatePercent).toBe(18);
      expect(data.taxAmount).toBe(180);
    });

    it('snapshots GST on the Razorpay path too, and charges the tax-inclusive total', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ price: 500, quantity: 1 })]);
      prismaMock.order.create.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-1',
        total: 579,
        items: [],
        createdAt: new Date(),
      });
      razorpayMock.createOrder.mockResolvedValue({ id: 'order_rzp_1', amount: 57900, currency: 'INR' });

      await service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.RAZORPAY });

      const data = prismaMock.order.create.mock.calls[0][0].data;
      expect(data.total).toBe(579);
      expect(data.taxAmount).toBe(includedTax(579, 18));
      // Razorpay is charged the total (57900 paise), never total + tax.
      expect(razorpayMock.createOrder).toHaveBeenCalledWith(57900, expect.any(String));
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

    it('RAZORPAY with a coupon that clears the whole payable total: settles server-side instead of sending a zero amount to the gateway', async () => {
      prismaMock.address.findUnique.mockResolvedValue(address);
      // Subtotal 1000 clears the free-shipping threshold, so shippingFee is 0
      // and a full-value coupon leaves nothing to charge.
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ price: 1000, quantity: 1 })]);
      couponsMock.validateForUser.mockResolvedValue({ couponId: 'coupon-1', code: 'FREEBIE', discount: 1000 });
      prismaMock.order.create.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-20260822-ABC123',
        total: 0,
        items: [],
        createdAt: new Date(),
      });

      const result = await service.create('user-1', {
        addressId: 'addr-1',
        paymentMethod: PaymentMethod.RAZORPAY,
        couponCode: 'FREEBIE',
      });

      // Razorpay rejects amounts under 1 rupee — it must never be called here.
      expect(razorpayMock.createOrder).not.toHaveBeenCalled();
      expect(result.razorpay).toBeNull();

      const createArgs = prismaMock.order.create.mock.calls[0][0];
      expect(createArgs.data.total).toBe(0);
      expect(createArgs.data.status).toBe(OrderStatus.CONFIRMED);
      expect(createArgs.data.payment.create.status).toBe(PaymentStatus.PAID);

      // Settled like COD: stock deducted, coupon consumed, cart cleared.
      expect(inventoryMock.adjustStock).toHaveBeenCalled();
      expect(couponsMock.redeem).toHaveBeenCalledWith(prismaMock, 'coupon-1', 'user-1', 'order-1', 1000);
      expect(prismaMock.cartItem.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });
  });

  describe('retryPayment', () => {
    it('refuses to retry an order with nothing left to pay rather than calling the gateway with zero', async () => {
      prismaMock.order.findUnique.mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        orderNumber: 'ORD-20260822-ABC123',
        paymentMethod: PaymentMethod.RAZORPAY,
        status: OrderStatus.PENDING,
        total: 0,
        items: [],
        createdAt: new Date(),
      });

      await expect(service.retryPayment('user-1', 'order-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(razorpayMock.createOrder).not.toHaveBeenCalled();
    });
  });

  describe('quote', () => {
    it("prices the caller's own server-side cart through the same pricing create() uses", async () => {
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ price: 600, quantity: 2 })]);

      const quote = await service.quote('user-1');

      expect(prismaMock.cartItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
      );
      expect(settingsMock.summarize).toHaveBeenCalledWith(1200, 0);
      expect(quote).toEqual({
        subtotal: 1200,
        discount: 0,
        shippingFee: 0,
        total: 1200,
        taxRatePercent: 18,
        taxIncluded: includedTax(1200, 18),
        couponCode: null,
      });
    });

    it('re-validates a coupon for this user rather than trusting a client-sent discount', async () => {
      prismaMock.cartItem.findMany.mockResolvedValue([cartLine({ price: 1000, quantity: 1 })]);
      couponsMock.validateForUser.mockResolvedValue({ couponId: 'c1', code: 'SAVE100', discount: 100 });

      const quote = await service.quote('user-1', 'SAVE100');

      expect(couponsMock.validateForUser).toHaveBeenCalledWith('SAVE100', 'user-1', 1000);
      expect(quote.discount).toBe(100);
      expect(quote.couponCode).toBe('SAVE100');
      expect(quote.total).toBe(900);
    });

    it('matches exactly what create() then records and charges for the same cart and coupon', async () => {
      const lines = [cartLine({ price: 450, quantity: 2 })];
      couponsMock.validateForUser.mockResolvedValue({ couponId: 'c1', code: 'TEN', discount: 90 });

      prismaMock.cartItem.findMany.mockResolvedValue(lines);
      const quote = await service.quote('user-1', 'TEN');

      prismaMock.address.findUnique.mockResolvedValue(address);
      prismaMock.cartItem.findMany.mockResolvedValue(lines);
      // An earlier test leaves order.findUnique returning an order, which would make
      // every generated order number look taken.
      prismaMock.order.findUnique.mockResolvedValue(null);
      prismaMock.order.create.mockResolvedValue({ id: 'order-1', total: quote.total, items: [], createdAt: new Date() });
      await service.create('user-1', { addressId: 'addr-1', paymentMethod: PaymentMethod.COD, couponCode: 'TEN' });

      const data = prismaMock.order.create.mock.calls[0][0].data;
      expect(data.subtotal).toBe(quote.subtotal);
      expect(data.discount).toBe(quote.discount);
      expect(data.shippingFee).toBe(quote.shippingFee);
      expect(data.total).toBe(quote.total);
      expect(data.taxAmount).toBe(quote.taxIncluded);
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
