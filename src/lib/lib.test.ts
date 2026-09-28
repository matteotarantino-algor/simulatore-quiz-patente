import { describe, expect, it } from 'vitest'
import cfgJson from '../../config/impostazioni.json'
import listatoJson from '../../data/questions.json'
import { correggi, creaTimer, formattaTempo, scaduto, tempoRimanente } from './exam'
import { daRipassare, importaProgressi, esportaProgressi, progressiVuoti, registraRisposta, registraEsame } from './progress'
import { probabilitaDomanda, probabilitaPerArgomento, probabilitaSuperamento, indicatori, verdetto } from './readiness'
import { mulberry32 } from './rng'
import { generaScheda, generaSessioneArgomento, generaRipasso, pesoDomanda, scegliDaInsieme } from './selection'
import type { Domanda, Impostazioni, Listato, Progressi } from './types'

const cfg = cfgJson as Impostazioni
const listato = listatoJson as unknown as Listato
const { domande, argomenti } = listato
const NOW = Date.UTC(2026, 8, 28)
const GIORNO = 86_400_000

function segna(p: Progressi, ids: number[], corretta: boolean, now = NOW) {
  for (const id of ids) registraRisposta(p, id, corretta, now, cfg)
}

describe('dati del listato', () => {
  it('7020 affermazioni in 25 argomenti con quote che sommano a 30', () => {
    expect(domande).toHaveLength(7020)
    expect(argomenti).toHaveLength(25)
    expect(argomenti.reduce((a, x) => a + x.quota, 0)).toBe(cfg.esame.domande)
    for (const a of argomenti) expect(domande.some((d) => d.argomento_id === a.id)).toBe(true)
  })
})

describe('generazione della scheda', () => {
  it('30 domande, ripartizione ufficiale per argomento, nessun duplicato', () => {
    for (const modo of ['intelligente', 'realistico'] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = generaScheda(domande, argomenti, progressiVuoti(), modo, NOW, cfg, mulberry32(seed))
        expect(s).toHaveLength(30)
        expect(new Set(s.map((d) => d.id)).size).toBe(30)
        for (const a of argomenti) expect(s.filter((d) => d.argomento_id === a.id)).toHaveLength(a.quota)
      }
    }
  })

  it('le schede cambiano tra un\'estrazione e l\'altra', () => {
    const a = generaScheda(domande, argomenti, progressiVuoti(), 'realistico', NOW, cfg, mulberry32(1))
    const b = generaScheda(domande, argomenti, progressiVuoti(), 'realistico', NOW, cfg, mulberry32(2))
    expect(a.map((d) => d.id)).not.toEqual(b.map((d) => d.id))
  })
})

describe('selezione intelligente', () => {
  const pool: Domanda[] = domande.filter((d) => d.argomento_id === 12) // Distanza di sicurezza, 134

  it('propone prima le domande mai viste', () => {
    const p = progressiVuoti()
    const viste = pool.slice(0, 120).map((d) => d.id)
    segna(p, viste, false) // anche se sbagliate, le non viste hanno la precedenza
    const scelte = scegliDaInsieme(pool, 10, p, NOW, cfg, mulberry32(7))
    expect(scelte).toHaveLength(10)
    expect(scelte.every((d) => !viste.includes(d.id))).toBe(true)
  })

  it('se le non viste non bastano, le prende tutte e completa con le viste', () => {
    const p = progressiVuoti()
    segna(p, pool.slice(0, 130).map((d) => d.id), true)
    const scelte = scegliDaInsieme(pool, 10, p, NOW, cfg, mulberry32(3))
    const nonViste = pool.slice(130).map((d) => d.id)
    expect(nonViste.every((id) => scelte.some((d) => d.id === id))).toBe(true)
    expect(new Set(scelte.map((d) => d.id)).size).toBe(10)
  })

  it('esaurite le non viste, privilegia le sbagliate rispetto alle consolidate', () => {
    const p = progressiVuoti()
    const sbagliate = pool.slice(0, 10).map((d) => d.id)
    const consolidate = pool.slice(10).map((d) => d.id)
    for (let i = 0; i < 3; i++) segna(p, consolidate, true, NOW - 2 * GIORNO)
    segna(p, sbagliate, false, NOW - GIORNO)
    let presiSbagliate = 0
    const prove = 200
    for (let seed = 0; seed < prove; seed++) {
      const scelte = scegliDaInsieme(pool, 10, p, NOW, cfg, mulberry32(seed))
      presiSbagliate += scelte.filter((d) => sbagliate.includes(d.id)).length
    }
    // le sbagliate sono 10 su 134 (7%) ma devono occupare la maggior parte delle schede
    expect(presiSbagliate / (prove * 10)).toBeGreaterThan(0.5)
  })

  it('pesi: sbagliata recente > sbagliata vecchia > indovinata una volta > consolidata', () => {
    const p = progressiVuoti()
    const [a, b, c, d] = pool.map((x) => x.id)
    segna(p, [a], false, NOW - GIORNO)
    segna(p, [b], false, NOW - 30 * GIORNO)
    segna(p, [c], true, NOW - GIORNO)
    for (let i = 0; i < 3; i++) segna(p, [d], true, NOW - GIORNO)
    const w = [a, b, c, d].map((id) => pesoDomanda(p.domande[id], NOW, cfg))
    expect(w[0]).toBeGreaterThan(w[1])
    expect(w[1]).toBeGreaterThan(w[2])
    expect(w[2]).toBeGreaterThan(w[3])
  })

  it('nell\'esame intelligente la ripartizione resta quella ufficiale anche con molte sbagliate', () => {
    const p = progressiVuoti()
    segna(p, domande.filter((d) => d.argomento_id === 2).map((d) => d.id), false)
    const s = generaScheda(domande, argomenti, p, 'intelligente', NOW, cfg, mulberry32(5))
    for (const a of argomenti) expect(s.filter((d) => d.argomento_id === a.id)).toHaveLength(a.quota)
  })

  it('sessione per argomento e ripasso non hanno duplicati', () => {
    const p = progressiVuoti()
    const s = generaSessioneArgomento(domande, [3, 4], 30, p, NOW, cfg, mulberry32(9))
    expect(s).toHaveLength(30)
    expect(new Set(s.map((d) => d.id)).size).toBe(30)
    expect(s.every((d) => d.argomento_id === 3 || d.argomento_id === 4)).toBe(true)
    segna(p, s.map((d) => d.id), false)
    const r = generaRipasso(domande, daRipassare(p, cfg), 20, p, NOW, cfg, mulberry32(9))
    expect(r).toHaveLength(20)
    expect(new Set(r.map((d) => d.id)).size).toBe(20)
  })
})

