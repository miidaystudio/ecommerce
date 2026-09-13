import type {
  CreateOrderResponse,
  OrderDetail,
  OrderQuote,
  OrderSummary,
  PaymentMethod,
} from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface PaginatedOrders {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface VerifyPaymentPayload {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export const ordersApi = {
  list: (page = 1, pageSize = 10): Promise<PaginatedOrders> =>
    apiFetch<PaginatedOrders>(`/orders/me?page=${page}&pageSize=${pageSize}`, { auth: true }),

  getById: (id: string): Promise<OrderDetail> => apiFetch<OrderDetail>(`/orders/me/${id}`, { auth: true }),

  // Only the coupon *code* is sent — the API recomputes the discount and total
  // server-side, so a tampered client can't influence what is charged.
  create: (addressId: string, paymentMethod: PaymentMethod, couponCode?: string): Promise<CreateOrderResponse> =>
    apiFetch<CreateOrderResponse>('/orders/me', {
      method: 'POST',
      body: { addressId, paymentMethod, ...(couponCode ? { couponCode } : {}) },
      auth: true,
    }),

  // The signed-in customer's server-side cart, priced exactly as order creation
  // will price it. Only the coupon code is sent.
  quote: (couponCode?: string): Promise<OrderQuote> =>
    apiFetch<OrderQuote>(
      `/orders/me/quote${couponCode ? `?couponCode=${encodeURIComponent(couponCode)}` : ''}`,
      { auth: true },
    ),

  retryPayment: (id: string): Promise<CreateOrderResponse> =>
    apiFetch<CreateOrderResponse>(`/orders/me/${id}/retry-payment`, { method: 'POST', auth: true }),

  verifyPayment: (id: string, payload: VerifyPaymentPayload): Promise<OrderDetail> =>
    apiFetch<OrderDetail>(`/orders/me/${id}/verify-payment`, { method: 'POST', body: payload, auth: true }),

  cancel: (id: string): Promise<OrderDetail> =>
    apiFetch<OrderDetail>(`/orders/me/${id}/cancel`, { method: 'PATCH', auth: true }),
};
