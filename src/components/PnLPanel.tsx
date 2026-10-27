import { useState, useMemo } from 'react'
import { computePnl } from '../lib/pnl'
import { formatSignedCurrency, formatCurrency0, formatPercent, formatPrice } from '../lib/format'
import { Tooltip } from './Tooltip'
import type { Quote, Position } from '../lib/types'
import type { TradingAccountState } from '../lib/tradingEngine'

interface PnLPanelProps {
  quotes: Record<string, Quote>
  tradingState?: TradingAccountState
  onClosePosition?: (symbol: string) => void
  onCancelOrder?: (orderId: string) => void
  onResetAccount?: () => void
}

type TabType = 'positions' | 'orders' | 'history'

export function PnLPanel({
  quotes,
  tradingState,
  onClosePosition,
  onCancelOrder,
  onResetAccount,
}: PnLPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('positions')

  // Convert tradingState positions map to array, or use demo positions
  const positionsArray: Position[] = useMemo(() => {
    if (tradingState?.positions) {
      return Object.values(tradingState.positions).filter((p) => p.qty > 0)
    }
    return []
  }, [tradingState?.positions])

  const pnl = useMemo(() => computePnl(positionsArray, quotes), [positionsArray, quotes])
  const cash = tradingState ? tradingState.cash : 100_000
  const totalEquity = cash + pnl.totalMarketValue
  const realizedPnl = tradingState ? tradingState.realizedPnl : 0
  const isUnrealizedUp = pnl.totalUnrealized >= 0
  const isRealizedUp = realizedPnl >= 0

  const openOrders = tradingState?.openOrders ?? []
  const tradeHistory = tradingState?.tradeHistory ?? []

  return (
    <div className="pnl">
      <div className="pnl-summary">
        <div className="pnl-block">
          <span className="pnl-label">
            Total Equity
            <Tooltip
              title="Total Portfolio Equity"
              content="Virtual cash plus the mark-to-market value of all open positions."
            />
          </span>
          <span className="mono pnl-equity">{formatCurrency0(totalEquity)}</span>
        </div>
        <div className="pnl-block">
          <span className="pnl-label">Cash</span>
          <span className="mono">{formatCurrency0(cash)}</span>
        </div>
        <div className="pnl-block">
          <span className="pnl-label">
            Unrealized P&L
            <Tooltip
              title="Unrealized P&L"
              content="Mark-to-market paper gain or loss across all open holdings based on current prices."
            />
          </span>
          <span className={`mono pnl-total ${isUnrealizedUp ? 'up' : 'down'}`}>
            {formatSignedCurrency(pnl.totalUnrealized)}
          </span>
          <span className={`mono pnl-pct ${isUnrealizedUp ? 'up' : 'down'}`}>
            {formatPercent(pnl.totalUnrealizedPct)}
          </span>
        </div>
        <div className="pnl-block">
          <span className="pnl-label">
            Realized P&L
            <Tooltip
              title="Realized P&L"
              content="Cumulative profit or loss locked in from sold or closed positions."
            />
          </span>
          <span className={`mono ${isRealizedUp ? 'up' : 'down'}`}>
            {formatSignedCurrency(realizedPnl)}
          </span>
        </div>
        {onResetAccount && (
          <button
            type="button"
            className="pnl-reset-btn"
            onClick={onResetAccount}
            title="Reset paper account balance and positions to default"
          >
            Reset
          </button>
        )}
      </div>

      <div className="pnl-tabs">
        <button
          type="button"
          className={`pnl-tab ${activeTab === 'positions' ? 'active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          Positions ({positionsArray.length})
        </button>
        <button
          type="button"
          className={`pnl-tab ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Open Orders ({openOrders.length})
        </button>
        <button
          type="button"
          className={`pnl-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Trade History ({tradeHistory.length})
        </button>
      </div>

      {activeTab === 'positions' && (
        <div className="pnl-table">
          <div className="pnl-row pnl-thead">
            <span>Symbol</span>
            <span>Qty</span>
            <span>Avg</span>
            <span>Last</span>
            <span>P&L</span>
            {onClosePosition && <span style={{ textAlign: 'right' }}>Action</span>}
          </div>
          {pnl.positions.length === 0 ? (
            <div className="pnl-empty">No open positions</div>
          ) : (
            pnl.positions.map((p) => {
              const rowUp = p.unrealized >= 0
              return (
                <div className="pnl-row" key={p.symbol}>
                  <span className="pnl-sym">{p.symbol}</span>
                  <span className="mono">{p.qty.toFixed(p.qty >= 10 ? 2 : 4)}</span>
                  <span className="mono pnl-dim">{formatPrice(p.avgPrice)}</span>
                  <span className="mono">{formatPrice(p.last)}</span>
                  <span className={`mono ${rowUp ? 'up' : 'down'}`}>
                    {formatSignedCurrency(p.unrealized)}
                  </span>
                  {onClosePosition && (
                    <span style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="pnl-close-btn"
                        onClick={() => onClosePosition(p.symbol)}
                      >
                        Close
                      </button>
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="pnl-table">
          <div className="pnl-row pnl-thead">
            <span>Symbol</span>
            <span>Side</span>
            <span>Type</span>
            <span>Limit</span>
            <span>Qty</span>
            {onCancelOrder && <span style={{ textAlign: 'right' }}>Action</span>}
          </div>
          {openOrders.length === 0 ? (
            <div className="pnl-empty">No open orders</div>
          ) : (
            openOrders.map((o) => (
              <div className="pnl-row" key={o.id}>
                <span className="pnl-sym">{o.symbol}</span>
                <span className={`mono ${o.side === 'BUY' ? 'up' : 'down'}`}>{o.side}</span>
                <span className="mono">{o.type}</span>
                <span className="mono">{formatPrice(o.price)}</span>
                <span className="mono">{o.qty}</span>
                {onCancelOrder && (
                  <span style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="pnl-cancel-btn"
                      onClick={() => onCancelOrder(o.id)}
                    >
                      Cancel
                    </button>
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="pnl-table">
          <div className="pnl-row pnl-thead">
            <span>Time</span>
            <span>Symbol</span>
            <span>Side</span>
            <span>Price</span>
            <span>Qty</span>
            <span style={{ textAlign: 'right' }}>Realized</span>
          </div>
          {tradeHistory.length === 0 ? (
            <div className="pnl-empty">No trade history yet</div>
          ) : (
            tradeHistory.slice(0, 50).map((t) => (
              <div className="pnl-row" key={t.id}>
                <span className="mono pnl-dim">
                  {new Date(t.timestamp).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className="pnl-sym">{t.symbol}</span>
                <span className={`mono ${t.side === 'BUY' ? 'up' : 'down'}`}>{t.side}</span>
                <span className="mono">{formatPrice(t.price)}</span>
                <span className="mono">{t.qty}</span>
                <span
                  className={`mono ${
                    t.realizedPnl === undefined
                      ? 'pnl-dim'
                      : t.realizedPnl >= 0
                      ? 'up'
                      : 'down'
                  }`}
                  style={{ textAlign: 'right' }}
                >
                  {t.realizedPnl !== undefined ? formatSignedCurrency(t.realizedPnl) : '—'}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
