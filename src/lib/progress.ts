import type { EsitoEsame, Impostazioni, Progressi, StatoDomanda } from './types'

export function progressiVuoti(): Progressi {
  return { versione: 1, domande: {}, esami: [], andamento: [] }
}

export function statoVuoto(): StatoDomanda {
  return { visto: 0, corrette: 0, errate: 0, ultimo_esito: null, ultima_data: null, serie_corrette: 0, storia: [] }
}

/** Registra una risposta (una domanda non risposta all'esame va registrata come errata). */
export function registraRisposta(
  p: Progressi,
  id: number,
  corretta: boolean,
  now: number,
  cfg: Impostazioni,
): StatoDomanda {
  const s = p.domande[id] ?? statoVuoto()
  s.visto += 1
  if (corretta) {
    s.corrette += 1
    s.serie_corrette += 1
  } else {
    s.errate += 1
    s.serie_corrette = 0
  }
  s.ultimo_esito = corretta
  s.ultima_data = now
  s.storia = [...s.storia, corretta ? 1 : 0].slice(-cfg.preparazione.storia_max)
  p.domande[id] = s
  return s
}

export function registraEsame(p: Progressi, esito: EsitoEsame): void {
  p.esami.push(esito)
  if (p.esami.length > 500) p.esami = p.esami.slice(-500)
}

export function registraAndamento(p: Progressi, data: number, prob: number): void {
  p.andamento.push({ data, p: Math.round(prob * 10000) / 10000 })
  if (p.andamento.length > 1000) p.andamento = p.andamento.slice(-1000)
}

/** Da ripassare: sbagliate almeno una volta e non ancora risposte bene N volte di fila. */
export function daRipassare(p: Progressi, cfg: Impostazioni): number[] {
  return Object.entries(p.domande)
    .filter(([, s]) => s.errate > 0 && s.serie_corrette < cfg.ripasso.serie_richiesta)
    .map(([id]) => Number(id))
}

// --- Persistenza (localStorage) ed export/import ---

const KEY = 'simulatore-quiz-patente:progressi:v1'

export function caricaProgressi(): Progressi {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const p = validaProgressi(JSON.parse(raw))
      if (p) return p
    }
  } catch {
    /* storage non disponibile o dati corrotti */
  }
  return progressiVuoti()
}

export function salvaProgressi(p: Progressi): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

export function azzeraProgressi(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignora */
  }
}

export function esportaProgressi(p: Progressi, versioneListato: string | null): string {
  return JSON.stringify(
    { app: 'simulatore-quiz-patente', esportato: new Date().toISOString(), listato: versioneListato, progressi: p },
    null,
    1,
  )
}

export function importaProgressi(testo: string): Progressi {
  const obj = JSON.parse(testo)
  const p = validaProgressi(obj?.app === 'simulatore-quiz-patente' ? obj.progressi : obj)
  if (!p) throw new Error('File non valido: non contiene progressi del simulatore.')
  return p
}

function validaProgressi(x: unknown): Progressi | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Partial<Progressi>
  if (o.versione !== 1 || typeof o.domande !== 'object' || o.domande === null) return null
  for (const s of Object.values(o.domande)) {
    if (typeof s?.visto !== 'number' || !Array.isArray(s.storia)) return null
  }
  return {
    versione: 1,
    domande: o.domande,
    esami: Array.isArray(o.esami) ? o.esami : [],
    andamento: Array.isArray(o.andamento) ? o.andamento : [],
  }
}
