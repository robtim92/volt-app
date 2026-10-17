/**
 * "Look inside the wire": a zoomed-in cartoon of the copper, with electrons
 * jiggling thermally and drifting with the current. The drift is sped up so
 * it's visible (real drift is well under a millimetre per second) and the
 * speed-up factor is shown. A second strip shows the same current through a
 * different gauge for comparison.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { liveFrame } from '@stores/liveSimStore'
import { useUIStore } from '@stores/uiStore'
import { formatValue } from '../../sim/elements'
import { wireLength } from '../../sim/netlist'
import { wireCurrent } from '../../sim/measure'
import { DEFAULT_GAUGE, GAUGE_OPTIONS, ampacity, areaMm2, diameterMm, driftVelocity, gaugeLabel, ohmsPerMetre } from '../../sim/wire'

/** screen px/s per m/s of real drift */
const SPEEDUP = 1e6
const MAX_PX_PER_S = 300

interface Particle {
  x: number
  y: number
  phase: number
}

function makeElectrons(n: number, w: number): Particle[] {
  return Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random(), phase: Math.random() * Math.PI * 2 }))
}

function fmtDrift(v: number): string {
  if (v === 0) return '0'
  if (v < 1e-3) return `${(v * 1e6).toPrecision(3)} µm/s`
  return `${(v * 1e3).toPrecision(3)} mm/s`
}

