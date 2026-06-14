/**
 * Volt — AI assistant context assembly
 *
 * Pure helpers that serialize the live circuit and the learner's lesson
 * progress into a compact, token-efficient text block. This block is sent as
 * part of the system prompt so the assistant can reason about exactly what the
 * user is looking at ("why isn't my LED lighting up?") without the user having
 * to describe it.
 *
 * Kept free of React/store imports so it can be unit-tested in isolation.
 */
import type { CircuitComponent, Wire } from '../sim/elements'
import { ELEMENTS } from '../sim/elements'
import type { SimulationResult } from '../stores/circuitStore'
import type { Lesson } from '../lessons/types'
import type { LessonProgress } from '../stores/lessonStore'

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Engineering-ish formatting for a value in a component's base unit. */
function fmtValue(c: CircuitComponent): string {
  if (c.value === undefined) return ''
  const unit = ELEMENTS[c.type]?.unit ?? ''
  return ` = ${c.value}${unit}`
}

/** Amps → mA/µA/A with a couple of significant figures. */
export function fmtCurrent(amps: number): string {
  const a = Math.abs(amps)
  if (a === 0) return '0 A'
  if (a < 1e-3) return `${(amps * 1e6).toPrecision(3)} µA`
  if (a < 1) return `${(amps * 1e3).toPrecision(3)} mA`
  return `${amps.toPrecision(3)} A`
}

// ── Circuit summary ───────────────────────────────────────────────────────────

export function buildCircuitSummary(
  components: CircuitComponent[],
  wires: Wire[],
  sim: SimulationResult | null
): string {
  if (components.length === 0) return 'The canvas is empty — no components placed yet.'

  const lines: string[] = []
  lines.push(`Components (${components.length}):`)
  for (const c of components) {
    const name = c.label || ELEMENTS[c.type]?.displayName || c.type
    const current = sim?.elementCurrents?.[c.id]
    const closed = c.type === 'switch' ? ` (${c.closed ? 'closed' : 'open'})` : ''
    const iStr = current !== undefined ? `, I = ${fmtCurrent(current)}` : ''
    lines.push(`  - ${name} [${c.type}]${fmtValue(c)}${closed}${iStr}`)
  }

  lines.push(`Wires: ${wires.length} connection${wires.length === 1 ? '' : 's'}.`)

  if (!sim) {
    lines.push('Simulation: not yet run.')
  } else if (sim.error) {
    lines.push(`Simulation: FAILED — ${sim.error}`)
  } else if (!sim.solved) {
    lines.push('Simulation: did not solve (likely an incomplete or open circuit).')
  } else {
    lines.push('Simulation: solved successfully.')
  }
  if (sim?.warnings?.length) {
    lines.push(`Warnings: ${sim.warnings.join('; ')}`)
  }

  return lines.join('\n')
}

// ── Lesson progress summary ───────────────────────────────────────────────────

export function buildLessonSummary(
  progress: Record<string, LessonProgress>,
  lessons: Lesson[],
  activeLessonId: string | null
): string {
  const active = activeLessonId ? lessons.find((l) => l.id === activeLessonId) : undefined
  const completed = lessons.filter((l) => progress[l.id]?.completed)

  const lines: string[] = []
  if (active) {
    const score = progress[active.id]?.lastQuizScore
    lines.push(
      `Active lesson: "${active.title}" (module: ${active.module})` +
        (score !== undefined ? `, last quiz ${score}%` : '')
    )
  } else {
    lines.push('Active lesson: none (free sandbox).')
  }
  lines.push(`Progress: ${completed.length}/${lessons.length} lessons completed.`)
  return lines.join('\n')
}

// ── System prompt assembly ────────────────────────────────────────────────────

export const TUTOR_PERSONA =
  'You are Volt AI, a patient electronics tutor embedded in an educational ' +
  'circuit simulator. Help the learner understand DC circuit concepts and debug ' +
  'the circuit they have on screen. Be concise and concrete; reference their ' +
  'actual components and measured currents. Prefer guiding questions and the ' +
  'relevant formula (Ohm\'s law, KVL/KCL, power) over just giving the answer. ' +
  'If the circuit context shows the simulation failed or did not solve, help ' +
  'them find the open connection or missing component.'

export interface AssistantContext {
  components: CircuitComponent[]
  wires: Wire[]
  sim: SimulationResult | null
  progress: Record<string, LessonProgress>
  lessons: Lesson[]
  activeLessonId: string | null
}

/** Build the full system prompt: persona + live circuit + lesson context. */
export function assembleSystemPrompt(ctx: AssistantContext): string {
  return [
    TUTOR_PERSONA,
    '',
    '--- CURRENT CIRCUIT ---',
    buildCircuitSummary(ctx.components, ctx.wires, ctx.sim),
    '',
    '--- LEARNER PROGRESS ---',
    buildLessonSummary(ctx.progress, ctx.lessons, ctx.activeLessonId)
  ].join('\n')
}
