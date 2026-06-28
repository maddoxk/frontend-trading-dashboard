import { useMemo } from 'react'
import { computePnl, DEMO_POSITIONS } from '../lib/pnl'
import { formatSignedCurrency, formatCurrency0, formatPercent, formatPrice } from '../lib/format'
import type { Quote } from '../lib/types'

interface PnLPanelProps {
  quotes: Record<string, Quote>
}

export function PnLPanel({ quotes }: PnLPanelProps) {
  const pnl = useMemo(() => computePnl(DEMO_POSITIONS, quotes), [quotes])
  const up = pnl.totalUnrealized >= 0

  return (
    <div className="pnl">
      <div className="pnl-summary">
        <div className="pnl-block">
          <span className="pnl-label">Equity</span>
          <span className="mono pnl-equity">{formatCurrency0(pnl.totalMarketValue)}</span>
        </div>
        <div className="pnl-block">
          <span className="pnl-label">Unrealized P&L</span>
          <span className={`mono pnl-total ${up ? 'up' : 'down'}`}>
            {formatSignedCurrency(pnl.totalUnrealized)}
          </span>
          <span className={`mono pnl-pct ${up ? 'up' : 'down'}`}>
            {formatPercent(pnl.totalUnrealizedPct)}
          </span>
        </div>
      </div>

      <div className="pnl-table">
        <div className="pnl-row pnl-thead">
          <span>Symbol</span>
          <span>Qty</span>
          <span>Avg</span>
          <span>Last</span>
          <span>P&L</span>
        </div>
        {pnl.positions.map((p) => {
          const rowUp = p.unrealized >= 0
          return (
            <div className="pnl-row" key={p.symbol}>
              <span className="pnl-sym">{p.symbol}</span>
              <span className="mono">{p.qty}</span>
              <span className="mono pnl-dim">{formatPrice(p.avgPrice)}</span>
              <span className="mono">{formatPrice(p.last)}</span>
              <span className={`mono ${rowUp ? 'up' : 'down'}`}>
                {formatSignedCurrency(p.unrealized)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
