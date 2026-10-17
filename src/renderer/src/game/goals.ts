/**
 * Volt — goal & star evaluation (pure)
 */
import type { CircuitComponent } from '../sim/elements'
import type { Goal, Level, StarRule } from './types'

export interface Readings {
  nodeVoltages: Record<string, number>
  elementCurrents: Record<string, number>
  terminalNodes: Record<string, string>
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

export function goalMet(goal: Goal, components: CircuitComponent[], r: Readings | null): boolean {
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
  }
}

export function starMet(
  rule: StarRule,
  components: CircuitComponent[],
  r: Readings | null,
  burnouts: number
): boolean {
  switch (rule.kind) {
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
  newBurnouts: number
): LevelProgress {
  if (prev.completed) return prev
  const burnouts = prev.burnouts + newBurnouts
  const goals = level.goals.map((g) => goalMet(g, components, r))
  const all = goals.every(Boolean)
  const held = all ? prev.held + simDt : 0
  const completed = all && held >= (level.holdSeconds ?? 0.5)
  let stars = prev.stars
  let starChecks = prev.starChecks
  if (completed) {
    starChecks = [
      starMet(level.stars[0], components, r, burnouts),
      starMet(level.stars[1], components, r, burnouts)
    ]
    stars = 1 + starChecks.filter(Boolean).length
  }
  return { goals, held, burnouts, completed, stars, starChecks }
}
