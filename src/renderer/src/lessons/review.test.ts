import { describe, it, expect } from 'vitest'
import {
  scoreToQuality,
  computeNextReview,
  getDueLessons,
  MIN_EASE,
  STALENESS_CEILING_DAYS,
  type ReviewItem
} from './review'
import type { Lesson } from './types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = '2026-06-14T12:00:00.000Z'

function lesson(id: string, module = 'Fundamentals'): Lesson {
  return {
    id,
    track: 'dc',
    module,
    title: `Lesson ${id}`,
    summary: '',
    estMinutes: 5,
    cards: []
  }
}

function daysFrom(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()
}

// ── scoreToQuality ────────────────────────────────────────────────────────────

describe('scoreToQuality', () => {
  it('maps the pass/fail boundary at 70 to grade 3', () => {
    expect(scoreToQuality(70)).toBe(3) // lowest pass
    expect(scoreToQuality(69)).toBe(2) // highest fail
  })

  it('grades across the full band', () => {
    expect(scoreToQuality(100)).toBe(5)
    expect(scoreToQuality(90)).toBe(5)
    expect(scoreToQuality(80)).toBe(4)
    expect(scoreToQuality(50)).toBe(2)
    expect(scoreToQuality(30)).toBe(1)
    expect(scoreToQuality(0)).toBe(0)
  })
})

// ── computeNextReview (SM-2 core) ─────────────────────────────────────────────

describe('computeNextReview', () => {
  it('seeds a fresh item: first pass → 1-day interval, ease rises on a 5', () => {
    const item = computeNextReview(undefined, 'L1', 5, NOW)
    expect(item.repetitions).toBe(1)
    expect(item.intervalDays).toBe(1)
    expect(item.ease).toBeCloseTo(2.6, 5) // 2.5 + 0.1 for a perfect grade
    expect(item.dueAt).toBe(daysFrom(NOW, 1))
    expect(item.lastReviewedAt).toBe(NOW)
  })

  it('grows the interval across successive passes (1 → 6 → round(6·EF))', () => {
    const r1 = computeNextReview(undefined, 'L1', 5, NOW)
    const r2 = computeNextReview(r1, 'L1', 5, NOW)
    expect(r2.repetitions).toBe(2)
    expect(r2.intervalDays).toBe(6)

    const r3 = computeNextReview(r2, 'L1', 5, NOW)
    expect(r3.repetitions).toBe(3)
    // SM-2 uses the freshly-updated ease for the next interval: round(6 · r3.ease).
    expect(r3.intervalDays).toBe(Math.round(r2.intervalDays * r3.ease))
    expect(r3.intervalDays).toBe(17)
    expect(r3.intervalDays).toBeGreaterThan(6)
  })

  it('lapses on a sub-3 grade: repetitions reset, interval back to 1 day', () => {
    const r1 = computeNextReview(undefined, 'L1', 5, NOW)
    const r2 = computeNextReview(r1, 'L1', 5, NOW)
    const lapse = computeNextReview(r2, 'L1', 1, NOW)
    expect(lapse.repetitions).toBe(0)
    expect(lapse.intervalDays).toBe(1)
    expect(lapse.dueAt).toBe(daysFrom(NOW, 1))
  })

  it('floors the ease factor at MIN_EASE under repeated poor grades', () => {
    let item = computeNextReview(undefined, 'L1', 0, NOW)
    for (let i = 0; i < 10; i++) item = computeNextReview(item, 'L1', 0, NOW)
    expect(item.ease).toBe(MIN_EASE)
    expect(item.ease).toBeGreaterThanOrEqual(MIN_EASE)
  })
})

// ── getDueLessons (queue selection) ───────────────────────────────────────────

describe('getDueLessons', () => {
  const lessons = [lesson('a'), lesson('b'), lesson('c'), lesson('d')]

  it('returns nothing for incomplete lessons', () => {
    const progress = { a: { completed: false, lastQuizScore: 10 } }
    expect(getDueLessons(lessons, progress, {}, NOW)).toEqual([])
  })

  it('surfaces a sub-70% completed lesson as low_score', () => {
    const progress = { a: { completed: true, lastQuizScore: 55, lastVisitedAt: NOW } }
    const due = getDueLessons(lessons, progress, {}, NOW)
    expect(due).toHaveLength(1)
    expect(due[0].reason).toBe('low_score')
  })

  it('surfaces a passing lesson whose SM-2 dueAt has passed', () => {
    const progress = { a: { completed: true, lastQuizScore: 95, lastVisitedAt: daysFrom(NOW, -2) } }
    const schedule: Record<string, ReviewItem> = {
      a: { lessonId: 'a', ease: 2.5, intervalDays: 1, repetitions: 1, dueAt: daysFrom(NOW, -1), lastReviewedAt: daysFrom(NOW, -2) }
    }
    const due = getDueLessons(lessons, progress, schedule, NOW)
    expect(due).toHaveLength(1)
    expect(due[0].reason).toBe('due')
    expect(due[0].overdueDays).toBe(1)
  })

  it('does NOT surface a passing lesson not yet due and not stale', () => {
    const progress = { a: { completed: true, lastQuizScore: 95, lastVisitedAt: NOW } }
    const schedule: Record<string, ReviewItem> = {
      a: { lessonId: 'a', ease: 2.5, intervalDays: 6, repetitions: 2, dueAt: daysFrom(NOW, 6), lastReviewedAt: NOW }
    }
    expect(getDueLessons(lessons, progress, schedule, NOW)).toEqual([])
  })

  it('applies the staleness ceiling regardless of SM-2 interval', () => {
    // Passing lesson, scheduled far in the future, but untouched > 7 days.
    const lastReviewed = daysFrom(NOW, -(STALENESS_CEILING_DAYS + 1))
    const progress = { a: { completed: true, lastQuizScore: 95, lastVisitedAt: lastReviewed } }
    const schedule: Record<string, ReviewItem> = {
      a: { lessonId: 'a', ease: 2.5, intervalDays: 30, repetitions: 5, dueAt: daysFrom(NOW, 20), lastReviewedAt: lastReviewed }
    }
    const due = getDueLessons(lessons, progress, schedule, NOW)
    expect(due).toHaveLength(1)
    expect(due[0].reason).toBe('stale')
  })

  it('sorts low_score before due before stale, then most-overdue first', () => {
    const progress = {
      a: { completed: true, lastQuizScore: 40, lastVisitedAt: NOW },                                   // low_score
      b: { completed: true, lastQuizScore: 90, lastVisitedAt: daysFrom(NOW, -3) },                      // due
      c: { completed: true, lastQuizScore: 90, lastVisitedAt: daysFrom(NOW, -(STALENESS_CEILING_DAYS + 2)) }, // stale
      d: { completed: true, lastQuizScore: 90, lastVisitedAt: daysFrom(NOW, -10) }                      // due, more overdue
    }
    const schedule: Record<string, ReviewItem> = {
      b: { lessonId: 'b', ease: 2.5, intervalDays: 1, repetitions: 1, dueAt: daysFrom(NOW, -2), lastReviewedAt: daysFrom(NOW, -3) },
      d: { lessonId: 'd', ease: 2.5, intervalDays: 1, repetitions: 1, dueAt: daysFrom(NOW, -9), lastReviewedAt: daysFrom(NOW, -10) }
    }
    const order = getDueLessons(lessons, progress, schedule, NOW).map((d) => d.lesson.id)
    expect(order).toEqual(['a', 'd', 'b', 'c'])
  })
})
