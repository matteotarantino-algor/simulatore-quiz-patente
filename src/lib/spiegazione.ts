import type { Domanda } from './types'

/**
 * Livello di copertura della "spiegazione" di un'affermazione, costruita solo con altre
 * affermazioni ufficiali del listato (nessun testo aggiunto):
 * - piena:    affermazioni VERE dello stesso quesito sulla stessa figura (o entrambe senza figura)
 * - figura:   affermazioni VERE di altri quesiti con la stessa identica figura
 * - parziale: affermazioni VERE dello stesso quesito, ma riferite a figure diverse
 * - nessuna:  nel listato non c'è altro di VERO collegato
 */
export type LivelloSpiegazione = 'piena' | 'figura' | 'parziale' | 'nessuna'

export interface Spiegazione {
  livello: LivelloSpiegazione
  vere: Domanda[]
  false: Domanda[]
}

interface Indici {
  perQuesito: Map<number, Domanda[]>
  perFigura: Map<string, Domanda[]>
}

const cache = new WeakMap<Domanda[], Indici>()

function indici(domande: Domanda[]): Indici {
  let ix = cache.get(domande)
  if (ix) return ix
  ix = { perQuesito: new Map(), perFigura: new Map() }
  for (const d of domande) {
    const q = ix.perQuesito.get(d.quesito_id)
    if (q) q.push(d)
    else ix.perQuesito.set(d.quesito_id, [d])
    if (d.figura) {
      const f = ix.perFigura.get(d.figura)
      if (f) f.push(d)
      else ix.perFigura.set(d.figura, [d])
    }
  }
  cache.set(domande, ix)
  return ix
}

/** Toglie l'affermazione stessa e i testi ripetuti (il listato contiene alcuni doppioni con numeri diversi). */
function pulisci(lista: Domanda[], d: Domanda): Domanda[] {
  const visti = new Set([d.testo])
  return lista.filter((x) => {
    if (x.id === d.id || visti.has(x.testo)) return false
    visti.add(x.testo)
    return true
  })
}

export function spiegazione(d: Domanda, domande: Domanda[]): Spiegazione {
  const { perQuesito, perFigura } = indici(domande)
  const quesito = perQuesito.get(d.quesito_id) ?? []
  const stessaFigura = quesito.filter((x) => x.figura === d.figura)

  const vereStesse = pulisci(stessaFigura.filter((x) => x.risposta), d)
  if (vereStesse.length) {
    return { livello: 'piena', vere: vereStesse, false: pulisci(stessaFigura.filter((x) => !x.risposta), d) }
  }
  if (d.figura) {
    const conFigura = perFigura.get(d.figura) ?? []
    const vere = pulisci(conFigura.filter((x) => x.risposta), d)
    if (vere.length) return { livello: 'figura', vere, false: pulisci(conFigura.filter((x) => !x.risposta), d) }
  }
  const vereQuesito = pulisci(quesito.filter((x) => x.risposta), d)
  const falseQuesito = pulisci(quesito.filter((x) => !x.risposta), d)
  return { livello: vereQuesito.length ? 'parziale' : 'nessuna', vere: vereQuesito, false: falseQuesito }
}
