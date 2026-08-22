'use client';

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayFailureResponse {
  error: { description?: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void) => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let loadPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout can only be opened in the browser'));
  }
  if (window.Razorpay) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay checkout')));
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });

  return loadPromise;
}

export interface OpenRazorpayCheckoutParams {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  orderNumber: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (response: RazorpayHandlerResponse) => void;
  onDismiss: () => void;
  onFailure: (description: string) => void;
}

export function useRazorpayCheckout() {
  async function open(params: OpenRazorpayCheckoutParams): Promise<void> {
    await loadRazorpayScript();
    if (!window.Razorpay) {
      throw new Error('Razorpay checkout failed to load');
    }

    const instance = new window.Razorpay({
      key: params.keyId,
      amount: params.amount,
      currency: params.currency,
      name: 'miiday',
      description: `Order ${params.orderNumber}`,
      order_id: params.razorpayOrderId,
      prefill: params.prefill,
      theme: { color: '#4A4238' },
      handler: params.onSuccess,
      modal: { ondismiss: params.onDismiss },
    });

    instance.on('payment.failed', (response) => {
      params.onFailure(response.error?.description ?? 'Payment failed');
    });

    instance.open();
  }

  return { open };
}
