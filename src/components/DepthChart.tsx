import { useMemo, useState, useCallback } from 'react'
import type { OrderBook } from '../lib/types'
import { formatPrice, formatQty } from '../lib/format'

interface DepthChartProps {
  book: OrderBook
  height?: number
  onSelectPrice?: (side: 'BUY' | 'SELL', price: number, size: number) => void
}

interface HoverInfo {
  x: number
  y: number
  side: 'BUY' | 'SELL'
  price: number
  total: number
}

export function DepthChart({ book, height = 240, onSelectPrice }: DepthChartProps) {
  const [hover, setHover] = useState<HoverInfo | null>(null)

  const { bidPoints, askPoints, maxTotal, minPrice, maxPrice } = useMemo(() => {
    const bids = [...book.bids].sort((a, b) => a.price - b.price) // ascending
    const asks = [...book.asks].sort((a, b) => a.price - b.price) // ascending

    const maxBidsTotal = bids.length > 0 ? bids[bids.length - 1].total : 1
    const maxAsksTotal = asks.length > 0 ? asks[asks.length - 1].total : 1
    const maxTotal = Math.max(maxBidsTotal, maxAsksTotal, 1)

    const minPrice = bids.length > 0 ? bids[0].price : book.midPrice * 0.98
    const maxPrice = asks.length > 0 ? asks[asks.length - 1].price : book.midPrice * 1.02

    return {
      bidPoints: bids,
      askPoints: asks,
      maxTotal,
      minPrice,
      maxPrice,
    }
  }, [book])

  const width = 300
  const priceRange = Math.max(0.01, maxPrice - minPrice)
  const getY = useCallback(
    (total: number) => height - (total / maxTotal) * (height - 24) - 10,
    [height, maxTotal],
  )

  // Construct Bid SVG polygon path
  const bidPath = useMemo(() => {
    if (bidPoints.length === 0) return ''
    const getX = (price: number) => ((price - minPrice) / priceRange) * width
    const midX = getX(book.midPrice)

    let path = `M ${midX} ${height}`
    const revBids = [...bidPoints].reverse()
    for (const b of revBids) {
      const x = Math.max(0, getX(b.price))
      const y = getY(b.total)
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
    }
    const firstBidX = Math.max(0, getX(bidPoints[0].price))
    path += ` L ${firstBidX.toFixed(1)} ${height} Z`
    return path
  }, [bidPoints, book.midPrice, height, minPrice, priceRange, getY])

  // Construct Ask SVG polygon path
  const askPath = useMemo(() => {
    if (askPoints.length === 0) return ''
    const getX = (price: number) => ((price - minPrice) / priceRange) * width
    const midX = getX(book.midPrice)

    let path = `M ${midX} ${height}`
    for (const a of askPoints) {
      const x = Math.min(width, getX(a.price))
      const y = getY(a.total)
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
    }
    const lastAskX = Math.min(width, getX(askPoints[askPoints.length - 1].price))
    path += ` L ${lastAskX.toFixed(1)} ${height} Z`
    return path
  }, [askPoints, book.midPrice, height, minPrice, priceRange, getY])

  const midX = ((book.midPrice - minPrice) / priceRange) * width

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const normalizedX = (mouseX / rect.width) * width
    const targetPrice = minPrice + (normalizedX / width) * priceRange

    if (targetPrice < book.midPrice) {
      // Find closest bid
      const closest = bidPoints.reduce((prev, curr) =>
        Math.abs(curr.price - targetPrice) < Math.abs(prev.price - targetPrice) ? curr : prev,
      )
      setHover({
        x: mouseX,
        y: (getY(closest.total) / height) * rect.height,
        side: 'BUY',
        price: closest.price,
        total: closest.total,
      })
    } else {
      // Find closest ask
      const closest = askPoints.reduce((prev, curr) =>
        Math.abs(curr.price - targetPrice) < Math.abs(prev.price - targetPrice) ? curr : prev,
      )
      setHover({
        x: mouseX,
        y: (getY(closest.total) / height) * rect.height,
        side: 'SELL',
        price: closest.price,
        total: closest.total,
      })
    }
  }

  return (
    <div className="depth-chart-wrap" style={{ position: 'relative', width: '100%', height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="depth-svg"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={() => {
          if (hover && onSelectPrice) {
            onSelectPrice(hover.side, hover.price, hover.total)
          }
        }}
      >
        <defs>
          <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#16c784" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#16c784" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ea3943" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ea3943" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Bid Depth Shape */}
        <path d={bidPath} fill="url(#bidGrad)" stroke="#16c784" strokeWidth="1.5" />

        {/* Ask Depth Shape */}
        <path d={askPath} fill="url(#askGrad)" stroke="#ea3943" strokeWidth="1.5" />

        {/* Mid Price Line */}
        <line
          x1={midX}
          y1={0}
          x2={midX}
          y2={height}
          stroke="#475569"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
      </svg>

      {/* Mid price badge */}
      <div className="depth-mid-badge mono">
        <span>Mid: {formatPrice(book.midPrice)}</span>
      </div>

      {/* Hover tooltip */}
      {hover && (
        <div
          className={`depth-tooltip mono ${hover.side === 'BUY' ? 'up' : 'down'}`}
          style={{
            left: Math.min(hover.x + 12, 180),
            top: Math.max(10, hover.y - 30),
          }}
        >
          <div>{hover.side === 'BUY' ? 'Bid' : 'Ask'} @ {formatPrice(hover.price)}</div>
          <div>Depth: {formatQty(hover.total)}</div>
        </div>
      )}
    </div>
  )
}
