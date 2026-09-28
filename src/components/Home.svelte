<script lang="ts">
  import { app, cfg, percentuale } from '../lib/app.svelte'
  import { calcolaPreparazione, ETICHETTA_VERDETTO } from '../lib/preparazione'

  const prep = $derived(calcolaPreparazione(app.listato!, app.progressi))
  const ripasso = $derived(app.daRipassare.length)
</script>

<div class="wrap stack">
  {#if app.sessione}
    <a class="card ripresa" href="#/quiz">
      <strong>Hai una sessione in corso: {app.sessione.titolo}</strong>
      <span class="muted small">Tocca per riprendere →</span>
    </a>
  {/if}

  <a class="card verdetto v-{prep.verdetto}" href="#/statistiche">
    <div>
      <div class="muted small">Probabilità stimata di superare l'esame</div>
      <div class="big">{percentuale(prep.probabilita)}</div>
      <div class="row small">
        <span class="badge {prep.verdetto === 'pronto' ? 'good' : prep.verdetto === 'quasi' ? 'warn' : 'bad'}">
          {prep.verdetto === 'pronto' ? '✓' : prep.verdetto === 'quasi' ? '◐' : '○'}
          {ETICHETTA_VERDETTO[prep.verdetto]}
        </span>
        <span class="muted">Copertura {percentuale(prep.copertura)} · Padronanza {percentuale(prep.padronanza)}</span>
      </div>
    </div>
    <span class="freccia" aria-hidden="true">›</span>
  </a>

  <div class="modi">
    <button class="card modo principale" type="button" onclick={() => app.avviaEsame('intelligente')}>
      <strong>Simulazione d'esame</strong>
      <span class="muted small">{cfg.esame.domande} domande · {cfg.esame.durata_minuti} minuti · max {cfg.esame.errori_max} errori. Prima le domande mai viste, poi quelle che sbagli.</span>
    </button>
    <button class="card modo" type="button" onclick={() => app.avviaEsame('realistico')}>
      <strong>Esame realistico</strong>
      <span class="muted small">Estrazione puramente casuale, come all'esame vero: la prova che misura davvero la preparazione.</span>
    </button>
    <a class="card modo" href="#/argomenti">
      <strong>Per argomento</strong>
      <span class="muted small">Scegli uno o più dei 25 argomenti, sessioni da 10, 20 o 30 domande con correzione immediata.</span>
    </a>
    <button class="card modo" type="button" disabled={!ripasso} onclick={() => app.avviaRipasso()}>
      <strong>Ripasso errori {ripasso ? `(${ripasso})` : ''}</strong>
      <span class="muted small">
        {ripasso
          ? `Le domande sbagliate tornano finché non le indovini ${cfg.ripasso.serie_richiesta} volte di fila.`
          : 'Nessun errore da ripassare, per ora.'}
      </span>
    </button>
    <a class="card modo" href="#/listato">
      <strong>Consulta il listato</strong>
      <span class="muted small">Tutte le {app.listato!.meta.totale.toLocaleString('it-IT')} affermazioni ufficiali con risposta, ricerca e filtro per argomento.</span>
    </a>
    <a class="card modo" href="#/statistiche">
      <strong>Preparazione</strong>
      <span class="muted small">Copertura, padronanza, argomenti deboli, andamento degli esami realistici.</span>
    </a>
  </div>
</div>

<style>
  .ripresa {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-decoration: none;
    color: inherit;
    border-color: var(--accent);
  }
  .verdetto {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-decoration: none;
    color: inherit;
    border-left: 6px solid var(--line);
  }
  .v-pronto {
    border-left-color: var(--good);
  }
  .v-quasi {
    border-left-color: var(--warn);
  }
  .v-non-ancora {
    border-left-color: var(--bad);
  }
  .big {
    font-size: 2.4rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
    margin: 2px 0 8px;
  }
  .freccia {
    font-size: 2rem;
    color: var(--ink-3);
  }
  .modi {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 12px;
  }
  .modo {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    text-decoration: none;
    color: inherit;
    font: inherit;
  }
  .modo:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .modo:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .principale {
    border: 2px solid var(--accent);
  }
</style>
