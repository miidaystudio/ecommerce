/**
 * GST contained in a tax-inclusive amount.
 *
 * Prices in this store already include tax (client decision, 2026-09-13), so
 * tax is never added on top of a total — it is the portion of the total that
 * is tax: amount × rate / (100 + rate). At 18%, ₹1,180 contains ₹180.
 *
 * Rounded to paise, and zero for a non-positive amount or rate, so a free or
 * fully-discounted order never reports negative or phantom tax.
 */
export function includedTax(amount: number, ratePercent: number): number {
  if (!(amount > 0) || !(ratePercent > 0)) return 0;
  return Math.round(((amount * ratePercent) / (100 + ratePercent)) * 100) / 100;
}
