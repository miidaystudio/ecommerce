import type { OrderStatus } from '@ecommerce/shared-types';

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-warning/20 text-text-strong',
  CONFIRMED: 'bg-success/15 text-success-strong',
  PACKED: 'bg-accent/15 text-accent',
  SHIPPED: 'bg-accent/15 text-accent',
  DELIVERED: 'bg-success/15 text-success-strong',
  CANCELLED: 'bg-danger/15 text-danger-strong',
  RETURNED: 'bg-danger/15 text-danger-strong',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Payment pending',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.1em] ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
