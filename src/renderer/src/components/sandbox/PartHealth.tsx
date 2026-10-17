/**
 * Inspector block: a part's rating, live temperature bar and burnt-out state,
 * with a "Replace part" action for damaged components.
 */
import { useEffect, useState } from 'react'
import { useCircuitStore } from '@stores/circuitStore'
import { liveFrame } from '@stores/liveSimStore'
import { THERMAL_PROFILES, ratingOf } from '../../sim/thermal'
import { formatValue, parseValue, type CircuitComponent } from '../../sim/elements'

const RATING_UNIT: Record<string, string> = { power: 'W', current: 'A', voltage: 'V' }
const RATING_LABEL: Record<string, string> = {
  power: 'Power rating',
  current: 'Max current',
  voltage: 'Voltage rating'
}

export default function PartHealth({ component }: { component: CircuitComponent }): JSX.Element | null {
  const updateComponent = useCircuitStore((s) => s.updateComponent)
  const checkpoint = useCircuitStore((s) => s.checkpoint)
  // re-render on live result publishes (heat lives in liveFrame)
  useCircuitStore((s) => s.simResult)
  const prof = THERMAL_PROFILES[component.type]
  const rating = ratingOf(component)
  const editable = prof && component.type !== 'breaker' && component.type !== 'gfci' && component.type !== 'ammeter'
  const [text, setText] = useState(rating !== null ? formatValue(rating) : '')
  useEffect(() => setText(rating !== null ? formatValue(rating) : ''), [rating, component.id])

  if (!prof || rating === null) return null
  const unit = RATING_UNIT[prof.stress]
  const heat = liveFrame.heat[component.id] ?? 0
  const pct = Math.min(100, (heat / prof.failAt) * 100)
  const barColor = heat >= prof.failAt * 0.75 ? 'bg-red-500' : heat >= 1 ? 'bg-orange-500' : heat >= 0.6 ? 'bg-amber-400' : 'bg-emerald-500'
  const isTrip = prof.failure === 'trip'

  const commit = (): void => {
    const v = parseValue(text)
    if (v !== null && v > 0) {
      checkpoint()
      updateComponent(component.id, { rating: v })
    }
  }

  return (
    <div className="mb-3 rounded border border-gray-200 dark:border-white/10 p-2" data-testid="part-health">
      {component.damaged ? (
        <div className="mb-2">
          <p className="text-xs font-semibold text-red-500">
            {component.type === 'ammeter' ? '⚡ Fuse blown' : '💥 Burnt out'} — acting as an open circuit.
          </p>
          <button
            onClick={() => {
              liveFrame.heat[component.id] = 0
              updateComponent(component.id, { damaged: false })
            }}
            className="mt-1 w-full px-2 py-1 text-xs rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 font-medium"
          >
            Replace part
          </button>
        </div>
      ) : (
        <div className="mb-2">
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
            <span>{isTrip ? 'Load' : 'Temperature'}</span>
            <span>{Math.round(heat * 100)}% of rating</span>
          </div>
          <div className="h-1.5 rounded bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div className={`h-full ${barColor} transition-[width] duration-100`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {editable ? (
        <label className="block">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {RATING_LABEL[prof.stress]} ({unit})
          </span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            aria-label="Component rating"
            className="mt-0.5 w-full px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-white/20 bg-white dark:bg-brand-dark text-gray-900 dark:text-gray-100"
          />
        </label>
      ) : (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          {RATING_LABEL[prof.stress]}: {formatValue(rating, unit)}
        </p>
      )}
    </div>
  )
}
