import type { Candle } from './types'

export interface IndicatorPoint {
  time: number
  value: number
}

export interface BollingerBandsPoint {
  time: number
  upper: number
  middle: number
  lower: number
}

/**
 * Calculates Simple Moving Average (SMA) over close prices.
 */
export function calculateSMA(candles: Candle[], period: number): IndicatorPoint[] {
  if (!Array.isArray(candles) || period <= 0 || candles.length < period) {
    return []
  }

  const results: IndicatorPoint[] = []
  let sum = 0

  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close
    if (!Number.isFinite(close)) continue
    sum += close

    if (i >= period) {
      sum -= candles[i - period].close
    }

    if (i >= period - 1) {
      results.push({
        time: candles[i].time,
        value: Number((sum / period).toFixed(4)),
      })
    }
  }

  return results
}

/**
 * Calculates Exponential Moving Average (EMA) over close prices.
 * Multiplier = 2 / (period + 1)
 */
export function calculateEMA(candles: Candle[], period: number): IndicatorPoint[] {
  if (!Array.isArray(candles) || period <= 0 || candles.length < period) {
    return []
  }

  const results: IndicatorPoint[] = []
  const k = 2 / (period + 1)

  // Seed with initial SMA
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += candles[i].close
  }
  let prevEma = sum / period
  results.push({
    time: candles[period - 1].time,
    value: Number(prevEma.toFixed(4)),
  })

  for (let i = period; i < candles.length; i++) {
    const close = candles[i].close
    if (!Number.isFinite(close)) continue
    const currentEma = close * k + prevEma * (1 - k)
    results.push({
      time: candles[i].time,
      value: Number(currentEma.toFixed(4)),
    })
    prevEma = currentEma
  }

  return results
}

/**
 * Calculates Bollinger Bands (SMA +/- multiplier * standard deviation).
 */
export function calculateBollingerBands(
  candles: Candle[],
  period = 20,
  stdDevMultiplier = 2,
): BollingerBandsPoint[] {
  if (!Array.isArray(candles) || period <= 0 || candles.length < period) {
    return []
  }

  const results: BollingerBandsPoint[] = []

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close
    }
    const mean = sum / period

    let varianceSum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].close - mean
      varianceSum += diff * diff
    }
    const stdDev = Math.sqrt(varianceSum / period)

    results.push({
      time: candles[i].time,
      middle: Number(mean.toFixed(4)),
      upper: Number((mean + stdDevMultiplier * stdDev).toFixed(4)),
      lower: Number((mean - stdDevMultiplier * stdDev).toFixed(4)),
    })
  }

  return results
}

/**
 * Generates historical candles for a symbol using GBM to backfill the chart.
 */
export function generateHistoricalCandles(
  initialPrice: number,
  volatility: number,
  drift: number,
  count = 120,
  timeframeSeconds = 1,
  endTimeSeconds = Math.floor(Date.now() / 1000),
): Candle[] {
  if (count <= 0) return []
  const startTime = endTimeSeconds - count * timeframeSeconds

  // Annualized dt for each candle
  const secondsPerYear = 252 * 6.5 * 3600
  const dt = timeframeSeconds / secondsPerYear

  let currentPrice = initialPrice
  const candles: Candle[] = []

  // Deterministic pseudo-random seed based on initialPrice
  let seed = Math.floor(initialPrice * 100)
  const prng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  const normalRand = () => {
    const u1 = Math.max(1e-15, prng())
    const u2 = prng()
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  }

  for (let i = 0; i < count; i++) {
    const time = startTime + i * timeframeSeconds
    const open = currentPrice

    // Intrabar volatility
    const z1 = normalRand()
    const z2 = normalRand()
    const driftTerm = (drift - 0.5 * volatility * volatility) * dt
    const diffTerm = volatility * Math.sqrt(dt) * z1

    const close = Math.max(0.01, open * Math.exp(driftTerm + diffTerm))
    const wickHigh = Math.max(open, close) * (1 + Math.abs(z2) * volatility * Math.sqrt(dt) * 0.7)
    const wickLow = Math.min(open, close) * Math.max(0.01, 1 - Math.abs(z1) * volatility * Math.sqrt(dt) * 0.7)

    candles.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(wickHigh.toFixed(2)),
      low: Number(wickLow.toFixed(2)),
      close: Number(close.toFixed(2)),
    })

    currentPrice = close
  }

  return candles
}
