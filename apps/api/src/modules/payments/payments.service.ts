import { Injectable, Logger } from '@nestjs/common';
import { InventoryAdjustmentReason, OrderStatus, PaymentStatus } from '@prisma/client';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly email: EmailService,
  ) {}

  /** The single place a Razorpay payment gets marked PAID and its order CONFIRMED
   * (stock deducted, cart cleared, confirmation email sent). Called from both the
   * webhook handler and the client's post-checkout verify call — safe to call
   * more than once for the same payment (webhook retries, or verify firing before
   * the webhook does): the PaymentStatus.PAID check makes it an idempotent no-op
   * on repeat calls, per arc.md's "webhook is the source of truth" — this is the
   * one function that actually changes state, and it accepts a claim of success
   * only after the caller has already cryptographically verified it. */
  async confirmPayment(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { razorpayOrderId },
      include: { order: { include: { items: true } } },
    });
    if (!payment) {
      this.logger.warn(`Payment confirmation for unknown razorpayOrderId=${razorpayOrderId}`);
      return;
    }
    if (payment.status === PaymentStatus.PAID) {
      return; // already processed — idempotent no-op
    }

    const order = payment.order;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.PAID, razorpayPaymentId, razorpaySignature, paidAt: new Date() },
      });

      const lines = order.items
        .filter((item) => item.variantId)
        .map((item) => ({ variantId: item.variantId as string, quantity: item.quantity }));
      await this.inventory.adjustStock(tx, lines, order.id, InventoryAdjustmentReason.ORDER_PLACED);

      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CONFIRMED } });
      await tx.cartItem.deleteMany({ where: { userId: order.userId } });
    });

    const user = await this.prisma.user.findUnique({ where: { id: order.userId } });
    if (user) {
      await this.email.send({
        to: user.email,
        subject: `Order confirmed — ${order.orderNumber}`,
        body: `Hi ${user.firstName ?? 'there'},\n\nYour order ${order.orderNumber} is confirmed. Total: ₹${order.total}.\n\nThanks for shopping with miiday.`,
      });
    }
  }

  async markFailed(razorpayOrderId: string, reason: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId } });
    if (!payment || payment.status === PaymentStatus.PAID) {
      return;
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED, failureReason: reason },
    });
  }
}
