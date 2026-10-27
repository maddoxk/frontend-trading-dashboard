import { useMemo, useRef, useState, useEffect } from 'react'
import { buildOrderBook, calculateSpreadBps } from '../lib/orderbook'
import { formatPrice, formatQty } from '../lib/format'
import { DepthChart } from './DepthChart'
import { Tooltip } from './Tooltip'
import type { Quote } from '../lib/types'

interface OrderBookProps {
  quote: Quote | undefined
  onSelectPrice?: (side: 'BUY' | 'SELL', price: number, size: number) => void
}

const ROW_HEIGHT = 22
const VISIBLE = 11

export function OrderBook({ quote, onSelectPrice }: OrderBookProps) {
  const seedRef = useRef(Math.random)
  const [viewMode, setViewMode] = useState<'ladder' | 'depth'>('ladder')
  const [flashDirection, setFlashDirection] = useState<'up' | 'down' | null>(null)
  const prevPriceRef = useRef<number | null>(null)

  const book = useMemo(() => {
    if (!quote) return null
    return buildOrderBook(quote.symbol, quote.price, seedRef.current, 24)
  }, [quote])

  // Trigger brief flash highlight on price tick
  useEffect(() => {
    if (!quote) return
    if (prevPriceRef.current !== null && prevPriceRef.current !== quote.price) {
      setFlashDirection(quote.price > prevPriceRef.current ? 'up' : 'down')
      const timer = setTimeout(() => setFlashDirection(null), 350)
      prevPriceRef.current = quote.price
      return () => clearTimeout(timer)
    }
    prevPriceRef.current = quote.price
  }, [quote])

  if (!book || !quote) {
    return <div className="ob-empty">No live market data</div>
  }

  const spreadBps = calculateSpreadBps(book.spread, book.midPrice)
  const maxTotal = Math.max(
    book.bids[book.bids.length - 1]?.total ?? 1,
    book.asks[book.asks.length - 1]?.total ?? 1,
  )

  const asks = book.asks.slice(0, VISIBLE).reverse()
  const bids = book.bids.slice(0, VISIBLE)

  return (
    <div className="orderbook">
      {/* View Switcher Bar */}
      <div className="ob-view-switch">
        <div className="ob-view-tabs">
          <button
            type="button"
            className={`ob-view-btn ${viewMode === 'ladder' ? 'active' : ''}`}
            onClick={() => setViewMode('ladder')}
          >
            Ladder
          </button>
          <button
            type="button"
            className={`ob-view-btn ${viewMode === 'depth' ? 'active' : ''}`}
            onClick={() => setViewMode('depth')}
          >
            Depth Chart
          </button>
        </div>
        <span className="ob-click-hint">Click row to trade</span>
      </div>

      {viewMode === 'depth' ? (
        <DepthChart book={book} height={VISIBLE * 2 * ROW_HEIGHT + 24} onSelectPrice={onSelectPrice} />
      ) : (
        <>
          <div className="ob-head">
            <span>Price (USD)</span>
            <span>Size</span>
            <span>Total</span>
          </div>

          {/* Asks (Sells) */}
          <div className="ob-side" style={{ height: VISIBLE * ROW_HEIGHT }}>
            {asks.map((lvl, i) => (
              <div
                className={`ob-row clickable ${flashDirection === 'down' ? 'flash-down' : ''}`}
                key={`a-${i}`}
                style={{ height: ROW_HEIGHT }}
                onClick={() => onSelectPrice && onSelectPrice('BUY', lvl.price, lvl.size)}
                title={`Click to BUY limit @ ${formatPrice(lvl.price)}`}
              >
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

          {/* Spread banner */}
          <div className={`ob-spread mono ${flashDirection ? `flash-${flashDirection}` : ''}`}>
            <span className="ob-mid">{formatPrice(book.midPrice)}</span>
            <span className="ob-spread-label">
              spread {formatPrice(book.spread)} ({spreadBps} bps)
              <Tooltip
                title="Spread in Basis Points (bps)"
                content="Difference between lowest ask and highest bid. 1 basis point (bps) = 0.01% of asset mid price."
              />
            </span>
          </div>

          {/* Bids (Buys) */}
          <div className="ob-side" style={{ height: VISIBLE * ROW_HEIGHT }}>
            {bids.map((lvl, i) => (
              <div
                className={`ob-row clickable ${flashDirection === 'up' ? 'flash-up' : ''}`}
                key={`b-${i}`}
                style={{ height: ROW_HEIGHT }}
                onClick={() => onSelectPrice && onSelectPrice('SELL', lvl.price, lvl.size)}
                title={`Click to SELL limit @ ${formatPrice(lvl.price)}`}
              >
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
        </>
      )}
    </div>
  )
}