describe('ripasso errori', () => {
  it('una domanda sbagliata esce dal ripasso solo dopo N risposte giuste di fila', () => {
    const p = progressiVuoti()
    const id = domande[0].id
    segna(p, [id], false)
    expect(daRipassare(p, cfg)).toContain(id)
    segna(p, [id], true)
    segna(p, [id], true)
    expect(daRipassare(p, cfg)).toContain(id)
    segna(p, [id], false) // la serie si azzera
    segna(p, [id], true)
    segna(p, [id], true)
    expect(daRipassare(p, cfg)).toContain(id)
    segna(p, [id], true)
    expect(daRipassare(p, cfg)).not.toContain(id)
  })
})

describe('correzione e soglia di promozione', () => {
  const scheda = domande.slice(0, 30)
  const giuste = scheda.map((d) => d.risposta)

  it('0 errori: promosso', () => {
    expect(correggi(scheda, giuste, 3)).toMatchObject({ errori: 0, promosso: true })
  })
  it('3 errori: promosso; 4 errori: respinto', () => {
    const r3 = giuste.map((r, i) => (i < 3 ? !r : r))
    const r4 = giuste.map((r, i) => (i < 4 ? !r : r))
    expect(correggi(scheda, r3, 3)).toMatchObject({ errori: 3, promosso: true, sbagliate: [0, 1, 2] })
    expect(correggi(scheda, r4, 3)).toMatchObject({ errori: 4, promosso: false })
  })
  it('una domanda senza risposta conta come errore', () => {
    const r = giuste.map((x, i) => (i < 2 ? !x : i < 4 ? null : x))
    const c = correggi(scheda, r, 3)
    expect(c).toMatchObject({ errori: 4, nonRisposte: 2, promosso: false })
    expect(correggi(scheda, [], 3)).toMatchObject({ errori: 30, nonRisposte: 30, promosso: false })
  })
})

describe('timer', () => {
  it('20 minuti, scadenza e formattazione', () => {
    const t = creaTimer(NOW, cfg.esame.durata_minuti)
    expect(tempoRimanente(t, NOW)).toBe(20 * 60_000)
    expect(formattaTempo(tempoRimanente(t, NOW))).toBe('20:00')
    expect(formattaTempo(tempoRimanente(t, NOW + 61_500))).toBe('18:59')
    expect(scaduto(t, NOW + 20 * 60_000 - 1)).toBe(false)
    expect(scaduto(t, NOW + 20 * 60_000)).toBe(true)
    expect(tempoRimanente(t, NOW + 30 * 60_000)).toBe(0)
  })
})

