/**
 * Geometric Brownian Motion price generator.
 *
 * The discretized GBM step is:
 *   S_{t+dt} = S_t * exp( (mu - sigma^2 / 2) * dt + sigma * sqrt(dt) * Z )
 * where Z ~ N(0, 1).
 *
 * This produces strictly-positive, log-normally distributed prices that are a
 * standard model for asset price paths.
 */

/**
 * A small seedable PRNG (mulberry32) so simulations are reproducible in tests.
 * Returns a function yielding uniform floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Box-Muller transform: convert two uniform randoms into one standard-normal
 * random variate.
 */
export function standardNormal(rng: () => number): number {
  let u = 0
  let v = 0
  // avoid log(0)
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

export interface GbmParams {
  /** annualized drift */
  mu: number
  /** annualized volatility */
  sigma: number
  /** time step as a fraction of a year */
  dt: number
}

/**
 * Advance a GBM price one step.
 * @param price current price (must be > 0)
 * @param params drift/volatility/dt
 * @param rng uniform random source in [0,1)
 */
export function gbmStep(
  price: number,
  params: GbmParams,
  rng: () => number = Math.random,
): number {
  const { mu, sigma, dt } = params
  const z = standardNormal(rng)
  const drift = (mu - (sigma * sigma) / 2) * dt
  const diffusion = sigma * Math.sqrt(dt) * z
  const next = price * Math.exp(drift + diffusion)
  // guard against degenerate values
  return next > 0 && Number.isFinite(next) ? next : price
}

/**
 * Generate a full price path of `steps` prices (excluding the start price).
 */
export function gbmPath(
  start: number,
  steps: number,
  params: GbmParams,
  rng: () => number = Math.random,
): number[] {
  const out: number[] = []
  let price = start
  for (let i = 0; i < steps; i++) {
    price = gbmStep(price, params, rng)
    out.push(price)
  }
  return out
}
