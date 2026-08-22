import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly client: Razorpay;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const keyId = this.config.get<string>('payments.razorpayKeyId')!;
    this.keySecret = this.config.get<string>('payments.razorpayKeySecret')!;
    this.webhookSecret = this.config.get<string>('payments.razorpayWebhookSecret')!;
    this.client = new Razorpay({ key_id: keyId, key_secret: this.keySecret });
  }

  get keyId(): string {
    return this.config.get<string>('payments.razorpayKeyId')!;
  }

  /** amountInPaise: Razorpay amounts are the smallest currency unit (paise for INR).
   * Capture behavior (auto vs manual) is controlled by the account's Razorpay
   * Dashboard settings, not a per-order flag on this create call — confirm
   * auto-capture is enabled there before going live. */
  async createOrder(amountInPaise: number, receipt: string): Promise<RazorpayOrder> {
    const order = await this.client.orders.create({
      amount: amountInPaise,
      currency: this.config.get<string>('payments.currency') ?? 'INR',
      receipt,
    });
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  }

  /** Verifies the {razorpay_order_id, razorpay_payment_id, razorpay_signature} a client
   * receives from Checkout.js. This is real cryptographic verification (not a
   * client-trusted flag) — see arc.md's "webhook is the source of truth" note:
   * this endpoint independently re-derives the same signature the webhook would
   * check, it does not accept the client's word for it. */
  verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
    const expected = createHmac('sha256', this.keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    return this.safeCompare(expected, signature);
  }

  /** Verifies a Razorpay webhook's X-Razorpay-Signature header against the RAW
   * request body. Must be called with the raw (unparsed) body bytes/string —
   * re-serializing parsed JSON can change byte-for-byte content and break
   * signature verification even for a genuine event. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return this.safeCompare(expected, signature);
  }

  private safeCompare(expected: string, actual: string): boolean {
    const expectedBuf = Buffer.from(expected, 'utf-8');
    const actualBuf = Buffer.from(actual ?? '', 'utf-8');
    if (expectedBuf.length !== actualBuf.length) {
      // timingSafeEqual throws on length mismatch; log and fail closed.
      this.logger.warn('Signature length mismatch');
      return false;
    }
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
