import { includedTax } from './tax';

describe('includedTax (tax-inclusive GST)', () => {
  it('extracts the tax portion of a tax-inclusive amount', () => {
    expect(includedTax(1180, 18)).toBe(180);
    expect(includedTax(1050, 5)).toBe(50);
    expect(includedTax(1120, 12)).toBe(120);
  });

  it('is never added on top — the result is always less than the amount', () => {
    expect(includedTax(500, 18)).toBeLessThan(500);
    expect(includedTax(500, 18)).toBe(76.27);
  });

  it('rounds to paise', () => {
    expect(includedTax(999, 18)).toBe(152.39);
    // 333.33 × 18 / 118 = 50.8469… → 50.85 (checked against a paise-rounded value,
    // not with Number.isInteger(x * 100), which floating point makes unreliable).
    expect(includedTax(333.33, 18)).toBe(50.85);
  });

  it('is zero for a zero rate, a zero amount, or a negative input', () => {
    expect(includedTax(1000, 0)).toBe(0);
    expect(includedTax(0, 18)).toBe(0);
    expect(includedTax(-100, 18)).toBe(0);
    expect(includedTax(100, -5)).toBe(0);
  });

  it('does not return NaN for non-finite inputs', () => {
    expect(includedTax(Number.NaN, 18)).toBe(0);
    expect(includedTax(100, Number.NaN)).toBe(0);
  });
});
