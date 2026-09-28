import type { Rng } from './types'

/** Generatore pseudo-casuale con seme (mulberry32): riproducibile nei test. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function randomSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** n elementi distinti, estratti in modo uniforme. */
export function sampleUniform<T>(items: T[], n: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, Math.min(n, items.length))
}

/**
 * n elementi distinti con probabilità proporzionale al peso
 * (Efraimidis–Spirakis: chiave = u^(1/w), si prendono le n chiavi più alte).
 */
export function sampleWeighted<T>(items: T[], weights: number[], n: number, rng: Rng): T[] {
  const keyed = items.map((item, i) => {
    const w = Math.max(weights[i], 1e-9)
    return { item, key: Math.pow(rng() || 1e-12, 1 / w) }
  })
  keyed.sort((x, y) => y.key - x.key)
  return keyed.slice(0, Math.min(n, items.length)).map((k) => k.item)
}
