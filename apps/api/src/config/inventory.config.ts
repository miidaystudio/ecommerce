import { registerAs } from '@nestjs/config';

export default registerAs('inventory', () => ({
  // A variant at or below this stock level is flagged "low stock" for the
  // admin dashboard/inventory views. Per-product overrides are a Phase 7
  // (store settings) concern — a single store-wide default is enough for now.
  lowStockThreshold: Number(process.env.LOW_STOCK_THRESHOLD ?? 5),
}));
