import type { Position, Quote } from './types'
import { DEMO_POSITIONS } from './pnl'

export type OrderSide = 'BUY' | 'SELL'
export type OrderType = 'MARKET' | 'LIMIT'
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED'

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  price: number
  qty: number
  status: OrderStatus
  createdAt: number
  filledAt?: number
}

export interface TradeFill {
  id: string
  orderId: string
  symbol: string
  side: OrderSide
  type: OrderType
  price: number
  qty: number
  total: number
  timestamp: number
  realizedPnl?: number
}

export interface TradingAccountState {
  cash: number
  initialCash: number
  realizedPnl: number
  positions: Record<string, Position>
  openOrders: Order[]
  tradeHistory: TradeFill[]
}

const STORAGE_KEY = 'quantdesk_trading_state_v1'
const DEFAULT_INITIAL_CASH = 100_000

/**
 * Creates the default initial state for paper trading.
 */
export function createDefaultTradingState(): TradingAccountState {
  const positionsMap: Record<string, Position> = {}
  for (const pos of DEMO_POSITIONS) {
    positionsMap[pos.symbol] = { ...pos }
  }
  return {
    cash: DEFAULT_INITIAL_CASH,
    initialCash: DEFAULT_INITIAL_CASH,
    realizedPnl: 0,
    positions: positionsMap,
    openOrders: [],
    tradeHistory: [],
  }
}

/**
 * Generate a unique ID safely.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9)
}

/**
 * Calculates reserved cash locked in pending Limit BUY orders.
 */
export function getReservedCash(openOrders: Order[]): number {
  return openOrders
    .filter((o) => o.status === 'PENDING' && o.side === 'BUY')
    .reduce((sum, o) => sum + o.price * o.qty, 0)
}

/**
 * Calculates reserved quantity locked in pending Limit SELL orders for a specific symbol.
 */
export function getReservedQty(openOrders: Order[], symbol: string): number {
  return openOrders
    .filter((o) => o.status === 'PENDING' && o.side === 'SELL' && o.symbol === symbol)
    .reduce((sum, o) => sum + o.qty, 0)
}

/**
 * Available cash that can be used for new buy orders.
 */
export function getAvailableCash(state: TradingAccountState): number {
  const reserved = getReservedCash(state.openOrders)
  return Math.max(0, state.cash - reserved)
}

/**
 * Available quantity of a held asset that can be sold.
 */
export function getAvailableQty(state: TradingAccountState, symbol: string): number {
  const pos = state.positions[symbol]
  const held = pos ? pos.qty : 0
  const reserved = getReservedQty(state.openOrders, symbol)
  return Math.max(0, held - reserved)
}

export interface PlaceOrderParams {
  symbol: string
  side: OrderSide
  type: OrderType
  qty: number
  limitPrice?: number
  currentQuote: Quote
}

export interface OrderResult {
  success: boolean
  error?: string
  order?: Order
  fill?: TradeFill
  newState: TradingAccountState
}

/**
 * Safely executes or enqueues a new order against the account state.
 */
export function placeOrder(
  state: TradingAccountState,
  params: PlaceOrderParams,
): OrderResult {
  const { symbol, side, type, currentQuote } = params

  // 1. Input sanitization & bounds checking
  if (!symbol || typeof symbol !== 'string') {
    return { success: false, error: 'Invalid symbol', newState: state }
  }
  const qty = Number(params.qty)
  if (!Number.isFinite(qty) || qty <= 0) {
    return { success: false, error: 'Order quantity must be greater than 0', newState: state }
  }

  const executionPrice = type === 'MARKET' ? currentQuote.price : Number(params.limitPrice)
  if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
    return { success: false, error: 'Invalid order price', newState: state }
  }

  const orderValue = qty * executionPrice

  // 2. Validate fund / inventory availability
  if (side === 'BUY') {
    const availableCash = getAvailableCash(state)
    if (orderValue > availableCash + 1e-6) {
      return {
        success: false,
        error: `Insufficient available cash. Required: $${orderValue.toFixed(2)}, Available: $${availableCash.toFixed(2)}`,
        newState: state,
      }
    }
  } else {
    // SELL
    const availableQty = getAvailableQty(state, symbol)
    if (qty > availableQty + 1e-6) {
      return {
        success: false,
        error: `Insufficient available shares to sell. Required: ${qty}, Available: ${availableQty}`,
        newState: state,
      }
    }
  }

  const now = Date.now()
  const orderId = generateId()

  // 3. Execution logic
  if (type === 'MARKET') {
    return executeFill(state, {
      id: generateId(),
      orderId,
      symbol,
      side,
      type: 'MARKET',
      price: executionPrice,
      qty,
      total: orderValue,
      timestamp: now,
    })
  } else {
    // LIMIT order -> add to openOrders
    const newOrder: Order = {
      id: orderId,
      symbol,
      side,
      type: 'LIMIT',
      price: executionPrice,
      qty,
      status: 'PENDING',
      createdAt: now,
    }

    const updatedState: TradingAccountState = {
      ...state,
      openOrders: [newOrder, ...state.openOrders],
    }

    // Check if limit price is already marketable (e.g. limit buy above market or limit sell below market)
    const marketable =
      (side === 'BUY' && currentQuote.price <= executionPrice) ||
      (side === 'SELL' && currentQuote.price >= executionPrice)

    if (marketable) {
      return executeFill(updatedState, {
        id: generateId(),
        orderId,
        symbol,
        side,
        type: 'LIMIT',
        price: executionPrice,
        qty,
        total: orderValue,
        timestamp: now,
      })
    }

    return {
      success: true,
      order: newOrder,
      newState: updatedState,
    }
  }
}

