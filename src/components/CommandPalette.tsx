import { useState, useEffect, useRef } from 'react'
import { SYMBOLS, SimulationScenario } from '../lib/marketFeed'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectSymbol: (symbol: string) => void
  onInjectScenario: (scenario: SimulationScenario, durationSec?: number) => void
  onSetLayout: (layout: 'single' | 'dual-h' | 'dual-v') => void
  onResetAccount: () => void
}

interface PaletteAction {
  id: string
  category: 'Asset' | 'Simulation' | 'Layout' | 'Account'
  title: string
  subtitle: string
  shortcut?: string
  run: () => void
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectSymbol,
  onInjectScenario,
  onSetLayout,
  onResetAccount,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Build searchable items list
  const actions: PaletteAction[] = [
    // 1. Assets
    ...SYMBOLS.map((s) => ({
      id: `asset-${s.symbol}`,
      category: 'Asset' as const,
      title: `${s.symbol} · ${s.name}`,
      subtitle: `Open ${s.symbol} candlestick chart & order book`,
      run: () => {
        onSelectSymbol(s.symbol)
        onClose()
      },
    })),
    // 2. Scenarios
    {
      id: 'scen-crash',
      category: 'Simulation' as const,
      title: '⚡ Inject Flash Crash (-15%)',
      subtitle: 'Simulate high-velocity liquidity drain and rapid price collapse',
      run: () => {
        onInjectScenario('FLASH_CRASH', 15)
        onClose()
      },
    },
    {
      id: 'scen-squeeze',
      category: 'Simulation' as const,
      title: '🚀 Inject Short Squeeze (+25%)',
      subtitle: 'Simulate parabolic breakout with massive volume spikes',
      run: () => {
        onInjectScenario('SHORT_SQUEEZE', 15)
        onClose()
      },
    },
    {
      id: 'scen-vol',
      category: 'Simulation' as const,
      title: '🌊 High Volatility Regime (4x)',
      subtitle: 'Expand volatility parameter σ for sharp whipsaws',
      run: () => {
        onInjectScenario('HIGH_VOLATILITY', 20)
        onClose()
      },
    },
    {
      id: 'scen-bull',
      category: 'Simulation' as const,
      title: '📈 Bull Market Trend (+Trend)',
      subtitle: 'Simulate continuous positive drift with low volatility',
      run: () => {
        onInjectScenario('BULL_RUN', 20)
        onClose()
      },
    },
    // 3. Layouts
    {
      id: 'layout-single',
      category: 'Layout' as const,
      title: 'Switch to Single Chart View',
      subtitle: 'Standard full-height chart layout',
      run: () => {
        onSetLayout('single')
        onClose()
      },
    },
    {
      id: 'layout-dual-h',
      category: 'Layout' as const,
      title: 'Switch to Dual Split View (Horizontal)',
      subtitle: 'Compare two instruments side-by-side',
      run: () => {
        onSetLayout('dual-h')
        onClose()
      },
    },
    // 4. Account
    {
      id: 'account-reset',
      category: 'Account' as const,
      title: 'Reset Paper Trading Account',
      subtitle: 'Restore starting $100k balance and default positions',
      run: () => {
        onResetAccount()
        onClose()
      },
    },
  ]

  // Filter actions based on query
  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase()),
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].run()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-search-wrap">
          <span className="cmd-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-input"
            placeholder="Type a command or search symbol (e.g. BTC, Flash Crash, Split)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
          />
          <span className="cmd-esc-badge">ESC</span>
        </div>

        <div className="cmd-results">
          {filtered.length === 0 ? (
            <div className="cmd-empty">No commands matching "{query}"</div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.id}
                className={`cmd-item ${idx === selectedIndex ? 'active' : ''}`}
                onClick={() => item.run()}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="cmd-item-main">
                  <span className="cmd-item-title">{item.title}</span>
                  <span className="cmd-item-sub">{item.subtitle}</span>
                </div>
                <span className="cmd-item-cat">{item.category}</span>
              </div>
            ))
          )}
        </div>

        <div className="cmd-footer">
          <span>↑↓ to navigate</span>
          <span>↵ to execute</span>
          <span>esc to close</span>
        </div>
      </div>
    </div>
  )
}
