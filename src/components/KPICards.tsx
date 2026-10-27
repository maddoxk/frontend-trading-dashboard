import { useMemo } from 'react'
import type { Quote } from '../lib/types'
import type { TradingAccountState } from '../lib/tradingEngine'
import type { ActiveScenario } from '../lib/marketFeed'
import { computePnl } from '../lib/pnl'
import { formatCurrency0, formatSignedCurrency, formatPercent, pctChange, formatPrice } from '../lib/format'
import { Tooltip } from './Tooltip'
import { SYMBOLS } from '../lib/marketFeed'

interface KPICardsProps {
  quotes: Record<string, Quote>
  tradingState: TradingAccountState
  activeScenario: ActiveScenario | null
  speed: number
  onSelectSymbol: (symbol: string) => void
}

export function KPICards({
  quotes,
  tradingState,
  activeScenario,
  speed,
  onSelectSymbol,
}: KPICardsProps) {
  // 1. Calculate Portfolio P&L metrics
  const positionsArray = useMemo(() => {
    return Object.values(tradingState.positions).filter((p) => p.qty > 0)
  }, [tradingState.positions])

  const pnl = useMemo(() => computePnl(positionsArray, quotes), [positionsArray, quotes])
  const totalEquity = tradingState.cash + pnl.totalMarketValue
  const totalCost = tradingState.initialCash
  const netReturnDollars = totalEquity - totalCost
  const netReturnPct = totalCost > 0 ? netReturnDollars / totalCost : 0
  const isNetReturnUp = netReturnDollars >= 0

  // 2. Identify top market performer
  const topMover = useMemo(() => {
    let bestSymbol = 'BTC'
    let bestChange = -Infinity
    for (const cfg of SYMBOLS) {
      const q = quotes[cfg.symbol]
      if (!q) continue
      const change = pctChange(q.price, q.open)
      if (change > bestChange) {
        bestChange = change
        bestSymbol = cfg.symbol
      }
    }
    const q = quotes[bestSymbol]
    const cfg = SYMBOLS.find((s) => s.symbol === bestSymbol)
    return {
      symbol: bestSymbol,
      name: cfg?.name ?? bestSymbol,
      price: q ? q.price : 0,
      change: Number.isFinite(bestChange) ? bestChange : 0,
    }
  }, [quotes])

  // 3. Assess overall market volatility pulse
  const marketPulse = useMemo(() => {
    if (activeScenario) {
      return {
        regime: activeScenario.label,
        level: 'Extreme',
        colorClass: 'pulse-extreme',
        desc: 'Macro shock scenario actively playing',
      }
    }
    if (speed >= 5) {
      return {
        regime: `High-Speed (${speed}x)`,
        level: 'Accelerated',
        colorClass: 'pulse-fast',
        desc: 'Feed running at accelerated multiplier',
      }
    }
    return {
      regime: 'Standard Market',
      level: 'Normal Vol',
      colorClass: 'pulse-normal',
      desc: 'Simulating standard continuous geometric Brownian paths',
    }
  }, [activeScenario, speed])

  const openOrdersCount = tradingState.openOrders.filter((o) => o.status === 'PENDING').length

  return (
    <div className="kpi-grid">
      {/* Card 1: Account Net Worth */}
      <div className="kpi-card">
        <div className="kpi-card-head">
          <span className="kpi-label">
            Portfolio Net Worth
            <Tooltip
              title="Portfolio Equity"
              content="Total paper trading equity: virtual cash + marked-to-market value of all open positions."
            />
          </span>
          <span className={`kpi-badge ${isNetReturnUp ? 'up' : 'down'}`}>
            {formatPercent(netReturnPct)}
          </span>
        </div>
        <div className="kpi-value mono">{formatCurrency0(totalEquity)}</div>
        <div className="kpi-footer">
          <span className="kpi-subtext">
            P&L: <b className={`mono ${isNetReturnUp ? 'up' : 'down'}`}>{formatSignedCurrency(netReturnDollars)}</b>
          </span>
          <span className="kpi-dim mono">Cash: {formatCurrency0(tradingState.cash)}</span>
        </div>
      </div>

      {/* Card 2: Top Gainer Asset */}
      <div
        className="kpi-card clickable"
        onClick={() => onSelectSymbol(topMover.symbol)}
        title={`Click to view ${topMover.symbol} chart`}
      >
        <div className="kpi-card-head">
          <span className="kpi-label">
            Top Gainer · 24h
            <Tooltip
              title="Market Leader"
              content="The instrument showing the largest percentage gain from its session open."
            />
          </span>
          <span className="kpi-badge up">
            +{formatPercent(topMover.change)}
          </span>
        </div>
        <div className="kpi-value">
          <span className="kpi-sym">{topMover.symbol}</span>
          <span className="kpi-price mono">{formatPrice(topMover.price)}</span>
        </div>
        <div className="kpi-footer">
          <span className="kpi-subtext">{topMover.name}</span>
          <span className="kpi-action-hint">View Chart →</span>
        </div>
      </div>

      {/* Card 3: Market Volatility Pulse */}
      <div className="kpi-card">
        <div className="kpi-card-head">
          <span className="kpi-label">
            Market Pulse
            <Tooltip
              title="Volatility Regime"
              content="Indicates active simulation conditions, playback speed, and whether a market shock is active."
            />
          </span>
          <span className={`kpi-pulse-badge ${marketPulse.colorClass}`}>
            <span className="kpi-pulse-dot" />
            {marketPulse.level}
          </span>
        </div>
        <div className="kpi-value kpi-regime-title">{marketPulse.regime}</div>
        <div className="kpi-footer">
          <span className="kpi-subtext">{marketPulse.desc}</span>
        </div>
      </div>

      {/* Card 4: Paper Trading Activity */}
      <div className="kpi-card">
        <div className="kpi-card-head">
          <span className="kpi-label">
            Trading Activity
            <Tooltip
              title="Execution Status"
              content="Number of open paper positions and queued limit orders awaiting price execution."
            />
          </span>
          <span className="kpi-badge neutral">
            {positionsArray.length} Holdings
          </span>
        </div>
        <div className="kpi-stats-row mono">
          <div className="kpi-stat-col">
            <span className="kpi-stat-num">{positionsArray.length}</span>
            <span className="kpi-stat-lbl">Positions</span>
          </div>
          <div className="kpi-stat-divider" />
          <div className="kpi-stat-col">
            <span className="kpi-stat-num">{openOrdersCount}</span>
            <span className="kpi-stat-lbl">Open Orders</span>
          </div>
          <div className="kpi-stat-divider" />
          <div className="kpi-stat-col">
            <span className="kpi-stat-num">{tradingState.tradeHistory.length}</span>
            <span className="kpi-stat-lbl">Total Fills</span>
          </div>
        </div>
      </div>
    </div>
  )
}
