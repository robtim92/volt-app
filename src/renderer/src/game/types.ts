/**
 * Volt — Campaign (game layer) types
 *
 * A level is a small mission on the live bench: a starter circuit, a parts bin,
 * goals that are checked continuously against the running simulation, and
 * star criteria that reward clean, efficient solutions.
 */
import type { ComponentType } from '../sim/elements'
import type { CircuitPreset } from '../lessons/types'
import type { BreakerType, HomeDesign } from '../home/types'

/** A reading taken from the live bench (used by Predict missions and goals). */
export type Measure =
  /** voltage from terminal a to terminal b ("comp:terminal"); b omitted = ground */
  | { kind: 'voltage'; a: string; b?: string }
  /** |current| through a part or wire */
  | { kind: 'current'; id: string }

/** Conditions checked every frame against the live simulation. */
export type Goal =
  | {
      /** every LED on the board conducts within [min, max] amps (and there are ≥ count of them) */
      kind: 'all_leds_lit'
      min: number
      max: number
      count?: number
      label: string
    }
  | { kind: 'leds_lit'; count: number; min: number; max: number; label: string }
  | { kind: 'switch_open'; label: string }
  | { kind: 'component_count'; type: ComponentType; min: number; label: string }
  /** total current drawn from all voltage sources ≤ max amps */
  | { kind: 'source_current_max'; max: number; label: string }
  /** a measured voltage or current within [min, max] */
  | { kind: 'measure'; measure: Measure; min: number; max: number; label: string }
  /** no melted wires on the board */
  | { kind: 'wires_intact'; label: string }
  /** every wire carries no more than its gauge's rating */
  | { kind: 'wires_within_rating'; label: string }
  /** a battery would last at least `hours` at its present current */
  | { kind: 'battery_runtime'; id: string; hours: number; label: string }
  /** a bench supply is in constant-voltage or constant-current mode */
  | { kind: 'supply_mode'; id: string; mode: 'CV' | 'CC'; label: string }
  // ── Home Power (Home workspace) ──
  /** each listed appliance is plugged in somewhere and switched on */
  | { kind: 'home_loads_on'; appliances: string[]; label: string }
  /** every breaker (and the main) is on: nothing tripped or switched off */
  | { kind: 'home_all_on'; label: string }
  /** no danger-level warnings (unprotected faults, breakers bigger than their wire) */
  | { kind: 'home_no_hazards'; label: string }
  /** voltage drop on a circuit ≤ maxPct while it carries current */
  | { kind: 'home_drop_max'; circuit: string; maxPct: number; label: string }
  /** the service load calculation fits the service rating */
  | { kind: 'home_service_fits'; label: string }
/** Extra stars (★2, ★3), judged when the level is completed. */
export type StarRule =
  | { kind: 'no_burnouts'; label: string }
  /** placed parts, not counting ground / junctions */
  | { kind: 'max_parts'; max: number; label: string }
  | { kind: 'led_current_band'; min: number; max: number; label: string }
  | { kind: 'source_current_max'; max: number; label: string }
  /** the player's prediction was within `tolerance` (fraction) of the measured value */
  | { kind: 'prediction'; tolerance: number; label: string }
  /** every wire's gauge (or just the listed wires') within [min, max] AWG */
  | { kind: 'wire_awg_range'; min: number; max: number; wires?: string[]; label: string }
  /** any goal, judged at completion */
  | { kind: 'goal'; goal: Goal; label: string }
  // ── Home Power ──
  /** no simplified code notes (GFCI/AFCI rooms) */
  | { kind: 'home_code_ok'; label: string }
  /** no circuit above pct% of its breaker rating */
  | { kind: 'home_circuit_load_max'; pct: number; label: string }
  /** at most n branch circuits */
  | { kind: 'home_max_circuits'; max: number; label: string }
  /** service stays at or below `amps` */
  | { kind: 'home_service_max'; amps: number; label: string }
  /** a circuit uses one of these breaker types */
  | { kind: 'home_breaker_type'; circuit: string; types: BreakerType[]; label: string }
  /** a circuit's wire gauge within [min, max] AWG */
  | { kind: 'home_gauge_range'; circuit: string; min: number; max: number; label: string }

export interface ScriptedAction {
  /** simulated seconds after start */
  at: number
  toggle: string
}

export interface Level {
  id: string
  chapterId: string
  title: string
  /** mission text, second person, a little story */
  brief: string
  /** the idea this level teaches (shown on the map + completion card) */
  concept: string
  starter: CircuitPreset
  /** parts the learner may add (palette filter) */
  palette: ComponentType[]
  goals: Goal[]
  /** simulated seconds all goals must hold to win (default 0.5) */
  holdSeconds?: number
  /** criteria for star 2 and star 3 */
  stars: [StarRule, StarRule]
  hints: string[]
  /** shown after completing: the "why it worked" */
  debrief: string
  xp: number
  /** parts added to the learner's collection on completion */
  unlocks?: ComponentType[]
  /** A reference solution (used by tests to prove the level is solvable). */
  solution: CircuitPreset & {
    actions?: ScriptedAction[]
    /** changes to starter parts (e.g. a new resistor value, a flipped LED) */
    componentPatches?: Record<string, Partial<import('../sim/elements').CircuitComponent>>
    /** changes to starter wires (e.g. a heavier gauge, a repaired wire) */
    wirePatches?: Record<string, Partial<import('../sim/elements').Wire>>
    /** starter wires the player deletes */
    removeWires?: string[]
    /** the player's prediction, for Predict missions */
    prediction?: number
  }
  /** Predict missions: the player types the reading they expect before building */
  predict?: { prompt: string; unit: string; measure: Measure }
  /** 'fix' missions start broken; shown as a tag on the map */
  type?: 'build' | 'fix' | 'predict' | 'design'
  /** Home Power missions run in the Home workspace instead of on the bench */
  home?: {
    starter: () => HomeDesign
    /** reference solution: the design after the player's changes */
    solve: (d: HomeDesign) => HomeDesign
    /** suggested clock speed */
    speed?: number
  }
}

export interface Chapter {
  id: string
  /** displayed chapter number */
  number: number
  title: string
  subtitle: string
  icon: string
  levels: Level[]
  /** opens when the player has this many stars in another chapter (or jumps ahead) */
  requires?: { chapter: string; stars: number }
}
