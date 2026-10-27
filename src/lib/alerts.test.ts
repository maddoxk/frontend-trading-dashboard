import { describe, it, expect } from 'vitest'
import { createPriceAlert, checkAlerts, PriceAlert } from './alerts'
import type { Quote } from './types'

function makeQuote(symbol: string, price: number, low = price * 0.99, high = price * 1.01): Quote {
  return {
    symbol,
    price,
    prevPrice: price,
    open: price,
    high,
    low,
    volume: 1000,
    time: Date.now(),
  }
}

describe('alerts engine', () => {
  it('creates valid price alerts with direction inferred from current price', () => {
    // Current price: 65,000, target: 70,000 -> ABOVE
    const alert1 = createPriceAlert('BTC', 70000, 65000)
    expect(alert1).not.toBeNull()
    expect(alert1?.direction).toBe('ABOVE')
    expect(alert1?.targetPrice).toBe(70000)

    // Current price: 65,000, target: 60,000 -> BELOW
    const alert2 = createPriceAlert('BTC', 60000, 65000)
    expect(alert2).not.toBeNull()
    expect(alert2?.direction).toBe('BELOW')

    // Invalid target price
    expect(createPriceAlert('BTC', -50, 65000)).toBeNull()
    expect(createPriceAlert('BTC', NaN, 65000)).toBeNull()
  })

  it('triggers alert when price breaches target condition', () => {
    const alertAbove: PriceAlert = {
      id: '1',
      symbol: 'ETH',
      targetPrice: 3600,
      direction: 'ABOVE',
      createdAt: Date.now(),
    }
    const alertBelow: PriceAlert = {
      id: '2',
      symbol: 'AAPL',
      targetPrice: 200,
      direction: 'BELOW',
      createdAt: Date.now(),
    }

    // Quotes: ETH high touches 3650, AAPL low stays above 205
    const quotes = {
      ETH: makeQuote('ETH', 3550, 3500, 3650),
      AAPL: makeQuote('AAPL', 210, 205, 215),
    }

    const res = checkAlerts([alertAbove, alertBelow], quotes)
    expect(res.triggeredAlerts.length).toBe(1)
    expect(res.triggeredAlerts[0].symbol).toBe('ETH')
    expect(res.remainingAlerts.length).toBe(1)
    expect(res.remainingAlerts[0].symbol).toBe('AAPL')
  })
})
