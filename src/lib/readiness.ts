import { perArgomento } from './selection'
import type { Argomento, Domanda, Impostazioni, Progressi, Rng, StatoDomanda } from './types'

/** Successi e tentativi pesati: peso d^k alla k-esima risposta più vecchia (k = 0 la più recente). */
function conteggiPesati(s: StatoDomanda, d: number): [number, number] {
  let succ = 0
  let tot = 0
  const n = s.storia.length
  for (let i = 0; i < n; i++) {
    const w = Math.pow(d, n - 1 - i)
    succ += w * s.storia[i]
    tot += w
  }
  return [succ, tot]
}

/**
 * Probabilità stimata di rispondere giusto a una domanda già vista:
 * (successi pesati + f·m) / (tentativi pesati + f), dove m è l'accuratezza media
 * nell'argomento e f = forza_prior_domanda. Con m = 0,5 e f = 2 è la formula
 * (corrette + 1) / (viste + 2); usare m al posto di 0,5 evita che anche chi risponde
 * sempre giusto resti bloccato intorno all'80% per domanda. null se mai vista.
 */
export function probabilitaDomanda(s: StatoDomanda | undefined, cfg: Impostazioni, mediaArgomento = 0.5): number | null {
  if (!s || s.visto === 0 || s.storia.length === 0) return null
  const [succ, tot] = conteggiPesati(s, cfg.preparazione.decadimento_storia)
  const f = cfg.preparazione.forza_prior_domanda
  return (succ + f * mediaArgomento) / (tot + f)
}

/**
 * Probabilità per ogni domanda di ciascun argomento.
 * - m = accuratezza pesata di tutte le risposte date nell'argomento: (S + 1) / (T + 2).
 * - Domande viste: probabilitaDomanda con media m.
 * - Non viste: m "tirata" verso un valore prudente (prior_non_viste) con forza forza_prior:
 *   con poche domande viste nell'argomento prevale il valore prudente.
 */
export function probabilitaPerArgomento(
  domande: Domanda[],
  prog: Progressi,
  cfg: Impostazioni,
): Map<number, number[]> {
  const { prior_non_viste: prior, forza_prior: forza, decadimento_storia: d } = cfg.preparazione
  const out = new Map<number, number[]>()
  for (const [argId, lista] of perArgomento(domande)) {
    let S = 0
    let T = 0
    let nViste = 0
    for (const q of lista) {
      const s = prog.domande[q.id]
      if (!s || s.storia.length === 0) continue
      const [succ, tot] = conteggiPesati(s, d)
      S += succ
      T += tot
      nViste++
    }
    const m = (S + 1) / (T + 2)
    const pNonViste = (nViste * m + forza * prior) / (nViste + forza)
    out.set(
      argId,
      lista.map((q) => probabilitaDomanda(prog.domande[q.id], cfg, m) ?? pNonViste),
    )
  }
  return out
}

/**
 * Monte Carlo: genera `simulazioni` schede con la ripartizione ufficiale per argomento
 * (estrazione casuale senza ripetizioni) e stima P(errori ≤ erroriMax).
 */
export function probabilitaSuperamento(
  domande: Domanda[],
  argomenti: Argomento[],
  prog: Progressi,
  cfg: Impostazioni,
  rng: Rng,
  simulazioni = cfg.preparazione.simulazioni,
): number {
  const probs = probabilitaPerArgomento(domande, prog, cfg)
  const erroriMax = cfg.esame.errori_max
  let promossi = 0
  for (let s = 0; s < simulazioni; s++) {
    let errori = 0
    for (const a of argomenti) {
      const p = probs.get(a.id) ?? []
      const scelti = new Set<number>()
      while (scelti.size < Math.min(a.quota, p.length)) scelti.add(Math.floor(rng() * p.length))
      for (const i of scelti) if (rng() >= p[i]) errori++
      if (errori > erroriMax) break
    }
    if (errori <= erroriMax) promossi++
  }
  return promossi / simulazioni
}

export interface IndicatoriArgomento {
  argomento: Argomento
  totale: number
  viste: number
  consolidate: number
  copertura: number
  padronanza: number
}

export function indicatori(domande: Domanda[], argomenti: Argomento[], prog: Progressi, cfg: Impostazioni) {
  const gruppi = perArgomento(domande)
  const serie = cfg.preparazione.serie_padronanza
  const perArg: IndicatoriArgomento[] = argomenti.map((a) => {
    const lista = gruppi.get(a.id) ?? []
    let viste = 0
    let consolidate = 0
    for (const d of lista) {
      const s = prog.domande[d.id]
      if (s?.visto) viste++
      if (s && s.serie_corrette >= serie) consolidate++
    }
    return {
      argomento: a,
      totale: lista.length,
      viste,
      consolidate,
      copertura: lista.length ? viste / lista.length : 0,
      padronanza: lista.length ? consolidate / lista.length : 0,
    }
  })
  const totale = domande.length
  const viste = perArg.reduce((a, x) => a + x.viste, 0)
  const consolidate = perArg.reduce((a, x) => a + x.consolidate, 0)
  return {
    totale,
    viste,
    consolidate,
    copertura: totale ? viste / totale : 0,
    padronanza: totale ? consolidate / totale : 0,
    perArgomento: perArg,
  }
}

export function argomentiDeboli(perArg: IndicatoriArgomento[], n = 5): IndicatoriArgomento[] {
  return [...perArg].sort((a, b) => a.padronanza - b.padronanza || a.copertura - b.copertura).slice(0, n)
}

export type Verdetto = 'pronto' | 'quasi' | 'non-ancora'

export function verdetto(probabilita: number, copertura: number, prog: Progressi, cfg: Impostazioni): Verdetto {
  const v = cfg.verdetto
  const ultimi = prog.esami.filter((e) => e.tipo === 'realistico').slice(-v.pronto_ultimi_realistici)
  const realisticiOk =
    ultimi.length >= v.pronto_ultimi_realistici && ultimi.every((e) => e.errori <= v.pronto_errori_max_realistici)
  if (probabilita >= v.pronto_probabilita && copertura >= v.pronto_copertura && realisticiOk) return 'pronto'
  if (probabilita >= v.quasi_probabilita) return 'quasi'
  return 'non-ancora'
}
