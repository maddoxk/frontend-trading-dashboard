import type { Position, Quote } from './types'

/** A demo portfolio of open positions (entry prices are illustrative). */
export const DEMO_POSITIONS: Position[] = [
  { symbol: 'BTC', qty: 0.85, avgPrice: 61200 },
  { symbol: 'ETH', qty: 12, avgPrice: 3310 },
  { symbol: 'NVDA', qty: 140, avgPrice: 109.4 },
  { symbol: 'AAPL', qty: 80, avgPrice: 205.1 },
  { symbol: 'TSLA', qty: 60, avgPrice: 198.7 },
]

export interface PositionPnl extends Position {
  last: number
  marketValue: number
  cost: number
  unrealized: number
  unrealizedPct: number
}

export interface PortfolioPnl {
  positions: PositionPnl[]
  totalMarketValue: number
  totalCost: number
  totalUnrealized: number
  totalUnrealizedPct: number
}

/** Mark a portfolio to market against the latest quotes. */
export function computePnl(
  positions: Position[],
  quotes: Record<string, Quote>,
): PortfolioPnl {
  let totalMarketValue = 0
  let totalCost = 0
  const rows: PositionPnl[] = positions.map((p) => {
    const last = quotes[p.symbol]?.price ?? p.avgPrice
    const marketValue = last * p.qty
    const cost = p.avgPrice * p.qty
    const unrealized = marketValue - cost
    totalMarketValue += marketValue
    totalCost += cost
    return {
      ...p,
      last,
      marketValue,
      cost,
      unrealized,
      unrealizedPct: cost === 0 ? 0 : unrealized / cost,
    }
  })
  const totalUnrealized = totalMarketValue - totalCost
  return {
    positions: rows,
    totalMarketValue,
    totalCost,
    totalUnrealized,
    totalUnrealizedPct: totalCost === 0 ? 0 : totalUnrealized / totalCost,
  }
}
