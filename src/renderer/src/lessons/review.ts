/**
 * Volt — Spaced-repetition scheduling (SM-2)
 *
 * Pure, side-effect-free helpers for the daily review queue. The store owns the
 * persisted `reviewSchedule`; this module owns the math so it can be unit-tested
 * in isolation.
 *
 * We use the classic SuperMemo-2 algorithm: each lesson carries an ease factor
 * (EF), a running interval, and a repetition count. A quiz score is mapped to an
 * SM-2 quality grade (0–5); grades below 3 (i.e. a sub-70% score) lapse the
 * lesson back to a 1-day interval.
 *
 * On top of SM-2 the review queue applies two extra surfacing rules, per the
 * Phase 3 spec: a lesson also surfaces if its last score was < 70%, or if it has
 * not been reviewed in STALENESS_CEILING_DAYS days regardless of its computed
 * SM-2 interval.
 */
import type { Lesson } from './types'

// ── Tunables ──────────────────────────────────────────────────────────────────

export const DEFAULT_EASE = 2.5
export const MIN_EASE = 1.3
/** Scores at or above this are a "pass" (SM-2 grade ≥ 3). */
export const REVIEW_SCORE_THRESHOLD = 70
/** A lesson untouched for this many days resurfaces no matter its SM-2 interval. */
export const STALENESS_CEILING_DAYS = 7

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReviewItem {
  lessonId: string
  /** SM-2 ease factor (EF), floored at MIN_EASE. */
  ease: number
  /** Current scheduling interval, in days. */
  intervalDays: number
  /** Consecutive successful repetitions (resets to 0 on a lapse). */
  repetitions: number
  /** When this lesson next becomes due for review (ISO timestamp). */
  dueAt: string
  /** When this lesson was last graded/reviewed (ISO timestamp). */
  lastReviewedAt: string
}

export type ReviewReason = 'low_score' | 'due' | 'stale'

export interface DueLesson {
  lesson: Lesson
  reason: ReviewReason
  /** Whole days the lesson is past due (0 for low_score-only / not-yet-due). */
  overdueDays: number
}

/** Minimal shape this module reads from the lesson store's progress map. */
interface ProgressLike {
  completed?: boolean
  lastQuizScore?: number
  lastVisitedAt?: string
}

// ── Date helpers ──────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * MS_PER_DAY).toISOString()
}

function daysBetween(laterIso: string, earlierIso: string): number {
  return (new Date(laterIso).getTime() - new Date(earlierIso).getTime()) / MS_PER_DAY
}

// ── SM-2 core ─────────────────────────────────────────────────────────────────

/**
 * Map a 0–100 quiz score to an SM-2 quality grade (0–5).
 * The pass/fail boundary sits exactly at REVIEW_SCORE_THRESHOLD: any score below
 * it yields a grade < 3, which SM-2 treats as a lapse.
 */
export function scoreToQuality(score: number): number {
  if (score >= 90) return 5
  if (score >= 80) return 4
  if (score >= REVIEW_SCORE_THRESHOLD) return 3
  if (score >= 50) return 2
  if (score >= 25) return 1
  return 0
}

function nextEase(ease: number, quality: number): number {
  // SM-2 EF update; clamp at the conventional 1.3 floor.
  const updated = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  return Math.max(MIN_EASE, updated)
}

/**
 * Advance an existing review item by one grading. Pass `undefined` for a
 * lesson's first-ever review to seed a fresh SM-2 item.
 */
export function computeNextReview(
  prev: ReviewItem | undefined,
  lessonId: string,
  quality: number,
  now: string
): ReviewItem {
  const ease = nextEase(prev?.ease ?? DEFAULT_EASE, quality)
  const priorReps = prev?.repetitions ?? 0
  const priorInterval = prev?.intervalDays ?? 0

  let repetitions: number
  let intervalDays: number

  if (quality < 3) {
    // Lapse: reset the streak, review again tomorrow.
    repetitions = 0
    intervalDays = 1
  } else {
    repetitions = priorReps + 1
    if (repetitions === 1) intervalDays = 1
    else if (repetitions === 2) intervalDays = 6
    else intervalDays = Math.round(priorInterval * ease)
  }

  return {
    lessonId,
    ease,
    intervalDays,
    repetitions,
    dueAt: addDays(now, intervalDays),
    lastReviewedAt: now
  }
}

// ── Queue selection ───────────────────────────────────────────────────────────

const REASON_RANK: Record<ReviewReason, number> = { low_score: 0, due: 1, stale: 2 }

/**
 * Build the "Review today" queue. A completed lesson surfaces if any of:
 *   • its last quiz score was below REVIEW_SCORE_THRESHOLD  (reason 'low_score')
 *   • its SM-2 dueAt has passed                              (reason 'due')
 *   • it has not been reviewed in STALENESS_CEILING_DAYS days (reason 'stale')
 *
 * Sorted by reason priority (low score → due → stale), then most-overdue first.
 */
export function getDueLessons(
  lessons: Lesson[],
  progress: Record<string, ProgressLike>,
  schedule: Record<string, ReviewItem>,
  now: string = new Date().toISOString()
): DueLesson[] {
  const out: DueLesson[] = []

  for (const lesson of lessons) {
    const p = progress[lesson.id]
    if (!p?.completed) continue

    const item = schedule[lesson.id]
    const lastReviewedAt = item?.lastReviewedAt ?? p.lastVisitedAt
    const staleDays = lastReviewedAt ? daysBetween(now, lastReviewedAt) : Infinity
    const dueOverdue = item ? daysBetween(now, item.dueAt) : 0

    let reason: ReviewReason | null = null
    let overdueDays = 0

    if (p.lastQuizScore !== undefined && p.lastQuizScore < REVIEW_SCORE_THRESHOLD) {
      reason = 'low_score'
      overdueDays = item ? Math.max(0, Math.floor(dueOverdue)) : 0
    } else if (item && dueOverdue >= 0) {
      reason = 'due'
      overdueDays = Math.floor(dueOverdue)
    } else if (staleDays >= STALENESS_CEILING_DAYS) {
      reason = 'stale'
      overdueDays = Number.isFinite(staleDays) ? Math.floor(staleDays) : 0
    }

    if (reason) out.push({ lesson, reason, overdueDays })
  }

  out.sort((a, b) => {
    const r = REASON_RANK[a.reason] - REASON_RANK[b.reason]
    if (r !== 0) return r
    return b.overdueDays - a.overdueDays
  })

  return out
}
