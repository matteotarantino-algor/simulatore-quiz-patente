import { sampleUniform, sampleWeighted, shuffle } from './rng'
import type { Argomento, Domanda, Impostazioni, Progressi, Rng, StatoDomanda } from './types'

const GIORNO_MS = 86_400_000

/**
 * Priorità di una domanda già vista (più alta = proposta più spesso).
 * Vedi README, sezione "Selezione intelligente", per il significato dei parametri.
 */
export function pesoDomanda(s: StatoDomanda, now: number, cfg: Impostazioni): number {
  const c = cfg.selezione
  const giorni = s.ultima_data == null ? Infinity : (now - s.ultima_data) / GIORNO_MS
  if (s.ultimo_esito === false) {
    return (
      c.peso_errata +
      c.peso_per_errore * Math.min(s.errate, c.errori_max_conteggiati) +
      (giorni <= c.giorni_errore_recente ? c.bonus_errore_recente : 0)
    )
  }
  if (s.serie_corrette >= c.serie_consolidata) return c.peso_consolidata
  if (s.visto === 1 && s.corrette === 1) return c.peso_indovinata_una_volta
  if (giorni >= c.giorni_vista_tempo_fa) return c.peso_vista_tempo_fa
  if (s.errate > 0) return c.peso_in_consolidamento
  return c.peso_normale
}

/**
 * Sceglie n domande distinte da un insieme:
 * 1. prima le mai viste (estratte a caso);
 * 2. se non bastano, le altre con estrazione pesata sulla priorità, mescolata alla media
 *    in misura `componente_casuale` per non riproporre sempre le stesse.
 */
export function scegliDaInsieme(
  insieme: Domanda[],
  n: number,
  prog: Progressi,
  now: number,
  cfg: Impostazioni,
  rng: Rng,
): Domanda[] {
  const nonViste = insieme.filter((d) => !(prog.domande[d.id]?.visto > 0))
  if (nonViste.length >= n) return sampleUniform(nonViste, n, rng)

  const viste = insieme.filter((d) => prog.domande[d.id]?.visto > 0)
  const pesi = viste.map((d) => pesoDomanda(prog.domande[d.id], now, cfg))
  const media = pesi.reduce((a, b) => a + b, 0) / (pesi.length || 1)
  const k = cfg.selezione.componente_casuale
  const pesiMisti = pesi.map((w) => (1 - k) * w + k * media)
  const altre = sampleWeighted(viste, pesiMisti, n - nonViste.length, rng)
  return shuffle([...nonViste, ...altre], rng)
}

export function perArgomento(domande: Domanda[]): Map<number, Domanda[]> {
  const m = new Map<number, Domanda[]>()
  for (const d of domande) {
    const list = m.get(d.argomento_id)
    if (list) list.push(d)
    else m.set(d.argomento_id, [d])
  }
  return m
}

/**
 * Scheda d'esame: `quota` domande per ciascun argomento, ordinate per argomento
 * come le schede ministeriali. "realistico" = estrazione puramente casuale.
 */
export function generaScheda(
  domande: Domanda[],
  argomenti: Argomento[],
  prog: Progressi,
  modo: 'intelligente' | 'realistico',
  now: number,
  cfg: Impostazioni,
  rng: Rng,
): Domanda[] {
  const gruppi = perArgomento(domande)
  const scheda: Domanda[] = []
  for (const a of [...argomenti].sort((x, y) => x.id - y.id)) {
    const pool = gruppi.get(a.id) ?? []
    const scelte =
      modo === 'realistico' ? sampleUniform(pool, a.quota, rng) : scegliDaInsieme(pool, a.quota, prog, now, cfg, rng)
    scheda.push(...scelte)
  }
  return scheda
}

export function generaSessioneArgomento(
  domande: Domanda[],
  argomentoIds: number[],
  n: number,
  prog: Progressi,
  now: number,
  cfg: Impostazioni,
  rng: Rng,
): Domanda[] {
  const ids = new Set(argomentoIds)
  return scegliDaInsieme(domande.filter((d) => ids.has(d.argomento_id)), n, prog, now, cfg, rng)
}

/** Ripasso errori: domande ancora da consolidare, priorità alle sbagliate più di recente/più volte. */
export function generaRipasso(
  domande: Domanda[],
  idsDaRipassare: number[],
  n: number,
  prog: Progressi,
  now: number,
  cfg: Impostazioni,
  rng: Rng,
): Domanda[] {
  const ids = new Set(idsDaRipassare)
  const pool = domande.filter((d) => ids.has(d.id))
  const pesi = pool.map((d) => pesoDomanda(prog.domande[d.id], now, cfg))
  return shuffle(sampleWeighted(pool, pesi, n, rng), rng)
}
