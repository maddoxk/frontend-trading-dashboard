import { useState, useEffect } from 'react'
import type { SimulationScenario, ActiveScenario } from '../lib/marketFeed'
import { Tooltip } from './Tooltip'

interface SimulationControlsProps {
  running: boolean
  speed: number
  activeScenario: ActiveScenario | null
  selectedSymbol: string
  onToggle: () => void
  onSetSpeed: (speed: number) => void
  onStepTick: () => void
  onInjectScenario: (scenario: SimulationScenario, durationSec?: number) => void
  onClearScenario: () => void
  onUpdateParams: (symbol: string, params: { drift?: number; volatility?: number }) => void
  onGetParams: (symbol: string) => { drift: number; volatility: number }
  onResetFeed: () => void
}

export function SimulationControls({
  running,
  speed,
  activeScenario,
  selectedSymbol,
  onToggle,
  onSetSpeed,
  onStepTick,
  onInjectScenario,
  onClearScenario,
  onUpdateParams,
  onGetParams,
  onResetFeed,
}: SimulationControlsProps) {
  const [showConfig, setShowConfig] = useState(false)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)

  // Current symbol params
  const currentParams = onGetParams(selectedSymbol)
  const [driftInput, setDriftInput] = useState<number>(currentParams.drift)
  const [volInput, setVolInput] = useState<number>(currentParams.volatility)

  // Sync inputs when selected symbol changes
  useEffect(() => {
    const p = onGetParams(selectedSymbol)
    setDriftInput(p.drift)
    setVolInput(p.volatility)
  }, [selectedSymbol, onGetParams])

  // Timer countdown for active scenario
  useEffect(() => {
    if (!activeScenario) {
      setRemainingSec(null)
      return
    }
    const update = () => {
      const elapsed = Date.now() - activeScenario.startedAt
      const left = Math.max(0, Math.ceil((activeScenario.durationMs - elapsed) / 1000))
      setRemainingSec(left)
      if (left <= 0) {
        onClearScenario()
      }
    }
    update()
    const interval = setInterval(update, 500)
    return () => clearInterval(interval)
  }, [activeScenario, onClearScenario])

  const handleApplyParams = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdateParams(selectedSymbol, { drift: driftInput, volatility: volInput })
  }

  return (
    <div className="sim-controls">
      {/* Active scenario pill */}
      {activeScenario && remainingSec !== null && remainingSec > 0 && (
        <div className="sim-scenario-badge">
          <span className="sim-badge-dot" />
          <span>{activeScenario.label} ({remainingSec}s)</span>
          <button
            type="button"
            className="sim-badge-close"
            onClick={onClearScenario}
            title="Cancel scenario"
          >
            ✕
          </button>
        </div>
      )}

      {/* Speed buttons */}
      <div className="sim-speed-group">
        {[0.5, 1, 2, 5, 10].map((s) => (
          <button
            key={s}
            type="button"
            className={`sim-speed-btn ${speed === s ? 'active' : ''}`}
            onClick={() => onSetSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* Step tick button when paused */}
      {!running && (
        <button
          type="button"
          className="sim-step-btn"
          onClick={onStepTick}
          title="Advance market by 1 tick"
        >
          Step ❯
        </button>
      )}

      {/* Scenario dropdown */}
      <div className="sim-dropdown-wrap">
        <select
          className="sim-scenario-select"
          value={activeScenario?.type ?? 'NONE'}
          onChange={(e) => onInjectScenario(e.target.value as SimulationScenario, 15)}
        >
          <option value="NONE">⚡ Inject Shock...</option>
          <option value="FLASH_CRASH">⚡ Flash Crash (-15%)</option>
          <option value="SHORT_SQUEEZE">🚀 Short Squeeze (+25%)</option>
          <option value="HIGH_VOLATILITY">🌊 High Volatility (4x)</option>
          <option value="BULL_RUN">📈 Bull Run (+Trend)</option>
        </select>
      </div>

      {/* Settings drawer toggle */}
      <button
        type="button"
        className={`ctrl-btn sim-tune-btn ${showConfig ? 'active' : ''}`}
        onClick={() => setShowConfig(!showConfig)}
        title="Simulation parameters"
      >
        ⚙ Tuner
      </button>

      {/* Play/Pause control */}
      <button className="ctrl-btn" onClick={onToggle}>
        {running ? 'Pause' : 'Resume'}
      </button>

      {/* Parameter tuning drawer/modal */}
      {showConfig && (
        <div className="sim-drawer">
          <div className="sim-drawer-head">
            <span className="sim-drawer-title">Simulation Tuner · {selectedSymbol}</span>
            <button
              type="button"
              className="sim-drawer-close"
              onClick={() => setShowConfig(false)}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleApplyParams} className="sim-drawer-body">
            <div className="sim-drawer-field">
              <label>
                <span>
                  Annualized Drift (μ)
                  <Tooltip
                    title="Geometric Brownian Drift (μ)"
                    content="Expected annualized percentage return trend. Positive = upward drift, negative = downward drift."
                  />
                </span>
                <b>{driftInput.toFixed(2)}</b>
              </label>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.05"
                value={driftInput}
                onChange={(e) => setDriftInput(parseFloat(e.target.value))}
              />
            </div>

            <div className="sim-drawer-field">
              <label>
                <span>
                  Volatility (σ)
                  <Tooltip
                    title="Annualized Volatility (σ)"
                    content="Standard deviation of price changes. Higher values generate larger continuous random walks."
                  />
                </span>
                <b>{volInput.toFixed(2)}</b>
              </label>
              <input
                type="range"
                min="0.05"
                max="2.5"
                step="0.05"
                value={volInput}
                onChange={(e) => setVolInput(parseFloat(e.target.value))}
              />
            </div>

            <div className="sim-drawer-actions">
              <button type="submit" className="sim-apply-btn">
                Apply to {selectedSymbol}
              </button>
              <button
                type="button"
                className="sim-reset-feed-btn"
                onClick={() => {
                  onResetFeed()
                  const p = onGetParams(selectedSymbol)
                  setDriftInput(p.drift)
                  setVolInput(p.volatility)
                }}
              >
                Reset Feed
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
