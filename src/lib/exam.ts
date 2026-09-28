import type { Domanda } from './types'

export type Risposta = boolean | null

export interface Correzione {
  errori: number
  corrette: number
  nonRisposte: number
  promosso: boolean
  /** Indici (nella scheda) delle domande sbagliate o senza risposta. */
  sbagliate: number[]
}

/** Correzione ufficiale: promosso con al massimo `erroriMax` errori; senza risposta = errore. */
export function correggi(scheda: Domanda[], risposte: Risposta[], erroriMax: number): Correzione {
  const sbagliate: number[] = []
  let nonRisposte = 0
  scheda.forEach((d, i) => {
    const r = risposte[i] ?? null
    if (r === null) nonRisposte++
    if (r !== d.risposta) sbagliate.push(i)
  })
  return {
    errori: sbagliate.length,
    corrette: scheda.length - sbagliate.length,
    nonRisposte,
    promosso: sbagliate.length <= erroriMax,
    sbagliate,
  }
}

// --- Timer basato sull'orologio (sopravvive al ricaricamento della pagina) ---

export interface Timer {
  inizio: number
  scadenza: number
}

export function creaTimer(now: number, durataMinuti: number): Timer {
  return { inizio: now, scadenza: now + durataMinuti * 60_000 }
}

export function tempoRimanente(t: Timer, now: number): number {
  return Math.max(0, t.scadenza - now)
}

export function scaduto(t: Timer, now: number): boolean {
  return now >= t.scadenza
}

export function formattaTempo(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
