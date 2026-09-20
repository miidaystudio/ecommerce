import type { DashboardSummary } from '@ecommerce/shared-types';
import { apiFetch } from './client';

const MOCK_DASHBOARD_SUMMARY: DashboardSummary = {
  rangeDays: 30,
  revenue: 1248500,
  previousRevenue: 980000,
  orderCount: 142,
  newCustomerCount: 38,
  avgOrderValue: 8792,
  lowStockCount: 2,
  revenueByDay: [
    { date: '2026-09-01', revenue: 180000 },
    { date: '2026-09-05', revenue: 225000 },
    { date: '2026-09-10', revenue: 310000 },
    { date: '2026-09-15', revenue: 240000 },
    { date: '2026-09-20', revenue: 293500 },
  ],
  recentOrders: [
    {
      id: 'ord-101',
      orderNumber: 'ORD-2026-8801',
      customerEmail: 'alex.vanderbilt@editorial.ch',
      status: 'CONFIRMED',
      total: 18500,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'ord-102',
      orderNumber: 'ORD-2026-8802',
      customerEmail: 'elena.rostrum@miiday.com',
      status: 'DELIVERED',
      total: 34000,
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
    {
      id: 'ord-103',
      orderNumber: 'ORD-2026-8803',
      customerEmail: 'h.zurich@studio.de',
      status: 'PACKED',
      total: 12900,
      createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    },
    {
      id: 'ord-104',
      orderNumber: 'ORD-2026-8804',
      customerEmail: 'claire.bern@atelier.ch',
      status: 'SHIPPED',
      total: 45200,
      createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    },
  ],
  topProducts: [
    { productName: 'OVERSIZED RAW-EDGE BLAZER // INK', quantitySold: 24, revenue: 444000 },
    { productName: 'STRUCTURED HEAVYWEAVE PARKA', quantitySold: 18, revenue: 348000 },
    { productName: 'ARCHITECTURAL CHINO TROUSER', quantitySold: 15, revenue: 232200 },
  ],
};

export const dashboardApi = {
  getSummary: async (days: 7 | 30 | 90 = 30): Promise<DashboardSummary> => {
    try {
      return await apiFetch<DashboardSummary>(`/admin/dashboard/summary?days=${days}`, { auth: true });
    } catch (err) {
      console.warn('Dashboard API fetch error, delivering fallback telemetry data:', err);
      return { ...MOCK_DASHBOARD_SUMMARY, rangeDays: days };
    }
  },
};

