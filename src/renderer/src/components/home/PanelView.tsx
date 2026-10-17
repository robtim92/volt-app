/**
 * The breaker panel: main breaker and leg meters on top, then the two columns
 * of spaces. Rows alternate between legs A and B; a double-pole breaker spans
 * two rows (both legs). Tap a breaker to select it, tap its handle to switch
 * it off / on or reset it.
 */
import { homeLive, useHomeStore } from '@stores/homeStore'
import type { BranchCircuit } from '../../home/types'
import { legOfSlot, legsOf } from '../../home/homeSim'
import { fmtAmps } from './useHomeClock'

const TYPE_BADGE: Record<string, string> = { gfci: 'GFCI', afci: 'AFCI', dual: 'DF' }

function LegMeter({ label, amps, rating }: { label: string; amps: number; rating: number }): JSX.Element {
  const pct = Math.min(100, (amps / rating) * 100)
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-12 text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex-1 h-1.5 rounded bg-gray-200 dark:bg-white/10 overflow-hidden">
        <div className={`h-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 text-right font-mono text-gray-700 dark:text-gray-300">{fmtAmps(amps)}</span>
    </div>
  )
}

function Breaker({ c, selected }: { c: BranchCircuit; selected: boolean }): JSX.Element {
  const select = useHomeStore((s) => s.select)
  const setBreaker = useHomeStore((s) => s.setBreaker)
  const r = homeLive.runtime.readings[c.id]
  const amps = r?.amps ?? 0
  const pct = Math.min(100, (amps / c.amps) * 100)
  const heat = homeLive.runtime.breakerHeat[c.id] ?? 0
  const handle = c.state === 'on' ? 'bg-gray-800 dark:bg-gray-200' : c.state === 'tripped' ? 'bg-red-500' : 'bg-gray-400'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => select(c.id)}
      onKeyDown={(e) => e.key === 'Enter' && select(c.id)}
      data-testid={`breaker-${c.id}`}
      className={`h-full flex items-stretch gap-1.5 rounded-md border px-1.5 py-1 cursor-pointer text-left transition-colors ${
        selected ? 'border-brand-yellow bg-brand-yellow/10' : c.state === 'tripped' ? 'border-red-400 bg-red-500/10' : 'border-gray-300 dark:border-white/15 bg-white dark:bg-white/5'
      }`}
    >
      <div className={`w-4 shrink-0 flex flex-col ${c.state === 'on' ? 'justify-start' : c.state === 'tripped' ? 'justify-center' : 'justify-end'}`}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setBreaker(c.id, c.state === 'on' ? 'off' : 'on')
          }}
          title={c.state === 'tripped' ? 'Reset breaker' : c.state === 'on' ? 'Switch off' : 'Switch on'}
          aria-label={`${c.name} breaker ${c.state}`}
          className={`w-4 h-5 rounded-sm ${handle} ${c.state === 'tripped' ? 'animate-pulse' : ''}`}
        />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 truncate">{c.name}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-hidden">
          <span className="font-mono">{c.amps} A</span>
          {c.poles === 2 && <span>· 240 V</span>}
          {TYPE_BADGE[c.type] && <span className="px-1 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300">{TYPE_BADGE[c.type]}</span>}
          <span className="ml-auto font-mono">{c.state === 'tripped' ? 'TRIPPED' : c.state === 'off' ? 'off' : fmtAmps(amps)}</span>
        </div>
        <div className="h-1 rounded bg-gray-200 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full ${heat > 1 ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${c.state === 'on' ? pct : 0}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function PanelView(): JSX.Element {
  useHomeStore((s) => s.tick)
  const design = useHomeStore((s) => s.design)
  const selected = useHomeStore((s) => s.selectedCircuitId)
  const setMain = useHomeStore((s) => s.setMain)
  const addCircuit = useHomeStore((s) => s.addCircuit)
  const select = useHomeStore((s) => s.select)
  const legs = homeLive.runtime.legs
  const rows = Math.ceil(design.spaces / 2)
  const occupied = new Set(design.circuits.flatMap((c) => (c.poles === 2 ? [c.slot, c.slot + 2] : [c.slot])))

  return (
    <div className="flex flex-col gap-3" data-testid="home-panel">
      <div className="rounded-lg border border-gray-300 dark:border-white/15 bg-gray-50 dark:bg-white/5 p-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => select(null)}
            className="text-xs font-semibold text-gray-900 dark:text-gray-100 hover:underline"
          >
            Main {design.mainAmps} A
          </button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">120/240 V split-phase</span>
          <button
            onClick={() => setMain(design.mainState === 'on' ? 'off' : 'on')}
            className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${
              design.mainState === 'on' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : design.mainState === 'tripped' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-300 dark:bg-white/15'
            }`}
          >
            {design.mainState === 'on' ? 'ON' : design.mainState === 'tripped' ? 'TRIPPED · reset' : 'OFF · switch on'}
          </button>
        </div>
        <LegMeter label="Leg A" amps={legs.A} rating={design.mainAmps} />
        <LegMeter label="Leg B" amps={legs.B} rating={design.mainAmps} />
        <LegMeter label="Neutral" amps={legs.N} rating={design.mainAmps} />
      </div>

      <div className="rounded-lg border-2 border-gray-400 dark:border-white/25 bg-gray-100 dark:bg-black/30 p-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-1" style={{ gridTemplateRows: `repeat(${rows}, 3.4rem)` }}>
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={`leg${r}`}
              className="flex items-center justify-center text-[9px] font-bold text-gray-400 dark:text-gray-500 w-4"
              style={{ gridColumn: 2, gridRow: r + 1 }}
            >
              {legOfSlot(r * 2 + 1)}
            </div>
          ))}
          {Array.from({ length: design.spaces }, (_, i) => i + 1)
            .filter((s) => !occupied.has(s))
            .map((s) => (
              <div
                key={`e${s}`}
                className="m-0.5 rounded border border-dashed border-gray-300 dark:border-white/10 text-[9px] text-gray-400 dark:text-gray-600 flex items-center justify-center"
                style={{ gridColumn: s % 2 === 1 ? 1 : 3, gridRow: Math.ceil(s / 2) }}
              >
                {s}
              </div>
            ))}
          {design.circuits.map((c) => (
            <div
              key={c.id}
              className="p-0.5"
              style={{ gridColumn: c.slot % 2 === 1 ? 1 : 3, gridRow: `${Math.ceil(c.slot / 2)} / span ${c.poles}` }}
              title={`Spaces ${c.poles === 2 ? `${c.slot} & ${c.slot + 2}` : c.slot} · leg ${legsOf(c).join('+')}`}
            >
              <Breaker c={c} selected={selected === c.id} />
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => addCircuit(1)} className="flex-1 px-2 py-1.5 text-xs rounded bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20">
          + 120 V circuit
        </button>
        <button onClick={() => addCircuit(2)} className="flex-1 px-2 py-1.5 text-xs rounded bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20">
          + 240 V circuit
        </button>
      </div>
    </div>
  )
}
