import { useEffect, useRef, useState, useCallback } from 'react'
import { MarketFeed, SYMBOLS } from '../lib/marketFeed'
import type { Quote, Candle } from '../lib/types'

export interface MarketState {
  quotes: Record<string, Quote>
  candles: Record<string, Candle>
  running: boolean
}

/**
 * React hook that owns a single MarketFeed instance and streams its quotes into
 * component state. Returns the latest quotes/candles and play/pause controls.
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

  useEffect(() => {
    const feed = feedRef.current!
    const unsub = feed.subscribe((tick) => {
      setQuotes(tick.quotes)
      setCandles((prev) => ({ ...prev, ...tick.candles }))
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

  return { quotes, candles, running, toggle }
}
