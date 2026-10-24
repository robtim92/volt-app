/**
 * Volt — goal & star evaluation (pure)
 */
import type { CircuitComponent, Wire } from '../sim/elements'
import type { Goal, Level, Measure, StarRule } from './types'
import { batteryParams } from '../sim/netlist'
import { hoursRemaining } from '../sim/battery'
import { ampacity } from '../sim/wire'
import type { HomeDesign, HomeRuntime } from '../home/types'
import { circuitWarnings } from '../home/homeSim'
import { AFCI_ROOMS, APPLIANCES, GFCI_ROOMS } from '../home/appliances'
import { serviceLoad } from '../home/loadCalc'

export interface Readings {
  nodeVoltages: Record<string, number>
  elementCurrents: Record<string, number>
  terminalNodes: Record<string, string>
}

/** Everything beyond the bench readings that goals may look at. */
export interface LevelContext {
  wires?: Wire[]
  /** battery state of charge by id (default full) */
  soc?: Record<string, number>
  supplyMode?: Record<string, 'CV' | 'CC'>
  home?: { design: HomeDesign; runtime: HomeRuntime }
  /** the player's prediction (Predict missions) */
  prediction?: number | null
}

/** Take a reading from the bench. */
export function measureValue(m: Measure, r: Readings): number {
  if (m.kind === 'current') return Math.abs(r.elementCurrents[m.id] ?? 0)
  const v = (key?: string): number => {
    if (!key) return 0
    const node = r.terminalNodes[key]
    return node !== undefined ? r.nodeVoltages[node] ?? 0 : 0
  }
  return v(m.a) - v(m.b)
}

function homeWarnings(h: NonNullable<LevelContext['home']>) {
  return h.design.circuits.flatMap((c) => circuitWarnings(c, h.runtime.readings[c.id], h.runtime.wireHeat[c.id] ?? 0, GFCI_ROOMS, AFCI_ROOMS))
}

const COUNTED = (c: CircuitComponent): boolean => c.type !== 'ground' && c.type !== 'wire_node'

export const partCount = (components: CircuitComponent[]): number => components.filter(COUNTED).length

function ledCurrents(components: CircuitComponent[], r: Readings): number[] {
  return components
    .filter((c) => c.type === 'led')
    .map((c) => (c.damaged ? 0 : r.elementCurrents[c.id] ?? 0))
}

/** Total current delivered by voltage sources (current *out of* the + terminal). */
export function sourceCurrent(components: CircuitComponent[], r: Readings): number {
  let total = 0
  for (const c of components) {
    if (c.type === 'voltage_source' || c.type === 'ac_voltage_source') {
      // SPICE convention: current into + is negative when sourcing
      total += Math.abs(r.elementCurrents[c.id] ?? 0)
    }
  }
  return total
}

export function goalMet(goal: Goal, components: CircuitComponent[], r: Readings | null, ctx: LevelContext = {}): boolean {
  if (goal.kind.startsWith('home_')) return homeGoalMet(goal, ctx)
  if (goal.kind === 'wires_intact') return (ctx.wires ?? []).every((w) => !w.damaged)
  if (goal.kind === 'wires_within_rating')
    return !!r && (ctx.wires ?? []).every((w) => !w.damaged && Math.abs(r.elementCurrents[w.id] ?? 0) <= ampacity(w.gauge ?? 22) * 1.0001)
  if (!r) return goal.kind === 'switch_open' ? components.some((c) => c.type === 'switch' && !c.closed) : false
  switch (goal.kind) {
    case 'all_leds_lit': {
      const leds = ledCurrents(components, r)
      if (leds.length === 0 || leds.length < (goal.count ?? 1)) return false
      return leds.every((i) => i >= goal.min && i <= goal.max)
    }
    case 'leds_lit':
      return ledCurrents(components, r).filter((i) => i >= goal.min && i <= goal.max).length >= goal.count
    case 'switch_open':
      return components.some((c) => c.type === 'switch' && !c.closed)
    case 'component_count':
      return components.filter((c) => c.type === goal.type && !c.damaged).length >= goal.min
    case 'source_current_max':
      return sourceCurrent(components, r) <= goal.max
    case 'measure': {
      const v = measureValue(goal.measure, r)
      return v >= goal.min && v <= goal.max
    }
    case 'battery_runtime': {
      const b = components.find((c) => c.id === goal.id && c.type === 'battery' && !c.damaged)
      if (!b) return false
      const i = Math.abs(r.elementCurrents[b.id] ?? 0)
      return i > 1e-6 && hoursRemaining(batteryParams(b, ctx.soc), i) >= goal.hours
    }
    case 'supply_mode':
      return (ctx.supplyMode?.[goal.id] ?? 'CV') === goal.mode && components.some((c) => c.id === goal.id)
    default:
      return false
  }
}

