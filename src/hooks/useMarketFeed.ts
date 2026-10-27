import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MarketFeed,
  SYMBOLS,
  SimulationScenario,
  ActiveScenario,
} from '../lib/marketFeed'
import type { Quote, Candle } from '../lib/types'

export interface MarketState {
  quotes: Record<string, Quote>
  candles: Record<string, Candle>
  running: boolean
  speed: number
  activeScenario: ActiveScenario | null
}

/**
 * React hook that owns a single MarketFeed instance and streams its quotes into
 * component state. Returns the latest quotes/candles, play/pause controls, speed
 * multipliers, and scenario injection controls.
 */
export function useMarketFeed() {
  const feedRef = useRef<MarketFeed | null>(null)
  if (feedRef.current === null) {
    feedRef.current = new MarketFeed(SYMBOLS, 250)
  }

  const [quotes, setQuotes] = useState<Record<string, Quote>>(
    () => ({ ...feedRef.current!.getQuotes() }),
  )
  const [candles, setCandles] = useState<Record<string, Candle>>({})
  const [running, setRunning] = useState(true)
  const [speed, setSpeedState] = useState(1.0)
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null)

  useEffect(() => {
    const feed = feedRef.current!
    const unsub = feed.subscribe((tick) => {
      setQuotes(tick.quotes)
      setCandles((prev) => ({ ...prev, ...tick.candles }))
      setSpeedState(tick.speed)
      setActiveScenario(tick.activeScenario)
    })
    feed.start()
    return () => {
      unsub()
      feed.stop()
    }
  }, [])

  const toggle = useCallback(() => {
    const feed = feedRef.current!
    if (feed.isRunning()) {
      feed.stop()
      setRunning(false)
    } else {
      feed.start()
      setRunning(true)
    }
  }, [])

  const setSpeed = useCallback((s: number) => {
    const feed = feedRef.current!
    feed.setSpeed(s)
    setSpeedState(feed.getSpeed())
  }, [])

  const stepTick = useCallback(() => {
    const feed = feedRef.current!
    feed.stepTick()
  }, [])

  const injectScenario = useCallback((scenario: SimulationScenario, durationSec?: number) => {
    const feed = feedRef.current!
    feed.injectScenario(scenario, durationSec)
    setActiveScenario(feed.getActiveScenario())
  }, [])

  const clearScenario = useCallback(() => {
    const feed = feedRef.current!
    feed.clearScenario()
    setActiveScenario(null)
  }, [])

  const updateSymbolParams = useCallback((symbol: string, params: { drift?: number; volatility?: number }) => {
    const feed = feedRef.current!
    feed.updateSymbolParams(symbol, params)
  }, [])

  const getSymbolParams = useCallback((symbol: string) => {
    const feed = feedRef.current!
    return feed.getSymbolParams(symbol)
  }, [])

  const resetFeed = useCallback(() => {
    const feed = feedRef.current!
    feed.reset()
    setQuotes({ ...feed.getQuotes() })
    setActiveScenario(null)
  }, [])

  return {
    quotes,
    candles,
    running,
    speed,
    activeScenario,
    toggle,
    setSpeed,
    stepTick,
    injectScenario,
    clearScenario,
    updateSymbolParams,
    getSymbolParams,
    resetFeed,
  }
}
