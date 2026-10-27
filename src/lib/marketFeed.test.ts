import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MarketFeed, SYMBOLS } from './marketFeed'

describe('MarketFeed', () => {
  let feed: MarketFeed

  beforeEach(() => {
    vi.useFakeTimers()
    feed = new MarketFeed(SYMBOLS, 250)
  })

  afterEach(() => {
    feed.stop()
    vi.useRealTimers()
  })

  it('initializes with default quotes and running state', () => {
    const quotes = feed.getQuotes()
    expect(Object.keys(quotes)).toEqual(['BTC', 'ETH', 'AAPL', 'NVDA', 'TSLA', 'SPY'])
    expect(quotes.BTC.price).toBe(67450)
    expect(feed.isRunning()).toBe(false)
  })

  it('updates quotes on tick and notifies subscribers', () => {
    let tickCount = 0
    feed.subscribe((tick) => {
      tickCount++
      expect(tick.quotes.BTC.price).toBeGreaterThan(0)
    })

    feed.stepTick()
    expect(tickCount).toBe(1)

    feed.stepTick()
    expect(tickCount).toBe(2)
  })

  it('adjusts playback speed multiplier safely', () => {
    feed.setSpeed(2.0)
    expect(feed.getSpeed()).toBe(2.0)

    feed.setSpeed(5.0)
    expect(feed.getSpeed()).toBe(5.0)

    // Reject non-positive or invalid speeds
    feed.setSpeed(-1)
    expect(feed.getSpeed()).toBe(5.0)

    feed.setSpeed(NaN)
    expect(feed.getSpeed()).toBe(5.0)
  })

  it('injects and clears simulation scenarios', () => {
    feed.injectScenario('FLASH_CRASH', 10)
    const scenario = feed.getActiveScenario()
    expect(scenario).not.toBeNull()
    expect(scenario?.type).toBe('FLASH_CRASH')

    feed.clearScenario()
    expect(feed.getActiveScenario()).toBeNull()
  })

  it('applies parameter updates and resets state', () => {
    feed.updateSymbolParams('BTC', { drift: 0.5, volatility: 0.9 })
    const params = feed.getSymbolParams('BTC')
    expect(params.drift).toBe(0.5)
    expect(params.volatility).toBe(0.9)

    feed.reset()
    const resetParams = feed.getSymbolParams('BTC')
    // After reset, returns default configs
    expect(resetParams.drift).toBe(0.18)
    expect(feed.getActiveScenario()).toBeNull()
  })

  it('pushes downward pressure during flash crash scenario', () => {
    feed.injectScenario('FLASH_CRASH', 20)
    const initialPrice = feed.getQuotes().BTC.price

    // Advance 50 ticks
    for (let i = 0; i < 50; i++) {
      feed.stepTick()
    }

    const finalPrice = feed.getQuotes().BTC.price
    // With negative drift and flash crash shocks, price should be noticeably lower
    expect(finalPrice).toBeLessThan(initialPrice * 1.05)
  })
})
