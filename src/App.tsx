import { useEffect, useRef, useState } from 'react'
import { useMarketFeed } from './hooks/useMarketFeed'
import { Watchlist } from './components/Watchlist'
import { Ticker } from './components/Ticker'
import { OrderBook } from './components/OrderBook'
import { PriceChart } from './components/PriceChart'
import { PnLPanel } from './components/PnLPanel'
import { SYMBOLS } from './lib/marketFeed'
import { formatPrice, formatPercent, pctChange, abbreviateNumber } from './lib/format'
import './App.css'

const SPARK_LEN = 40

export default function App() {
  const { quotes, candles, running, toggle } = useMarketFeed()
  const [selected, setSelected] = useState('BTC')

  // maintain a rolling price history per symbol for sparklines
  const [history, setHistory] = useState<Record<string, number[]>>({})
  const lastSampled = useRef(0)
  useEffect(() => {
    const now = Date.now()
    if (now - lastSampled.current < 400) return
    lastSampled.current = now
    setHistory((prev) => {
      const next: Record<string, number[]> = { ...prev }
      for (const cfg of SYMBOLS) {
        const q = quotes[cfg.symbol]
        if (!q) continue
        const arr = next[cfg.symbol] ? [...next[cfg.symbol]] : []
        arr.push(q.price)
        if (arr.length > SPARK_LEN) arr.shift()
        next[cfg.symbol] = arr
      }
      return next
    })
  }, [quotes])

  const active = quotes[selected]
  const cfg = SYMBOLS.find((s) => s.symbol === selected)
  const change = active ? pctChange(active.price, active.open) : 0
  const up = change >= 0

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-name">QuantDesk</span>
          <span className="brand-sub">Trading Dashboard</span>
        </div>
        <div className="topbar-right">
          <span className={`feed-status ${running ? "live" : "paused"}`}>
            <span className="dot" />
            {running ? "LIVE FEED" : "PAUSED"}
          </span>
          <button className="ctrl-btn" onClick={toggle}>
            {running ? "Pause" : "Resume"}
          </button>
        </div>
      </header>

      <Ticker quotes={quotes} />

      <main className="layout">
        <aside className="col-left panel">
          <div className="panel-title">Watchlist</div>
          <Watchlist
            quotes={quotes}
            history={history}
            selected={selected}
            onSelect={setSelected}
          />
        </aside>

        <section className="col-center">
          <div className="panel chart-panel">
            <div className="chart-head">
              <div className="chart-id">
                <span className="chart-sym">{selected}</span>
                <span className="chart-name">{cfg?.name}</span>
              </div>
              {active && (
                <div className="chart-quote">
                  <span className="mono chart-price">{formatPrice(active.price)}</span>
                  <span className={`mono chart-chg ${up ? "up" : "down"}`}>
                    {formatPercent(change)}
                  </span>
                </div>
              )}
            </div>
            <div className="chart-body">
              <PriceChart symbol={selected} candle={candles[selected]} />
            </div>
            {active && (
              <div className="chart-stats mono">
                <span>O <b>{formatPrice(active.open)}</b></span>
                <span>H <b className="up">{formatPrice(active.high)}</b></span>
                <span>L <b className="down">{formatPrice(active.low)}</b></span>
                <span>Vol <b>{abbreviateNumber(active.volume)}</b></span>
              </div>
            )}
          </div>

          <div className="panel pnl-panel">
            <div className="panel-title">Portfolio P&L</div>
            <PnLPanel quotes={quotes} />
          </div>
        </section>

        <aside className="col-right panel">
          <div className="panel-title">Order Book · {selected}</div>
          <OrderBook quote={active} />
        </aside>
      </main>

      <footer className="footer">
        <span>
          Simulated market data via geometric Brownian motion — not real prices.
        </span>
        <a href="https://github.com/maddoxk/frontend-trading-dashboard" target="_blank" rel="noreferrer">
          source on GitHub
        </a>
      </footer>
    </div>
  )
}
