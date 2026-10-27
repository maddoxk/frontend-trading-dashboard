import { describe, it, expect } from 'vitest'
import {
  calculateSMA,
  calculateEMA,
  calculateBollingerBands,
  generateHistoricalCandles,
} from './indicators'
import type { Candle } from './types'

function makeCandles(prices: number[], startTime = 1000, step = 1): Candle[] {
  return prices.map((p, idx) => ({
    time: startTime + idx * step,
    open: p,
    high: p * 1.01,
    low: p * 0.99,
    close: p,
  }))
}

describe('indicators', () => {
  describe('calculateSMA', () => {
    it('returns empty array if candles count is less than period', () => {
      const candles = makeCandles([10, 20])
      expect(calculateSMA(candles, 3)).toEqual([])
      expect(calculateSMA([], 5)).toEqual([])
      expect(calculateSMA(candles, 0)).toEqual([])
    })

    it('correctly calculates 3-period SMA', () => {
      const candles = makeCandles([10, 20, 30, 40, 50])
      const sma = calculateSMA(candles, 3)

      expect(sma.length).toBe(3)
      // (10 + 20 + 30) / 3 = 20
      expect(sma[0].value).toBe(20)
      // (20 + 30 + 40) / 3 = 30
      expect(sma[1].value).toBe(30)
      // (30 + 40 + 50) / 3 = 40
      expect(sma[2].value).toBe(40)
    })
  })

  describe('calculateEMA', () => {
    it('returns empty array if candles count is less than period', () => {
      const candles = makeCandles([10, 20])
      expect(calculateEMA(candles, 3)).toEqual([])
    })

    it('starts with initial SMA and applies exponential smoothing', () => {
      const candles = makeCandles([10, 20, 30, 40])
      // period = 3: initial EMA = (10+20+30)/3 = 20
      // k = 2 / (3 + 1) = 0.5
      // next EMA = 40 * 0.5 + 20 * (1 - 0.5) = 20 + 10 = 30
      const ema = calculateEMA(candles, 3)
      expect(ema.length).toBe(2)
      expect(ema[0].value).toBe(20)
      expect(ema[1].value).toBe(30)
    })
  })

  describe('calculateBollingerBands', () => {
    it('calculates middle SMA and bands', () => {
      const candles = makeCandles([10, 10, 10, 10, 10])
      const bb = calculateBollingerBands(candles, 5, 2)
      expect(bb.length).toBe(1)
      expect(bb[0].middle).toBe(10)
      // Standard deviation of identical values is 0
      expect(bb[0].upper).toBe(10)
      expect(bb[0].lower).toBe(10)
    })

    it('upper band is always >= middle and lower <= middle', () => {
      const candles = makeCandles([10, 15, 12, 18, 14, 20, 16])
      const bb = calculateBollingerBands(candles, 4, 2)
      expect(bb.length).toBe(4)
      for (const pt of bb) {
        expect(pt.upper).toBeGreaterThanOrEqual(pt.middle)
        expect(pt.lower).toBeLessThanOrEqual(pt.middle)
      }
    })
  })

  describe('generateHistoricalCandles', () => {
    it('generates specified number of candles with valid OHLC relationships', () => {
      const count = 50
      const candles = generateHistoricalCandles(100, 0.2, 0.05, count, 5, 1700000000)
      expect(candles.length).toBe(count)

      for (let i = 0; i < candles.length; i++) {
        const c = candles[i]
        expect(c.open).toBeGreaterThan(0)
        expect(c.close).toBeGreaterThan(0)
        expect(c.high).toBeGreaterThanOrEqual(Math.min(c.open, c.close))
        expect(c.low).toBeLessThanOrEqual(Math.max(c.open, c.close))
        if (i > 0) {
          expect(c.time).toBeGreaterThan(candles[i - 1].time)
        }
      }
    })
  })
})
