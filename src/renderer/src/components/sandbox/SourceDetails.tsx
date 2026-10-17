/**
 * Inspector block for batteries (chemistry, cells, state of charge, sag) and
 * bench supplies (current limit, CV/CC mode).
 */
import { useEffect, useState } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { liveFrame } from '@stores/liveSimStore'
import { formatValue, parseValue, type CircuitComponent } from '../../sim/elements'
import { CHEMISTRIES, cellOcv, hoursRemaining, packResistance, type Chemistry } from '../../sim/battery'
import { batteryParams } from '../../sim/netlist'

const field =
  'mt-1 w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100'

function fmtHours(h: number): string {
  if (!Number.isFinite(h)) return '—'
  if (h < 1 / 60) return `${Math.round(h * 3600)} s`
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 48) return `${h.toFixed(1)} h`
  return `${Math.round(h / 24)} days`
}

export function BatteryDetails({ c }: { c: CircuitComponent }): JSX.Element {
  const updateComponent = useCircuitStore((s) => s.updateComponent)
  const checkpoint = useCircuitStore((s) => s.checkpoint)
  const simResult = useCircuitStore((s) => s.simResult)
  const p = batteryParams(c, liveFrame.soc)
  const chem = CHEMISTRIES[p.chemistry]
  const nominal = cellOcv(p.chemistry, 0.5) * p.cells
  const delivered = -(simResult?.elementCurrents[c.id] ?? 0)
  const socPct = Math.round(p.soc * 100)
  return (
    <div className="mb-3 space-y-2" data-testid="battery-details">
      <label className="block">
        <span className="text-xs text-gray-500 dark:text-gray-400">Chemistry</span>
        <select
          value={p.chemistry}
          onChange={(e) => {
            const chemistry = e.target.value as Chemistry
            checkpoint()
            updateComponent(c.id, { chemistry, cells: CHEMISTRIES[chemistry].defaultCells })
          }}
          aria-label="Battery chemistry"
          className={field}
        >
          {(Object.keys(CHEMISTRIES) as Chemistry[]).map((k) => (
            <option key={k} value={k}>
              {CHEMISTRIES[k].name} · {CHEMISTRIES[k].capacityAh} Ah
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-gray-500 dark:text-gray-400">Cells in series</span>
        <input
          type="number"
          min={1}
          max={48}
          value={p.cells}
          onChange={(e) => {
            const n = Math.max(1, Math.min(48, Math.round(Number(e.target.value) || 1)))
            checkpoint()
            updateComponent(c.id, { cells: n })
          }}
          aria-label="Cells in series"
          className={field}
        />
      </label>
      <div>
        <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
          <span>Charge</span>
          <span>{socPct}%</span>
        </div>
        <div className="h-2 rounded bg-gray-200 dark:bg-white/10 overflow-hidden">
          <div className={`h-full ${socPct < 15 ? 'bg-red-500' : socPct < 40 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${socPct}%` }} />
        </div>
      </div>
      <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
        <p className="flex justify-between"><span>Nominal</span><span className="font-mono">{formatValue(nominal, 'V')}</span></p>
        <p className="flex justify-between"><span>Internal resistance</span><span className="font-mono">{formatValue(packResistance(p), 'Ω')}</span></p>
        <p className="flex justify-between"><span>Delivering</span><span className="font-mono">{formatValue(Math.max(0, delivered), 'A')}</span></p>
        <p className="flex justify-between"><span>Time left at this rate</span><span className="font-mono">{fmtHours(hoursRemaining(p, delivered))}</span></p>
        <p className="text-[11px] text-gray-400">Comfortable continuous current: about {formatValue(chem.maxCurrent, 'A')}</p>
      </div>
      <button
        onClick={() => {
          liveFrame.soc[c.id] = 1
          updateComponent(c.id, { soc: 1 })
        }}
        className="w-full px-2 py-1 text-xs rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
      >
        🔌 Recharge to 100%
      </button>
    </div>
  )
}

export function SupplyDetails({ c }: { c: CircuitComponent }): JSX.Element {
  const updateComponent = useCircuitStore((s) => s.updateComponent)
  const checkpoint = useCircuitStore((s) => s.checkpoint)
  useCircuitStore((s) => s.simResult)
  const limit = c.currentLimit ?? 1
  const [text, setText] = useState(formatValue(limit))
  useEffect(() => setText(formatValue(limit)), [limit, c.id])
  const mode = liveFrame.supplyMode[c.id] ?? 'CV'
  const commit = (): void => {
    const v = parseValue(text)
    if (v !== null && v > 0) {
      checkpoint()
      updateComponent(c.id, { currentLimit: v })
    }
  }
  return (
    <div className="mb-3 space-y-2" data-testid="supply-details">
      <label className="block">
        <span className="text-xs text-gray-500 dark:text-gray-400">Current limit (A)</span>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} aria-label="Current limit" className={field} />
      </label>
      <p className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-300">Mode</span>
        <span
          className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${mode === 'CC' ? 'bg-red-500/15 text-red-500' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}
          title={mode === 'CC' ? 'Constant current: the load wants more than the limit, so the voltage drops' : 'Constant voltage: holding the set voltage'}
        >
          {mode}
        </span>
      </p>
      <p className="text-[11px] text-gray-400">
        CV holds the set voltage; when the load would draw more than the limit, the supply switches to CC and lowers its voltage instead.
      </p>
    </div>
  )
}
