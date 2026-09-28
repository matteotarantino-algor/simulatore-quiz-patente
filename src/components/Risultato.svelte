<script lang="ts">
  import { app, cfg, isEsame } from '../lib/app.svelte'
  import { formattaTempo } from '../lib/exam'
  import Figura from './Figura.svelte'

  const r = $derived(app.risultato!)
  const esame = $derived(isEsame(r.tipo))
  const date = $derived(r.risposte.filter((x) => x !== null).length)
  let tutte = $state(false)
  const indici = $derived(tutte ? r.ids.map((_, i) => i) : r.correzione.sbagliate)

  const vf = (x: boolean | null) => (x === null ? 'nessuna' : x ? 'VERO' : 'FALSO')

  function ripeti() {
    if (r.tipo === 'esame') app.avviaEsame('intelligente')
    else if (r.tipo === 'realistico') app.avviaEsame('realistico')
    else if (r.tipo === 'ripasso') app.avviaRipasso()
    else app.go('/argomenti')
  }
</script>

<div class="wrap stack">
  <section class="card esito" class:ok={!esame || r.correzione.promosso} class:ko={esame && !r.correzione.promosso}>
    <p class="muted small">{r.titolo}</p>
    {#if esame}
      <h1>{r.correzione.promosso ? '✓ Promosso' : '✗ Respinto'}</h1>
      <p>
        <strong>{r.correzione.errori}</strong>
        {r.correzione.errori === 1 ? 'errore' : 'errori'} su {r.ids.length} (massimo consentito {cfg.esame.errori_max})
        {#if r.correzione.nonRisposte}· di cui {r.correzione.nonRisposte} senza risposta{/if}
        · tempo {formattaTempo(r.durata_s * 1000)}
      </p>
    {:else}
      <h1>{date - (r.correzione.errori - r.correzione.nonRisposte)} giuste su {date}</h1>
      <p>
        {r.correzione.errori - r.correzione.nonRisposte} sbagliate
        {#if r.correzione.nonRisposte}· {r.correzione.nonRisposte} saltate (non registrate){/if}
      </p>
    {/if}
    <div class="row">
      <button class="btn primary" type="button" onclick={ripeti}>
        {r.tipo === 'argomento' ? 'Nuova sessione' : 'Ripeti'}
      </button>
      {#if app.daRipassare.length}
        <button class="btn" type="button" onclick={() => app.avviaRipasso()}>Ripasso errori ({app.daRipassare.length})</button>
      {/if}
      <a class="btn" href="#/statistiche">Preparazione</a>
      <a class="btn" href="#/">Home</a>
    </div>
  </section>

  <section class="stack">
    <div class="row">
      <h2 style="margin:0">{tutte ? 'Tutte le domande' : `Errori (${r.correzione.sbagliate.length})`}</h2>
      <span style="flex:1"></span>
      <button class="btn" type="button" onclick={() => (tutte = !tutte)}>{tutte ? 'Solo errori' : 'Mostra tutte'}</button>
    </div>
    {#if indici.length === 0}
      <p class="card muted">Nessun errore. 🎉</p>
    {/if}
    {#each indici as i (i)}
      {@const d = app.domanda(r.ids[i])}
      {@const data = r.risposte[i]}
      {@const giusta = data === d.risposta}
      <article class="card voce">
        {#if d.figura}<Figura src={d.figura} size="md" />{/if}
        <div class="stack">
          <p class="tiny muted">{i + 1}. · {d.argomento_nome.length > 60 ? app.listato!.argomenti.find((a) => a.id === d.argomento_id)?.breve : d.argomento_nome} · n. {d.id}</p>
          <p class="testo">{d.testo}</p>
          <div class="row small">
            <span class="badge" class:good={giusta} class:bad={!giusta}>{giusta ? '✓' : '✗'} Tua risposta: {vf(data)}</span>
            {#if !giusta}<span class="badge good">Corretta: {vf(d.risposta)}</span>{/if}
          </div>
        </div>
      </article>
    {/each}
  </section>
</div>

<style>
  .esito {
    border-left: 6px solid var(--line);
  }
  .esito.ok {
    border-left-color: var(--good);
  }
  .esito.ok h1 {
    color: var(--good-ink);
  }
  .esito.ko {
    border-left-color: var(--bad);
  }
  .esito.ko h1 {
    color: var(--bad-ink);
  }
  .esito p {
    margin: 0 0 12px;
  }
  .voce {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }
  .voce > .stack {
    flex: 1;
    min-width: 0;
  }
  .voce p {
    margin: 0;
  }
  .testo {
    font-size: 1.02rem;
  }
  @media (max-width: 520px) {
    .voce {
      flex-direction: column;
      align-items: center;
    }
  }
</style>
