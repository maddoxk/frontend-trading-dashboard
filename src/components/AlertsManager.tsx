import { useState } from 'react'
import type { PriceAlert } from '../lib/alerts'
import { formatPrice } from '../lib/format'

interface AlertsManagerProps {
  alerts: PriceAlert[]
  currentPrice: number
  selectedSymbol: string
  audioMuted: boolean
  onToggleMute: () => void
  onAddAlert: (symbol: string, targetPrice: number) => void
  onRemoveAlert: (id: string) => void
}

export function AlertsManager({
  alerts,
  currentPrice,
  selectedSymbol,
  audioMuted,
  onToggleMute,
  onAddAlert,
  onRemoveAlert,
}: AlertsManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [targetInput, setTargetInput] = useState<string>('')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const numericTarget = parseFloat(targetInput)
    if (isNaN(numericTarget) || numericTarget <= 0) return
    onAddAlert(selectedSymbol, numericTarget)
    setTargetInput('')
  }

  return (
    <div className="alerts-manager">
      <button
        type="button"
        className={`ctrl-btn alerts-toggle-btn ${alerts.length > 0 ? 'has-alerts' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Price alerts"
      >
        🔔 {alerts.length > 0 ? alerts.length : ''}
      </button>

      <button
        type="button"
        className={`ctrl-btn audio-toggle-btn ${audioMuted ? 'muted' : ''}`}
        onClick={onToggleMute}
        title={audioMuted ? 'Unmute audio notifications' : 'Mute audio notifications'}
      >
        {audioMuted ? '🔇' : '🔊'}
      </button>

      {isOpen && (
        <div className="alerts-dropdown">
          <div className="alerts-head">
            <span className="alerts-title">Price Alerts</span>
            <button
              type="button"
              className="alerts-close"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleAdd} className="alerts-form">
            <div className="alerts-input-row">
              <span className="alerts-sym">{selectedSymbol}</span>
              <input
                type="number"
                step="any"
                min="0.0001"
                placeholder={`Target (Now: ${formatPrice(currentPrice)})`}
                className="alerts-input mono"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                required
              />
              <button type="submit" className="alerts-add-btn">
                + Set
              </button>
            </div>
          </form>

          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="alerts-empty">No active price alerts</div>
            ) : (
              alerts.map((alt) => (
                <div className="alerts-item mono" key={alt.id}>
                  <div className="alerts-item-info">
                    <span className="alerts-item-sym">{alt.symbol}</span>
                    <span className={`alerts-item-dir ${alt.direction.toLowerCase()}`}>
                      {alt.direction === 'ABOVE' ? '▲ ≥' : '▼ ≤'} {formatPrice(alt.targetPrice)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="alerts-del-btn"
                    onClick={() => onRemoveAlert(alt.id)}
                    title="Delete alert"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
