import { useState, useMemo } from 'react'
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

type CategoryFilter = 'ALL' | 'CRYPTO' | 'TECH' | 'INDICES'

const CATEGORY_MAP: Record<string, 'CRYPTO' | 'TECH' | 'INDICES'> = {
  BTC: 'CRYPTO',
  ETH: 'CRYPTO',
  AAPL: 'TECH',
  NVDA: 'TECH',
  TSLA: 'TECH',
  SPY: 'INDICES',
}

export function Watchlist({ quotes, history, selected, onSelect }: WatchlistProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('ALL')

  const filteredSymbols = useMemo(() => {
    return SYMBOLS.filter((cfg) => {
      // Category match
      if (category !== 'ALL') {
        const itemCat = CATEGORY_MAP[cfg.symbol]
        if (itemCat !== category) return false
      }
      // Text search match
      if (search.trim()) {
        const term = search.toLowerCase()
        const matchesSym = cfg.symbol.toLowerCase().includes(term)
        const matchesName = cfg.name.toLowerCase().includes(term)
        return matchesSym || matchesName
      }
      return true
    })
  }, [search, category])

  return (
    <div className="watchlist-wrapper">
      {/* Search Input */}
      <div className="wl-search-box">
        <span className="wl-search-icon">🔍</span>
        <input
          type="text"
          className="wl-search-input"
          placeholder="Filter assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            className="wl-search-clear"
            onClick={() => setSearch('')}
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="wl-filter-chips">
        {(['ALL', 'CRYPTO', 'TECH', 'INDICES'] as CategoryFilter[]).map((cat) => (
          <button
            key={cat}
            type="button"
            className={`wl-chip ${category === cat ? 'active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Asset List */}
      <div className="watchlist">
        {filteredSymbols.length === 0 ? (
          <div className="wl-empty">No instruments found matching filter</div>
        ) : (
          filteredSymbols.map((cfg) => {
            const q = quotes[cfg.symbol]
            if (!q) return null
            const change = pctChange(q.price, q.open)
            const up = change >= 0
            const spark = history[cfg.symbol] ?? []
            const cat = CATEGORY_MAP[cfg.symbol]

            return (
              <button
                key={cfg.symbol}
                className={`wl-row ${selected === cfg.symbol ? 'wl-active' : ''}`}
                onClick={() => onSelect(cfg.symbol)}
              >
                <div className="wl-id">
                  <div className="wl-sym-group">
                    <span className="wl-sym">{cfg.symbol}</span>
                    <span className="wl-cat-tag">{cat}</span>
                  </div>
                  <span className="wl-name">{cfg.name}</span>
                </div>
                <Sparkline
                  data={spark}
                  color={up ? 'var(--up)' : 'var(--down)'}
                />
                <div className="wl-px">
                  <span className="mono wl-price">{formatPrice(q.price)}</span>
                  <span className={`mono wl-chg ${up ? 'up' : 'down'}`}>
                    {up ? '+' : ''}{formatPercent(change)}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
