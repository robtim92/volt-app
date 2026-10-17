/**
 * Inspector for one branch circuit: breaker, wire run, live readings, the
 * appliances on it, fault injection and warnings. With nothing selected it
 * shows the whole-house summary and service load calculation.
 */
import { useState } from 'react'
import { homeLive, useHomeStore } from '@stores/homeStore'
import { APPLIANCES, AFCI_ROOMS, GFCI_ROOMS, ROOMS } from '../../home/appliances'
import { THERMAL_TRIP, circuitWarnings, nominalVolts } from '../../home/homeSim'
import { serviceLoad } from '../../home/loadCalc'
import type { BreakerType, CircuitFault } from '../../home/types'
import { ampacity } from '../../sim/wire'
import { fmtAmps, fmtW } from './useHomeClock'

const input = 'mt-1 w-full px-2 py-1 text-sm rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100'
const label = 'block text-xs text-gray-500 dark:text-gray-400'
const BREAKER_AMPS = [15, 20, 30, 40, 50, 60]
const GAUGES = [14, 12, 10, 8, 6, 4]
const TYPES: [BreakerType, string][] = [
  ['standard', 'Standard'],
  ['gfci', 'GFCI (ground fault)'],
  ['afci', 'AFCI (arc fault)'],
  ['dual', 'Dual function (GFCI + AFCI)']
]
const FAULTS: [CircuitFault, string][] = [
  ['none', 'No fault'],
  ['ground', 'Ground fault (leak to ground)'],
  ['arc', 'Arcing fault (damaged cord)'],
  ['short', 'Short circuit']
]

function Row({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <p className="flex justify-between text-sm">
      <span className="text-gray-600 dark:text-gray-300">{k}</span>
      <span className="font-mono text-gray-900 dark:text-gray-100">{v}</span>
    </p>
  )
}

