/**
 * Volt — Campaign (game layer) types
 *
 * A level is a small mission on the live bench: a starter circuit, a parts bin,
 * goals that are checked continuously against the running simulation, and
 * star criteria that reward clean, efficient solutions.
 */
import type { ComponentType } from '../sim/elements'
import type { CircuitPreset } from '../lessons/types'

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

/** Extra stars (★2, ★3), judged when the level is completed. */
export type StarRule =
  | { kind: 'no_burnouts'; label: string }
  /** placed parts, not counting ground / junctions */
  | { kind: 'max_parts'; max: number; label: string }
  | { kind: 'led_current_band'; min: number; max: number; label: string }
  | { kind: 'source_current_max'; max: number; label: string }

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
  solution: CircuitPreset & { actions?: ScriptedAction[] }
}

export interface Chapter {
  id: string
  title: string
  subtitle: string
  icon: string
  levels: Level[]
}
