import { formatIncludedGst } from '../../lib/utils/format-price';

/**
 * The GST contained in a tax-inclusive total, shown under it. Renders nothing
 * when there is no tax to report (no rate configured, or an order placed
 * before tax was tracked), rather than a misleading "incl. ₹0.00 GST".
 */
export function IncludedGst({
  taxAmount,
  taxRatePercent,
  className = '',
}: {
  taxAmount: number;
  taxRatePercent: number;
  className?: string;
}) {
  if (!(taxAmount > 0)) return null;
  return (
    <p className={`text-right text-2xs text-text-secondary ${className}`}>
      {formatIncludedGst(taxAmount, taxRatePercent)}
    </p>
  );
}
