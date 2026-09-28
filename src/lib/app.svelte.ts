import cfgJson from '../../config/impostazioni.json'
import { correggi, creaTimer, scaduto, type Correzione, type Risposta, type Timer } from './exam'
import {
  azzeraProgressi,
  caricaProgressi,
  daRipassare,
  progressiVuoti,
  registraAndamento,
  registraEsame,
  registraRisposta,
  salvaProgressi,
} from './progress'
import { probabilitaSuperamento } from './readiness'
import { mulberry32, randomSeed } from './rng'
import { generaRipasso, generaScheda, generaSessioneArgomento } from './selection'
import type { Domanda, Impostazioni, Listato, Progressi, TipoSessione } from './types'

export const cfg = cfgJson as Impostazioni

export interface Sessione {
  tipo: TipoSessione
  titolo: string
  ids: number[]
  risposte: Risposta[]
  indice: number
  /** Solo per gli esami. */
  timer: Timer | null
  creata: number
}

export interface Risultato {
  tipo: TipoSessione
  titolo: string
  ids: number[]
  risposte: Risposta[]
  correzione: Correzione
  durata_s: number
  data: number
}

export const isEsame = (t: TipoSessione) => t === 'esame' || t === 'realistico'

const K_SESSIONE = 'simulatore-quiz-patente:sessione:v1'
const K_RISULTATO = 'simulatore-quiz-patente:risultato:v1'

function leggi<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function scrivi(k: string, v: unknown) {
  try {
    if (v == null) localStorage.removeItem(k)
    else localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage non disponibile */
  }
}

class App {
  listato = $state.raw<Listato | null>(null)
  errore = $state<string | null>(null)
  progressi = $state.raw<Progressi>(caricaProgressi())
  sessione = $state.raw<Sessione | null>(leggi<Sessione>(K_SESSIONE))
  risultato = $state.raw<Risultato | null>(leggi<Risultato>(K_RISULTATO))
  route = $state(location.hash.slice(1) || '/')
  salvataggioOk = $state(true)
  #perId = new Map<number, Domanda>()

  constructor() {
    window.addEventListener('hashchange', () => {
      this.route = location.hash.slice(1) || '/'
      window.scrollTo(0, 0)
    })
  }

  async carica() {
    try {
      const mod = await import('../../data/questions.json')
      const l = (mod.default ?? mod) as unknown as Listato
      this.#perId = new Map(l.domande.map((d) => [d.id, d]))
      // una sessione salvata con domande non più presenti (listato aggiornato) viene scartata
      if (this.sessione && !this.sessione.ids.every((id) => this.#perId.has(id))) this.#setSessione(null)
      if (this.risultato && !this.risultato.ids.every((id) => this.#perId.has(id))) this.#setRisultato(null)
      this.listato = l
    } catch (e) {
      this.errore = `Impossibile caricare il listato: ${(e as Error).message}`
    }
  }

  domanda(id: number): Domanda {
    return this.#perId.get(id)!
  }

  go(path: string) {
    if (location.hash.slice(1) === path) this.route = path
    else location.hash = path
  }

  get daRipassare(): number[] {
    return daRipassare(this.progressi, cfg)
  }

  // --- Avvio sessioni ---

  avviaEsame(modo: 'intelligente' | 'realistico') {
    const l = this.listato!
    const now = Date.now()
    const scheda = generaScheda(l.domande, l.argomenti, this.progressi, modo, now, cfg, mulberry32(randomSeed()))
    this.#avvia(
      modo === 'realistico' ? 'realistico' : 'esame',
      modo === 'realistico' ? 'Esame realistico' : 'Simulazione d\'esame',
      scheda,
      creaTimer(now, cfg.esame.durata_minuti),
    )
  }

  avviaArgomento(argomentoIds: number[], n: number) {
    const l = this.listato!
    const scelte = generaSessioneArgomento(l.domande, argomentoIds, n, this.progressi, Date.now(), cfg, mulberry32(randomSeed()))
    const titolo =
      argomentoIds.length === 1 ? l.argomenti.find((a) => a.id === argomentoIds[0])!.breve : `${argomentoIds.length} argomenti`
    this.#avvia('argomento', titolo, scelte, null)
  }

  avviaRipasso() {
    const l = this.listato!
    const scelte = generaRipasso(
      l.domande,
      this.daRipassare,
      cfg.ripasso.domande_per_sessione,
      this.progressi,
      Date.now(),
      cfg,
      mulberry32(randomSeed()),
    )
    if (scelte.length) this.#avvia('ripasso', 'Ripasso errori', scelte, null)
  }

  #avvia(tipo: TipoSessione, titolo: string, domande: Domanda[], timer: Timer | null) {
    this.#setSessione({
      tipo,
      titolo,
      ids: domande.map((d) => d.id),
      risposte: domande.map(() => null),
      indice: 0,
      timer,
      creata: Date.now(),
    })
    this.go('/quiz')
  }

