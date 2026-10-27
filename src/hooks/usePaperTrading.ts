import { useState, useEffect, useCallback, useRef } from 'react'
import type { Quote } from '../lib/types'
import {
  TradingAccountState,
  loadTradingState,
  saveTradingState,
  placeOrder,
  cancelOrder,
  closePosition,
  checkLimitOrders,
  resetTradingState,
  PlaceOrderParams,
  OrderResult,
} from '../lib/tradingEngine'

export function usePaperTrading(quotes: Record<string, Quote>) {
  const [state, setState] = useState<TradingAccountState>(() => loadTradingState())
  const quotesRef = useRef(quotes)
  quotesRef.current = quotes

  // Save to localStorage on state changes
  useEffect(() => {
    saveTradingState(state)
  }, [state])

  // Check limit orders whenever quotes update
  useEffect(() => {
    setState((prev) => {
      const next = checkLimitOrders(prev, quotes)
      return next === prev ? prev : next
    })
  }, [quotes])

  const executeOrder = useCallback((params: Omit<PlaceOrderParams, 'currentQuote'>): OrderResult => {
    const q = quotesRef.current[params.symbol]
    if (!q) {
      return {
        success: false,
        error: `No live quote available for ${params.symbol}`,
        newState: state,
      }
    }
    const result = placeOrder(state, {
      ...params,
      currentQuote: q,
    })
    if (result.success) {
      setState(result.newState)
    }
    return result
  }, [state])

  const cancel = useCallback((orderId: string) => {
    setState((prev) => cancelOrder(prev, orderId))
  }, [])

  const close = useCallback((symbol: string): OrderResult => {
    const q = quotesRef.current[symbol]
    if (!q) {
      return {
        success: false,
        error: `No live quote available for ${symbol}`,
        newState: state,
      }
    }
    const result = closePosition(state, symbol, q)
    if (result.success) {
      setState(result.newState)
    }
    return result
  }, [state])

  const reset = useCallback(() => {
    const next = resetTradingState()
    setState(next)
  }, [])

  return {
    state,
    executeOrder,
    cancel,
    close,
    reset,
  }
}
