// Prices from the API are plain decimal numbers in INR (see miiday design references).
const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number): string {
  return formatter.format(amount);
}

// Tax is shown to the paisa: it is a derived figure, and rounding it to whole
// rupees would make it disagree with an invoice or a tax calculation.
const exactFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPriceExact(amount: number): string {
  return exactFormatter.format(amount);
}

/** "incl. ₹76.27 GST (18%)" — prices are tax-inclusive, so GST is a breakdown, never an addition. */
export function formatIncludedGst(taxAmount: number, taxRatePercent: number): string {
  return `incl. ${exactFormatter.format(taxAmount)} GST (${Number(taxRatePercent)}%)`;
}
