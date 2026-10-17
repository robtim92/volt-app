/**
 * Inspector block for a wire: gauge, length, resistance, voltage drop, load
 * against its rating, repair, and the "look inside" view.
 */
import { useEffect, useState } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { liveFrame } from '@stores/liveSimStore'
import { useUIStore } from '@stores/uiStore'
import { formatValue, parseValue, type Wire } from '../../sim/elements'
import { wireLength } from '../../sim/netlist'
import { DEFAULT_GAUGE, GAUGE_OPTIONS, ampacity, areaMm2, gaugeLabel, ohmsPerMetre } from '../../sim/wire'
import { WIRE_PROFILE } from '../../sim/thermal'

const fmtLength = (m: number): string => (m >= 1 ? `${parseFloat(m.toPrecision(3))} m` : `${parseFloat((m * 100).toPrecision(3))} cm`)

export default function WireDetails({ wire, current }: { wire: Wire; current: number | null }): JSX.Element {
  const updateWire = useCircuitStore((s) => s.updateWire)
  const checkpoint = useCircuitStore((s) => s.checkpoint)
  const components = useCircuitStore((s) => s.components)
  const setWireZoom = useUIStore((s) => s.setWireZoom)
  const setWireStyle = useUIStore((s) => s.setWireStyle)
  const defaultStyle = useUIStore((s) => s.wireStyle)
  const style = wire.style ?? defaultStyle
  const touchHint = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  useCircuitStore((s) => s.simResult) // re-render on live publishes
  const gauge = wire.gauge ?? DEFAULT_GAUGE
  const byId = new Map(components.map((c) => [c.id, c]))
  const length = wireLength(wire, byId)
  const resistance = ohmsPerMetre(gauge) * length
  const rating = ampacity(gauge)
  const heat = liveFrame.heat[wire.id] ?? 0
  const pct = Math.min(100, (heat / WIRE_PROFILE.failAt) * 100)
  const i = Math.abs(current ?? 0)

  const [lenText, setLenText] = useState(wire.length !== undefined ? String(wire.length) : '')
  useEffect(() => setLenText(wire.length !== undefined ? String(wire.length) : ''), [wire.id, wire.length])

  const commitLength = (): void => {
    const t = lenText.trim()
    checkpoint()
    if (t === '') {
      updateWire(wire.id, { length: undefined })
      return
    }
    const v = parseValue(t)
    if (v !== null && v > 0) updateWire(wire.id, { length: v })
  }

  return (
    <div className="mt-3 space-y-2" data-testid="wire-details">
      <label className="block">
        <span className="text-xs text-gray-500 dark:text-gray-400">Wire gauge</span>
        <select
          value={gauge}
          onChange={(e) => {
            checkpoint()
            updateWire(wire.id, { gauge: Number(e.target.value) })
          }}
          aria-label="Wire gauge"
          className="mt-1 w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
        >
          {GAUGE_OPTIONS.map((g) => (
            <option key={g} value={g}>
              {gaugeLabel(g)} · {areaMm2(g).toPrecision(2)} mm² · {ampacity(g)} A
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-gray-500 dark:text-gray-400">Length (m) — blank = as drawn ({fmtLength(length)})</span>
        <input
          type="text"
          value={lenText}
          placeholder={`${parseFloat(length.toPrecision(3))}`}
          onChange={(e) => setLenText(e.target.value)}
          onBlur={commitLength}
          onKeyDown={(e) => e.key === 'Enter' && commitLength()}
          aria-label="Wire length"
          className="mt-1 w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
        />
      </label>
      <div>
        <span className="text-xs text-gray-500 dark:text-gray-400">Corners</span>
        <div className="mt-1 flex gap-1" role="group" aria-label="Wire corners">
          {(['square', 'rounded'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                checkpoint()
                updateWire(wire.id, { style: st })
              }}
              aria-pressed={style === st}
              className={`flex-1 px-2 py-1 text-xs rounded border ${style === st ? 'border-brand-yellow bg-brand-yellow/15 text-gray-900 dark:text-gray-100' : 'border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-300'}`}
            >
              {st === 'square' ? '┐ Square' : '╮ Rounded'}
            </button>
          ))}
          <button
            onClick={() => {
              checkpoint()
              updateWire(wire.id, { points: undefined })
            }}
            disabled={!wire.points}
            title="Reset to the automatic route"
            className="flex-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-300 disabled:opacity-40"
          >
            Straighten
          </button>
        </div>
        <button
          onClick={() => {
            checkpoint()
            setWireStyle(style)
            for (const w of useCircuitStore.getState().wires) if (w.style) updateWire(w.id, { style: undefined })
          }}
          className="mt-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
        >
          Use {style} corners for every wire
        </button>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          Drag a section to move it · {touchHint ? 'double-tap' : 'double-click'} the wire to add a bend, a corner to remove it
        </p>
      </div>
      <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
        <p className="flex justify-between"><span>Resistance</span><span className="font-mono">{formatValue(resistance, 'Ω')}</span></p>
        <p className="flex justify-between"><span>Voltage drop</span><span className="font-mono">{formatValue(i * resistance, 'V')}</span></p>
        <p className="flex justify-between"><span>Heat in wire</span><span className="font-mono">{formatValue(i * i * resistance, 'W')}</span></p>
      </div>
      {wire.damaged ? (
        <div>
          <p className="text-xs font-semibold text-red-500">🔥 Melted — this wire is now an open circuit.</p>
          <button
            onClick={() => {
              liveFrame.heat[wire.id] = 0
              updateWire(wire.id, { damaged: false })
            }}
            className="mt-1 w-full px-2 py-1 text-xs rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium"
          >
            Replace wire
          </button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
            <span>Load vs. {rating} A rating</span>
            <span>{Math.round((i / rating) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full ${heat >= 1.5 ? 'bg-red-500' : heat >= 1 ? 'bg-orange-500' : heat >= 0.6 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      <button
        onClick={() => setWireZoom(wire.id)}
        className="w-full px-2 py-1.5 text-sm rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 font-medium"
      >
        🔍 Look inside the wire
      </button>
    </div>
  )
}
