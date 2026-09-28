<script lang="ts">
  import { app } from '../lib/app.svelte'
  import Figura from './Figura.svelte'

  const PAGINA = 40
  let q = $state('')
  let arg = $state(0)
  let figura = $state<'tutte' | 'con' | 'senza'>('tutte')
  let mostraRisposte = $state(true)
  let limite = $state(PAGINA)

  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, "'")

  const indice = $derived(app.listato!.domande.map((d) => norm(d.testo)))

  const risultati = $derived.by(() => {
    const termini = norm(q).trim().split(/\s+/).filter(Boolean)
    const numero = /^\d{3,6}$/.test(q.trim()) ? Number(q.trim()) : null
    return app.listato!.domande.filter((d, i) => {
      if (arg && d.argomento_id !== arg) return false
      if (figura === 'con' && !d.figura) return false
      if (figura === 'senza' && d.figura) return false
      if (numero !== null) return d.id === numero || d.quesito_id === numero
      return termini.every((t) => indice[i].includes(t))
    })
  })

  $effect(() => {
    void q, arg, figura
    limite = PAGINA
  })
</script>

<div class="wrap stack">
  <h1>Listato ufficiale</h1>
  <div class="card filtri">
    <input type="search" placeholder="Cerca nel testo o per numero domanda…" bind:value={q} aria-label="Cerca" />
    <select bind:value={arg} aria-label="Argomento">
      <option value={0}>Tutti i 25 argomenti</option>
      {#each app.listato!.argomenti as a (a.id)}
        <option value={a.id}>{a.id}. {a.breve}</option>
      {/each}
    </select>
    <div class="row small">
      <select bind:value={figura} aria-label="Figura" style="width:auto">
        <option value="tutte">Con e senza figura</option>
        <option value="con">Solo con figura</option>
        <option value="senza">Solo senza figura</option>
      </select>
      <label class="row"><input type="checkbox" bind:checked={mostraRisposte} /> Mostra risposte</label>
    </div>
    <div class="small muted">{risultati.length.toLocaleString('it-IT')} affermazioni</div>
  </div>

  <ul class="lista">
    {#each risultati.slice(0, limite) as d (d.id)}
      {@const s = app.progressi.domande[d.id]}
      <li class="card voce">
        {#if d.figura}<Figura src={d.figura} size="sm" />{/if}
        <div class="corpo">
          <p class="testo">{d.testo}</p>
          <div class="row tiny muted">
            {#if mostraRisposte}
              <span class="badge" class:good={d.risposta} class:bad={!d.risposta}>{d.risposta ? 'VERO' : 'FALSO'}</span>
            {/if}
            <span>n. {d.id} · quesito {d.quesito_id} · pag. {d.pagina_sorgente}</span>
            {#if s?.visto}<span>· vista {s.visto}× ({s.errate} err.)</span>{/if}
          </div>
        </div>
      </li>
    {/each}
  </ul>
  {#if risultati.length > limite}
    <button class="btn block" type="button" onclick={() => (limite += PAGINA)}>
      Mostra altre ({(risultati.length - limite).toLocaleString('it-IT')} rimanenti)
    </button>
  {/if}
</div>

<style>
  .filtri {
    display: grid;
    gap: 8px;
  }
  .lista {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }
  .voce {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px;
  }
  .corpo {
    flex: 1;
    min-width: 0;
  }
  .testo {
    margin: 0 0 6px;
  }
  label input {
    width: 18px;
    height: 18px;
  }
</style>
