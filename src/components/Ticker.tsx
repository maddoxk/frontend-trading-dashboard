import { formatPrice, formatPercent, pctChange } from '../lib/format'
import type { Quote } from '../lib/types'
import { SYMBOLS } from '../lib/marketFeed'

interface TickerProps {
  quotes: Record<string, Quote>
}

/** A horizontally scrolling marquee of live prices. Duplicated once for a seamless loop. */
export function Ticker({ quotes }: TickerProps) {
  const items = SYMBOLS.map((cfg) => {
    const q = quotes[cfg.symbol]
    if (!q) return null
    const change = pctChange(q.price, q.open)
    const up = change >= 0
    return (
      <span className="tk-item" key={cfg.symbol}>
        <span className="tk-sym">{cfg.symbol}</span>
        <span className="mono tk-px">{formatPrice(q.price)}</span>
        <span className={`mono tk-chg ${up ? 'up' : 'down'}`}>
          {up ? '▲' : '▼'} {formatPercent(change)}
        </span>
      </span>
    )
  })

  return (
    <div className="ticker" aria-label="Live price ticker">
      <div className="tk-track">
        {items}
        {items}
      </div>
    </div>
  )
}
