<script lang="ts">
  /** Pulsante ⓘ che apre la spiegazione tratta dal listato. */
  let { onclick, label }: { onclick: () => void; label?: string } = $props()
</script>

<button type="button" class="info" class:con-testo={!!label} {onclick} aria-label="Cosa dice il listato" title="Cosa dice il listato">
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
    <rect x="11" y="10" width="2" height="7" rx="1" fill="currentColor" />
    <circle cx="12" cy="7" r="1.3" fill="currentColor" />
  </svg>
  {#if label}<span>{label}</span>{/if}
</button>

<style>
  .info {
    flex: none;
    min-width: 40px;
    height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--accent-ink);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .info:hover {
    background: var(--surface-2);
  }
  .con-testo {
    padding: 0 12px 0 10px;
  }
</style>
