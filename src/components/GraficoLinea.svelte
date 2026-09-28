<script lang="ts">
  /** Linea a serie singola su scala 0–1 con crosshair e tooltip. */
  let {
    punti,
    soglia = null,
    etichettaSoglia = '',
    formattaY,
    formattaX,
  }: {
    punti: { x: number; y: number }[]
    soglia?: number | null
    etichettaSoglia?: string
    formattaY: (y: number) => string
    formattaX: (x: number) => string
  } = $props()

  let W = $state(640)
  const H = $derived(Math.max(170, Math.min(220, W * 0.45)))
  const M = { t: 12, r: 14, b: 26, l: 40 }
  const iw = $derived(W - M.l - M.r)
  const ih = $derived(H - M.t - M.b)

  const sx = (i: number) => M.l + (punti.length <= 1 ? iw / 2 : (i / (punti.length - 1)) * iw)
  const sy = (y: number) => M.t + (1 - y) * ih
  const path = $derived(punti.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(''))
  let hover = $state<number | null>(null)
  let svg: SVGSVGElement | undefined = $state()

  function move(e: PointerEvent) {
    if (!svg || !punti.length) return
    const r = svg.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const i = punti.length <= 1 ? 0 : Math.round(((x - M.l) / iw) * (punti.length - 1))
    hover = Math.max(0, Math.min(punti.length - 1, i))
  }
</script>

<div class="chart" bind:clientWidth={W}>
  <svg
    bind:this={svg}
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label="Grafico dell'andamento"
    onpointermove={move}
    onpointerdown={move}
    onpointerleave={() => (hover = null)}
  >
    {#each [0, 0.25, 0.5, 0.75, 1] as g (g)}
      <line class="grid" x1={M.l} x2={W - M.r} y1={sy(g)} y2={sy(g)} />
      <text class="ax" x={M.l - 6} y={sy(g) + 4} text-anchor="end">{formattaY(g)}</text>
    {/each}
    {#if soglia !== null}
      <line class="soglia" x1={M.l} x2={W - M.r} y1={sy(soglia)} y2={sy(soglia)} />
      <text class="ax" x={W - M.r} y={sy(soglia) - 5} text-anchor="end">{etichettaSoglia}</text>
    {/if}
    {#if punti.length}
      <text class="ax" x={M.l} y={H - 6}>{formattaX(punti[0].x)}</text>
      <text class="ax" x={W - M.r} y={H - 6} text-anchor="end">{formattaX(punti[punti.length - 1].x)}</text>
      <path class="line" d={path} />
      {#if punti.length === 1}<circle class="dot" cx={sx(0)} cy={sy(punti[0].y)} r="4" />{/if}
      {#if hover !== null}
        <line class="cross" x1={sx(hover)} x2={sx(hover)} y1={M.t} y2={M.t + ih} />
        <circle class="dot" cx={sx(hover)} cy={sy(punti[hover].y)} r="5" />
      {/if}
    {/if}
    <rect x={M.l} y={M.t} width={iw} height={ih} fill="transparent" />
  </svg>
  {#if hover !== null}
    <div class="tip" style="left:clamp(60px, {(sx(hover) / W) * 100}%, calc(100% - 60px))">
      <strong>{formattaY(punti[hover].y)}</strong><br /><span>{formattaX(punti[hover].x)}</span>
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
    touch-action: pan-y;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .ax {
    fill: var(--ink-3);
    font-size: 11px;
  }
  .soglia {
    stroke: var(--ink-3);
    stroke-dasharray: 4 4;
  }
  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .cross {
    stroke: var(--ink-3);
  }
  .dot {
    fill: var(--accent);
    stroke: var(--surface);
    stroke-width: 2;
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
