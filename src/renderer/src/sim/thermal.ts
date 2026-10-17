/**
 * Volt — Heat & damage model
 *
 * Real parts have limits. This module tracks how hard each component is being
 * pushed and what happens when it's pushed too far: resistors overheat and
 * burn, LEDs pop, capacitors blow on overvoltage, an ammeter's fuse blows,
 * breakers and GFCIs trip.
 *
 * Each component gets a dimensionless "load" q = (stress / rating) — e.g. a
 * resistor's power over its wattage rating, an LED's current over its max
 * current. Its heat θ follows first-order thermal lag toward q:
 *
 *     dθ/dt = (q − θ) / τ
 *
 * so a brief spike is survivable but sustained abuse isn't, and resistors warm
 * up visibly over a second or two. When θ crosses the part's failure point the
 * part fails (or trips) and a teaching message explains why.
 *
 * θ ≈ 1 means "running at its rating"; renderers use θ for glow/heat colours.
 * Pure functions, no DOM.
 */
import { formatValue, type CircuitComponent, type ComponentType } from './elements'
import { terminalKey } from './netlist'
import type { Wire } from './elements'
import { CHEMISTRIES, DEFAULT_CHEMISTRY } from './battery'
import { DEFAULT_GAUGE, ampacity, gaugeLabel } from './wire'

export type FailureKind = 'burnout' | 'pop' | 'fuse' | 'trip'

export interface ThermalProfile {
  /** default rating (units depend on `stress`) */
  rating: number
  /** what is compared to the rating */
  stress: 'power' | 'current' | 'voltage'
  /** thermal time constant (s) */
  tau: number
  /** θ at which the part fails / trips */
  failAt: number
  failure: FailureKind
}

export const THERMAL_PROFILES: Partial<Record<ComponentType, ThermalProfile>> = {
  // ¼ W through-hole resistor; visibly smoking around 2–3× rating
  resistor: { rating: 0.25, stress: 'power', tau: 1.5, failAt: 2.5, failure: 'burnout' },
  // Typical 5 mm LED: 20 mA nominal, ~30 mA max
  led: { rating: 0.03, stress: 'current', tau: 0.12, failAt: 2, failure: 'burnout' },
  // 1N400x-class rectifier: 1 A
  diode: { rating: 1, stress: 'current', tau: 0.3, failAt: 2, failure: 'burnout' },
  // General-purpose electrolytic, 50 V
  capacitor: { rating: 50, stress: 'voltage', tau: 0.05, failAt: 1.15, failure: 'pop' },
  // Multimeter current range fused at 10 A
  ammeter: { rating: 10, stress: 'current', tau: 0.05, failAt: 1, failure: 'fuse' },
  // Thermal-magnetic breaker: trips on sustained overload
  breaker: { rating: 15, stress: 'current', tau: 0.4, failAt: 1, failure: 'trip' },
  // GFCI modelled as a fast trip on its (leakage) current rating
  gfci: { rating: 0.005, stress: 'current', tau: 0.02, failAt: 1, failure: 'trip' },
  // Batteries: rating = the chemistry's comfortable continuous current
  battery: { rating: 1, stress: 'current', tau: 4, failAt: 3, failure: 'burnout' }
}

/** Wires heat on current against their gauge's ampacity, and melt open. */
export const WIRE_PROFILE: ThermalProfile = { rating: 3, stress: 'current', tau: 1.5, failAt: 2, failure: 'burnout' }

/** Effective rating: the component's own override, else breakers use `value`, else the default. */
export function ratingOf(c: CircuitComponent): number | null {
  const prof = THERMAL_PROFILES[c.type]
  if (!prof) return null
  if (c.type === 'breaker' || c.type === 'gfci') return c.value ?? prof.rating
  if (c.type === 'battery') return c.rating ?? CHEMISTRIES[c.chemistry ?? DEFAULT_CHEMISTRY].maxCurrent
  return c.rating ?? prof.rating
}

export interface ElectricalReadings {
  nodeVoltages: Record<string, number>
  elementCurrents: Record<string, number>
  terminalNodes: Record<string, string>
  /** frame-averaged figures from the transient solver (preferred when present) */
  stats?: { power: Record<string, number>; irms: Record<string, number>; vpeak: Record<string, number> }
}

