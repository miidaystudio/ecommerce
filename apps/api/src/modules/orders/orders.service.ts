import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InventoryAdjustmentReason, OrderStatus, PaymentMethod, PaymentStatus, Prisma, ProductStatus } from '@prisma/client';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../database/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService } from '../inventory/inventory.service';
import { PaymentsService } from '../payments/payments.service';
import { RazorpayService } from '../payments/razorpay.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

const ORDER_DETAIL_INCLUDE = {
  items: true,
  payment: true,
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

export interface OrderItemView {
  id: string;
  productName: string;
  variantName: string;
  sku: string;
  attributes: Record<string, string> | null;
  imageUrl: string | null;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingAddress: OrderShippingAddress;
  subtotal: number;
  shippingFee: number;
  discount: number;
  couponCode: string | null;
  total: number;
  items: OrderItemView[];
  createdAt: string;
}

export interface CreateOrderResponse {
  order: OrderDetail;
  razorpay: { keyId: string; razorpayOrderId: string; amount: number; currency: string } | null;
}

export interface PaginatedOrders {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminOrderSummary extends OrderSummary {
  customerEmail: string;
  customerName: string | null;
}

export interface AdminOrderDetail extends OrderDetail {
  customerEmail: string;
  customerName: string | null;
}

export interface PaginatedAdminOrders {
  items: AdminOrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ADMIN_ORDER_INCLUDE = {
  items: true,
  payment: true,
  user: { select: { email: true, firstName: true, lastName: true } },
} satisfies Prisma.OrderInclude;

type AdminOrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ADMIN_ORDER_INCLUDE }>;

// Admin-settable transitions. PENDING is system-only (payment confirmation);
// CANCELLED/RETURNED are terminal. Both release any deducted stock.
const ADMIN_ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [],
  CONFIRMED: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  PACKED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  DELIVERED: [OrderStatus.RETURNED],
  CANCELLED: [],
  RETURNED: [],
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly paymentsService: PaymentsService,
    private readonly inventory: InventoryService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly coupons: CouponsService,
  ) {}

  async create(userId: string, dto: CreateOrderDto): Promise<CreateOrderResponse> {
    const address = await this.prisma.address.findUnique({ where: { id: dto.addressId } });
    if (!address || address.userId !== userId) {
      throw new NotFoundException('Address not found');
    }

    const cartItems = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { variant: { include: { product: true } } },
    });
    if (cartItems.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    const problems: string[] = [];
    for (const item of cartItems) {
      if (item.variant.product.status !== ProductStatus.ACTIVE) {
        problems.push(`${item.variant.product.name} is no longer available`);
      } else if (item.quantity > item.variant.stock) {
        problems.push(
          `${item.variant.product.name} (${item.variant.name}): only ${item.variant.stock} left in stock`,
        );
      }
    }
    if (problems.length > 0) {
      // AllExceptionsFilter only ever forwards `message` (string | string[]) —
      // an array here surfaces each problem individually, same as ValidationPipe's
      // own errors elsewhere in this API, rather than a custom field it would drop.
      throw new BadRequestException(problems);
    }

    const subtotal = cartItems.reduce((sum, item) => sum + Number(item.variant.price) * item.quantity, 0);
    const shippingFee = this.computeShippingFee(subtotal);

    // Re-validated from scratch here even if the client already previewed it —
    // the preview grants nothing, and the discount is computed from the live
    // cart subtotal, never from any amount the client sent.
    const appliedCoupon = dto.couponCode
      ? await this.coupons.validateForUser(dto.couponCode, userId, subtotal)
      : null;
    const discount = appliedCoupon?.discount ?? 0;

    const total = Math.max(0, subtotal - discount) + shippingFee;
    const orderNumber = await this.generateOrderNumber();

    const couponFields = {
      discount,
      couponCode: appliedCoupon?.code ?? null,
      couponId: appliedCoupon?.couponId ?? null,
    };

    const itemsData = cartItems.map((item) => ({
      variantId: item.variantId,
      productName: item.variant.product.name,
      variantName: item.variant.name,
      sku: item.variant.sku,
      attributes: (item.variant.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
      price: item.variant.price,
      quantity: item.quantity,
      lineTotal: Number(item.variant.price) * item.quantity,
    }));

    const shippingFields = {
      shippingFullName: address.fullName,
      shippingPhone: address.phone,
      shippingLine1: address.line1,
      shippingLine2: address.line2,
      shippingCity: address.city,
      shippingState: address.state,
      shippingPostalCode: address.postalCode,
      shippingCountry: address.country,
    };

    if (dto.paymentMethod === PaymentMethod.COD) {
      const order = await this.prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            orderNumber,
            userId,
            status: OrderStatus.CONFIRMED,
            ...shippingFields,
            subtotal,
            shippingFee,
            ...couponFields,
            total,
            paymentMethod: PaymentMethod.COD,
            items: { create: itemsData },
            payment: { create: { method: PaymentMethod.COD, status: PaymentStatus.PENDING, amount: total } },
          },
          include: ORDER_DETAIL_INCLUDE,
        });

        const lines = cartItems.map((item) => ({ variantId: item.variantId, quantity: item.quantity }));
        await this.inventory.adjustStock(tx, lines, created.id, InventoryAdjustmentReason.ORDER_PLACED);
        if (appliedCoupon) {
          await this.coupons.redeem(tx, appliedCoupon.couponId, userId, created.id, appliedCoupon.discount);
        }
        await tx.cartItem.deleteMany({ where: { userId } });

        return created;
      });

      await this.sendOrderConfirmedEmail(userId, order);
      return { order: this.toDetail(order), razorpay: null };
    }

    // RAZORPAY: create the order PENDING with no stock deducted yet — arc.md:
    // "never deduct stock before payment is confirmed." The coupon is likewise
    // recorded on the order but NOT redeemed here; PaymentsService.confirmPayment()
    // consumes the use, so an abandoned payment never burns a coupon.
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        status: OrderStatus.PENDING,
        ...shippingFields,
        subtotal,
        shippingFee,
        ...couponFields,
        total,
        paymentMethod: PaymentMethod.RAZORPAY,
        items: { create: itemsData },
        payment: { create: { method: PaymentMethod.RAZORPAY, status: PaymentStatus.PENDING, amount: total } },
      },
      include: ORDER_DETAIL_INCLUDE,
    });

    const razorpayOrder = await this.createRazorpayOrderFor(order.id, total, orderNumber);

    return {
      order: this.toDetail(order),
      razorpay: {
        keyId: this.razorpay.keyId,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    };
  }

  async retryPayment(userId: string, orderId: string): Promise<CreateOrderResponse> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    if (order.paymentMethod !== PaymentMethod.RAZORPAY || order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('This order is not awaiting payment');
    }

    const razorpayOrder = await this.createRazorpayOrderFor(order.id, Number(order.total), order.orderNumber);

    return {
      order: this.toDetail(order),
      razorpay: {
        keyId: this.razorpay.keyId,
        razorpayOrderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
    };
  }

  /** Called after Razorpay Checkout.js returns control to the storefront. Real
   * cryptographic verification (not a client-trusted flag) — see
   * RazorpayService.verifyPaymentSignature and PaymentsService.confirmPayment's
   * docs for why this doesn't conflict with "webhook is the source of truth". */
  async verifyPaymentSignature(
    userId: string,
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    if (order.payment?.razorpayOrderId !== razorpayOrderId) {
      throw new BadRequestException('Payment does not match this order');
    }

    const isValid = this.razorpay.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) {
      throw new BadRequestException('Payment verification failed');
    }

    await this.paymentsService.confirmPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    const fresh = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    return this.toDetail(fresh);
  }

  async cancelMine(userId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('This order can no longer be cancelled');
    }

    const stockWasDeducted = order.status === OrderStatus.CONFIRMED;

    await this.prisma.$transaction(async (tx) => {
      if (stockWasDeducted) {
        const restock = order.items
          .filter((item) => item.variantId)
          .map((item) => ({ variantId: item.variantId as string, quantity: -item.quantity }));
        await this.inventory.adjustStock(tx, restock, order.id, InventoryAdjustmentReason.ORDER_CANCELLED);
      }

      // Deliberately NOT marking Payment REFUNDED here: no money has actually
      // moved (automated Razorpay refund processing is a follow-up, not built
      // this phase — flagged in memory.md), and recording REFUNDED without a
      // real refund would misrepresent financial state to whoever reads it
      // later. The signal for "this needs a manual refund" is simply
      // status=CANCELLED with payment.status still PAID.

      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
    });

    const fresh = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    await this.sendOrderCancelledEmail(userId, fresh);
    return this.toDetail(fresh);
  }

  async listMine(userId: string, query: ListOrdersQueryDto): Promise<PaginatedOrders> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        include: ORDER_DETAIL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      items: orders.map((order) => this.toSummary(order)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getMineById(userId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found');
    }
    return this.toDetail(order);
  }

  async adminList(query: {
    page?: number;
    pageSize?: number;
    status?: OrderStatus;
    q?: string;
  }): Promise<PaginatedAdminOrders> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.OrderWhereInput = {
      status: query.status,
      ...(query.q
        ? {
            OR: [
              { orderNumber: { contains: query.q, mode: 'insensitive' } },
              { user: { email: { contains: query.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: ADMIN_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((order) => this.toAdminSummary(order)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async adminGetById(orderId: string): Promise<AdminOrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ADMIN_ORDER_INCLUDE });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.toAdminDetail(order);
  }

  async adminUpdateStatus(orderId: string, nextStatus: OrderStatus): Promise<AdminOrderDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowed = ADMIN_ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(`Cannot move an order from ${order.status} to ${nextStatus}`);
    }

    const releasesStock = nextStatus === OrderStatus.CANCELLED || nextStatus === OrderStatus.RETURNED;

    await this.prisma.$transaction(async (tx) => {
      if (releasesStock) {
        const restock = order.items
          .filter((item) => item.variantId)
          .map((item) => ({ variantId: item.variantId as string, quantity: -item.quantity }));
        await this.inventory.adjustStock(
          tx,
          restock,
          order.id,
          nextStatus === OrderStatus.CANCELLED
            ? InventoryAdjustmentReason.ORDER_CANCELLED
            : InventoryAdjustmentReason.RESTOCK,
        );
      }
      await tx.order.update({ where: { id: order.id }, data: { status: nextStatus } });
    });

    const fresh = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ADMIN_ORDER_INCLUDE });
    await this.sendStatusChangeEmail(order.userId, fresh, nextStatus);
    return this.toAdminDetail(fresh);
  }

  private async createRazorpayOrderFor(orderId: string, total: number, receipt: string) {
    const razorpayOrder = await this.razorpay.createOrder(Math.round(total * 100), receipt);
    await this.prisma.payment.update({ where: { orderId }, data: { razorpayOrderId: razorpayOrder.id } });
    return razorpayOrder;
  }

  private computeShippingFee(subtotal: number): number {
    const threshold = this.config.get<number>('payments.freeShippingThreshold') ?? 999;
    const flatFee = this.config.get<number>('payments.flatShippingFee') ?? 79;
    return subtotal >= threshold ? 0 : flatFee;
  }

  private async generateOrderNumber(): Promise<string> {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = randomBytes(3).toString('hex').toUpperCase();
      const candidate = `ORD-${datePart}-${suffix}`;
      const exists = await this.prisma.order.findUnique({ where: { orderNumber: candidate } });
      if (!exists) {
        return candidate;
      }
    }
    throw new Error('Could not generate a unique order number');
  }

  private async sendOrderConfirmedEmail(userId: string, order: OrderWithRelations): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      to: user.email,
      subject: `Order confirmed — ${order.orderNumber}`,
      body: `Hi ${user.firstName ?? 'there'},\n\nYour order ${order.orderNumber} is confirmed. Total: ₹${order.total}.\n\nThanks for shopping with miiday.`,
    });
  }

  private async sendOrderCancelledEmail(userId: string, order: OrderWithRelations): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;
    await this.email.send({
      to: user.email,
      subject: `Order cancelled — ${order.orderNumber}`,
      body: `Hi ${user.firstName ?? 'there'},\n\nYour order ${order.orderNumber} has been cancelled.`,
    });
  }

  private toSummary(order: OrderWithRelations): OrderSummary {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.payment?.status ?? PaymentStatus.PENDING,
      total: Number(order.total),
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt.toISOString(),
    };
  }

  private toDetail(order: OrderWithRelations): OrderDetail {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.payment?.status ?? PaymentStatus.PENDING,
      shippingAddress: {
        fullName: order.shippingFullName,
        phone: order.shippingPhone,
        line1: order.shippingLine1,
        line2: order.shippingLine2,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostalCode,
        country: order.shippingCountry,
      },
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      discount: Number(order.discount),
      couponCode: order.couponCode,
      total: Number(order.total),
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        attributes: (item.attributes as Record<string, string> | null) ?? null,
        imageUrl: item.imageUrl,
        price: Number(item.price),
        quantity: item.quantity,
        lineTotal: Number(item.lineTotal),
      })),
      createdAt: order.createdAt.toISOString(),
    };
  }

  private async sendStatusChangeEmail(
    userId: string,
    order: OrderWithRelations,
    status: OrderStatus,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const copy: Partial<Record<OrderStatus, { subject: string; body: string }>> = {
      PACKED: {
        subject: `Order packed — ${order.orderNumber}`,
        body: `Hi ${user.firstName ?? 'there'},\n\nYour order ${order.orderNumber} has been packed and will ship soon.`,
      },
      SHIPPED: {
        subject: `Order shipped — ${order.orderNumber}`,
        body: `Hi ${user.firstName ?? 'there'},\n\nYour order ${order.orderNumber} is on its way.`,
      },
      DELIVERED: {
        subject: `Order delivered — ${order.orderNumber}`,
        body: `Hi ${user.firstName ?? 'there'},\n\nYour order ${order.orderNumber} has been delivered. We hope you love it.`,
      },
      CANCELLED: {
        subject: `Order cancelled — ${order.orderNumber}`,
        body: `Hi ${user.firstName ?? 'there'},\n\nYour order ${order.orderNumber} has been cancelled.`,
      },
      RETURNED: {
        subject: `Order returned — ${order.orderNumber}`,
        body: `Hi ${user.firstName ?? 'there'},\n\nYour return for order ${order.orderNumber} has been processed.`,
      },
    };

    const message = copy[status];
    if (!message) return;
    await this.email.send({ to: user.email, ...message });
  }

  private toAdminSummary(order: AdminOrderWithRelations): AdminOrderSummary {
    return {
      ...this.toSummary(order),
      customerEmail: order.user.email,
      customerName: [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || null,
    };
  }

  private toAdminDetail(order: AdminOrderWithRelations): AdminOrderDetail {
    return {
      ...this.toDetail(order),
      customerEmail: order.user.email,
      customerName: [order.user.firstName, order.user.lastName].filter(Boolean).join(' ') || null,
    };
  }
}
