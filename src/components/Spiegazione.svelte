<script lang="ts">
  import { onMount } from 'svelte'
  import { app } from '../lib/app.svelte'
  import { spiegazione } from '../lib/spiegazione'
  import Figura from './Figura.svelte'

  let {
    id,
    rispostaData,
    onclose,
  }: { id: number; rispostaData?: boolean | null; onclose: () => void } = $props()

  const d = $derived(app.domanda(id))
  const s = $derived(spiegazione(d, app.listato!.domande))
  const vf = (x: boolean | null | undefined) => (x == null ? 'nessuna' : x ? 'VERO' : 'FALSO')
  const giusta = $derived(rispostaData === d.risposta)

  let dialog: HTMLDialogElement
  let chiudi: HTMLButtonElement
  let chiuso = false

  /** Chiusura esplicita: non dipende dall'evento nativo `close`, che alcuni browser non emettono in modo affidabile. */
  function chiudiModale() {
    if (chiuso) return
    chiuso = true
    if (dialog.open) dialog.close()
    onclose()
  }

  onMount(() => {
    const html = document.documentElement
    const prima = html.style.overflow
    const origine = document.activeElement as HTMLElement | null
    html.style.overflow = 'hidden'
    dialog.showModal()
    chiudi.focus()
    return () => {
      html.style.overflow = prima
      // il dialog viene smontato: riporta il focus sul pulsante che l'ha aperto, senza scorrere
      origine?.focus?.({ preventScroll: true })
    }
  })
</script>

<dialog
  bind:this={dialog}
  class="spieg"
  aria-labelledby="spieg-titolo"
  onclose={chiudiModale}
  oncancel={(e) => {
    e.preventDefault()
    chiudiModale()
  }}
  onclick={(e) => e.target === dialog && chiudiModale()}
>
  <div class="box">
    <header>
      <h2 id="spieg-titolo">Cosa dice il listato</h2>
      <button bind:this={chiudi} type="button" class="x" aria-label="Chiudi" onclick={chiudiModale}>✕</button>
    </header>

    <div class="corpo">
      <section class="target">
        {#if d.figura}<Figura src={d.figura} size="thumb" />{/if}
        <div class="t-testo">
          <p class="testo">{d.testo}</p>
          <div class="row small">
            {#if rispostaData !== undefined}
              <span class="badge" class:good={giusta} class:bad={!giusta}>{giusta ? '✓' : '✗'} Tua risposta: {vf(rispostaData)}</span>
            {/if}
            <span class="badge ufficiale">Risposta ufficiale: <strong>{vf(d.risposta)}</strong></span>
          </div>
          <p class="tiny muted">n. {d.id} · quesito {d.quesito_id} · pag. {d.pagina_sorgente} del PDF</p>
        </div>
      </section>

      <section>
        <h3>
          <span class="badge good">VERO</span>
          {#if s.livello === 'piena'}
            Cosa è vero {d.figura ? 'su questa figura' : 'su questo punto'}
          {:else if s.livello === 'figura'}
            Cosa è vero su questa figura (da altri quesiti)
          {:else}
            Affermazioni vere collegate
          {/if}
        </h3>
        {#if s.livello === 'parziale'}
          <p class="nota small">
            Nel listato non ci sono altre affermazioni vere su questa stessa figura. Queste sono le affermazioni vere dello
            stesso quesito ministeriale, riferite ad altre figure.
          </p>
        {:else if s.livello === 'nessuna'}
          <p class="nota small">
            Nel listato non ci sono altre affermazioni vere collegate a questa: vale la risposta ufficiale
            <strong>{vf(d.risposta)}</strong>.
          </p>
        {/if}
        {#if s.vere.length}
          <ul class="lista">
            {#each s.vere as x (x.id)}
              <li>
                {#if x.figura && x.figura !== d.figura}<Figura src={x.figura} size="sm" />{/if}
                <div>
                  <p>{x.testo}</p>
                  <span class="tiny muted">n. {x.id}</span>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      {#if s.false.length}
        <details>
          <summary>
            <span class="freccia" aria-hidden="true">›</span>
            <span class="badge bad">FALSO</span>
            <span>Altre affermazioni false {d.figura ? 'sulla stessa figura' : 'sullo stesso punto'} ({s.false.length})</span>
          </summary>
          <ul class="lista">
            {#each s.false as x (x.id)}
              <li>
                {#if x.figura && x.figura !== d.figura}<Figura src={x.figura} size="sm" />{/if}
                <div>
                  <p>{x.testo}</p>
                  <span class="tiny muted">n. {x.id}</span>
                </div>
              </li>
            {/each}
          </ul>
        </details>
      {/if}

      <p class="tiny muted fonte">Testi riportati parola per parola dal listato ufficiale MIT, con la loro risposta ufficiale.</p>
    </div>

    <footer>
      <button type="button" class="btn primary block" onclick={chiudiModale}>Torna alla lista</button>
    </footer>
  </div>
</dialog>

<style>
  .spieg {
    padding: 0;
    border: none;
    background: transparent;
    color: var(--ink);
    width: 100%;
    max-width: 680px;
    height: 100%;
    max-height: 100%;
    margin: 0 auto;
    overscroll-behavior: contain;
  }
  .spieg::backdrop {
    background: rgb(0 0 0 / 60%);
  }
  .box {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface);
  }
  @media (min-width: 700px) and (min-height: 600px) {
    .spieg {
      height: auto;
      max-height: calc(100dvh - 48px);
      margin: 24px auto;
    }
    .box {
      height: auto;
      max-height: calc(100dvh - 48px);
      border-radius: 16px;
      border: 1px solid var(--line);
    }
  }
  header,
  footer {
    flex: none;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  header h2 {
    margin: 0;
  }
  footer {
    border-bottom: none;
    border-top: 1px solid var(--line);
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }
  .x {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 1.1rem;
    flex: none;
  }
  .corpo {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: grid;
    gap: 18px;
    align-content: start;
    overscroll-behavior: contain;
  }
  .target {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--line);
  }
  .t-testo {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 8px;
  }
  .t-testo p {
    margin: 0;
  }
  .testo {
    font-size: 1rem;
    font-weight: 600;
  }
  .ufficiale {
    background: color-mix(in srgb, var(--accent) 14%, var(--surface));
    color: var(--ink);
    font-weight: 600;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin: 0 0 8px;
  }
  .nota {
    margin: 0 0 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--warn-bg);
  }
  .lista {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0;
  }
  .lista li {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .lista li:last-child {
    border-bottom: none;
  }
  .lista li > div {
    flex: 1;
    min-width: 0;
  }
  .lista p {
    margin: 0 0 2px;
    overflow-wrap: anywhere;
  }
  details {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 4px 12px;
  }
  summary {
    list-style: none;
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    flex-wrap: wrap;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .freccia {
    display: inline-block;
    width: 14px;
    font-size: 1.4rem;
    line-height: 1;
    color: var(--ink-2);
    transition: transform 0.15s;
  }
  details[open] .freccia {
    transform: rotate(90deg);
  }
  .fonte {
    margin: 0;
  }
</style>