function homeGoalMet(goal: Goal, ctx: LevelContext): boolean {
  const h = ctx.home
  if (!h) return false
  const d = h.design
  switch (goal.kind) {
    case 'home_loads_on':
      return goal.appliances.every((a) =>
        d.circuits.some((c) => c.state === 'on' && c.loads.some((l) => l.appliance === a && l.on && APPLIANCES[a]?.volts === (c.poles === 2 ? 240 : 120)))
      )
    case 'home_all_on':
      return d.mainState === 'on' && d.circuits.every((c) => c.state === 'on')
    case 'home_no_hazards':
      return !homeWarnings(h).some((w) => w.level === 'danger')
    case 'home_drop_max': {
      const r = h.runtime.readings[goal.circuit]
      return !!r && r.amps > 0.5 && r.dropPct <= goal.maxPct
    }
    case 'home_service_fits':
      return serviceLoad(d).amps <= d.serviceAmps
    default:
      return false
  }
}

export function starMet(
  rule: StarRule,
  components: CircuitComponent[],
  r: Readings | null,
  burnouts: number,
  ctx: LevelContext = {},
  level?: Level
): boolean {
  const d = ctx.home?.design
  switch (rule.kind) {
    case 'prediction': {
      if (!r || !level?.predict || ctx.prediction === null || ctx.prediction === undefined) return false
      const actual = measureValue(level.predict.measure, r)
      return Math.abs(ctx.prediction - actual) <= rule.tolerance * Math.max(Math.abs(actual), 1e-9)
    }
    case 'wire_awg_range':
      return (ctx.wires ?? [])
        .filter((w) => !rule.wires || rule.wires.includes(w.id))
        .every((w) => (w.gauge ?? 22) >= rule.min && (w.gauge ?? 22) <= rule.max)
    case 'goal':
      return goalMet(rule.goal, components, r, ctx)
    case 'home_code_ok':
      return !!ctx.home && !homeWarnings(ctx.home).some((w) => w.level === 'info' || w.level === 'danger')
    case 'home_circuit_load_max':
      return !!ctx.home && d!.circuits.every((c) => (ctx.home!.runtime.readings[c.id]?.amps ?? 0) <= (rule.pct / 100) * c.amps)
    case 'home_max_circuits':
      return !!d && d.circuits.length <= rule.max
    case 'home_service_max':
      return !!d && d.serviceAmps <= rule.amps
    case 'home_breaker_type':
      return !!d && rule.types.includes(d.circuits.find((c) => c.id === rule.circuit)?.type ?? 'standard')
    case 'home_gauge_range': {
      const g = d?.circuits.find((c) => c.id === rule.circuit)?.gauge
      return g !== undefined && g >= rule.min && g <= rule.max
    }
    case 'no_burnouts':
      return burnouts === 0
    case 'max_parts':
      return partCount(components) <= rule.max
    case 'led_current_band': {
      if (!r) return false
      const leds = ledCurrents(components, r)
      return leds.length > 0 && leds.every((i) => i >= rule.min && i <= rule.max)
    }
    case 'source_current_max':
      return !!r && sourceCurrent(components, r) <= rule.max
  }
}

export interface LevelProgress {
  goals: boolean[]
  /** simulated seconds all goals have held continuously */
  held: number
  burnouts: number
  completed: boolean
  stars: number
  starChecks: [boolean, boolean]
  /** Predict missions: the reading at completion */
  measured?: number
}

export const newProgress = (level: Level): LevelProgress => ({
  goals: level.goals.map(() => false),
  held: 0,
  burnouts: 0,
  completed: false,
  stars: 0,
  starChecks: [false, false]
})

/**
 * Advance a level attempt by one simulation frame. Pure: returns the next
 * progress. Once completed, progress is frozen (stars locked in).
 */
export function stepLevel(
  level: Level,
  prev: LevelProgress,
  components: CircuitComponent[],
  r: Readings | null,
  simDt: number,
  newBurnouts: number,
  ctx: LevelContext = {}
): LevelProgress {
  if (prev.completed) return prev
  const burnouts = prev.burnouts + newBurnouts
  const goals = level.goals.map((g) => goalMet(g, components, r, ctx))
  const all = goals.every(Boolean)
  const held = all ? prev.held + simDt : 0
  const completed = all && held >= (level.holdSeconds ?? 0.5)
  let stars = prev.stars
  let starChecks = prev.starChecks
  if (completed) {
    starChecks = [
      starMet(level.stars[0], components, r, burnouts, ctx, level),
      starMet(level.stars[1], components, r, burnouts, ctx, level)
    ]
    stars = 1 + starChecks.filter(Boolean).length
  }
  const measured = completed && level.predict && r ? measureValue(level.predict.measure, r) : undefined
  return { goals, held, burnouts, completed, stars, starChecks, ...(measured !== undefined ? { measured } : {}) }
}
