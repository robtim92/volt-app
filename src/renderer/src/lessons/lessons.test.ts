/**
 * Content validation: every lesson must be structurally sound and every
 * embedded circuit preset must actually solve in the simulator. This keeps
 * authored content honest as the curriculum grows.
 */
import { describe, it, expect } from 'vitest'
import { ALL_LESSONS, getLessonsForTrack, getModulesForTrack, getLesson } from './index'
import { buildNetlist } from '../sim/netlist'
import { solveDC } from '../sim/solver'

describe('lesson content integrity', () => {
  it('has unique lesson ids', () => {
    const ids = ALL_LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every lesson has cards, a summary, and a sensible time estimate', () => {
    for (const lesson of ALL_LESSONS) {
      expect(lesson.cards.length, lesson.id).toBeGreaterThanOrEqual(3)
      expect(lesson.summary.length, lesson.id).toBeGreaterThan(10)
      expect(lesson.estMinutes, lesson.id).toBeGreaterThan(0)
      expect(lesson.estMinutes, lesson.id).toBeLessThan(60)
    }
  })

  it('every lesson includes at least one quiz card', () => {
    for (const lesson of ALL_LESSONS) {
      const quizzes = lesson.cards.filter((c) => c.type === 'quiz')
      expect(quizzes.length, lesson.id).toBeGreaterThanOrEqual(1)
    }
  })

  it('every quiz has a valid answer index and an explanation', () => {
    for (const lesson of ALL_LESSONS) {
      for (const card of lesson.cards) {
        if (card.type !== 'quiz') continue
        expect(card.choices.length, lesson.id).toBeGreaterThanOrEqual(2)
        expect(card.answerIndex, lesson.id).toBeGreaterThanOrEqual(0)
        expect(card.answerIndex, lesson.id).toBeLessThan(card.choices.length)
        expect(card.explanation.length, lesson.id).toBeGreaterThan(10)
      }
    }
  })

  it('every embedded circuit preset builds and solves', () => {
    for (const lesson of ALL_LESSONS) {
      for (const card of lesson.cards) {
        if (card.type !== 'concept' || !card.circuit) continue
        const { netlist, warnings } = buildNetlist(
          card.circuit.components,
          card.circuit.wires
        )
        expect(warnings, `${lesson.id}: preset warnings`).toEqual([])
        const result = solveDC(netlist)
        expect(result.solved, `${lesson.id}: ${result.error ?? ''}`).toBe(true)
      }
    }
  })

  it('preset component ids are unique within each preset', () => {
    for (const lesson of ALL_LESSONS) {
      for (const card of lesson.cards) {
        if (card.type !== 'concept' || !card.circuit) continue
        const ids = card.circuit.components.map((c) => c.id)
        expect(new Set(ids).size, lesson.id).toBe(ids.length)
      }
    }
  })
})

describe('lesson lookup helpers', () => {
  it('returns DC lessons in curriculum order', () => {
    const dc = getLessonsForTrack('dc')
    expect(dc.length).toBeGreaterThanOrEqual(4)
    expect(dc[0].module).toBe('Fundamentals')
  })

  it('groups lessons by module preserving order', () => {
    const modules = getModulesForTrack('dc')
    expect(modules.length).toBeGreaterThanOrEqual(3)
    expect(modules[0].module).toBe('Fundamentals')
  })

  it('returns empty for tracks without content yet', () => {
    expect(getLessonsForTrack('ac')).toEqual([])
    expect(getLessonsForTrack('digital')).toEqual([])
  })

  it('finds lessons by id', () => {
    expect(getLesson('dc-ohm-1')?.title).toBe("Ohm's Law")
    expect(getLesson('nope')).toBeUndefined()
  })
})
