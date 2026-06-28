import type { Candle, Quote, SymbolConfig } from './types'
import { gbmStep, type GbmParams } from './gbm'

export const SYMBOLS: SymbolConfig[] = [
  { symbol: 'BTC', name: 'Bitcoin', initialPrice: 67450, drift: 0.18, volatility: 0.65 },
  { symbol: 'ETH', name: 'Ethereum', initialPrice: 3520, drift: 0.14, volatility: 0.72 },
  { symbol: 'AAPL', name: 'Apple Inc.', initialPrice: 212.4, drift: 0.09, volatility: 0.28 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', initialPrice: 124.6, drift: 0.32, volatility: 0.52 },
  { symbol: 'TSLA', name: 'Tesla Inc.', initialPrice: 182.3, drift: 0.05, volatility: 0.6 },
  { symbol: 'SPY', name: 'S&P 500 ETF', initialPrice: 545.1, drift: 0.08, volatility: 0.16 },
]

/** A single update emitted by the feed. */
export interface FeedTick {
  quotes: Record<string, Quote>
  /** symbol -> latest candle (1s buckets) that changed this tick */
  candles: Record<string, Candle>
}

export type FeedListener = (tick: FeedTick) => void

/**
 * A self-contained simulated market data feed. It mimics a websocket: callers
 * subscribe() for streamed ticks and call start()/stop(). Internally it advances
 * a GBM price for every symbol on a fixed interval and aggregates 1-second OHLC
 * candles.
 */
export class MarketFeed {
  private quotes: Record<string, Quote> = {}
  private candles: Record<string, Candle> = {}
  private listeners = new Set<FeedListener>()
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly intervalMs: number
  private readonly dt: number

  constructor(
    private configs: SymbolConfig[] = SYMBOLS,
    intervalMs = 250,
  ) {
    this.intervalMs = intervalMs
    // treat one trading year as ~252*6.5*3600 seconds; per-tick dt in years
    const secondsPerYear = 252 * 6.5 * 3600
    this.dt = intervalMs / 1000 / secondsPerYear
    this.reset()
  }

  /** Re-seed all quotes/candles to their opening state. */
  reset(): void {
    const now = Date.now()
    for (const c of this.configs) {
      this.quotes[c.symbol] = {
        symbol: c.symbol,
        price: c.initialPrice,
        prevPrice: c.initialPrice,
        open: c.initialPrice,
        high: c.initialPrice,
        low: c.initialPrice,
        volume: 0,
        time: now,
      }
      const sec = Math.floor(now / 1000)
      this.candles[c.symbol] = {
        time: sec,
        open: c.initialPrice,
        high: c.initialPrice,
        low: c.initialPrice,
        close: c.initialPrice,
      }
    }
  }

  getQuotes(): Record<string, Quote> {
    return this.quotes
  }

  subscribe(fn: FeedListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  isRunning(): boolean {
    return this.timer !== null
  }

  private tick(): void {
    const now = Date.now()
    const sec = Math.floor(now / 1000)
    const changedCandles: Record<string, Candle> = {}

    for (const c of this.configs) {
      const q = this.quotes[c.symbol]
      const params: GbmParams = { mu: c.drift, sigma: c.volatility, dt: this.dt }
      const next = gbmStep(q.price, params)

      q.prevPrice = q.price
      q.price = next
      q.high = Math.max(q.high, next)
      q.low = Math.min(q.low, next)
      q.volume += Math.abs(next - q.prevPrice) * (20 + Math.random() * 80)
      q.time = now

      // aggregate 1-second OHLC candle
      const candle = this.candles[c.symbol]
      if (candle.time === sec) {
        candle.high = Math.max(candle.high, next)
        candle.low = Math.min(candle.low, next)
        candle.close = next
      } else {
        this.candles[c.symbol] = {
          time: sec,
          open: q.prevPrice,
          high: next,
          low: next,
          close: next,
        }
      }
      changedCandles[c.symbol] = this.candles[c.symbol]
    }

    const tickPayload: FeedTick = {
      quotes: { ...this.quotes },
      candles: changedCandles,
    }
    for (const fn of this.listeners) fn(tickPayload)
  }
}
