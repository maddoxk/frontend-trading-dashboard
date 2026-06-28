import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  formatSignedCurrency,
  formatPercent,
  pctChange,
  abbreviateNumber,
  formatQty,
} from './format'

describe('formatPrice', () => {
  it('formats positive values as USD', () => {
    expect(formatPrice(1234.5)).toBe('$1,234.50')
  })
  it('handles zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })
  it('returns em dash for non-finite', () => {
    expect(formatPrice(NaN)).toBe('—')
    expect(formatPrice(Infinity)).toBe('—')
  })
})

describe('formatSignedCurrency', () => {
  it('prefixes a plus for gains', () => {
    expect(formatSignedCurrency(12.5)).toBe('+$12.50')
  })
  it('prefixes a minus for losses', () => {
    expect(formatSignedCurrency(-3)).toBe('-$3.00')
  })
  it('has no sign for zero', () => {
    expect(formatSignedCurrency(0)).toBe('$0.00')
  })
})

describe('formatPercent', () => {
  it('formats a positive fraction with a plus sign', () => {
    expect(formatPercent(0.0125)).toBe('+1.25%')
  })
  it('formats a negative fraction', () => {
    expect(formatPercent(-0.05)).toBe('-5.00%')
  })
  it('respects custom digits', () => {
    expect(formatPercent(0.12345, 1)).toBe('+12.3%')
  })
})

describe('pctChange', () => {
  it('computes fractional change', () => {
    expect(pctChange(110, 100)).toBeCloseTo(0.1)
  })
  it('computes negative change', () => {
    expect(pctChange(90, 100)).toBeCloseTo(-0.1)
  })
  it('returns 0 when base is 0', () => {
    expect(pctChange(50, 0)).toBe(0)
  })
})

describe('abbreviateNumber', () => {
  it('abbreviates thousands', () => {
    expect(abbreviateNumber(1500)).toBe('1.5K')
  })
  it('abbreviates millions', () => {
    expect(abbreviateNumber(2_300_000)).toBe('2.30M')
  })
  it('abbreviates billions', () => {
    expect(abbreviateNumber(4_500_000_000)).toBe('4.50B')
  })
  it('handles small numbers', () => {
    expect(abbreviateNumber(42)).toBe('42')
  })
  it('handles negatives', () => {
    expect(abbreviateNumber(-1500)).toBe('-1.5K')
  })
})

describe('formatQty', () => {
  it('adds thousands separators', () => {
    expect(formatQty(1234567)).toBe('1,234,567')
  })
})
