import { describe, expect, it } from 'vitest'
import listatoJson from '../../data/questions.json'
import { spiegazione, type LivelloSpiegazione } from './spiegazione'
import type { Listato } from './types'

const { domande } = listatoJson as unknown as Listato
const perId = new Map(domande.map((d) => [d.id, d]))

describe('spiegazione dal listato', () => {
  const tutte = domande.map((d) => ({ d, s: spiegazione(d, domande) }))

  it('copertura: oltre il 98% delle affermazioni ha una spiegazione piena', () => {
    const conta: Record<LivelloSpiegazione, number> = { piena: 0, figura: 0, parziale: 0, nessuna: 0 }
    for (const { s } of tutte) conta[s.livello]++
    expect(conta.piena + conta.figura + conta.parziale + conta.nessuna).toBe(7020)
    expect((conta.piena + conta.figura) / 7020).toBeGreaterThan(0.98)
    expect(conta).toMatchInlineSnapshot(`
      {
        "figura": 42,
        "nessuna": 20,
        "parziale": 94,
        "piena": 6864,
      }
    `)
  })

  it('usa solo affermazioni del listato, con la loro risposta ufficiale, mai sé stessa né doppioni', () => {
    for (const { d, s } of tutte) {
      for (const x of s.vere) expect(x.risposta).toBe(true)
      for (const x of s.false) expect(x.risposta).toBe(false)
      const tutteX = [...s.vere, ...s.false]
      for (const x of tutteX) {
        expect(perId.get(x.id)).toBe(x) // oggetto del listato, testo invariato
        expect(x.id).not.toBe(d.id)
        expect(x.testo).not.toBe(d.testo)
      }
      expect(new Set(s.vere.map((x) => x.testo)).size).toBe(s.vere.length)
      expect(new Set(s.false.map((x) => x.testo)).size).toBe(s.false.length)
    }
  })

  it('piena = stesso quesito e stessa figura', () => {
    for (const { d, s } of tutte) {
      if (s.livello !== 'piena') continue
      for (const x of [...s.vere, ...s.false]) {
        expect(x.quesito_id).toBe(d.quesito_id)
        expect(x.figura).toBe(d.figura)
      }
    }
  })

  it('esempio: segnale di svolta obbligatoria per autocarri (n. 20460)', () => {
    const s = spiegazione(perId.get(20460)!, domande)
    expect(s.livello).toBe('piena')
    expect(s.vere.map((x) => x.id)).toEqual([20454, 20455, 20456, 20457, 20458, 20459])
    expect(s.vere[0].testo).toBe(
      'Il segnale raffigurato preannuncia una svolta obbligatoria a destra per gli autocarri di massa superiore a 3,5 t',
    )
    expect(s.false.map((x) => x.id)).toEqual([20461, 20462, 20463, 20464, 20465])
  })
})
