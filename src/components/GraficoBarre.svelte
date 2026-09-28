<script lang="ts">
  /** Barre verticali (errori per esame) con linea del limite e tooltip. */
  let {
    valori,
    limite,
    etichette,
  }: { valori: number[]; limite: number; etichette: string[] } = $props()

  let W = $state(640)
  const H = $derived(Math.max(170, Math.min(200, W * 0.45)))
  const M = { t: 12, r: 14, b: 22, l: 32 }
  const iw = $derived(W - M.l - M.r)
  const ih = $derived(H - M.t - M.b)
  const max = $derived(Math.max(limite + 2, ...valori))
  const sy = (v: number) => M.t + (1 - v / max) * ih
  const passo = $derived(iw / Math.max(valori.length, 1))
  const bw = $derived(Math.max(4, Math.min(28, passo - 2)))
  const ticks = $derived(Array.from({ length: Math.floor(max / 2) + 1 }, (_, i) => i * 2))
  let hover = $state<number | null>(null)
</script>

<div class="chart" bind:clientWidth={W}>
  <svg viewBox="0 0 {W} {H}" role="img" aria-label="Errori negli esami realistici" onpointerleave={() => (hover = null)}>
    {#each ticks as t (t)}
      <line class="grid" x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} />
      <text class="ax" x={M.l - 6} y={sy(t) + 4} text-anchor="end">{t}</text>
    {/each}
    {#each valori as v, i (i)}
      {@const x = M.l + i * passo + (passo - bw) / 2}
      <path
        class="barra"
        class:attiva={hover === i}
        d={v > 0
          ? `M${x},${sy(0)} V${sy(v) + 4} Q${x},${sy(v)} ${x + 4},${sy(v)} H${x + bw - 4} Q${x + bw},${sy(v)} ${x + bw},${sy(v) + 4} V${sy(0)} Z`
          : `M${x},${sy(0) - 2} H${x + bw} V${sy(0)} H${x} Z`}
      />
      <rect
        x={M.l + i * passo}
        y={M.t}
        width={passo}
        height={ih}
        fill="transparent"
        role="presentation"
        onpointerenter={() => (hover = i)}
        onpointerdown={() => (hover = i)}
      />
    {/each}
    <line class="limite" x1={M.l} x2={W - M.r} y1={sy(limite + 0.5)} y2={sy(limite + 0.5)} />
    <text class="ax" x={W - M.r} y={sy(limite + 0.5) - 5} text-anchor="end">limite: max {limite} errori</text>
  </svg>
  {#if hover !== null}
    <div class="tip" style="left:clamp(80px, {((M.l + hover * passo + passo / 2) / W) * 100}%, calc(100% - 80px))">
      <strong>{valori[hover]} {valori[hover] === 1 ? 'errore' : 'errori'}</strong> · {valori[hover] <= limite ? 'promosso' : 'respinto'}<br />
      <span>{etichette[hover]}</span>
    </div>
  {/if}
</div>

<style>
  .chart {
    position: relative;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .grid {
    stroke: var(--line);
  }
  .ax {
    fill: var(--ink-3);
    font-size: 11px;
  }
  .barra {
    fill: var(--accent);
  }
  .barra.attiva {
    fill: var(--accent-ink);
  }
  .limite {
    stroke: var(--ink-3);
    stroke-dasharray: 4 4;
  }
  .tip {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 4px 8px;
    font-size: 0.8rem;
    pointer-events: none;
    white-space: nowrap;
    box-shadow: var(--shadow);
  }
  .tip span {
    color: var(--ink-2);
  }
</style>
