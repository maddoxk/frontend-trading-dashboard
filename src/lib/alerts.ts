import type { Quote } from './types'

export type AlertDirection = 'ABOVE' | 'BELOW'

export interface PriceAlert {
  id: string
  symbol: string
  targetPrice: number
  direction: AlertDirection
  createdAt: number
  triggered?: boolean
  triggeredAt?: number
}

export interface ToastNotification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'alert'
  timestamp: number
}

const STORAGE_ALERTS_KEY = 'quantdesk_alerts_v1'

export function createPriceAlert(
  symbol: string,
  targetPrice: number,
  currentPrice: number,
): PriceAlert | null {
  if (!symbol || !Number.isFinite(targetPrice) || targetPrice <= 0) {
    return null
  }

  const direction: AlertDirection = targetPrice >= currentPrice ? 'ABOVE' : 'BELOW'
  return {
    id: 'alt-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7),
    symbol,
    targetPrice,
    direction,
    createdAt: Date.now(),
  }
}

export interface CheckAlertsResult {
  remainingAlerts: PriceAlert[]
  triggeredAlerts: PriceAlert[]
}

export function checkAlerts(
  alerts: PriceAlert[],
  quotes: Record<string, Quote>,
): CheckAlertsResult {
  if (!Array.isArray(alerts) || alerts.length === 0) {
    return { remainingAlerts: [], triggeredAlerts: [] }
  }

  const remaining: PriceAlert[] = []
  const triggered: PriceAlert[] = []

  for (const alt of alerts) {
    if (alt.triggered) {
      continue
    }

    const quote = quotes[alt.symbol]
    if (!quote) {
      remaining.push(alt)
      continue
    }

    const isTriggered =
      (alt.direction === 'ABOVE' && quote.high >= alt.targetPrice) ||
      (alt.direction === 'BELOW' && quote.low <= alt.targetPrice)

    if (isTriggered) {
      triggered.push({
        ...alt,
        triggered: true,
        triggeredAt: Date.now(),
      })
    } else {
      remaining.push(alt)
    }
  }

  return { remainingAlerts: remaining, triggeredAlerts: triggered }
}

export function loadAlerts(): PriceAlert[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_ALERTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveAlerts(alerts: PriceAlert[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_ALERTS_KEY, JSON.stringify(alerts))
  } catch {
    // Ignore storage quota errors
  }
}
