import { useMemo, useRef } from 'react'
import { buildOrderBook } from '../lib/orderbook'
import { formatPrice, formatQty } from '../lib/format'
import type { Quote } from '../lib/types'

interface OrderBookProps {
  quote: Quote | undefined
}

const ROW_HEIGHT = 22
const VISIBLE = 12

/**
 * Virtualized bid/ask ladder. The book is rebuilt each render around the live
 * mid price; only a fixed window of rows is rendered (windowed list) so deep
 * books stay cheap to paint.
 */
export function OrderBook({ quote }: OrderBookProps) {
  // a per-mount rng-ish seed so the ladder is stable between renders of the same book
  const seedRef = useRef(Math.random)

  const book = useMemo(() => {
    if (!quote) return null
    return buildOrderBook(quote.symbol, quote.price, seedRef.current, 24)
  }, [quote?.symbol, quote?.price])

  if (!book || !quote) {
    return <div className="ob-empty">No data</div>
  }

  const maxTotal = Math.max(
    book.bids[book.bids.length - 1]?.total ?? 1,
    book.asks[book.asks.length - 1]?.total ?? 1,
  )

  const asks = book.asks.slice(0, VISIBLE).reverse()
  const bids = book.bids.slice(0, VISIBLE)

  return (
    <div className="orderbook">
      <div className="ob-head">
        <span>Price (USD)</span>
        <span>Size</span>
        <span>Total</span>
      </div>

      <div className="ob-side" style={{ height: VISIBLE * ROW_HEIGHT }}>
        {asks.map((lvl, i) => (
          <div className="ob-row" key={`a-${i}`} style={{ height: ROW_HEIGHT }}>
            <div
              className="ob-depth ask"
              style={{ width: `${(lvl.total / maxTotal) * 100}%` }}
            />
            <span className="mono down">{formatPrice(lvl.price)}</span>
            <span className="mono">{formatQty(lvl.size)}</span>
            <span className="mono ob-total">{formatQty(lvl.total)}</span>
          </div>
        ))}
      </div>

      <div className="ob-spread mono">
        <span className="ob-mid">{formatPrice(book.midPrice)}</span>
        <span className="ob-spread-label">spread {formatPrice(book.spread)}</span>
      </div>

      <div className="ob-side" style={{ height: VISIBLE * ROW_HEIGHT }}>
        {bids.map((lvl, i) => (
          <div className="ob-row" key={`b-${i}`} style={{ height: ROW_HEIGHT }}>
            <div
              className="ob-depth bid"
              style={{ width: `${(lvl.total / maxTotal) * 100}%` }}
            />
            <span className="mono up">{formatPrice(lvl.price)}</span>
            <span className="mono">{formatQty(lvl.size)}</span>
            <span className="mono ob-total">{formatQty(lvl.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
