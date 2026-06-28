import { Sparkline } from './Sparkline'
import { formatPrice, formatPercent, pctChange } from '../lib/format'
import type { Quote } from '../lib/types'
import { SYMBOLS } from '../lib/marketFeed'

interface WatchlistProps {
  quotes: Record<string, Quote>
  history: Record<string, number[]>
  selected: string
  onSelect: (symbol: string) => void
}

export function Watchlist({ quotes, history, selected, onSelect }: WatchlistProps) {
  return (
    <div className="watchlist">
      {SYMBOLS.map((cfg) => {
        const q = quotes[cfg.symbol]
        if (!q) return null
        const change = pctChange(q.price, q.open)
        const up = change >= 0
        const spark = history[cfg.symbol] ?? []
        return (
          <button
            key={cfg.symbol}
            className={`wl-row ${selected === cfg.symbol ? 'wl-active' : ''}`}
            onClick={() => onSelect(cfg.symbol)}
          >
            <div className="wl-id">
              <span className="wl-sym">{cfg.symbol}</span>
              <span className="wl-name">{cfg.name}</span>
            </div>
            <Sparkline
              data={spark}
              color={up ? 'var(--up)' : 'var(--down)'}
            />
            <div className="wl-px">
              <span className="mono wl-price">{formatPrice(q.price)}</span>
              <span className={`mono wl-chg ${up ? 'up' : 'down'}`}>
                {formatPercent(change)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
