/**
 * One-line diagram: utility → meter → main breaker → bus, with one row per
 * branch circuit (breaker → wire run → loads). Live: energized runs glow and
 * thicken with current, tripped ones go red and dashed, and loads fade when
 * they are idle (cycling) or off. Tap a row to edit that circuit.
 */
import { homeLive, useHomeStore } from '@stores/homeStore'
import { APPLIANCES } from '../../home/appliances'
import { fmtAmps, fmtW } from './useHomeClock'

const ROW = 52
const TOP = 150
const BUS_X = 44

export default function OneLineDiagram(): JSX.Element {
  useHomeStore((s) => s.tick)
  const design = useHomeStore((s) => s.design)
  const selected = useHomeStore((s) => s.selectedCircuitId)
  const select = useHomeStore((s) => s.select)
  const rt = homeLive.runtime
  const circuits = [...design.circuits].sort((a, b) => a.slot - b.slot)
  const height = TOP + Math.max(1, circuits.length) * ROW + 20
  const mainOn = design.mainState === 'on'
  const energy = mainOn ? '#E8B500' : '#9ca3af'

  return (
    <div className="w-full overflow-x-auto" data-testid="one-line">
      <svg viewBox={`0 0 620 ${height}`} className="w-full min-w-[520px]" style={{ height: 'auto' }} role="img" aria-label="One-line diagram">
        {/* utility transformer */}
        <g className="text-gray-700 dark:text-gray-200" stroke="currentColor" fill="none" strokeWidth={1.5}>
          <circle cx={BUS_X} cy={18} r={9} />
          <circle cx={BUS_X} cy={31} r={9} />
          <line x1={BUS_X} y1={40} x2={BUS_X} y2={56} stroke={energy} strokeWidth={3} />
          <circle cx={BUS_X} cy={68} r={12} />
          <text x={BUS_X} y={72} fontSize={10} textAnchor="middle" fill="currentColor" stroke="none">kWh</text>
          <line x1={BUS_X} y1={80} x2={BUS_X} y2={94} stroke={energy} strokeWidth={3} />
          {/* main breaker */}
          <rect x={BUS_X - 9} y={94} width={18} height={22} rx={3} />
          {mainOn ? <line x1={BUS_X} y1={98} x2={BUS_X} y2={112} /> : <line x1={BUS_X} y1={98} x2={BUS_X + 7} y2={110} stroke="#ef4444" />}
        </g>
        <g fontSize={11} className="fill-gray-600 dark:fill-gray-300">
          <text x={BUS_X + 22} y={28}>Utility 120/240 V · {design.serviceAmps} A service</text>
          <text x={BUS_X + 22} y={72}>Meter · {rt.kwh.toFixed(2)} kWh · {fmtW(rt.totalWatts)}</text>
          <text x={BUS_X + 22} y={109}>
            Main {design.mainAmps} A {design.mainState === 'tripped' ? '· TRIPPED' : design.mainState === 'off' ? '· off' : ''}
          </text>
        </g>
        {/* bus */}
        <line x1={BUS_X} y1={116} x2={BUS_X} y2={TOP + (circuits.length - 1) * ROW + 4} stroke={energy} strokeWidth={5} strokeLinecap="round" />

        {circuits.map((c, i) => {
          const y = TOP + i * ROW
          const r = rt.readings[c.id]
          const live = mainOn && c.state === 'on'
          const amps = r?.amps ?? 0
          const stroke = c.state === 'tripped' ? '#ef4444' : live ? '#E8B500' : '#9ca3af'
          const w = live ? 1.5 + Math.min(5, amps / 5) : 1.5
          const isSel = selected === c.id
          return (
            <g key={c.id} onClick={() => select(c.id)} style={{ cursor: 'pointer' }} data-testid={`oneline-${c.id}`}>
              <rect x={BUS_X + 4} y={y - ROW / 2 + 3} width={572} height={ROW - 6} rx={6} className={isSel ? 'fill-amber-400/15' : 'fill-transparent hover:fill-gray-500/5'} />
              <line x1={BUS_X} y1={y} x2={BUS_X + 36} y2={y} stroke={mainOn ? '#E8B500' : '#9ca3af'} strokeWidth={2} />
              {/* breaker */}
              <rect x={BUS_X + 36} y={y - 9} width={26} height={18} rx={3} fill="none" stroke={stroke} strokeWidth={1.5} />
              {c.state === 'on' ? (
                <line x1={BUS_X + 40} y1={y} x2={BUS_X + 58} y2={y} stroke={stroke} strokeWidth={1.5} />
              ) : (
                <line x1={BUS_X + 40} y1={y} x2={BUS_X + 56} y2={y - 7} stroke={stroke} strokeWidth={1.5} />
              )}
              {c.poles === 2 && <text x={BUS_X + 49} y={y + 20} fontSize={8} textAnchor="middle" className="fill-gray-500">2P</text>}
              {/* wire run */}
              <line x1={BUS_X + 62} y1={y} x2={300} y2={y} stroke={stroke} strokeWidth={w} strokeDasharray={c.state === 'tripped' ? '5 4' : undefined} />
              <text x={BUS_X + 70} y={y - 7} fontSize={11} fontWeight={600} className="fill-gray-800 dark:fill-gray-100">
                {c.name} · {c.amps} A
              </text>
              <text x={BUS_X + 70} y={y + 15} fontSize={9.5} className="fill-gray-500 dark:fill-gray-400">
                {c.gauge} AWG · {c.lengthFt} ft · {c.state === 'tripped' ? 'tripped' : live ? `${fmtAmps(amps)} · ${r ? Math.round(r.volts) : 0} V` : 'off'}
                {live && r && r.dropPct > 3 && amps > 0.5 ? ` · ${r.dropPct.toFixed(1)}% drop` : ''}
              </text>
              {/* loads */}
              {c.loads.slice(0, 8).map((l, k) => {
                const a = APPLIANCES[l.appliance]
                const running = !!rt.loadRunning[l.id]
                return (
                  <g key={l.id} opacity={running ? 1 : l.on ? 0.45 : 0.2}>
                    <circle cx={318 + k * 34} cy={y} r={14} fill="none" stroke={running ? '#E8B500' : '#9ca3af'} strokeWidth={1.2} />
                    <text x={318 + k * 34} y={y + 5} fontSize={14} textAnchor="middle">
                      {a?.icon ?? '?'}
                    </text>
                    <title>{`${a?.name ?? l.appliance}: ${running ? 'running' : l.on ? 'idle (cycling)' : 'off'}`}</title>
                  </g>
                )
              })}
            </g>
          )
        })}
        {circuits.length === 0 && (
          <text x={BUS_X + 20} y={TOP + 4} fontSize={12} className="fill-gray-500">
            No branch circuits yet. Add one from the panel.
          </text>
        )}
      </svg>
    </div>
  )
}
