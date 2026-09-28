<script lang="ts">
  import { app, cfg, percentuale } from '../lib/app.svelte'
  import { calcolaPreparazione, ETICHETTA_VERDETTO } from '../lib/preparazione'
  import GraficoBarre from './GraficoBarre.svelte'
  import GraficoLinea from './GraficoLinea.svelte'

  const prep = $derived(calcolaPreparazione(app.listato!, app.progressi))
  const realistici = $derived(app.progressi.esami.filter((e) => e.tipo === 'realistico').slice(-30))
  const andamento = $derived(app.progressi.andamento.slice(-200).map((a) => ({ x: a.data, y: a.p })))
  const v = cfg.verdetto
  const data = (t: number) => new Date(t).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  let ordine = $state<'id' | 'padronanza'>('id')
  const righe = $derived(
    ordine === 'id' ? prep.perArgomento : [...prep.perArgomento].sort((a, b) => a.padronanza - b.padronanza),
  )
</script>

<div class="wrap stack">
  <h1>Preparazione</h1>

  <section class="card verdetto v-{prep.verdetto}">
    <div class="kpi">
      <div>
        <div class="muted small">Probabilità stimata di superare l'esame</div>
        <div class="big">{percentuale(prep.probabilita)}</div>
      </div>
      <span class="badge {prep.verdetto === 'pronto' ? 'good' : prep.verdetto === 'quasi' ? 'warn' : 'bad'}">
        {prep.verdetto === 'pronto' ? '✓' : prep.verdetto === 'quasi' ? '◐' : '○'}
        {ETICHETTA_VERDETTO[prep.verdetto]}
      </span>
    </div>
    <p class="small muted spiega">
      Per ogni domanda stimiamo la probabilità che tu risponda giusto dalle tue risposte (le più recenti contano di più);
      per le mai viste usiamo la tua media nell'argomento, prudente se l'argomento è poco coperto. Poi simuliamo
      {cfg.preparazione.simulazioni.toLocaleString('it-IT')} schede d'esame e contiamo quante volte faresti al massimo
      {cfg.esame.errori_max} errori.
    </p>
    <p class="small muted spiega">
      <strong>Pronto</strong>: probabilità ≥ {percentuale(v.pronto_probabilita)}, copertura ≥ {percentuale(v.pronto_copertura)}
      e ultimi {v.pronto_ultimi_realistici} esami realistici con al massimo {v.pronto_errori_max_realistici} errore.
      <strong>Quasi pronto</strong>: probabilità ≥ {percentuale(v.quasi_probabilita)}. Sotto: <strong>non ancora</strong>.
    </p>
  </section>

  <div class="grid2">
    <section class="card">
      <div class="muted small">Copertura del listato</div>
      <div class="mid">{percentuale(prep.copertura)}</div>
      <div class="bar"><span style="width:{prep.copertura * 100}%"></span></div>
      <p class="tiny muted">{prep.viste.toLocaleString('it-IT')} di {prep.totale.toLocaleString('it-IT')} affermazioni viste almeno una volta</p>
    </section>
    <section class="card">
      <div class="muted small">Padronanza</div>
      <div class="mid">{percentuale(prep.padronanza)}</div>
      <div class="bar"><span style="width:{prep.padronanza * 100}%"></span></div>
      <p class="tiny muted">
        {prep.consolidate.toLocaleString('it-IT')} affermazioni con le ultime {cfg.preparazione.serie_padronanza} risposte corrette
      </p>
    </section>
  </div>

  <section class="card stack">
    <h2>Argomenti deboli</h2>
    <p class="small muted">I 5 argomenti con padronanza più bassa.</p>
    <ul class="deboli">
      {#each prep.deboli as x (x.argomento.id)}
        <li>
          <span><strong>{x.argomento.breve}</strong> <span class="tiny muted">padronanza {percentuale(x.padronanza)} · viste {percentuale(x.copertura)}</span></span>
          <button class="btn" type="button" onclick={() => app.avviaArgomento([x.argomento.id], 20)}>Allenati</button>
        </li>
      {/each}
    </ul>
    <button class="btn primary" type="button" onclick={() => app.avviaArgomento(prep.deboli.map((x) => x.argomento.id), 30)}>
      Allenati su tutti e 5 (30 domande)
    </button>
  </section>

  <section class="card stack">
    <h2>Andamento della probabilità stimata</h2>
    {#if andamento.length}
      <GraficoLinea punti={andamento} soglia={v.pronto_probabilita} etichettaSoglia="soglia «pronto»" formattaY={(y) => percentuale(y)} formattaX={data} />
    {:else}
      <p class="muted small">Completa una sessione per vedere l'andamento.</p>
    {/if}
  </section>

  <section class="card stack">
    <h2>Esami realistici</h2>
    {#if realistici.length}
      <p class="small muted">
        Ultimi {realistici.length}: promossi {realistici.filter((e) => e.promosso).length}, media errori
        {(realistici.reduce((a, e) => a + e.errori, 0) / realistici.length).toFixed(1).replace('.', ',')}
      </p>
      <GraficoBarre valori={realistici.map((e) => e.errori)} limite={cfg.esame.errori_max} etichette={realistici.map((e) => data(e.data))} />
      <details class="small">
        <summary>Tabella dati</summary>
        <table>
          <thead><tr><th>Data</th><th>Errori</th><th>Esito</th></tr></thead>
          <tbody>
            {#each [...realistici].reverse() as e (e.data)}
              <tr><td>{data(e.data)}</td><td>{e.errori}</td><td>{e.promosso ? 'Promosso' : 'Respinto'}</td></tr>
            {/each}
          </tbody>
        </table>
      </details>
    {:else}
      <p class="muted small">Nessun esame realistico ancora. Sono la prova più affidabile: estrazione casuale, senza priorità sugli errori.</p>
      <button class="btn" type="button" onclick={() => app.avviaEsame('realistico')}>Fai un esame realistico</button>
    {/if}
  </section>

  <section class="card stack">
    <div class="row">
      <h2 style="margin:0">Per argomento</h2>
      <span style="flex:1"></span>
      <select bind:value={ordine} style="width:auto" aria-label="Ordina">
        <option value="id">Ordine ministeriale</option>
        <option value="padronanza">Padronanza crescente</option>
      </select>
    </div>
    <div class="tab">
      {#each righe as x (x.argomento.id)}
        <div class="riga">
          <div class="nome small"><strong>{x.argomento.id}. {x.argomento.breve}</strong></div>
          <div class="metr tiny muted">
            <span>Copertura {percentuale(x.copertura)}</span>
            <div class="bar"><span style="width:{x.copertura * 100}%"></span></div>
            <span>Padronanza {percentuale(x.padronanza)}</span>
            <div class="bar"><span style="width:{x.padronanza * 100}%"></span></div>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .verdetto {
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
  .kpi {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .big {
    font-size: 2.6rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .mid {
    font-size: 1.8rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    margin-bottom: 6px;
  }
  .spiega {
    margin: 10px 0 0;
  }
  .deboli {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .deboli li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--line);
  }
  .deboli li span span {
    display: block;
  }
  .tab {
    display: grid;
    gap: 12px;
  }
  .metr {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 4px 10px;
    align-items: center;
    margin-top: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  th,
  td {
    text-align: left;
    padding: 4px 6px;
    border-bottom: 1px solid var(--line);
  }
</style>
