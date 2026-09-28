<script lang="ts">
  import Argomenti from './components/Argomenti.svelte'
  import Dati from './components/Dati.svelte'
  import Home from './components/Home.svelte'
  import Listato from './components/Listato.svelte'
  import Quiz from './components/Quiz.svelte'
  import Risultato from './components/Risultato.svelte'
  import Statistiche from './components/Statistiche.svelte'
  import { app } from './lib/app.svelte'

  app.carica()

  const TEMI = ['auto', 'light', 'dark'] as const
  type Tema = (typeof TEMI)[number]
  let tema = $state<Tema>(leggiTema())

  function leggiTema(): Tema {
    try {
      const t = localStorage.getItem('simulatore-quiz-patente:tema')
      return t === 'light' || t === 'dark' ? t : 'auto'
    } catch {
      return 'auto'
    }
  }
  $effect(() => {
    if (tema === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = tema
    try {
      localStorage.setItem('simulatore-quiz-patente:tema', tema)
    } catch {
      /* ignora */
    }
  })

  const pagina = $derived.by(() => {
    const r = app.route.split('?')[0]
    if (r === '/quiz') return app.sessione ? 'quiz' : app.risultato ? 'risultato' : 'home'
    if (r === '/risultato') return app.risultato ? 'risultato' : 'home'
    if (['/argomenti', '/listato', '/statistiche', '/dati'].includes(r)) return r.slice(1)
    return 'home'
  })
  const inQuiz = $derived(pagina === 'quiz')
  const voci = [
    ['home', '/', 'Home'],
    ['listato', '/listato', 'Listato'],
    ['statistiche', '/statistiche', 'Preparazione'],
    ['dati', '/dati', 'Progressi'],
  ] as const
</script>

{#if !inQuiz}
  <header class="app-bar">
    <div class="wrap bar-in">
      <a class="logo" href="#/">Quiz Patente B</a>
      <nav>
        {#each voci as [id, href, label] (id)}
          <a href="#{href}" aria-current={pagina === id ? 'page' : undefined}>{label}</a>
        {/each}
      </nav>
      <button
          type="button"
          class="tema"
          onclick={() => (tema = TEMI[(TEMI.indexOf(tema) + 1) % TEMI.length])}
          aria-label="Tema: {tema === 'auto' ? 'automatico' : tema === 'light' ? 'chiaro' : 'scuro'}"
          title="Tema: {tema === 'auto' ? 'automatico' : tema === 'light' ? 'chiaro' : 'scuro'}"
        >
          {tema === 'auto' ? '◐' : tema === 'light' ? '☀' : '☾'}
      </button>
    </div>
  </header>
{/if}

<main>
  {#if app.errore}
    <div class="wrap"><p class="card badge bad">{app.errore}</p></div>
  {:else if !app.listato}
    <div class="wrap"><p class="muted">Caricamento del listato…</p></div>
  {:else if pagina === 'quiz'}
    <Quiz />
  {:else if pagina === 'risultato'}
    <Risultato />
  {:else if pagina === 'argomenti'}
    <Argomenti />
  {:else if pagina === 'listato'}
    <Listato />
  {:else if pagina === 'statistiche'}
    <Statistiche />
  {:else if pagina === 'dati'}
    <Dati />
  {:else}
    <Home />
  {/if}
</main>

{#if !inQuiz}
  <footer class="wrap tiny muted">
    <p>
      Strumento personale di esercitazione, <strong>non affiliato</strong> al Ministero delle Infrastrutture e dei
      Trasporti. Domande, risposte e figure provengono esclusivamente dal listato ufficiale
      <a href="https://www.ilportaledellautomobilista.it/web/portale-automobilista/-/quiz-per-le-patenti-am-b-superiori-e-cqc" target="_blank" rel="noopener">«Patente AB» (conseguimento)</a>
      pubblicato sul Portale dell'Automobilista{#if app.listato}: file <em>{app.listato.meta.file}</em>, listato del
        {app.listato.meta.versione_listato}, PDF generato il {app.listato.meta.data_pdf},
        {app.listato.meta.totale.toLocaleString('it-IT')} affermazioni{/if}.
    </p>
    <p>
      La ripartizione delle 30 domande per argomento non è pubblicata ufficialmente: qui si usa 1 domanda per ciascuno
      dei 25 argomenti + 1 in più ai 5 argomenti più ampi. Nessun tracciamento, nessun account: i progressi restano nel
      tuo browser.
    </p>
  </footer>
{/if}

<style>
  .app-bar {
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .bar-in {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: 'logo tema' 'nav nav';
    align-items: center;
    gap: 4px 8px;
    padding-top: 6px;
    padding-bottom: 6px;
  }
  @media (min-width: 640px) {
    .bar-in {
      grid-template-columns: auto 1fr auto;
      grid-template-areas: 'logo nav tema';
    }
    nav {
      justify-content: flex-end;
    }
  }
  .logo {
    grid-area: logo;
    font-weight: 800;
    color: var(--ink);
    text-decoration: none;
  }
  nav {
    grid-area: nav;
    display: flex;
    gap: 2px;
    align-items: center;
  }
  nav a,
  .tema {
    padding: 8px 10px;
    border-radius: 8px;
    color: var(--ink-2);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.92rem;
    background: none;
    border: none;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  @media (max-width: 639px) {
    nav a {
      flex: 1;
      padding: 8px 4px;
    }
  }
  .tema {
    grid-area: tema;
  }
  nav a[aria-current='page'] {
    color: var(--accent-ink);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .tema {
    font-size: 1.1rem;
  }
  footer {
    padding-top: 8px;
    padding-bottom: 32px;
    border-top: 1px solid var(--line);
    margin-top: 24px;
  }
  footer p {
    margin: 0.6em 0;
  }
</style>
