/** Formatting and number utilities for the trading dashboard. */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Format a value as USD currency, e.g. 1234.5 -> "$1,234.50". */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return usd.format(value)
}

/** Format a whole-dollar currency value, e.g. 1234567 -> "$1,234,567". */
export function formatCurrency0(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return usd0.format(value)
}

/** Format a signed P&L value, e.g. 12.5 -> "+$12.50", -3 -> "-$3.00". */
export function formatSignedCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${usd.format(Math.abs(value))}`
}

/** Format a fractional change as a signed percentage, e.g. 0.0125 -> "+1.25%". */
export function formatPercent(fraction: number, digits = 2): string {
  if (!Number.isFinite(fraction)) return '—'
  const pct = fraction * 100
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

/** Compute fractional change between two values. Returns 0 if base is 0. */
export function pctChange(current: number, base: number): number {
  if (base === 0 || !Number.isFinite(base)) return 0
  return (current - base) / base
}

/** Abbreviate large numbers, e.g. 1500 -> "1.5K", 2_300_000 -> "2.3M". */
export function abbreviateNumber(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`
  return `${sign}${abs.toFixed(0)}`
}

/** Format a quantity of shares/units with thousands separators. */
export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

/** Format an epoch-ms timestamp as HH:MM:SS local time. */
export function formatTime(epochMs: number): string {
  const d = new Date(epochMs)
  return d.toLocaleTimeString('en-US', { hour12: false })
}
