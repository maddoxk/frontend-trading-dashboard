export interface SymbolConfig {
  symbol: string
  name: string
  initialPrice: number
  /** annualized drift (mu) */
  drift: number
  /** annualized volatility (sigma) */
  volatility: number
}

export interface Quote {
  symbol: string
  price: number
  /** previous price, used to derive tick direction */
  prevPrice: number
  /** session open price, used for day change */
  open: number
  /** running session high */
  high: number
  /** running session low */
  low: number
  /** notional 24h volume */
  volume: number
  /** epoch ms of last update */
  time: number
}

export interface Candle {
  time: number // epoch seconds
  open: number
  high: number
  low: number
  close: number
}

export interface OrderBookLevel {
  price: number
  size: number
  /** cumulative size from best price outward */
  total: number
}

export interface OrderBook {
  symbol: string
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  spread: number
  midPrice: number
}

export interface Position {
  symbol: string
  qty: number
  avgPrice: number
}

export type TickDirection = 'up' | 'down' | 'flat'
