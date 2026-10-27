import { describe, it, expect, beforeEach } from 'vitest'
import {
  createDefaultTradingState,
  placeOrder,
  cancelOrder,
  closePosition,
  checkLimitOrders,
  getAvailableCash,
  getAvailableQty,
  TradingAccountState,
} from './tradingEngine'
import type { Quote } from './types'

function makeQuote(symbol: string, price: number, low = price * 0.99, high = price * 1.01): Quote {
  return {
    symbol,
    price,
    prevPrice: price,
    open: price,
    high,
    low,
    volume: 1000,
    time: Date.now(),
  }
}

describe('tradingEngine', () => {
  let state: TradingAccountState

  beforeEach(() => {
    state = createDefaultTradingState()
  })

  describe('input validation & security', () => {
    it('rejects invalid or non-positive quantities', () => {
      const q = makeQuote('BTC', 65000)
      const res1 = placeOrder(state, { symbol: 'BTC', side: 'BUY', type: 'MARKET', qty: 0, currentQuote: q })
      expect(res1.success).toBe(false)
      expect(res1.error).toContain('quantity must be greater than 0')

      const res2 = placeOrder(state, { symbol: 'BTC', side: 'BUY', type: 'MARKET', qty: -5, currentQuote: q })
      expect(res2.success).toBe(false)

      const res3 = placeOrder(state, { symbol: 'BTC', side: 'BUY', type: 'MARKET', qty: NaN, currentQuote: q })
      expect(res3.success).toBe(false)
    })

    it('rejects invalid limit price', () => {
      const q = makeQuote('BTC', 65000)
      const res = placeOrder(state, {
        symbol: 'BTC',
        side: 'BUY',
        type: 'LIMIT',
        qty: 1,
        limitPrice: -100,
        currentQuote: q,
      })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Invalid order price')
    })

    it('prevents buying with insufficient cash', () => {
      const q = makeQuote('BTC', 100000)
      // Account starts with 100,000 cash; attempting to buy 2 BTC costs 200,000
      const res = placeOrder(state, {
        symbol: 'BTC',
        side: 'BUY',
        type: 'MARKET',
        qty: 2,
        currentQuote: q,
      })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Insufficient available cash')
    })

    it('prevents selling more quantity than held', () => {
      const q = makeQuote('BTC', 65000)
      // Default state has 0.85 BTC
      const res = placeOrder(state, {
        symbol: 'BTC',
        side: 'SELL',
        type: 'MARKET',
        qty: 2.0,
        currentQuote: q,
      })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Insufficient available shares')
    })
  })

  describe('market orders', () => {
    it('executes market buy and updates cash, positions, and history', () => {
      const q = makeQuote('AAPL', 200)
      const initialCash = state.cash
      const initialAaplQty = state.positions['AAPL']?.qty ?? 0
      const initialAaplAvg = state.positions['AAPL']?.avgPrice ?? 200

      const res = placeOrder(state, {
        symbol: 'AAPL',
        side: 'BUY',
        type: 'MARKET',
        qty: 10,
        currentQuote: q,
      })

      expect(res.success).toBe(true)
      expect(res.fill).toBeDefined()
      expect(res.newState.cash).toBe(initialCash - 2000)

      const newPos = res.newState.positions['AAPL']
      expect(newPos.qty).toBe(initialAaplQty + 10)
      const expectedAvg = (initialAaplQty * initialAaplAvg + 2000) / (initialAaplQty + 10)
      expect(newPos.avgPrice).toBeCloseTo(expectedAvg, 4)

      expect(res.newState.tradeHistory.length).toBe(1)
      expect(res.newState.tradeHistory[0].side).toBe('BUY')
      expect(res.newState.tradeHistory[0].total).toBe(2000)
    })

    it('executes market sell and calculates realized P&L', () => {
      // Create clean position: 10 AAPL @ $150
      state.positions['AAPL'] = { symbol: 'AAPL', qty: 10, avgPrice: 150 }
      const q = makeQuote('AAPL', 200) // sold at $200 -> profit of $50/share * 5 = $250

      const res = placeOrder(state, {
        symbol: 'AAPL',
        side: 'SELL',
        type: 'MARKET',
        qty: 5,
        currentQuote: q,
      })

      expect(res.success).toBe(true)
      expect(res.fill?.realizedPnl).toBe(250)
      expect(res.newState.realizedPnl).toBe(250)
      expect(res.newState.cash).toBe(state.cash + 1000)
      expect(res.newState.positions['AAPL'].qty).toBe(5)
    })

    it('fully closes position when selling entire balance', () => {
      state.positions['ETH'] = { symbol: 'ETH', qty: 2, avgPrice: 3000 }
      const q = makeQuote('ETH', 3500)

      const res = closePosition(state, 'ETH', q)
      expect(res.success).toBe(true)
      expect(res.newState.positions['ETH']).toBeUndefined()
      expect(res.fill?.realizedPnl).toBe(1000)
    })
  })

  describe('limit orders and cash/inventory reservation', () => {
    it('reserves cash when placing a non-marketable limit BUY', () => {
      const q = makeQuote('BTC', 65000)
      // Limit buy at 60000 (below current price)
      const res = placeOrder(state, {
        symbol: 'BTC',
        side: 'BUY',
        type: 'LIMIT',
        limitPrice: 60000,
        qty: 1,
        currentQuote: q,
      })

      expect(res.success).toBe(true)
      expect(res.order).toBeDefined()
      expect(res.order?.status).toBe('PENDING')
      expect(res.newState.openOrders.length).toBe(1)

      // Available cash should now be decreased by 60,000
      expect(getAvailableCash(res.newState)).toBe(state.cash - 60000)
    })

    it('reserves shares when placing a non-marketable limit SELL', () => {
      state.positions['TSLA'] = { symbol: 'TSLA', qty: 50, avgPrice: 150 }
      const q = makeQuote('TSLA', 180)

      const res = placeOrder(state, {
        symbol: 'TSLA',
        side: 'SELL',
        type: 'LIMIT',
        limitPrice: 220,
        qty: 30,
        currentQuote: q,
      })

      expect(res.success).toBe(true)
      expect(getAvailableQty(res.newState, 'TSLA')).toBe(20)

      // Trying to sell another 30 should fail because only 20 are available
      const res2 = placeOrder(res.newState, {
        symbol: 'TSLA',
        side: 'SELL',
        type: 'LIMIT',
        limitPrice: 230,
        qty: 30,
        currentQuote: q,
      })
      expect(res2.success).toBe(false)
      expect(res2.error).toContain('Insufficient available shares')
    })

    it('cancelling a limit order releases reserved funds', () => {
      const q = makeQuote('BTC', 65000)
      const res = placeOrder(state, {
        symbol: 'BTC',
        side: 'BUY',
        type: 'LIMIT',
        limitPrice: 60000,
        qty: 1,
        currentQuote: q,
      })

      const cancelledState = cancelOrder(res.newState, res.order!.id)
      expect(cancelledState.openOrders.length).toBe(0)
      expect(getAvailableCash(cancelledState)).toBe(state.cash)
    })

    it('fills pending limit BUY when price drops below limit', () => {
      const qInitial = makeQuote('BTC', 65000)
      const res = placeOrder(state, {
        symbol: 'BTC',
        side: 'BUY',
        type: 'LIMIT',
        limitPrice: 60000,
        qty: 0.5,
        currentQuote: qInitial,
      })

      expect(res.newState.openOrders.length).toBe(1)

      // Tick arrives with price 59500 (low 59000)
      const qDropped = makeQuote('BTC', 59500, 59000, 60500)
      const tickedState = checkLimitOrders(res.newState, { BTC: qDropped })

      expect(tickedState.openOrders.length).toBe(0)
      expect(tickedState.tradeHistory.length).toBe(1)
      expect(tickedState.tradeHistory[0].side).toBe('BUY')
      expect(tickedState.tradeHistory[0].price).toBe(60000)
    })
  })
})
