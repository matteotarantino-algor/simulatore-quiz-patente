<script lang="ts">
  import { app } from '../lib/app.svelte'
  import { esportaProgressi, importaProgressi } from '../lib/progress'

  let messaggio = $state<{ ok: boolean; testo: string } | null>(null)
  let confermaAzzera = $state(false)
  let file: HTMLInputElement | undefined = $state()

  const nViste = $derived(Object.values(app.progressi.domande).filter((s) => s.visto > 0).length)

  function esporta() {
    const blob = new Blob([esportaProgressi(app.progressi, app.listato!.meta.versione_listato)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `progressi-quiz-patente-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    messaggio = { ok: true, testo: 'File dei progressi scaricato.' }
  }

  async function importa(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    try {
      const p = importaProgressi(await f.text())
      app.sostituisciProgressi(p)
      messaggio = { ok: true, testo: `Progressi importati: ${Object.keys(p.domande).length} domande, ${p.esami.length} esami.` }
    } catch (err) {
      messaggio = { ok: false, testo: (err as Error).message }
    }
    if (file) file.value = ''
  }
</script>

<div class="wrap stack">
  <h1>Progressi</h1>
  <section class="card stack">
    <p>
      I progressi ({nViste.toLocaleString('it-IT')} domande viste, {app.progressi.esami.length} esami) sono salvati
      <strong>solo in questo browser</strong>, su questo dispositivo. Nessun dato viene inviato a server.
    </p>
    <p class="small muted">
      Per passare da PC a telefono (o viceversa): <em>Esporta</em> qui, invia il file all'altro dispositivo e lì usa
      <em>Importa</em>. L'importazione sostituisce i progressi presenti.
    </p>
    {#if !app.salvataggioOk}
      <p class="badge bad">Attenzione: il browser non consente il salvataggio (navigazione privata?). Esporta i progressi prima di chiudere.</p>
    {/if}
    <div class="row">
      <button class="btn primary" type="button" onclick={esporta}>Esporta progressi (JSON)</button>
      <label class="btn">
        Importa progressi
        <input bind:this={file} type="file" accept="application/json,.json" onchange={importa} hidden />
      </label>
    </div>
    {#if messaggio}
      <p class="badge" class:good={messaggio.ok} class:bad={!messaggio.ok} role="status">{messaggio.testo}</p>
    {/if}
  </section>

  <section class="card stack">
    <h2>Azzera</h2>
    <p class="small muted">Cancella tutti i progressi, gli esami e l'andamento da questo browser. Non si può annullare.</p>
    {#if !confermaAzzera}
      <button class="btn danger" type="button" onclick={() => (confermaAzzera = true)}>Azzera i progressi…</button>
    {:else}
      <div class="row">
        <button class="btn" type="button" onclick={() => (confermaAzzera = false)}>Annulla</button>
        <button
          class="btn danger"
          type="button"
          onclick={() => {
            app.azzera()
            confermaAzzera = false
            messaggio = { ok: true, testo: 'Progressi azzerati.' }
          }}>Sì, azzera tutto</button
        >
      </div>
    {/if}
  </section>
</div>
