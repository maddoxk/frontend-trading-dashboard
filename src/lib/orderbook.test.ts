import { describe, it, expect } from 'vitest'
import { buildOrderBook } from './orderbook'
import { mulberry32 } from './gbm'

describe('buildOrderBook', () => {
  it('produces the requested depth on both sides', () => {
    const ob = buildOrderBook('BTC', 1000, mulberry32(1), 10)
    expect(ob.bids).toHaveLength(10)
    expect(ob.asks).toHaveLength(10)
  })

  it('orders bids descending and asks ascending', () => {
    const ob = buildOrderBook('ETH', 2000, mulberry32(2), 8)
    for (let i = 1; i < ob.bids.length; i++) {
      expect(ob.bids[i].price).toBeLessThan(ob.bids[i - 1].price)
    }
    for (let i = 1; i < ob.asks.length; i++) {
      expect(ob.asks[i].price).toBeGreaterThan(ob.asks[i - 1].price)
    }
  })

  it('has a non-negative spread with best ask above best bid', () => {
    const ob = buildOrderBook('AAPL', 200, mulberry32(3), 12)
    expect(ob.asks[0].price).toBeGreaterThan(ob.bids[0].price)
    expect(ob.spread).toBeGreaterThanOrEqual(0)
  })

  it('accumulates cumulative totals monotonically', () => {
    const ob = buildOrderBook('NVDA', 120, mulberry32(4), 12)
    for (let i = 1; i < ob.bids.length; i++) {
      expect(ob.bids[i].total).toBeGreaterThanOrEqual(ob.bids[i - 1].total)
    }
  })

  it('keeps the mid price near the input mid', () => {
    const ob = buildOrderBook('SPY', 545, mulberry32(5), 12)
    expect(Math.abs(ob.midPrice - 545)).toBeLessThan(5)
  })
})
