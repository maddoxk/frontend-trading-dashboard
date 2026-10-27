import { useState, useEffect } from 'react'
import type { Quote } from '../lib/types'
import {
  OrderSide,
  OrderType,
  TradingAccountState,
  getAvailableCash,
  getAvailableQty,
  OrderResult,
  PlaceOrderParams,
} from '../lib/tradingEngine'
import { formatCurrency0, formatPrice } from '../lib/format'

interface OrderEntryProps {
  symbol: string
  quote: Quote | undefined
  tradingState: TradingAccountState
  selectedOrderBookPrice?: { side: OrderSide; price: number; size: number } | null
  onPlaceOrder: (params: Omit<PlaceOrderParams, 'currentQuote'>) => OrderResult
}

export function OrderEntry({
  symbol,
  quote,
  tradingState,
  selectedOrderBookPrice,
  onPlaceOrder,
}: OrderEntryProps) {
  const [side, setSide] = useState<OrderSide>('BUY')
  const [orderType, setOrderType] = useState<OrderType>('MARKET')
  const [qty, setQty] = useState<string>('1')
  const [limitPrice, setLimitPrice] = useState<string>('')
  const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null)

  // Listen to order book clicks
  useEffect(() => {
    if (selectedOrderBookPrice) {
      setSide(selectedOrderBookPrice.side)
      setOrderType('LIMIT')
      setLimitPrice(selectedOrderBookPrice.price.toFixed(2))
      setFeedback({
        message: `Selected ${selectedOrderBookPrice.side} level @ ${selectedOrderBookPrice.price.toFixed(2)}`,
        isError: false,
      })
      const timer = setTimeout(() => setFeedback(null), 2500)
      return () => clearTimeout(timer)
    }
  }, [selectedOrderBookPrice])

  // Update default limit price when symbol changes
  useEffect(() => {
    if (quote?.price && !selectedOrderBookPrice) {
      setLimitPrice(quote.price.toFixed(2))
    }
  }, [symbol, quote?.price, selectedOrderBookPrice])

  const availableCash = getAvailableCash(tradingState)
  const availableQty = getAvailableQty(tradingState, symbol)
  const currentPrice = quote ? quote.price : 0
  const activePrice = orderType === 'MARKET' ? currentPrice : Number(limitPrice) || currentPrice
  const parsedQty = Number(qty) || 0
  const estimatedTotal = parsedQty * activePrice

  const handlePercentageClick = (pct: number) => {
    if (side === 'BUY') {
      if (activePrice <= 0) return
      const maxAffordable = availableCash / activePrice
      const targetQty = (maxAffordable * pct)
      // Format sensibly (e.g. 4 decimals for crypto, 2 for equities)
      const formatted = targetQty > 1 ? targetQty.toFixed(2) : targetQty.toFixed(4)
      setQty(formatted)
    } else {
      const targetQty = availableQty * pct
      const formatted = targetQty > 1 ? targetQty.toFixed(2) : targetQty.toFixed(4)
      setQty(formatted)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    if (!quote) {
      setFeedback({ message: 'Waiting for live price feed...', isError: true })
      return
    }

    const numericQty = parseFloat(qty)
    if (isNaN(numericQty) || numericQty <= 0) {
      setFeedback({ message: 'Please enter a valid quantity greater than 0', isError: true })
      return
    }

    const numericLimit = orderType === 'LIMIT' ? parseFloat(limitPrice) : undefined
    if (orderType === 'LIMIT' && (isNaN(numericLimit!) || numericLimit! <= 0)) {
      setFeedback({ message: 'Please enter a valid limit price', isError: true })
      return
    }

    const result = onPlaceOrder({
      symbol,
      side,
      type: orderType,
      qty: numericQty,
      limitPrice: numericLimit,
    })

    if (result.success) {
      setFeedback({
        message: result.fill
          ? `Filled ${side} ${numericQty} ${symbol} @ ${formatPrice(result.fill.price)}`
          : `Placed Limit ${side} ${numericQty} ${symbol} @ ${formatPrice(numericLimit!)}`,
        isError: false,
      })
      setTimeout(() => setFeedback(null), 4000)
    } else {
      setFeedback({ message: result.error || 'Failed to place order', isError: true })
    }
  }

  return (
    <div className="order-entry">
      <div className="oe-tabs">
        <button
          type="button"
          className={`oe-side-btn buy ${side === 'BUY' ? 'active' : ''}`}
          onClick={() => { setSide('BUY'); setFeedback(null); }}
        >
          BUY
        </button>
        <button
          type="button"
          className={`oe-side-btn sell ${side === 'SELL' ? 'active' : ''}`}
          onClick={() => { setSide('SELL'); setFeedback(null); }}
        >
          SELL
        </button>
      </div>

      <div className="oe-types">
        <button
          type="button"
          className={`oe-type-btn ${orderType === 'MARKET' ? 'active' : ''}`}
          onClick={() => setOrderType('MARKET')}
        >
          Market
        </button>
        <button
          type="button"
          className={`oe-type-btn ${orderType === 'LIMIT' ? 'active' : ''}`}
          onClick={() => {
            setOrderType('LIMIT')
            if (quote) setLimitPrice(quote.price.toFixed(2))
          }}
        >
          Limit
        </button>
      </div>

      <form onSubmit={handleSubmit} className="oe-form">
        {orderType === 'LIMIT' && (
          <div className="oe-field">
            <label className="oe-label">Limit Price ($)</label>
            <div className="oe-input-wrap">
              <input
                type="number"
                step="any"
                min="0.0001"
                className="oe-input mono"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>
        )}

        <div className="oe-field">
          <div className="oe-label-row">
            <label className="oe-label">Quantity</label>
            <span className="oe-sublabel mono">
              {side === 'BUY'
                ? `Avail: ${formatCurrency0(availableCash)}`
                : `Holding: ${availableQty.toFixed(4)} ${symbol}`}
            </span>
          </div>
          <div className="oe-input-wrap">
            <input
              type="number"
              step="any"
              min="0.0001"
              className="oe-input mono"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="oe-pct-group">
          {[0.25, 0.5, 0.75, 1.0].map((pct) => (
            <button
              key={pct}
              type="button"
              className="oe-pct-btn"
              onClick={() => handlePercentageClick(pct)}
            >
              {pct * 100}%
            </button>
          ))}
        </div>

        <div className="oe-summary mono">
          <div className="oe-sum-row">
            <span>Est. Value:</span>
            <span>${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {feedback && (
          <div className={`oe-alert ${feedback.isError ? 'error' : 'success'}`}>
            {feedback.message}
          </div>
        )}

        <button
          type="submit"
          className={`oe-submit-btn ${side.toLowerCase()}`}
          disabled={!quote}
        >
          {side} {symbol}
        </button>
      </form>
    </div>
  )
}
