<script lang="ts">
  import { app, cfg, isEsame } from '../lib/app.svelte'
  import { formattaTempo, tempoRimanente } from '../lib/exam'
  import Figura from './Figura.svelte'
  import InfoBtn from './InfoBtn.svelte'
  import Spiegazione from './Spiegazione.svelte'

  const s = $derived(app.sessione!)
  const esame = $derived(isEsame(s.tipo))
  const d = $derived(app.domanda(s.ids[s.indice]))
  const risposta = $derived(s.risposte[s.indice])
  const risposte = $derived(s.risposte.filter((r) => r !== null).length)
  const sbagliateFinora = $derived(
    esame ? 0 : s.ids.filter((id, i) => s.risposte[i] !== null && s.risposte[i] !== app.domanda(id).risposta).length,
  )
  const argomento = $derived(app.listato!.argomenti.find((a) => a.id === d.argomento_id)!)

  let now = $state(Date.now())
  let conferma = $state<'consegna' | 'abbandona' | null>(null)
  let spiegazioneAperta = $state(false)

  $effect(() => {
    if (!s.timer) return
    const t = setInterval(() => {
      now = Date.now()
      if (s.timer && now >= s.timer.scadenza) app.consegna()
    }, 250)
    return () => clearInterval(t)
  })

  const rimanente = $derived(s.timer ? tempoRimanente(s.timer, now) : 0)

  function tasto(e: KeyboardEvent) {
    if (conferma || spiegazioneAperta || (e.target as HTMLElement).closest('input,select,textarea,dialog')) return
    if (e.key === 'v' || e.key === 'V') app.rispondi(true)
    else if (e.key === 'f' || e.key === 'F') app.rispondi(false)
    else if (e.key === 'ArrowRight') app.vaiA(s.indice + 1)
    else if (e.key === 'ArrowLeft') app.vaiA(s.indice - 1)
  }

  function statoCella(i: number): string {
    const r = s.risposte[i]
    if (r === null) return ''
    if (esame) return 'data'
    return r === app.domanda(s.ids[i]).risposta ? 'ok' : 'ko'
  }
</script>

<svelte:window onkeydown={tasto} />

