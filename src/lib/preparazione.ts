import { cfg } from './app.svelte'
import { argomentiDeboli, indicatori, probabilitaSuperamento, verdetto, type Verdetto } from './readiness'
import { mulberry32 } from './rng'
import type { Listato, Progressi } from './types'

export function calcolaPreparazione(l: Listato, p: Progressi) {
  // seme fisso: lo stesso stato dà sempre lo stesso numero (niente oscillazioni a ogni visita)
  const probabilita = probabilitaSuperamento(l.domande, l.argomenti, p, cfg, mulberry32(20211220))
  const ind = indicatori(l.domande, l.argomenti, p, cfg)
  return {
    probabilita,
    ...ind,
    deboli: argomentiDeboli(ind.perArgomento, 5),
    verdetto: verdetto(probabilita, ind.copertura, p, cfg),
  }
}

export const ETICHETTA_VERDETTO: Record<Verdetto, string> = {
  pronto: 'Pronto',
  quasi: 'Quasi pronto',
  'non-ancora': 'Non ancora',
}
