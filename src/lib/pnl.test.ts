import { describe, it, expect } from 'vitest'
import { computePnl } from './pnl'
import type { Position, Quote } from './types'

function quote(symbol: string, price: number): Quote {
  return { symbol, price, prevPrice: price, open: price, high: price, low: price, volume: 0, time: 0 }
}

describe('computePnl', () => {
  const positions: Position[] = [
    { symbol: 'AAA', qty: 10, avgPrice: 100 },
    { symbol: 'BBB', qty: 5, avgPrice: 200 },
  ]

  it('computes per-position unrealized P&L', () => {
    const quotes = { AAA: quote('AAA', 110), BBB: quote('BBB', 180) }
    const pnl = computePnl(positions, quotes)
    expect(pnl.positions[0].unrealized).toBeCloseTo(100) // (110-100)*10
    expect(pnl.positions[1].unrealized).toBeCloseTo(-100) // (180-200)*5
  })

  it('aggregates totals correctly', () => {
    const quotes = { AAA: quote('AAA', 110), BBB: quote('BBB', 180) }
    const pnl = computePnl(positions, quotes)
    expect(pnl.totalCost).toBeCloseTo(2000) // 1000 + 1000
    expect(pnl.totalMarketValue).toBeCloseTo(2000) // 1100 + 900
    expect(pnl.totalUnrealized).toBeCloseTo(0)
    expect(pnl.totalUnrealizedPct).toBeCloseTo(0)
  })

  it('falls back to avg price when a quote is missing', () => {
    const pnl = computePnl(positions, {})
    expect(pnl.totalUnrealized).toBeCloseTo(0)
    expect(pnl.positions[0].last).toBe(100)
  })

  it('computes percent return', () => {
    const quotes = { AAA: quote('AAA', 150), BBB: quote('BBB', 200) }
    const pnl = computePnl(positions, quotes)
    expect(pnl.positions[0].unrealizedPct).toBeCloseTo(0.5)
  })
})
