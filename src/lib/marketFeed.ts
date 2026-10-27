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

export type SimulationScenario = 'NONE' | 'FLASH_CRASH' | 'SHORT_SQUEEZE' | 'HIGH_VOLATILITY' | 'BULL_RUN'

export interface ActiveScenario {
  type: SimulationScenario
  label: string
  startedAt: number
  durationMs: number
}

/** A single update emitted by the feed. */
export interface FeedTick {
  quotes: Record<string, Quote>
  /** symbol -> latest candle (1s buckets) that changed this tick */
  candles: Record<string, Candle>
  speed: number
  activeScenario: ActiveScenario | null
}

export type FeedListener = (tick: FeedTick) => void

const BASE_INTERVAL_MS = 250
const SECONDS_PER_YEAR = 252 * 6.5 * 3600

/**
 * A self-contained simulated market data feed with speed control, step stepping,
 * scenario injection, and configurable volatility/drift regimes.
 */
export class MarketFeed {
  private quotes: Record<string, Quote> = {}
  private candles: Record<string, Candle> = {}
  private listeners = new Set<FeedListener>()
  private timer: ReturnType<typeof setInterval> | null = null
  private speed = 1.0
  private intervalMs: number = BASE_INTERVAL_MS
  private activeScenario: ActiveScenario | null = null
  private customConfigs: Record<string, { drift: number; volatility: number }> = {}

  constructor(
    private configs: SymbolConfig[] = SYMBOLS,
    intervalMs = BASE_INTERVAL_MS,
  ) {
    this.intervalMs = intervalMs
    this.reset()
  }

  /** Re-seed all quotes/candles to their opening state and clear active scenarios. */
  reset(): void {
    const now = Date.now()
    this.activeScenario = null
    this.customConfigs = {}
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

  getSpeed(): number {
    return this.speed
  }

  getActiveScenario(): ActiveScenario | null {
    if (!this.activeScenario) return null
    if (Date.now() - this.activeScenario.startedAt > this.activeScenario.durationMs) {
      this.activeScenario = null
      return null
    }
    return this.activeScenario
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) return
    this.speed = Math.max(0.1, Math.min(20, speed))
    this.intervalMs = Math.max(20, Math.round(BASE_INTERVAL_MS / this.speed))

    if (this.isRunning()) {
      this.stop()
      this.start()
    }
  }

  injectScenario(scenario: SimulationScenario, durationSeconds = 15): void {
    if (scenario === 'NONE') {
      this.activeScenario = null
      return
    }

    const labels: Record<SimulationScenario, string> = {
      NONE: 'None',
      FLASH_CRASH: 'Flash Crash (-15%)',
      SHORT_SQUEEZE: 'Short Squeeze (+25%)',
      HIGH_VOLATILITY: 'High Volatility (4x)',
      BULL_RUN: 'Bull Run (+Trend)',
    }

    this.activeScenario = {
      type: scenario,
      label: labels[scenario] || scenario,
      startedAt: Date.now(),
      durationMs: durationSeconds * 1000,
    }
  }

  clearScenario(): void {
    this.activeScenario = null
  }

  updateSymbolParams(symbol: string, params: { drift?: number; volatility?: number }): void {
    const existing = this.customConfigs[symbol] || {
      drift: this.configs.find((c) => c.symbol === symbol)?.drift ?? 0.1,
      volatility: this.configs.find((c) => c.symbol === symbol)?.volatility ?? 0.3,
    }

    if (params.drift !== undefined && Number.isFinite(params.drift)) {
      existing.drift = params.drift
    }
    if (params.volatility !== undefined && Number.isFinite(params.volatility) && params.volatility >= 0.01) {
      existing.volatility = params.volatility
    }

    this.customConfigs[symbol] = existing
  }

  getSymbolParams(symbol: string): { drift: number; volatility: number } {
    if (this.customConfigs[symbol]) {
      return { ...this.customConfigs[symbol] }
    }
    const c = this.configs.find((cfg) => cfg.symbol === symbol)
    return {
      drift: c?.drift ?? 0.1,
      volatility: c?.volatility ?? 0.3,
    }
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

  /** Advance simulation by exactly 1 tick (useful when paused). */
  stepTick(): void {
    this.tick()
  }

  private tick(): void {
    const now = Date.now()
    const sec = Math.floor(now / 1000)
    const changedCandles: Record<string, Candle> = {}

    // Check scenario expiration
    const scenario = this.getActiveScenario()
    const dt = (this.intervalMs / 1000 / SECONDS_PER_YEAR) * this.speed

    for (const c of this.configs) {
      const q = this.quotes[c.symbol]
      const cfgParams = this.getSymbolParams(c.symbol)
      let mu = cfgParams.drift
      let sigma = cfgParams.volatility
      let volumeMultiplier = 1

      // Apply scenario modifiers
      if (scenario) {
        switch (scenario.type) {
          case 'FLASH_CRASH':
            mu = -6.5
            sigma = Math.max(sigma * 2.5, 1.2)
            volumeMultiplier = 5
            break
          case 'SHORT_SQUEEZE':
            mu = +8.0
            sigma = Math.max(sigma * 2.0, 1.0)
            volumeMultiplier = 8
            break
          case 'HIGH_VOLATILITY':
            mu = 0
            sigma = sigma * 3.8
            volumeMultiplier = 2.5
            break
          case 'BULL_RUN':
            mu = +2.2
            sigma = Math.min(sigma * 0.6, 0.25)
            volumeMultiplier = 1.8
            break
        }
      }

      const params: GbmParams = { mu, sigma, dt }
      let next = gbmStep(q.price, params)

      // Direct shock nudge during initial ticks of flash crash or squeeze
      if (scenario?.type === 'FLASH_CRASH' && Math.random() < 0.4) {
        next = Math.max(0.01, next * 0.995)
      } else if (scenario?.type === 'SHORT_SQUEEZE' && Math.random() < 0.4) {
        next = next * 1.008
      }

      q.prevPrice = q.price
      q.price = next
      q.high = Math.max(q.high, next)
      q.low = Math.min(q.low, next)
      q.volume += Math.abs(next - q.prevPrice) * (20 + Math.random() * 80) * volumeMultiplier
      q.time = now

      // Aggregate 1-second OHLC candle
      const candle = this.candles[c.symbol]
      if (candle && candle.time === sec) {
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
      speed: this.speed,
      activeScenario: scenario,
    }
    for (const fn of this.listeners) fn(tickPayload)
  }
}
