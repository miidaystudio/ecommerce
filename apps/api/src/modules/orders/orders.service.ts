import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InventoryAdjustmentReason, OrderStatus, PaymentMethod, PaymentStatus, Prisma, ProductStatus } from '@prisma/client';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../database/prisma.service';
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

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly razorpay: RazorpayService,
    private readonly paymentsService: PaymentsService,
    private readonly inventory: InventoryService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
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
    const total = subtotal + shippingFee;
    const orderNumber = await this.generateOrderNumber();

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
            total,
            paymentMethod: PaymentMethod.COD,
            items: { create: itemsData },
            payment: { create: { method: PaymentMethod.COD, status: PaymentStatus.PENDING, amount: total } },
          },
          include: ORDER_DETAIL_INCLUDE,
        });

        const lines = cartItems.map((item) => ({ variantId: item.variantId, quantity: item.quantity }));
        await this.inventory.adjustStock(tx, lines, created.id, InventoryAdjustmentReason.ORDER_PLACED);
        await tx.cartItem.deleteMany({ where: { userId } });

        return created;
      });

      await this.sendOrderConfirmedEmail(userId, order);
      return { order: this.toDetail(order), razorpay: null };
    }

    // RAZORPAY: create the order PENDING with no stock deducted yet — arc.md:
    // "never deduct stock before payment is confirmed." Confirmation happens in
    // PaymentsService.confirmPayment(), triggered by the webhook and/or the
    // signature-verified return-from-checkout call (verifyPaymentSignature below).
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        status: OrderStatus.PENDING,
        ...shippingFields,
        subtotal,
        shippingFee,
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
}
