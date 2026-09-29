<script lang="ts">
  import { figuraUrl } from '../lib/app.svelte'

  let { src, size = 'md' }: { src: string; size?: 'sm' | 'thumb' | 'md' | 'lg' } = $props()
  let dialog: HTMLDialogElement | undefined = $state()

  const apri = () => dialog && !dialog.open && dialog.showModal()
  const chiudi = () => dialog?.open && dialog.close()
</script>

<button class="fig {size}" type="button" onclick={apri} aria-label="Ingrandisci la figura">
  <img src={figuraUrl(src)} alt="Figura della domanda" loading="lazy" decoding="async" />
  <span class="zoom" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.42 1.4-5.39-5.38A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm1 2v3h3v2h-3v3H9v-3H6V9h3V6h2Z"/></svg>
  </span>
</button>

<dialog bind:this={dialog} onclick={chiudi}>
  <img src={figuraUrl(src)} alt="Figura della domanda, ingrandita" />
  <p>Tocca per chiudere</p>
</dialog>

<style>
  .fig {
    position: relative;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #fff;
    line-height: 0;
    flex: none;
  }
  .fig img {
    width: 100%;
    height: auto;
    display: block;
  }
  .sm {
    width: 64px;
  }
  .thumb {
    width: 96px;
  }
  .md {
    width: min(200px, 42vw);
  }
  .lg {
    width: min(260px, 70vw);
  }
  .zoom {
    position: absolute;
    right: 4px;
    bottom: 4px;
    background: rgb(0 0 0 / 55%);
    color: #fff;
    border-radius: 6px;
    padding: 3px;
    line-height: 0;
  }
  .sm .zoom {
    display: none;
  }
  dialog {
    border: none;
    padding: 12px;
    background: #fff;
    border-radius: 12px;
    max-width: 96vw;
    max-height: 96dvh;
    text-align: center;
  }
  dialog::backdrop {
    background: rgb(0 0 0 / 80%);
  }
  dialog img {
    width: min(92vw, 80dvh, 640px);
    height: auto;
    display: block;
  }
  dialog p {
    margin: 8px 0 0;
    color: #555;
    font-size: 0.8rem;
  }
</style>
