<script lang="ts">
  import { app, cfg, percentuale } from '../lib/app.svelte'
  import { indicatori } from '../lib/readiness'

  const ind = $derived(indicatori(app.listato!.domande, app.listato!.argomenti, app.progressi, cfg))
  let scelti = $state<number[]>([])
  let n = $state(20)

  function toggle(id: number) {
    scelti = scelti.includes(id) ? scelti.filter((x) => x !== id) : [...scelti, id]
  }
</script>

<div class="wrap stack">
  <h1>Allenamento per argomento</h1>
  <p class="muted small">
    Seleziona uno o più argomenti. Correzione immediata dopo ogni risposta; prima le domande mai viste, poi quelle
    sbagliate.
  </p>

  <ul class="lista">
    {#each ind.perArgomento as x (x.argomento.id)}
      {@const on = scelti.includes(x.argomento.id)}
      <li>
        <button type="button" class="card voce" class:on aria-pressed={on} onclick={() => toggle(x.argomento.id)}>
          <span class="check" aria-hidden="true">{on ? '✓' : ''}</span>
          <span class="info">
            <span class="nome"><strong>{x.argomento.id}. {x.argomento.breve}</strong></span>
            <span class="tiny muted">{x.argomento.nome}</span>
            <span class="metriche tiny muted">
              <span>Viste {x.viste}/{x.totale}</span>
              <span class="bar" style="flex:1"><span style="width:{x.copertura * 100}%"></span></span>
              <span>Padronanza {percentuale(x.padronanza)}</span>
            </span>
          </span>
        </button>
      </li>
    {/each}
  </ul>

  <div class="card barra">
    <div class="row" role="radiogroup" aria-label="Numero di domande">
      <span class="small muted">Domande:</span>
      {#each [10, 20, 30] as k (k)}
        <button type="button" class="btn" class:primary={n === k} role="radio" aria-checked={n === k} onclick={() => (n = k)}>{k}</button>
      {/each}
    </div>
    <button class="btn primary" type="button" disabled={!scelti.length} onclick={() => app.avviaArgomento(scelti, n)}>
      Inizia{scelti.length ? ` (${scelti.length} ${scelti.length === 1 ? 'argomento' : 'argomenti'})` : ''}
    </button>
  </div>
</div>

<style>
  .barra {
    position: sticky;
    bottom: 8px;
    z-index: 5;
    box-shadow: 0 4px 18px rgb(0 0 0 / 18%);
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: space-between;
    align-items: center;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }
  .voce {
    width: 100%;
    display: flex;
    gap: 12px;
    text-align: left;
    align-items: flex-start;
    padding: 12px;
  }
  .voce.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  }
  .check {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 2px solid var(--line);
    display: grid;
    place-items: center;
    font-weight: 800;
    color: var(--on-accent);
  }
  .on .check {
    background: var(--accent);
    border-color: var(--accent);
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .metriche {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }
</style>