<div class="quiz wrap">
  <header class="top">
    <div>
      <div class="titolo">{s.titolo}</div>
      <div class="muted small">
        Domanda <strong>{s.indice + 1}</strong> di {s.ids.length}
        {#if !esame}· errori {sbagliateFinora}{/if}
      </div>
    </div>
    {#if s.timer}
      <div class="timer" class:urgente={rimanente < 60_000} role="timer" aria-label="Tempo rimanente">
        {formattaTempo(rimanente)}
      </div>
    {/if}
  </header>

  <article class="card domanda">
    <div class="meta tiny muted">
      <span>{argomento.breve}</span>
      <span>n. {d.id}</span>
    </div>
    <div class="corpo" class:con-figura={!!d.figura}>
      {#if d.figura}
        {#key d.id}<Figura src={d.figura} size="lg" />{/key}
      {/if}
      <p class="testo">{d.testo}</p>
    </div>

    <div class="vf" role="group" aria-label="Risposta">
      {#each [true, false] as v (v)}
        {@const scelto = risposta === v}
        {@const giusto = !esame && risposta !== null && d.risposta === v}
        {@const errato = !esame && scelto && d.risposta !== v}
        <button
          type="button"
          class="vf-btn"
          class:scelto
          class:giusto
          class:errato
          aria-pressed={scelto}
          disabled={!esame && risposta !== null}
          onclick={() => app.rispondi(v)}
        >
          <span class="lettera">{v ? 'V' : 'F'}</span>{v ? 'Vero' : 'Falso'}
        </button>
      {/each}
    </div>

    {#if !esame && risposta !== null}
      <div class="esito" class:ok={risposta === d.risposta} class:ko={risposta !== d.risposta}>
        <p role="status">
          {#if risposta === d.risposta}
            ✓ Giusto
          {:else}
            ✗ Sbagliato — la risposta corretta è <strong>{d.risposta ? 'VERO' : 'FALSO'}</strong>
          {/if}
        </p>
        <InfoBtn label="Perché?" onclick={() => (spiegazioneAperta = true)} />
      </div>
    {/if}
  </article>

  <nav class="navi row">
    <button class="btn" type="button" disabled={s.indice === 0} onclick={() => app.vaiA(s.indice - 1)}>← Indietro</button>
    <span class="spacer"></span>
    {#if s.indice < s.ids.length - 1}
      <button class="btn primary" type="button" onclick={() => app.vaiA(s.indice + 1)}>Avanti →</button>
    {:else}
      <button class="btn primary" type="button" onclick={() => (conferma = 'consegna')}>
        {esame ? 'Consegna' : 'Termina'}
      </button>
    {/if}
  </nav>

  <section class="card">
    <div class="celle" aria-label="Vai alla domanda">
      {#each s.ids as _, i (i)}
        <button
          type="button"
          class="cella {statoCella(i)}"
          class:corrente={i === s.indice}
          aria-label={`Domanda ${i + 1}${s.risposte[i] === null ? ', senza risposta' : ''}`}
          onclick={() => app.vaiA(i)}>{i + 1}</button
        >
      {/each}
    </div>
    <div class="row azioni">
      <span class="muted small">Risposte date: {risposte}/{s.ids.length}</span>
      <span class="spacer"></span>
      <button class="btn" type="button" onclick={() => (conferma = 'abbandona')}>Abbandona</button>
      <button class="btn primary" type="button" onclick={() => (conferma = 'consegna')}>
        {esame ? 'Consegna' : 'Termina'}
      </button>
    </div>
  </section>

  {#if conferma}
    <div class="overlay" role="presentation" onclick={() => (conferma = null)}>
      <div
        class="card dialogo"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conf-t"
        tabindex="-1"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.key === 'Escape' && (conferma = null)}
      >
        {#if conferma === 'consegna'}
          <h2 id="conf-t">{esame ? 'Consegnare la scheda?' : 'Terminare la sessione?'}</h2>
          {#if esame && risposte < s.ids.length}
            <p>
              Hai ancora <strong>{s.ids.length - risposte}</strong> domande senza risposta: all'esame contano come errori.
            </p>
          {:else if esame}
            <p>Dopo la consegna non potrai più cambiare le risposte.</p>
          {:else}
            <p>Le risposte date sono già state registrate.</p>
          {/if}
          <div class="row">
            <button class="btn" type="button" onclick={() => (conferma = null)}>Torna alle domande</button>
            <button class="btn primary" type="button" onclick={() => app.consegna()}>{esame ? 'Consegna' : 'Termina'}</button>
          </div>
        {:else}
          <h2 id="conf-t">Abbandonare?</h2>
          <p>
            {esame
              ? 'La scheda non verrà corretta né conteggiata nelle statistiche.'
              : 'Le risposte già date restano registrate nei progressi.'}
          </p>
          <div class="row">
            <button class="btn" type="button" onclick={() => (conferma = null)}>Continua</button>
            <button class="btn danger" type="button" onclick={() => app.abbandona()}>Abbandona</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {#if spiegazioneAperta}
    <Spiegazione id={d.id} rispostaData={risposta} onclose={() => (spiegazioneAperta = false)} />
  {/if}
  <p class="tiny muted">Scorciatoie da tastiera: V = Vero, F = Falso, ← → per spostarsi. Limite errori: {cfg.esame.errori_max}.</p>
</div>

<style>
  .quiz > * + * {
    margin-top: 12px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--bg);
    padding: 8px 0;
  }
  .titolo {
    font-weight: 700;
  }
  .timer {
    font-variant-numeric: tabular-nums;
    font-size: 1.4rem;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .timer.urgente {
    background: var(--bad-bg);
    color: var(--bad-ink);
    border-color: var(--bad);
  }
  .meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  .corpo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .testo {
    font-size: 1.15rem;
    margin: 0;
    align-self: stretch;
  }
  @media (min-width: 640px) {
    .corpo.con-figura {
      flex-direction: row;
      align-items: flex-start;
    }
  }
  .vf {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 18px;
  }
  .vf-btn {
    min-height: 58px;
    border-radius: 12px;
    border: 2px solid var(--line);
    background: var(--surface);
    font-size: 1.1rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .vf-btn:disabled {
    cursor: default;
  }
  .lettera {
    display: inline-grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface-2);
  }
  .vf-btn.scelto {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
  }
  .vf-btn.scelto .lettera {
    background: var(--accent);
    color: var(--on-accent);
  }
  .vf-btn.giusto {
    border-color: var(--good);
    background: var(--good-bg);
  }
  .vf-btn.giusto .lettera {
    background: var(--good);
    color: #fff;
  }
  .vf-btn.errato {
    border-color: var(--bad);
    background: var(--bad-bg);
  }
  .vf-btn.errato .lettera {
    background: var(--bad);
    color: #fff;
  }
  .esito {
    margin: 12px 0 0;
    padding: 6px 6px 6px 12px;
    border-radius: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .esito p {
    margin: 0;
  }
  .esito.ok {
    background: var(--good-bg);
    color: var(--good-ink);
  }
  .esito.ko {
    background: var(--bad-bg);
    color: var(--bad-ink);
  }
  .spacer {
    flex: 1;
  }
  .celle {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 6px;
  }
  .cella {
    min-height: 40px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .cella.data {
    background: color-mix(in srgb, var(--accent) 18%, var(--surface));
    border-color: var(--accent);
  }
  .cella.ok {
    background: var(--good-bg);
    border-color: var(--good);
  }
  .cella.ko {
    background: var(--bad-bg);
    border-color: var(--bad);
  }
  .cella.corrente {
    outline: 3px solid var(--ink);
    outline-offset: 1px;
  }
  .azioni {
    margin-top: 12px;
  }
  .overlay {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 55%);
    display: grid;
    place-items: center;
    padding: 16px;
    z-index: 50;
  }
  .dialogo {
    max-width: 420px;
    width: 100%;
  }
</style>
