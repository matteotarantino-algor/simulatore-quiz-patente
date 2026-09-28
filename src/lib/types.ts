import type impostazioni from '../../config/impostazioni.json'

export type Impostazioni = typeof impostazioni

export interface Domanda {
  id: number
  quesito_id: number
  argomento_id: number
  argomento_nome: string
  testo: string
  risposta: boolean
  figura: string | null
  pagina_sorgente: number
}

export interface Argomento {
  id: number
  nome: string
  breve: string
  /** Domande per scheda d'esame (somma = 30). */
  quota: number
}

export interface Meta {
  fonte: string
  url: string
  file: string
  versione_listato: string | null
  data_pdf: string | null
  pagine: number
  totale: number
  figure_uniche: number
}

export interface Listato {
  meta: Meta
  argomenti: Argomento[]
  domande: Domanda[]
}

/** Stato di apprendimento di una singola affermazione. */
export interface StatoDomanda {
  visto: number
  corrette: number
  errate: number
  ultimo_esito: boolean | null
  /** Timestamp (ms) dell'ultima risposta. */
  ultima_data: number | null
  serie_corrette: number
  /** Ultimi esiti (1 = giusta, 0 = sbagliata), il più recente in fondo. */
  storia: number[]
}

export type TipoSessione = 'esame' | 'realistico' | 'argomento' | 'ripasso'

export interface EsitoEsame {
  data: number
  tipo: 'esame' | 'realistico'
  errori: number
  totale: number
  promosso: boolean
  durata_s: number
}

export interface Progressi {
  versione: 1
  domande: Record<number, StatoDomanda>
  esami: EsitoEsame[]
  andamento: { data: number; p: number }[]
}

export type Rng = () => number
