import { SkipThrottle } from '@nestjs/throttler';
import { Controller, Headers, HttpCode, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { RazorpayService } from './razorpay.service';

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id: string;
        error_description?: string;
      };
    };
  };
}

// Razorpay retries a webhook it believes failed. A 429 here would look like
// a failure and, worse, could drop the confirmation that marks an order PAID —
// so this route is never rate limited. It is already authenticated by an HMAC
// signature over the raw body, which is a far stronger gate than an IP count.
@SkipThrottle()
@Controller('payments/webhook')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly razorpay: RazorpayService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // Deliberately bypasses @Body()/the global ValidationPipe: this handler needs
  // the exact raw bytes Razorpay signed (see main.ts's route-scoped express.raw()
  // registration), not a parsed-and-reserialized object.
  @Post('razorpay')
  @HttpCode(200)
  async handleRazorpayWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature?: string,
  ): Promise<{ received: true }> {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : '';

    if (!signature || !rawBody || !this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let event: RazorpayWebhookPayload;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new UnauthorizedException('Malformed webhook payload');
    }

    const paymentEntity = event.payload.payment?.entity;

    switch (event.event) {
      case 'payment.captured':
      case 'order.paid': {
        if (paymentEntity) {
          await this.paymentsService.confirmPayment(paymentEntity.order_id, paymentEntity.id, signature);
        }
        break;
      }
      case 'payment.failed': {
        if (paymentEntity) {
          await this.paymentsService.markFailed(
            paymentEntity.order_id,
            paymentEntity.error_description ?? 'Payment failed',
          );
        }
        break;
      }
      default:
        this.logger.debug(`Ignoring unhandled Razorpay webhook event: ${event.event}`);
    }

    // Always 200 once the signature is valid — Razorpay retries on non-2xx,
    // and an event we intentionally ignore isn't a failure.
    return { received: true };
  }
}