export default function WireZoom(): JSX.Element | null {
  const wireZoomId = useUIStore((s) => s.wireZoomId)
  const setWireZoom = useUIStore((s) => s.setWireZoom)
  const wires = useCircuitStore((s) => s.wires)
  const components = useCircuitStore((s) => s.components)
  const simResult = useCircuitStore((s) => s.simResult)
  const wire = wires.find((w) => w.id === wireZoomId) ?? null
  const gauge = wire?.gauge ?? DEFAULT_GAUGE
  const [compare, setCompare] = useState<number>(gauge >= 18 ? 12 : 22)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const current = wire && simResult?.solved ? Math.abs(wireCurrent(wire, simResult) ?? 0) : 0
  const live = useRef({ current, gauge, compare, damaged: !!wire?.damaged })
  live.current = { current, gauge, compare, damaged: !!wire?.damaged }

  const length = useMemo(() => {
    if (!wire) return 0
    return wireLength(wire, new Map(components.map((c) => [c.id, c])))
  }, [wire, components])

  useEffect(() => {
    if (!wire) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setWireZoom(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wire, setWireZoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !wireZoomId) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = performance.now()
    const strips: { electrons: Particle[]; offset: number }[] = [
      { electrons: [], offset: 0 },
      { electrons: [], offset: 0 }
    ]
    const draw = (now: number): void => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const dpr = window.devicePixelRatio || 1
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
        canvas.width = Math.round(W * dpr)
        canvas.height = Math.round(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const { current: I, gauge: g0, compare: g1, damaged } = live.current
      const heat = wireZoomId ? liveFrame.heat[wireZoomId] ?? 0 : 0
      const laneH = H / 2
      const maxD = diameterMm(4)
      ;[g0, g1].forEach((g, k) => {
        const strip = strips[k]
        const cy = laneH * k + laneH / 2 + 6
        const bandH = Math.max(8, (laneH - 34) * (diameterMm(g) / maxD))
        const top = cy - bandH / 2
        // insulation + copper
        ctx.fillStyle = k === 0 ? '#1e293b' : '#334155'
        ctx.fillRect(0, top - 5, W, bandH + 10)
        const hot = k === 0 ? Math.max(0, Math.min(1, (heat - 0.5) / 1.5)) : 0
        ctx.fillStyle = `rgb(${Math.round(184 + 60 * hot)},${Math.round(115 - 40 * hot)},${Math.round(51 - 30 * hot)})`
        ctx.fillRect(0, top, W, bandH)
        if (k === 0 && damaged) {
          ctx.fillStyle = '#0b0b0b'
          ctx.fillRect(W / 2 - 18, top - 5, 36, bandH + 10)
        }
        // copper ion lattice, vibrating more when hot
        const spacing = 14
        const jig = 0.6 + (k === 0 ? heat : 0) * 1.6
        ctx.fillStyle = 'rgba(120,53,15,0.55)'
        for (let x = spacing / 2; x < W; x += spacing) {
          for (let y = top + spacing / 2; y < top + bandH; y += spacing) {
            ctx.beginPath()
            ctx.arc(x + (Math.random() - 0.5) * jig, y + (Math.random() - 0.5) * jig, 2.2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
        // electrons: density is fixed, so count follows the copper area on screen
        const want = Math.round((W * bandH) / 260)
        if (strip.electrons.length !== want) strip.electrons = makeElectrons(want, W)
        const drift = damaged && k === 0 ? 0 : driftVelocity(I, g)
        const pxs = Math.min(MAX_PX_PER_S, drift * SPEEDUP)
        ctx.fillStyle = '#60a5fa'
        for (const e of strip.electrons) {
          e.phase += dt * 9
          e.x -= pxs * dt // electrons move against conventional current
          if (e.x < 0) e.x += W
          const jx = Math.cos(e.phase * 1.7) * 2.5
          const jy = Math.sin(e.phase) * 2.5
          const y = top + 3 + e.y * (bandH - 6) + jy
          ctx.beginPath()
          ctx.arc(e.x + jx, y, 1.8, 0, Math.PI * 2)
          ctx.fill()
        }
        // label
        ctx.fillStyle = '#e2e8f0'
        ctx.font = '600 12px Inter, system-ui, sans-serif'
        ctx.fillText(
          `${k === 0 ? 'This wire' : 'Compare'} · ${gaugeLabel(g)} · ${fmtDrift(drift)} drift${pxs >= MAX_PX_PER_S ? ' (capped)' : ''}`,
          8,
          laneH * k + 14
        )
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [wireZoomId])

  if (!wire) return null
  const area = areaMm2(gauge)
  const density = current / area
  const r = ohmsPerMetre(gauge) * length
  const heat = liveFrame.heat[wire.id] ?? 0
  const rows: [string, string][] = [
    ['Current', formatValue(current, 'A')],
    ['Gauge', `${gaugeLabel(gauge)} · ${diameterMm(gauge).toFixed(2)} mm`],
    ['Copper area', `${area.toPrecision(3)} mm²`],
    ['Current density', `${density.toPrecision(3)} A/mm²`],
    ['Drift speed', fmtDrift(driftVelocity(current, gauge))],
    ['Resistance', formatValue(r, 'Ω')],
    ['Voltage drop', formatValue(current * r, 'V')],
    ['Heat vs rating', `${Math.round((current / ampacity(gauge)) * 100)}% of ${formatValue(ampacity(gauge), 'A')}${heat > 1 ? ' · hot!' : ''}`]
  ]

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60 md:p-6" onClick={() => setWireZoom(null)}>
      <div
        className="w-full md:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-white dark:bg-brand-dark border border-gray-200 dark:border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Look inside the wire"
        data-testid="wire-zoom"
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">🔍 Inside the wire</h2>
          <button onClick={() => setWireZoom(null)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-lg px-2" aria-label="Close">
            ×
          </button>
        </div>
        <div className="px-4 pt-2">
          <canvas ref={canvasRef} className="w-full h-56 md:h-64 rounded-lg bg-slate-900" />
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Electrons (blue) jiggle fast in random directions, but only creep along the wire. Drift is shown about {SPEEDUP.toLocaleString()} times faster than real life.
          </p>
        </div>
        <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">{k}</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{v}</span>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <label htmlFor="wz-compare">Compare with</label>
          <select
            id="wz-compare"
            value={compare}
            onChange={(e) => setCompare(Number(e.target.value))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark"
          >
            {GAUGE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {gaugeLabel(g)}
              </option>
            ))}
          </select>
          <span className="text-gray-500 dark:text-gray-400">carrying the same current</span>
        </div>
        <p className="px-4 pb-4 text-xs text-gray-600 dark:text-gray-300">
          The signal travels at near light speed, but each electron only drifts a fraction of a millimetre per second. A thinner wire packs the same current into less copper, so electrons drift faster, bump into the lattice more, and the wire heats up.
        </p>
      </div>
    </div>
  )
}