function HouseSummary(): JSX.Element {
  useHomeStore((s) => s.tick)
  const design = useHomeStore((s) => s.design)
  const patch = useHomeStore((s) => s.patchDesign)
  const rt = homeLive.runtime
  const lc = serviceLoad(design)
  return (
    <div className="space-y-3" data-testid="house-summary">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{design.name}</h3>
      <div className="grid grid-cols-3 gap-2">
        <label className={label}>
          Floor area (ft²)
          <input className={input} type="number" min={200} step={100} value={design.sqft} onChange={(e) => patch({ sqft: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className={label}>
          Service (A)
          <select className={input} value={design.serviceAmps} onChange={(e) => patch({ serviceAmps: Number(e.target.value), mainAmps: Math.min(design.mainAmps, Number(e.target.value)) })}>
            {[100, 150, 200, 400].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Main (A)
          <select className={input} value={design.mainAmps} onChange={(e) => patch({ mainAmps: Number(e.target.value) })}>
            {[60, 100, 150, 200, 400].filter((a) => a <= design.serviceAmps).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-1">
        <Row k="Using now" v={fmtW(rt.totalWatts)} />
        <Row k="Leg A / leg B" v={`${fmtAmps(rt.legs.A)} / ${fmtAmps(rt.legs.B)}`} />
        <Row k="Neutral" v={fmtAmps(rt.legs.N)} />
        <Row k="Energy so far" v={`${rt.kwh.toFixed(2)} kWh`} />
      </div>
      <div className="rounded-lg border border-gray-200 dark:border-white/10 p-2.5 space-y-1">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Service load calculation</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Simplified from the NEC optional method for dwellings. A teaching estimate.</p>
        <Row k="General lighting (3 VA/ft²)" v={fmtW(lc.lighting)} />
        <Row k="Kitchen + laundry circuits" v={fmtW(lc.smallAppliance + lc.laundry)} />
        <Row k="Fixed appliances" v={fmtW(lc.fixed)} />
        <Row k="Heating / cooling (largest)" v={fmtW(lc.hvac)} />
        <Row k="Demand (10 kVA + 40% of rest)" v={fmtW(lc.demandVA)} />
        <div className="pt-1">
          <div className="flex justify-between text-sm font-semibold">
            <span>Calculated load</span>
            <span className={lc.pctOfService > 100 ? 'text-red-500' : lc.pctOfService > 80 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}>
              {Math.round(lc.amps)} A of {design.serviceAmps} A
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div className={`h-full ${lc.pctOfService > 100 ? 'bg-red-500' : lc.pctOfService > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, lc.pctOfService)}%` }} />
          </div>
          {lc.pctOfService > 100 && <p className="mt-1 text-xs text-red-500">Over the service rating: this home would need a service upgrade.</p>}
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">Select a breaker or a row in the diagram to edit that circuit.</p>
    </div>
  )
}

export default function CircuitCard(): JSX.Element {
  useHomeStore((s) => s.tick)
  const design = useHomeStore((s) => s.design)
  const id = useHomeStore((s) => s.selectedCircuitId)
  const update = useHomeStore((s) => s.updateCircuit)
  const remove = useHomeStore((s) => s.removeCircuit)
  const addLoad = useHomeStore((s) => s.addLoad)
  const updateLoad = useHomeStore((s) => s.updateLoad)
  const removeLoad = useHomeStore((s) => s.removeLoad)
  const setBreaker = useHomeStore((s) => s.setBreaker)
  const select = useHomeStore((s) => s.select)
  const [pick, setPick] = useState('')
  const c = design.circuits.find((x) => x.id === id)
  if (!c) return <HouseSummary />

  const rt = homeLive.runtime
  const r = rt.readings[c.id]
  const heat = rt.breakerHeat[c.id] ?? 0
  const warnings = circuitWarnings(c, r, rt.wireHeat[c.id] ?? 0, GFCI_ROOMS, AFCI_ROOMS)
  const V = nominalVolts(c)
  const options = Object.values(APPLIANCES).sort((a, b) => (a.volts === V ? 0 : 1) - (b.volts === V ? 0 : 1) || a.name.localeCompare(b.name))

  return (
    <div className="space-y-3" data-testid="circuit-card">
      <div className="flex items-center gap-2">
        <button onClick={() => select(null)} className="text-xs text-sky-600 dark:text-sky-400 hover:underline">← House</button>
        <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
          Space {c.poles === 2 ? `${c.slot} & ${c.slot + 2}` : c.slot} · {V} V
        </span>
      </div>
      <input className={`${input} font-semibold`} value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} aria-label="Circuit name" />
      <div className="grid grid-cols-2 gap-2">
        <label className={label}>
          Room
          <select className={input} value={c.room} onChange={(e) => update(c.id, { room: e.target.value })}>
            {ROOMS.map((rm) => (
              <option key={rm}>{rm}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Poles
          <select className={input} value={c.poles} onChange={(e) => update(c.id, { poles: Number(e.target.value) as 1 | 2 })}>
            <option value={1}>1 pole · 120 V</option>
            <option value={2}>2 pole · 240 V</option>
          </select>
        </label>
        <label className={label}>
          Breaker
          <select className={input} value={c.amps} onChange={(e) => update(c.id, { amps: Number(e.target.value) })}>
            {BREAKER_AMPS.map((a) => (
              <option key={a} value={a}>{a} A</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Protection
          <select className={input} value={c.type} onChange={(e) => update(c.id, { type: e.target.value as BreakerType })}>
            {TYPES.map(([v, t]) => (
              <option key={v} value={v}>{t}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Wire
          <select className={input} value={c.gauge} onChange={(e) => update(c.id, { gauge: Number(e.target.value) })}>
            {GAUGES.map((g) => (
              <option key={g} value={g}>{g} AWG · {ampacity(g)} A</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Run length (ft)
          <input className={input} type="number" min={1} step={5} value={c.lengthFt} onChange={(e) => update(c.id, { lengthFt: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-white/10 p-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Live</span>
          {c.state === 'tripped' ? (
            <button onClick={() => setBreaker(c.id, 'on')} className="px-2 py-0.5 text-xs rounded bg-red-500 text-white font-medium">Reset breaker</button>
          ) : (
            <button onClick={() => setBreaker(c.id, c.state === 'on' ? 'off' : 'on')} className="px-2 py-0.5 text-xs rounded bg-gray-200 dark:bg-white/10">
              {c.state === 'on' ? 'Switch off' : 'Switch on'}
            </button>
          )}
        </div>
        <Row k="Current" v={`${fmtAmps(r?.amps ?? 0)}${r?.surging ? ' (motor starting)' : ''}`} />
        <Row k="Voltage at the far end" v={`${(r?.volts ?? 0).toFixed(1)} V`} />
        <Row k="Voltage drop" v={`${(r?.amps ?? 0) > 0.05 ? (r?.dropPct ?? 0).toFixed(1) : '0.0'}%`} />
        <Row k="Power to loads" v={fmtW(r?.watts ?? 0)} />
        <div>
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">
            <span>Breaker heat (trips at 100%)</span>
            <span>{Math.round((heat / THERMAL_TRIP) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div className={`h-full ${heat / THERMAL_TRIP > 0.8 ? 'bg-red-500' : heat / THERMAL_TRIP > 0.5 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (heat / THERMAL_TRIP) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1">Plugged in</p>
        <ul className="space-y-1">
          {c.loads.map((l) => {
            const a = APPLIANCES[l.appliance]
            const running = !!rt.loadRunning[l.id]
            const wrong = a && a.volts !== V
            return (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-center">{a?.icon}</span>
                <span className={`flex-1 truncate ${wrong ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'}`}>
                  {a?.name ?? l.appliance}
                  <span className="ml-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {a ? fmtW(a.watts) : ''} {l.on && !running && a?.cycle ? '· idle' : ''}
                  </span>
                </span>
                <button
                  role="switch"
                  aria-checked={l.on}
                  aria-label={`${a?.name} power`}
                  onClick={() => updateLoad(c.id, l.id, { on: !l.on })}
                  className={`w-9 h-5 rounded-full relative transition-colors ${l.on ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-white/20'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${l.on ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
                <button onClick={() => removeLoad(c.id, l.id)} aria-label={`Remove ${a?.name}`} className="text-gray-400 hover:text-red-500 px-1">×</button>
              </li>
            )
          })}
          {c.loads.length === 0 && <li className="text-xs text-gray-500">Nothing plugged in yet.</li>}
        </ul>
        <div className="mt-2 flex gap-2">
          <select className={input} value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Appliance to add">
            <option value="">Add an appliance…</option>
            {options.map((a) => (
              <option key={a.id} value={a.id} disabled={a.volts !== V}>
                {a.icon} {a.name} · {fmtW(a.watts)}{a.volts !== V ? ` (${a.volts} V)` : ''}
              </option>
            ))}
          </select>
          <button
            disabled={!pick}
            onClick={() => {
              addLoad(c.id, pick)
              setPick('')
            }}
            className="mt-1 px-3 text-sm rounded bg-brand-yellow text-gray-900 font-medium disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      <label className={label}>
        Inject a fault
        <select className={input} value={c.fault ?? 'none'} onChange={(e) => update(c.id, { fault: e.target.value as CircuitFault })}>
          {FAULTS.map(([v, t]) => (
            <option key={v} value={v}>{t}</option>
          ))}
        </select>
      </label>

      {warnings.length > 0 && (
        <ul className="space-y-1.5">
          {warnings.map((w, i) => (
            <li
              key={i}
              className={`text-xs rounded px-2 py-1.5 ${
                w.level === 'danger' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : w.level === 'warn' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
              }`}
            >
              {w.level === 'danger' ? '⚠️ ' : w.level === 'warn' ? '⚡ ' : 'ℹ️ '}
              {w.text}
            </li>
          ))}
        </ul>
      )}

      <button onClick={() => remove(c.id)} className="w-full px-2 py-1.5 text-sm rounded bg-red-500/10 text-red-500 hover:bg-red-500/20">
        Remove circuit
      </button>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        A simulation for learning. Real panel work is dangerous: leave it to a licensed electrician.
      </p>
    </div>
  )
}
