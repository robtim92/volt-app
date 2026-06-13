/**
 * Volt — Lesson content schema
 *
 * Lessons are sequences of cards, one idea per card, in the spirit of
 * Brilliant.org. Cards can embed a circuit preset that the learner can open
 * in the sandbox with one click ("guided lab lite" — full in-card mini-sims
 * and lab mode come later in Phase 2).
 *
 * Content lives in TypeScript modules for now (type-checked at build time);
 * the Phase 2–3 CMS will emit the same shapes as JSON.
 */
import type { CircuitComponent, ComponentType, Wire } from '../sim/elements'

export type { CircuitComponent, ComponentType, Wire }

export type TrackId = 'dc' | 'ac' | 'digital'

export interface CircuitPreset {
  components: CircuitComponent[]
  wires: Wire[]
}

export interface ConceptCard {
  type: 'concept'
  title: string
  /** Plain text; blank lines separate paragraphs. */
  body: string
  /** Optional circuit the learner can open in the sandbox. */
  circuit?: CircuitPreset
  /** Label for the circuit button (default: "Try it in the sandbox") */
  circuitLabel?: string
}

export interface QuizCard {
  type: 'quiz'
  question: string
  choices: string[]
  answerIndex: number
  explanation: string
}

export type CircuitConditionType =
  | 'circuit_solves'
  | 'component_type_current'
  | 'voltmeter_reads'
  | 'component_present'
  | 'component_absent'

export interface CircuitCondition {
  type: CircuitConditionType
  componentType?: ComponentType
  min?: number
  max?: number
  count?: number
  label: string
}

export interface CircuitQuizCard {
  type: 'circuit_quiz'
  question: string
  instructions: string
  starterCircuit?: CircuitPreset
  allowedComponents?: ComponentType[]
  conditions: CircuitCondition[]
  hints?: string[]
  explanation: string
}

export type LessonCard = ConceptCard | QuizCard | CircuitQuizCard

export interface Lesson {
  id: string
  track: TrackId
  /** Module grouping, e.g. "Fundamentals" or "Ohm's Law & Power" */
  module: string
  title: string
  summary: string
  estMinutes: number
  cards: LessonCard[]
}
