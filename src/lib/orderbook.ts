import type { OrderBook, OrderBookLevel } from './types'

/**
 * Build a synthetic order book around a mid price. Levels are spaced by `tick`
 * and sizes decay with distance from the mid plus a deterministic jitter so the
 * ladder looks lively but is reproducible given the rng.
 */
export function buildOrderBook(
  symbol: string,
  mid: number,
  rng: () => number = Math.random,
  depth = 12,
): OrderBook {
  // tick size scales with price magnitude
  const tick = Math.max(0.01, Math.round(mid * 0.0002 * 100) / 100)
  const bids: OrderBookLevel[] = []
  const asks: OrderBookLevel[] = []

  let bidTotal = 0
  let askTotal = 0
  for (let i = 0; i < depth; i++) {
    const decay = Math.exp(-i * 0.18)
    const baseSize = 50 + 950 * decay

    const bidSize = Math.round(baseSize * (0.6 + 0.8 * rng()))
    const bidPrice = round2(mid - tick * (i + 0.5))
    bidTotal += bidSize
    bids.push({ price: bidPrice, size: bidSize, total: bidTotal })

    const askSize = Math.round(baseSize * (0.6 + 0.8 * rng()))
    const askPrice = round2(mid + tick * (i + 0.5))
    askTotal += askSize
    asks.push({ price: askPrice, size: askSize, total: askTotal })
  }

  const bestBid = bids[0]?.price ?? mid
  const bestAsk = asks[0]?.price ?? mid
  return {
    symbol,
    bids,
    asks,
    spread: round2(bestAsk - bestBid),
    midPrice: round2((bestAsk + bestBid) / 2),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
