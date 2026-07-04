/**
 * Volt — Oscilloscope
 *
 * A collapsible bottom drawer that reconstructs and plots the time-domain
 * waveform v(t) = peak·cos(ωt + φ) for probed signals, using the AC phasor
 * result in the circuit store. Shows input-vs-output phase shift — the payoff
 * of the AC track.
 *
 * Which signals are plotted:
 *   - a selected wire  → that net's voltage
 *   - a selected component → its terminal node voltages
 *   - nothing selected → every non-ground node (capped)
 *
 * The waveform grid + traces render on a canvas; the header and legend are HTML
 * (testable, accessible). Voltage-only for now (currents share no axis).
 */
import { useEffect, useRef } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { useUIStore } from '@stores/uiStore'
import { ELEMENTS } from '../../sim/elements'
import { terminalKey } from '../../sim/netlist'
import { sampleWave, periodSeconds } from '../../sim/waveform'

const TRACE_COLORS = ['#E8B500', '#3b82f6', '#22c55e', '#ef4444', '#a855f7']
const MAX_DEFAULT_TRACES = 5
const PERIODS = 2

interface Trace {
  label: string
  peak: number
  phaseDeg: number
  color: string
}

export default function Oscilloscope(): JSX.Element {
  const simResult = useCircuitStore((s) => s.simResult)
  const selectedComponentId = useCircuitStore((s) => s.selectedComponentId)
  const selectedWireId = useCircuitStore((s) => s.selectedWireId)
  const components = useCircuitStore((s) => s.components)
  const wires = useCircuitStore((s) => s.wires)
  const setScopeOpen = useUIStore((s) => s.setScopeOpen)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const ac = simResult?.ac === true && simResult.solved && !!simResult.omega
  const omega = simResult?.omega ?? 0
  const freqHz = omega ? omega / (2 * Math.PI) : 0

  // ── Which traces to plot ──
  const traces: Trace[] = []
  if (ac && simResult) {
    const nvp = simResult.nodeVoltagePhase ?? {}
    const nodeTrace = (node: string, label: string, color: string): Trace => ({
      label,
      peak: simResult.nodeVoltages[node] ?? 0,
      phaseDeg: nvp[node] ?? 0,
      color
    })

    const wire = selectedWireId ? wires.find((w) => w.id === selectedWireId) : undefined
    const component = selectedComponentId
      ? components.find((c) => c.id === selectedComponentId)
      : undefined

    if (wire) {
      const node = simResult.terminalNodes[terminalKey(wire.fromComponentId, wire.fromTerminal)]
      if (node) traces.push(nodeTrace(node, 'Net', TRACE_COLORS[0]))
    } else if (component) {
      const def = ELEMENTS[component.type]
      def.terminals.forEach((t, i) => {
        const node = simResult.terminalNodes[terminalKey(component.id, i)]
        if (node && node !== 'gnd') {
          traces.push(nodeTrace(node, t.name ?? `Pin ${i + 1}`, TRACE_COLORS[traces.length % TRACE_COLORS.length]))
        }
      })
    }

    if (traces.length === 0) {
      const seen = new Set<string>()
      for (const node of Object.keys(simResult.nodeVoltages)) {
        if (node === 'gnd' || seen.has(node)) continue
        seen.add(node)
        traces.push(nodeTrace(node, node, TRACE_COLORS[traces.length % TRACE_COLORS.length]))
        if (traces.length >= MAX_DEFAULT_TRACES) break
      }
    }
  }

  // ── Canvas draw ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // jsdom / test

    const dark = useUIStore.getState().darkMode

    const draw = (): void => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      const w = rect.width
      const h = rect.height
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const bg = dark ? '#0b0b14' : '#fbfbfd'
      const gridColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
      const axisColor = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, w, h)

      const padL = 8
      const padR = 8
      const padY = 10
      const plotW = w - padL - padR
      const plotH = h - padY * 2
      const midY = padY + plotH / 2

      if (!ac || traces.length === 0 || omega <= 0) {
        return
      }

      const amp = Math.max(1e-9, ...traces.map((t) => Math.abs(t.peak))) * 1.1
      const total = periodSeconds(omega) * PERIODS
      const xOf = (t: number): number => padL + (t / total) * plotW
      const yOf = (v: number): number => midY - (v / amp) * (plotH / 2)

      // grid: vertical per half-period, horizontal quarters
      ctx.strokeStyle = gridColor
      ctx.lineWidth = 1
      const period = periodSeconds(omega)
      for (let k = 0; k <= PERIODS * 2; k++) {
        const x = xOf((period / 2) * k)
        ctx.beginPath()
        ctx.moveTo(x, padY)
        ctx.lineTo(x, padY + plotH)
        ctx.stroke()
      }
      for (let r = -2; r <= 2; r++) {
        const y = midY - (r / 2) * (plotH / 2)
        ctx.beginPath()
        ctx.moveTo(padL, y)
        ctx.lineTo(padL + plotW, y)
        ctx.stroke()
      }
      // zero axis
      ctx.strokeStyle = axisColor
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.moveTo(padL, midY)
      ctx.lineTo(padL + plotW, midY)
      ctx.stroke()

      // traces
      for (const tr of traces) {
        const { t, v } = sampleWave(tr.peak, tr.phaseDeg, omega, PERIODS, 300)
        ctx.strokeStyle = tr.color
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < t.length; i++) {
          const x = xOf(t[i])
          const y = yOf(v[i])
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    draw()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null
    observer?.observe(canvas)
    return () => observer?.disconnect()
  }, [ac, omega, traces.map((t) => `${t.label}:${t.peak.toFixed(6)}:${t.phaseDeg.toFixed(2)}:${t.color}`).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="shrink-0 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-brand-navy/40">
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Oscilloscope</span>
          {ac && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {freqHz >= 1000 ? `${(freqHz / 1000).toFixed(2)} kHz` : `${Math.round(freqHz)} Hz`} ·{' '}
              {PERIODS} periods
            </span>
          )}
        </div>
        <button
          onClick={() => setScopeOpen(false)}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-lg leading-none"
          aria-label="Close oscilloscope"
        >
          ×
        </button>
      </div>

      {ac ? (
        <div className="px-3 pb-2">
          <canvas ref={canvasRef} data-testid="scope-canvas" className="w-full h-32 block rounded" />
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
            {traces.map((t) => (
              <span key={t.label} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span className="inline-block w-3 h-1.5 rounded-sm" style={{ backgroundColor: t.color }} />
                <span className="font-medium">{t.label}</span>
                <span className="font-mono text-gray-500 dark:text-gray-400">
                  {t.peak.toPrecision(3)} Vpk · {(t.peak / Math.SQRT2).toPrecision(3)} Vrms · ∠{Math.round(t.phaseDeg)}°
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="px-3 pb-3 text-xs text-gray-400 dark:text-gray-500">
          Add an AC source (and probe a wire or component) to see its waveform here.
        </p>
      )}
    </div>
  )
}