/**
 * Internal helper to apply a fill to positions, cash, and trade history.
 */
function executeFill(
  state: TradingAccountState,
  fill: TradeFill,
): OrderResult {
  const { symbol, side, price, qty, total } = fill
  let newCash = state.cash
  let newRealizedPnl = state.realizedPnl
  const newPositions = { ...state.positions }
  let tradeRealizedPnl: number | undefined

  if (side === 'BUY') {
    newCash -= total
    const existing = newPositions[symbol]
    if (existing && existing.qty > 0) {
      const combinedQty = existing.qty + qty
      const combinedAvg = (existing.qty * existing.avgPrice + total) / combinedQty
      newPositions[symbol] = {
        symbol,
        qty: combinedQty,
        avgPrice: combinedAvg,
      }
    } else {
      newPositions[symbol] = {
        symbol,
        qty,
        avgPrice: price,
      }
    }
  } else {
    // SELL
    newCash += total
    const existing = newPositions[symbol]
    if (existing && existing.qty > 0) {
      const sellQty = Math.min(qty, existing.qty)
      tradeRealizedPnl = (price - existing.avgPrice) * sellQty
      newRealizedPnl += tradeRealizedPnl

      const remainingQty = existing.qty - sellQty
      if (remainingQty <= 1e-8) {
        delete newPositions[symbol]
      } else {
        newPositions[symbol] = {
          ...existing,
          qty: remainingQty,
        }
      }
    }
  }

  const finalFill: TradeFill = {
    ...fill,
    realizedPnl: tradeRealizedPnl,
  }

  // Update openOrders if this was from an existing order
  const updatedOrders = state.openOrders.map((o) =>
    o.id === fill.orderId
      ? { ...o, status: 'FILLED' as OrderStatus, filledAt: fill.timestamp }
      : o,
  ).filter((o) => o.status === 'PENDING') // Keep open orders clean or keep filled in history

  const newState: TradingAccountState = {
    ...state,
    cash: newCash,
    realizedPnl: newRealizedPnl,
    positions: newPositions,
    openOrders: updatedOrders,
    tradeHistory: [finalFill, ...state.tradeHistory],
  }

  return {
    success: true,
    fill: finalFill,
    newState,
  }
}

/**
 * Evaluates pending limit orders against current market quotes.
 */
export function checkLimitOrders(
  state: TradingAccountState,
  quotes: Record<string, Quote>,
): TradingAccountState {
  if (state.openOrders.length === 0) return state

  let currentState = state
  const pending = state.openOrders.filter((o) => o.status === 'PENDING')

  for (const order of pending) {
    const q = quotes[order.symbol]
    if (!q) continue

    const shouldFillBuy = order.side === 'BUY' && q.low <= order.price
    const shouldFillSell = order.side === 'SELL' && q.high >= order.price

    if (shouldFillBuy || shouldFillSell) {
      const result = executeFill(currentState, {
        id: generateId(),
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        price: order.price,
        qty: order.qty,
        total: order.qty * order.price,
        timestamp: Date.now(),
      })
      if (result.success) {
        currentState = result.newState
      }
    }
  }

  return currentState
}

/**
 * Cancels a pending order.
 */
export function cancelOrder(
  state: TradingAccountState,
  orderId: string,
): TradingAccountState {
  const updatedOrders = state.openOrders.filter((o) => o.id !== orderId)
  return {
    ...state,
    openOrders: updatedOrders,
  }
}

/**
 * Market-closes an entire open position.
 */
export function closePosition(
  state: TradingAccountState,
  symbol: string,
  currentQuote: Quote,
): OrderResult {
  const pos = state.positions[symbol]
  if (!pos || pos.qty <= 0) {
    return { success: false, error: `No open position in ${symbol}`, newState: state }
  }

  return placeOrder(state, {
    symbol,
    side: 'SELL',
    type: 'MARKET',
    qty: pos.qty,
    currentQuote,
  })
}

/**
 * LocalStorage serialization with safe fallback.
 */
export function loadTradingState(): TradingAccountState {
  if (typeof localStorage === 'undefined') return createDefaultTradingState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultTradingState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.cash !== 'number' || !parsed.positions) {
      return createDefaultTradingState()
    }
    return {
      cash: parsed.cash,
      initialCash: typeof parsed.initialCash === 'number' ? parsed.initialCash : DEFAULT_INITIAL_CASH,
      realizedPnl: typeof parsed.realizedPnl === 'number' ? parsed.realizedPnl : 0,
      positions: parsed.positions ?? {},
      openOrders: Array.isArray(parsed.openOrders) ? parsed.openOrders : [],
      tradeHistory: Array.isArray(parsed.tradeHistory) ? parsed.tradeHistory : [],
    }
  } catch {
    return createDefaultTradingState()
  }
}

export function saveTradingState(state: TradingAccountState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Failed to save trading state to localStorage:', err)
  }
}

export function resetTradingState(): TradingAccountState {
  const defaultState = createDefaultTradingState()
  saveTradingState(defaultState)
  return defaultState
}
