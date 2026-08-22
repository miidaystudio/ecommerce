import type {
  CreateOrderResponse,
  OrderDetail,
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

  create: (addressId: string, paymentMethod: PaymentMethod): Promise<CreateOrderResponse> =>
    apiFetch<CreateOrderResponse>('/orders/me', { method: 'POST', body: { addressId, paymentMethod }, auth: true }),

  retryPayment: (id: string): Promise<CreateOrderResponse> =>
    apiFetch<CreateOrderResponse>(`/orders/me/${id}/retry-payment`, { method: 'POST', auth: true }),

  verifyPayment: (id: string, payload: VerifyPaymentPayload): Promise<OrderDetail> =>
    apiFetch<OrderDetail>(`/orders/me/${id}/verify-payment`, { method: 'POST', body: payload, auth: true }),

  cancel: (id: string): Promise<OrderDetail> =>
    apiFetch<OrderDetail>(`/orders/me/${id}/cancel`, { method: 'PATCH', auth: true }),
};
