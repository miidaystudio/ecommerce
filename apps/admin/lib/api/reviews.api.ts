import type { AdminReviewView, PaginatedReviews, ReviewStatus } from '@ecommerce/shared-types';
import { apiFetch } from './client';

export const reviewsApi = {
  list: (page = 1, pageSize = 20, status?: ReviewStatus): Promise<PaginatedReviews<AdminReviewView>> =>
    apiFetch<PaginatedReviews<AdminReviewView>>(
      `/admin/reviews?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ''}`,
      { auth: true },
    ),

  moderate: (id: string, status: ReviewStatus): Promise<AdminReviewView> =>
    apiFetch<AdminReviewView>(`/admin/reviews/${id}`, { method: 'PATCH', body: { status }, auth: true }),

  remove: (id: string): Promise<{ success: true }> =>
    apiFetch<{ success: true }>(`/admin/reviews/${id}`, { method: 'DELETE', auth: true }),
};