  // --- Durante la sessione ---

  rispondi(valore: boolean) {
    const s = this.sessione
    if (!s) return
    if (s.timer && scaduto(s.timer, Date.now())) return this.consegna()
    if (!isEsame(s.tipo)) {
      // allenamento: risposta definitiva, correzione immediata e registrata subito
      if (s.risposte[s.indice] !== null) return
      const d = this.domanda(s.ids[s.indice])
      const p = { ...this.progressi, domande: { ...this.progressi.domande } }
      registraRisposta(p, d.id, valore === d.risposta, Date.now(), cfg)
      this.#setProgressi(p)
    }
    const risposte = s.risposte.slice()
    risposte[s.indice] = valore
    this.#setSessione({ ...s, risposte })
  }

  vaiA(indice: number) {
    const s = this.sessione
    if (!s) return
    this.#setSessione({ ...s, indice: Math.max(0, Math.min(s.ids.length - 1, indice)) })
  }

  /** Consegna (esame) o termina (allenamento). */
  consegna() {
    const s = this.sessione
    if (!s) return
    const now = Date.now()
    const esame = isEsame(s.tipo)
    const scheda = s.ids.map((id) => this.domanda(id))
    const correzione = correggi(scheda, s.risposte, cfg.esame.errori_max)
    const p: Progressi = { ...this.progressi, domande: { ...this.progressi.domande }, esami: [...this.progressi.esami], andamento: [...this.progressi.andamento] }
    const fine = s.timer ? Math.min(now, s.timer.scadenza) : now
    const durata_s = Math.round((fine - (s.timer?.inizio ?? s.creata)) / 1000)
    if (esame) {
      // all'esame anche la domanda senza risposta conta come errore
      scheda.forEach((d, i) => registraRisposta(p, d.id, s.risposte[i] === d.risposta, now, cfg))
      registraEsame(p, {
        data: now,
        tipo: s.tipo as 'esame' | 'realistico',
        errori: correzione.errori,
        totale: scheda.length,
        promosso: correzione.promosso,
        durata_s,
      })
    }
    const l = this.listato!
    registraAndamento(p, now, probabilitaSuperamento(l.domande, l.argomenti, p, cfg, mulberry32(randomSeed())))
    this.#setProgressi(p)
    this.#setRisultato({ tipo: s.tipo, titolo: s.titolo, ids: s.ids, risposte: s.risposte, correzione, durata_s, data: now })
    this.#setSessione(null)
    this.go('/risultato')
  }

  abbandona() {
    this.#setSessione(null)
    this.go('/')
  }

  // --- Progressi ---

  sostituisciProgressi(p: Progressi) {
    this.#setProgressi(p)
  }

  azzera() {
    azzeraProgressi()
    this.#setProgressi(progressiVuoti())
    this.#setSessione(null)
    this.#setRisultato(null)
  }

  #setProgressi(p: Progressi) {
    this.progressi = p
    this.salvataggioOk = salvaProgressi(p)
  }
  #setSessione(s: Sessione | null) {
    this.sessione = s
    scrivi(K_SESSIONE, s)
  }
  #setRisultato(r: Risultato | null) {
    this.risultato = r
    scrivi(K_RISULTATO, r)
  }
}

export const app = new App()

export function figuraUrl(figura: string): string {
  return import.meta.env.BASE_URL + figura
}

export function percentuale(x: number, decimali = 0): string {
  return `${(x * 100).toFixed(decimali).replace('.', ',')}%`
}