describe('probabilità stimata di superamento', () => {
  it('probabilità per domanda: con media 0,5 è (corrette+1)/(viste+2), pesata sulle recenti', () => {
    const p = progressiVuoti()
    const [a, b, c] = domande.map((d) => d.id)
    expect(probabilitaDomanda(p.domande[a], cfg)).toBeNull()
    segna(p, [a], true)
    expect(probabilitaDomanda(p.domande[a], cfg)).toBeCloseTo(2 / 3)
    // stessi esiti in ordine diverso: conta di più il più recente
    segna(p, [b], false)
    segna(p, [b], true)
    segna(p, [c], true)
    segna(p, [c], false)
    expect(probabilitaDomanda(p.domande[b], cfg)!).toBeGreaterThan(probabilitaDomanda(p.domande[c], cfg)!)
  })

  it('senza progressi è bassa; sapendo tutto è ~1; sbagliando tutto è ~0', () => {
    const vuoto = progressiVuoti()
    expect(probabilitaSuperamento(domande, argomenti, vuoto, cfg, mulberry32(1), 2000)).toBeLessThan(0.01)

    const bravo = progressiVuoti()
    for (let i = 0; i < 4; i++) segna(bravo, domande.map((d) => d.id), true)
    expect(probabilitaSuperamento(domande, argomenti, bravo, cfg, mulberry32(1), 2000)).toBeGreaterThan(0.95)

    const scarso = progressiVuoti()
    segna(scarso, domande.map((d) => d.id), false)
    expect(probabilitaSuperamento(domande, argomenti, scarso, cfg, mulberry32(1), 2000)).toBeLessThan(0.01)
  })

  it('coincide con il calcolo esatto quando ogni domanda ha la stessa probabilità', () => {
    // con p uguale per tutte, errori ~ Binomiale(30, 1-p): P(X ≤ 3)
    const p = progressiVuoti()
    const ids = domande.map((d) => d.id)
    for (const id of ids) {
      p.domande[id] = { visto: 8, corrette: 8, errate: 0, ultimo_esito: true, ultima_data: NOW, serie_corrette: 8, storia: [1, 1, 1, 1, 1, 1, 1, 1] }
    }
    const pq = probabilitaPerArgomento(domande, p, cfg).get(1)![0]
    expect(pq).toBeGreaterThan(0.9)
    expect(pq).toBeLessThan(1)
    const q = 1 - pq
    const binom = (n: number, k: number) => {
      let r = 1
      for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
      return r
    }
    let esatta = 0
    for (let k = 0; k <= 3; k++) esatta += binom(30, k) * q ** k * pq ** (30 - k)
    const mc = probabilitaSuperamento(domande, argomenti, p, cfg, mulberry32(42), 20000)
    expect(Math.abs(mc - esatta)).toBeLessThan(0.02)
  })

  it('calibrazione: studente simulato con accuratezza reale nota', () => {
    const binom = (n: number, k: number) => {
      let r = 1
      for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
      return r
    }
    const veraProb = (acc: number) => {
      let s = 0
      for (let k = 0; k <= 3; k++) s += binom(30, k) * (1 - acc) ** k * acc ** (30 - k)
      return s
    }
    for (const acc of [0.8, 0.9, 0.95, 0.98]) {
      const rng = mulberry32(Math.round(acc * 1000))
      const p = progressiVuoti()
      // ogni domanda "saputa" (sempre giusta) con probabilità acc, altrimenti sempre sbagliata
      for (const d of domande) {
        const sa = rng() < acc
        for (let i = 0; i < 2; i++) registraRisposta(p, d.id, sa, NOW, cfg)
      }
      const stima = probabilitaSuperamento(domande, argomenti, p, cfg, mulberry32(11), 5000)
      expect(Math.abs(stima - veraProb(acc))).toBeLessThan(0.1)
    }
  })

  it('le non viste usano la media dell\'argomento, prudente se l\'argomento è poco coperto', () => {
    const p = progressiVuoti()
    // solo 2 domande viste e giuste: la stima delle non viste resta vicina al valore prudente
    segna(p, domande.slice(0, 2).map((d) => d.id), true)
    const prob = probabilitaSuperamento(domande, argomenti, p, cfg, mulberry32(3), 2000)
    expect(prob).toBeLessThan(0.05)
  })
})

describe('indicatori e verdetto', () => {
  it('copertura e padronanza', () => {
    const p = progressiVuoti()
    const ids = domande.slice(0, 702).map((d) => d.id)
    segna(p, ids, true)
    segna(p, ids.slice(0, 351), true)
    const ind = indicatori(domande, argomenti, p, cfg)
    expect(ind.copertura).toBeCloseTo(0.1)
    expect(ind.padronanza).toBeCloseTo(0.05)
  })

  it('"pronto" richiede anche gli ultimi 5 esami realistici con 0-1 errori', () => {
    const p = progressiVuoti()
    expect(verdetto(0.95, 0.95, p, cfg)).toBe('quasi')
    for (let i = 0; i < 5; i++) registraEsame(p, { data: NOW, tipo: 'realistico', errori: i % 2, totale: 30, promosso: true, durata_s: 600 })
    expect(verdetto(0.95, 0.95, p, cfg)).toBe('pronto')
    expect(verdetto(0.95, 0.5, p, cfg)).toBe('quasi')
    expect(verdetto(0.6, 0.95, p, cfg)).toBe('non-ancora')
  })
})

describe('export/import progressi', () => {
  it('andata e ritorno', () => {
    const p = progressiVuoti()
    segna(p, [domande[0].id], false)
    const back = importaProgressi(esportaProgressi(p, '26/09/2021'))
    expect(back.domande[domande[0].id].errate).toBe(1)
    expect(() => importaProgressi('{"foo":1}')).toThrow()
  })
})
