import { describe, it, expect } from 'vitest'
import { mulberry32, standardNormal, gbmStep, gbmPath } from './gbm'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect(a()).toBe(b())
    expect(a()).toBe(b())
  })
  it('yields values within [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('standardNormal', () => {
  it('produces a roughly zero mean over many samples', () => {
    const rng = mulberry32(123)
    let sum = 0
    const n = 20000
    for (let i = 0; i < n; i++) sum += standardNormal(rng)
    const mean = sum / n
    expect(Math.abs(mean)).toBeLessThan(0.05)
  })
  it('produces a roughly unit variance', () => {
    const rng = mulberry32(321)
    const n = 20000
    const vals: number[] = []
    for (let i = 0; i < n; i++) vals.push(standardNormal(rng))
    const mean = vals.reduce((a, b) => a + b, 0) / n
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n
    expect(variance).toBeGreaterThan(0.9)
    expect(variance).toBeLessThan(1.1)
  })
})

describe('gbmStep', () => {
  it('keeps prices strictly positive', () => {
    const rng = mulberry32(99)
    let price = 100
    for (let i = 0; i < 5000; i++) {
      price = gbmStep(price, { mu: 0.1, sigma: 0.8, dt: 1 / 252 }, rng)
      expect(price).toBeGreaterThan(0)
      expect(Number.isFinite(price)).toBe(true)
    }
  })
  it('is reproducible with a seeded rng', () => {
    const p1 = gbmStep(100, { mu: 0.1, sigma: 0.3, dt: 0.01 }, mulberry32(5))
    const p2 = gbmStep(100, { mu: 0.1, sigma: 0.3, dt: 0.01 }, mulberry32(5))
    expect(p1).toBe(p2)
  })
  it('with zero volatility grows by the drift term', () => {
    // sigma=0 => S * exp(mu*dt), deterministic regardless of rng
    const next = gbmStep(100, { mu: 0.2, sigma: 0, dt: 0.5 }, mulberry32(1))
    expect(next).toBeCloseTo(100 * Math.exp(0.2 * 0.5), 6)
  })
})

describe('gbmPath', () => {
  it('returns the requested number of steps', () => {
    const path = gbmPath(100, 50, { mu: 0.1, sigma: 0.4, dt: 1 / 252 }, mulberry32(11))
    expect(path).toHaveLength(50)
  })
  it('has a positive long-run drift on average with positive mu', () => {
    // average terminal price across many seeds should exceed the start
    let sum = 0
    const trials = 200
    for (let s = 0; s < trials; s++) {
      const path = gbmPath(100, 252, { mu: 0.5, sigma: 0.2, dt: 1 / 252 }, mulberry32(s + 1))
      sum += path[path.length - 1]
    }
    expect(sum / trials).toBeGreaterThan(100)
  })
})
