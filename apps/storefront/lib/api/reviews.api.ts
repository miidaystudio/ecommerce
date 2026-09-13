import type { PaginatedReviews, ProductReviewSummary, ReviewView } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export interface UpsertReviewPayload {
  rating: number;
  title?: string;
  body: string;
}

export const reviewsApi = {
  listForProduct: (productId: string, page = 1, pageSize = 10): Promise<PaginatedReviews<ReviewView>> =>
    apiFetch<PaginatedReviews<ReviewView>>(`/products/${productId}/reviews?page=${page}&pageSize=${pageSize}`),

  summary: (productId: string): Promise<ProductReviewSummary> =>
    apiFetch<ProductReviewSummary>(`/products/${productId}/reviews/summary`),

  getMine: (productId: string): Promise<ReviewView | null> =>
    apiFetch<ReviewView | null>(`/products/${productId}/reviews/mine`, { auth: true }),

  upsertMine: (productId: string, payload: UpsertReviewPayload): Promise<ReviewView> =>
    apiFetch<ReviewView>(`/products/${productId}/reviews/mine`, { method: 'PUT', body: payload, auth: true }),

  removeMine: (productId: string): Promise<{ success: true }> =>
    apiFetch<{ success: true }>(`/products/${productId}/reviews/mine`, { method: 'DELETE', auth: true }),
};
