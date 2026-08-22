import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RazorpayService } from './razorpay.service';

describe('RazorpayService — signature verification (security-critical)', () => {
  let service: RazorpayService;

  const config = {
    'payments.razorpayKeyId': 'rzp_test_key',
    'payments.razorpayKeySecret': 'test_key_secret',
    'payments.razorpayWebhookSecret': 'test_webhook_secret',
    'payments.currency': 'INR',
  };

  const configServiceMock = { get: jest.fn((key: string) => config[key as keyof typeof config]) };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RazorpayService, { provide: ConfigService, useValue: configServiceMock }],
    }).compile();

    service = moduleRef.get(RazorpayService);
  });

  describe('verifyPaymentSignature', () => {
    it('accepts a signature genuinely computed with the configured key secret', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const signature = createHmac('sha256', 'test_key_secret').update(`${orderId}|${paymentId}`).digest('hex');

      expect(service.verifyPaymentSignature(orderId, paymentId, signature)).toBe(true);
    });

    it('rejects a signature computed with the wrong secret (forged by an attacker without the real key)', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const forged = createHmac('sha256', 'attacker_guess').update(`${orderId}|${paymentId}`).digest('hex');

      expect(service.verifyPaymentSignature(orderId, paymentId, forged)).toBe(false);
    });

    it('rejects a genuine signature replayed against a different order/payment id pair', () => {
      const signature = createHmac('sha256', 'test_key_secret').update('order_A|pay_A').digest('hex');

      expect(service.verifyPaymentSignature('order_B', 'pay_B', signature)).toBe(false);
    });

    it('rejects an empty or garbage signature instead of throwing', () => {
      expect(service.verifyPaymentSignature('order_A', 'pay_A', '')).toBe(false);
      expect(service.verifyPaymentSignature('order_A', 'pay_A', 'not-hex-at-all')).toBe(false);
    });
  });

  describe('verifyWebhookSignature', () => {
    it('accepts a signature genuinely computed over the exact raw body with the webhook secret', () => {
      const rawBody = '{"event":"payment.captured","payload":{}}';
      const signature = createHmac('sha256', 'test_webhook_secret').update(rawBody).digest('hex');

      expect(service.verifyWebhookSignature(rawBody, signature)).toBe(true);
    });

    it('rejects the correct signature if even one byte of the body differs (e.g. reserialized JSON)', () => {
      const original = '{"event":"payment.captured","payload":{}}';
      const reserialized = '{"event": "payment.captured", "payload": {}}'; // extra spaces
      const signature = createHmac('sha256', 'test_webhook_secret').update(original).digest('hex');

      expect(service.verifyWebhookSignature(reserialized, signature)).toBe(false);
    });

    it('rejects a signature computed with the wrong webhook secret', () => {
      const rawBody = '{"event":"payment.captured","payload":{}}';
      const forged = createHmac('sha256', 'wrong_secret').update(rawBody).digest('hex');

      expect(service.verifyWebhookSignature(rawBody, forged)).toBe(false);
    });
  });
});
