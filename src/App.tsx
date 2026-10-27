import { useEffect, useRef, useState, useCallback } from 'react'
import { useMarketFeed } from './hooks/useMarketFeed'
import { usePaperTrading } from './hooks/usePaperTrading'
import { Watchlist } from './components/Watchlist'
import { Ticker } from './components/Ticker'
import { OrderBook } from './components/OrderBook'
import { OrderEntry } from './components/OrderEntry'
import { PriceChart } from './components/PriceChart'
import { PnLPanel } from './components/PnLPanel'
import { SimulationControls } from './components/SimulationControls'
import { AlertsManager } from './components/AlertsManager'
import { ToastContainer } from './components/ToastContainer'
import { SYMBOLS } from './lib/marketFeed'
import {
  PriceAlert,
  ToastNotification,
  createPriceAlert,
  checkAlerts,
  loadAlerts,
  saveAlerts,
} from './lib/alerts'
import { playSound } from './lib/audio'
import { formatPrice, formatPercent, pctChange, abbreviateNumber } from './lib/format'
import './App.css'

const SPARK_LEN = 40
const PREFS_KEY = 'quantdesk_workspace_prefs_v1'

type LayoutMode = 'single' | 'dual-h' | 'dual-v'

interface WorkspacePreferences {
  layoutMode: LayoutMode
  showLeft: boolean
  showRight: boolean
  showTicker: boolean
  audioMuted: boolean
  secondarySymbol: string
}

function loadPreferences(): WorkspacePreferences {
  const defaults: WorkspacePreferences = {
    layoutMode: 'single',
    showLeft: true,
    showRight: true,
    showTicker: true,
    audioMuted: false,
    secondarySymbol: 'ETH',
  }
  if (typeof localStorage === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

function savePreferences(prefs: WorkspacePreferences): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage quota
  }
}

