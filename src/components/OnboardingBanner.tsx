import { useState, useEffect } from 'react'

const ONBOARDING_STORAGE_KEY = 'quantdesk_dismissed_onboarding_v1'

interface OnboardingBannerProps {
  onSelectStep?: (step: 'asset' | 'shock' | 'trade') => void
}

export function OnboardingBanner({ onSelectStep }: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const isDismissed = localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
      setDismissed(isDismissed)
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
      } catch {
        // Ignore storage quota
      }
    }
  }

  const handleReopen = () => {
    setDismissed(false)
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    }
  }

  if (dismissed) {
    return (
      <button
        type="button"
        className="onboarding-reopen-btn"
        onClick={handleReopen}
        title="Open beginner walkthrough guide"
      >
        ✨ New to QuantDesk? Quick Tour
      </button>
    )
  }

  return (
    <div className="onboarding-card">
      <div className="onboarding-head">
        <div className="onboarding-title-group">
          <span className="onboarding-badge">Beginner Walkthrough</span>
          <h3 className="onboarding-title">Welcome to QuantDesk — Your Risk-Free Trading Sandbox</h3>
          <p className="onboarding-desc">
            Prices stream in real-time using geometric Brownian motion (GBM). No real money, no API keys.
            Test trading strategies and stress-test market liquidity in seconds.
          </p>
        </div>
        <button
          type="button"
          className="onboarding-close-btn"
          onClick={handleDismiss}
          title="Dismiss guide"
        >
          ✕ Dismiss
        </button>
      </div>

      <div className="onboarding-steps">
        <div
          className="onboarding-step clickable"
          onClick={() => onSelectStep?.('asset')}
          title="Click to explore instruments"
        >
          <div className="onboarding-step-num">1</div>
          <div className="onboarding-step-info">
            <span className="onboarding-step-title">Select an Instrument</span>
            <span className="onboarding-step-text">Choose BTC, ETH, AAPL, or NVDA from the watchlist to load live charts.</span>
          </div>
        </div>

        <div
          className="onboarding-step clickable"
          onClick={() => onSelectStep?.('shock')}
          title="Click to test market scenarios"
        >
          <div className="onboarding-step-num">2</div>
          <div className="onboarding-step-info">
            <span className="onboarding-step-title">Test a Market Shock</span>
            <span className="onboarding-step-text">Use the top bar to trigger a ⚡ Flash Crash or 🚀 Short Squeeze in real-time.</span>
          </div>
        </div>

        <div
          className="onboarding-step clickable"
          onClick={() => onSelectStep?.('trade')}
          title="Click to place paper trades"
        >
          <div className="onboarding-step-num">3</div>
          <div className="onboarding-step-info">
            <span className="onboarding-step-title">Place Your First Trade</span>
            <span className="onboarding-step-text">Execute Market or Limit orders with your $100,000 paper balance.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