/** Instantaneous stress and load q for a component, or null if it has no thermal model. */
export function componentLoad(
  c: CircuitComponent,
  r: ElectricalReadings
): { q: number; stress: number } | null {
  const prof = THERMAL_PROFILES[c.type]
  const rating = ratingOf(c)
  if (!prof || rating === null || c.damaged) return null
  if ((c.type === 'breaker' || c.type === 'gfci') && !c.closed) return null
  const i = r.elementCurrents[c.id] ?? 0
  const va = r.nodeVoltages[r.terminalNodes[terminalKey(c.id, 0)]] ?? 0
  const vb = r.nodeVoltages[r.terminalNodes[terminalKey(c.id, 1)]] ?? 0
  const v = va - vb
  // Prefer averages over the whole frame (true RMS / mean power / peak), so AC
  // heating doesn't depend on where in the cycle the frame landed.
  const st = r.stats
  let stress: number
  switch (prof.stress) {
    case 'power':
      stress = st?.power[c.id] ?? Math.abs(v * i)
      break
    case 'current':
      stress = st?.irms[c.id] ?? Math.abs(i)
      break
    case 'voltage':
      stress = st?.vpeak[c.id] ?? Math.abs(v)
      break
  }
  return { q: stress / rating, stress }
}

export interface ThermalEvent {
  componentId: string
  kind: FailureKind
  message: string
}

export interface ThermalStepResult {
  heat: Record<string, number>
  events: ThermalEvent[]
}

function failureMessage(c: CircuitComponent, stress: number): string {
  const name = c.label ?? c.id
  const rating = ratingOf(c) ?? 0
  switch (c.type) {
    case 'led':
      return `💥 ${name} burned out — ${formatValue(stress, 'A')} is far more than the ~${formatValue(rating, 'A')} an LED can take. Add a current-limiting resistor in series.`
    case 'resistor':
      return `🔥 ${name} burned up — it was turning ${formatValue(stress, 'W')} into heat but is only rated for ${formatValue(rating, 'W')}. Use a larger resistance or a higher-wattage part.`
    case 'diode':
      return `💥 ${name} failed — ${formatValue(stress, 'A')} exceeds its ${formatValue(rating, 'A')} rating.`
    case 'capacitor':
      return `💥 ${name} popped — ${formatValue(stress, 'V')} across a capacitor rated for ${formatValue(rating, 'V')}.`
    case 'ammeter':
      return `⚡ ${name}'s fuse blew — over ${formatValue(rating, 'A')}. An ammeter goes in series with a load, never straight across a source.`
    case 'battery':
      return `🔥 ${name} overheated — it was asked for ${formatValue(stress, 'A')} but is only good for about ${formatValue(rating, 'A')}. A short circuit drains and cooks a battery fast.`
    case 'breaker':
      return `⚡ ${name} tripped — ${formatValue(stress, 'A')} exceeds its ${formatValue(rating, 'A')} rating. Reduce the load, then reset it.`
    case 'gfci':
      return `⚡ ${name} tripped — ${formatValue(stress, 'A')} exceeds its ${formatValue(rating, 'A')} trip threshold. Reset it once the fault is cleared.`
    default:
      return `${name} failed`
  }
}

/**
 * Advance every component's heat by dt seconds given the current electrical
 * readings. Returns new heat values plus any failures that happened this step.
 * Callers apply failures: 'trip' → open the device (closed = false), anything
 * else → mark `damaged` (an open circuit until repaired).
 */
export function stepThermal(
  components: CircuitComponent[],
  readings: ElectricalReadings,
  heat: Record<string, number>,
  dt: number,
  wires: Wire[] = []
): ThermalStepResult {
  const next: Record<string, number> = {}
  const events: ThermalEvent[] = []
  for (const w of wires) {
    if (w.damaged) continue
    const gauge = w.gauge ?? DEFAULT_GAUGE
    const rating = ampacity(gauge)
    const i = readings.stats?.irms[w.id] ?? Math.abs(readings.elementCurrents[w.id] ?? 0)
    const q = i / rating
    const prev = heat[w.id] ?? 0
    const theta = q + (prev - q) * Math.exp(-dt / WIRE_PROFILE.tau)
    next[w.id] = theta
    if (theta >= WIRE_PROFILE.failAt) {
      events.push({
        componentId: w.id,
        kind: 'burnout',
        message: `🔥 A wire melted — ${formatValue(i, 'A')} through ${gaugeLabel(gauge)} wire rated for about ${formatValue(rating, 'A')}. Use thicker wire (a smaller AWG number) or reduce the current.`
      })
    }
  }
  for (const c of components) {
    const prof = THERMAL_PROFILES[c.type]
    if (!prof) continue
    const load = componentLoad(c, readings)
    const prev = heat[c.id] ?? 0
    const q = load?.q ?? 0
    // exact first-order update (stable for any dt)
    const theta = q + (prev - q) * Math.exp(-dt / prof.tau)
    if (load && theta >= prof.failAt) {
      events.push({ componentId: c.id, kind: prof.failure, message: failureMessage(c, load.stress) })
      next[c.id] = prof.failure === 'trip' ? 0 : theta
    } else {
      next[c.id] = theta
    }
  }
  return { heat: next, events }
}