export default function App() {
  const {
    quotes,
    candles,
    running,
    speed,
    activeScenario,
    toggle,
    setSpeed,
    stepTick,
    injectScenario,
    clearScenario,
    updateSymbolParams,
    getSymbolParams,
    resetFeed,
  } = useMarketFeed()

  // Workspace configuration & state
  const [prefs, setPrefs] = useState<WorkspacePreferences>(() => loadPreferences())
  const [selected, setSelected] = useState('BTC')
  const [selectedOBPrice, setSelectedOBPrice] = useState<{ side: 'BUY' | 'SELL'; price: number; size: number } | null>(null)
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => loadAlerts())
  const [toasts, setToasts] = useState<ToastNotification[]>([])

  const { state: tradingState, executeOrder, cancel, close, reset } = usePaperTrading(quotes)

  // Save preferences on change
  useEffect(() => {
    savePreferences(prefs)
  }, [prefs])

  // Save alerts on change
  useEffect(() => {
    saveAlerts(alerts)
  }, [alerts])

  const addToast = useCallback((title: string, message: string, type: 'info' | 'success' | 'alert' = 'info') => {
    const id = 'tst-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6)
    setToasts((prev) => [...prev, { id, title, message, type, timestamp: Date.now() }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Check alerts against quotes on each tick
  useEffect(() => {
    if (alerts.length === 0) return
    const { remainingAlerts, triggeredAlerts } = checkAlerts(alerts, quotes)
    if (triggeredAlerts.length > 0) {
      setAlerts(remainingAlerts)
      for (const t of triggeredAlerts) {
        playSound('alert', prefs.audioMuted)
        addToast(
          `Alert Triggered: ${t.symbol}`,
          `${t.symbol} crossed ${t.direction === 'ABOVE' ? '≥' : '≤'} ${formatPrice(t.targetPrice)}`,
          'alert',
        )
      }
    }
  }, [quotes, alerts, prefs.audioMuted, addToast])

  // Wrap executeOrder with sound & toast notifications
  const handleExecuteOrder = useCallback(
    (params: Parameters<typeof executeOrder>[0]) => {
      const res = executeOrder(params)
      if (res.success) {
        playSound('trade', prefs.audioMuted)
        if (res.fill) {
          addToast(
            'Order Filled',
            `${res.fill.side} ${res.fill.qty} ${res.fill.symbol} @ ${formatPrice(res.fill.price)}`,
            'success',
          )
        }
      }
      return res
    },
    [executeOrder, prefs.audioMuted, addToast],
  )

  // Maintain rolling price history per symbol for sparklines
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

  const activeSecondary = quotes[prefs.secondarySymbol]
  const changeSecondary = activeSecondary ? pctChange(activeSecondary.price, activeSecondary.open) : 0
  const upSecondary = changeSecondary >= 0

  const handleAddAlert = (symbol: string, targetPrice: number) => {
    const currentPrice = quotes[symbol]?.price || targetPrice
    const newAlert = createPriceAlert(symbol, targetPrice, currentPrice)
    if (newAlert) {
      setAlerts((prev) => [...prev, newAlert])
      addToast('Alert Created', `Target ${symbol} ${newAlert.direction === 'ABOVE' ? '≥' : '≤'} ${formatPrice(targetPrice)}`)
    }
  }

  const handleRemoveAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  // Derive layout class based on panel visibility
  const layoutClass = [
    'layout',
    !prefs.showLeft && !prefs.showRight ? 'maximized' : '',
    !prefs.showLeft && prefs.showRight ? 'hide-left' : '',
    prefs.showLeft && !prefs.showRight ? 'hide-right' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◈</span>
          <span className="brand-name">QuantDesk</span>
          <span className="brand-sub">Trading Terminal</span>
        </div>

        <div className="topbar-right">
          <span className={`feed-status ${running ? 'live' : 'paused'}`}>
            <span className="dot" />
            {running ? 'LIVE FEED' : 'PAUSED'}
          </span>

          {/* Workspace Layout Controls */}
          <div className="ws-controls">
            <button
              type="button"
              className={`ws-btn ${prefs.layoutMode === 'single' ? 'active' : ''}`}
              onClick={() => setPrefs((p) => ({ ...p, layoutMode: 'single' }))}
              title="Single chart"
            >
              1 Chart
            </button>
            <button
              type="button"
              className={`ws-btn ${prefs.layoutMode === 'dual-h' ? 'active' : ''}`}
              onClick={() => setPrefs((p) => ({ ...p, layoutMode: 'dual-h' }))}
              title="Dual split horizontal"
            >
              Dual ◫
            </button>
            <button
              type="button"
              className={`ws-btn ${prefs.layoutMode === 'dual-v' ? 'active' : ''}`}
              onClick={() => setPrefs((p) => ({ ...p, layoutMode: 'dual-v' }))}
              title="Dual split vertical"
            >
              Dual ⬒
            </button>
            <button
              type="button"
              className={`ws-btn ${!prefs.showLeft && !prefs.showRight ? 'active' : ''}`}
              onClick={() =>
                setPrefs((p) => ({
                  ...p,
                  showLeft: !p.showLeft && !p.showRight ? true : false,
                  showRight: !p.showLeft && !p.showRight ? true : false,
                }))
              }
              title="Maximize chart view"
            >
              Full ⛶
            </button>
          </div>

          {/* Price Alerts & Audio Chimes */}
          <AlertsManager
            alerts={alerts}
            currentPrice={active?.price || 0}
            selectedSymbol={selected}
            audioMuted={prefs.audioMuted}
            onToggleMute={() => setPrefs((p) => ({ ...p, audioMuted: !p.audioMuted }))}
            onAddAlert={handleAddAlert}
            onRemoveAlert={handleRemoveAlert}
          />

          {/* Simulation Playback & Stress Engine */}
          <SimulationControls
            running={running}
            speed={speed}
            activeScenario={activeScenario}
            selectedSymbol={selected}
            onToggle={toggle}
            onSetSpeed={setSpeed}
            onStepTick={stepTick}
            onInjectScenario={injectScenario}
            onClearScenario={clearScenario}
            onUpdateParams={updateSymbolParams}
            onGetParams={getSymbolParams}
            onResetFeed={resetFeed}
          />
        </div>
      </header>

      {prefs.showTicker && <Ticker quotes={quotes} />}

      <main className={layoutClass}>
        {prefs.showLeft && (
          <aside className="col-left panel">
            <div className="panel-title">Watchlist</div>
            <Watchlist
              quotes={quotes}
              history={history}
              selected={selected}
              onSelect={setSelected}
            />
          </aside>
        )}

        <section className="col-center">
          {prefs.layoutMode === 'single' ? (
            <div className="panel chart-panel">
              <div className="chart-head">
                <div className="chart-id">
                  <span className="chart-sym">{selected}</span>
                  <span className="chart-name">{cfg?.name}</span>
                </div>
                {active && (
                  <div className="chart-quote">
                    <span className="mono chart-price">{formatPrice(active.price)}</span>
                    <span className={`mono chart-chg ${up ? 'up' : 'down'}`}>
                      {formatPercent(change)}
                    </span>
                  </div>
                )}
              </div>
              <div className="chart-body">
                <PriceChart symbol={selected} candle={candles[selected]} quote={active} />
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
          ) : (
            <div className={`dual-chart-container ${prefs.layoutMode === 'dual-h' ? 'horizontal' : 'vertical'}`}>
              {/* Primary Chart */}
              <div className="panel chart-panel">
                <div className="chart-head">
                  <div className="chart-id">
                    <span className="chart-sym">{selected}</span>
                    <span className="chart-name">{cfg?.name}</span>
                  </div>
                  {active && (
                    <div className="chart-quote">
                      <span className="mono chart-price">{formatPrice(active.price)}</span>
                      <span className={`mono chart-chg ${up ? 'up' : 'down'}`}>
                        {formatPercent(change)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="chart-body">
                  <PriceChart symbol={selected} candle={candles[selected]} quote={active} />
                </div>
              </div>

              {/* Secondary Chart */}
              <div className="panel chart-panel">
                <div className="chart-head">
                  <div className="chart-id">
                    <select
                      className="chart-select-secondary"
                      value={prefs.secondarySymbol}
                      onChange={(e) => setPrefs((p) => ({ ...p, secondarySymbol: e.target.value }))}
                    >
                      {SYMBOLS.map((s) => (
                        <option key={s.symbol} value={s.symbol}>
                          {s.symbol} · {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {activeSecondary && (
                    <div className="chart-quote">
                      <span className="mono chart-price">{formatPrice(activeSecondary.price)}</span>
                      <span className={`mono chart-chg ${upSecondary ? 'up' : 'down'}`}>
                        {formatPercent(changeSecondary)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="chart-body">
                  <PriceChart
                    symbol={prefs.secondarySymbol}
                    candle={candles[prefs.secondarySymbol]}
                    quote={activeSecondary}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="panel pnl-panel">
            <div className="panel-title">Portfolio & P&L</div>
            <PnLPanel
              quotes={quotes}
              tradingState={tradingState}
              onClosePosition={close}
              onCancelOrder={cancel}
              onResetAccount={reset}
            />
          </div>
        </section>

        {prefs.showRight && (
          <aside className="col-right">
            <div className="panel order-entry-panel">
              <div className="panel-title">Trade · {selected}</div>
              <OrderEntry
                symbol={selected}
                quote={active}
                tradingState={tradingState}
                selectedOrderBookPrice={selectedOBPrice}
                onPlaceOrder={handleExecuteOrder}
              />
            </div>

            <div className="panel orderbook-panel">
              <div className="panel-title">Order Book · {selected}</div>
              <OrderBook
                quote={active}
                onSelectPrice={(side, price, size) => setSelectedOBPrice({ side, price, size })}
              />
            </div>
          </aside>
        )}
      </main>

      <footer className="footer">
        <span>
          Simulated market data via geometric Brownian motion — not real prices.
        </span>
        <a href="https://github.com/maddoxk/frontend-trading-dashboard" target="_blank" rel="noreferrer">
          source on GitHub
        </a>
      </footer>

      {/* Floating in-app notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
