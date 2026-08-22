// Prices from the API are plain decimal numbers in INR (see miiday design references).
const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number): string {
  return formatter.format(amount);
}
