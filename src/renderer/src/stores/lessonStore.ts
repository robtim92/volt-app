import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { computeNextReview, scoreToQuality, type ReviewItem } from '../lessons/review'

// ── Types ────────────────────────────────────────────────────────────────────
// Lesson content will be loaded from JSON files in Phase 2.
// This store defines the shape for progress tracking and navigation.

export type TrackId = 'dc' | 'ac' | 'digital'

export interface LessonProgress {
  lessonId: string
  completed: boolean
  lastQuizScore?: number   // 0-100
  lastVisitedAt?: string   // ISO timestamp
}

export interface LessonState {
  // Progress — persisted to localStorage
  progress: Record<string, LessonProgress>  // key: lessonId
  /**
   * Pass/fail for each circuit quiz card.
   * Outer key: lessonId. Inner key: card index (as string). Value: passed.
   */
  circuitQuizResults: Record<string, Record<string, boolean>>
  /**
   * SM-2 spaced-repetition scheduling, keyed by lessonId. Persisted.
   * Drives the Dashboard's "Review today" queue (see lessons/review.ts).
   */
  reviewSchedule: Record<string, ReviewItem>

  // Navigation state — not persisted
  activeLessonId: string | null
  activeCardIndex: number

  // Actions
  markLessonComplete: (lessonId: string) => void
  recordQuizScore: (lessonId: string, score: number) => void
  recordCircuitQuizResult: (lessonId: string, cardIndex: number, passed: boolean) => void
  /** Advance a lesson's SM-2 schedule by one grading (quality 0–5). */
  recordReview: (lessonId: string, quality: number) => void
  setActiveLesson: (lessonId: string | null) => void
  setActiveCard: (index: number) => void
  advanceCard: () => void
}

export const useLessonStore = create<LessonState>()(
  persist(
    (set) => ({
      progress: {},
      circuitQuizResults: {},
      reviewSchedule: {},
      activeLessonId: null,
      activeCardIndex: 0,

      markLessonComplete: (lessonId) =>
        set((s) => ({
          progress: {
            ...s.progress,
            [lessonId]: {
              ...s.progress[lessonId],
              lessonId,
              completed: true,
              lastVisitedAt: new Date().toISOString()
            }
          }
        })),

      recordQuizScore: (lessonId, score) =>
        set((s) => {
          const now = new Date().toISOString()
          return {
            progress: {
              ...s.progress,
              [lessonId]: {
                ...s.progress[lessonId],
                lessonId,
                completed: s.progress[lessonId]?.completed ?? false,
                lastQuizScore: score
              }
            },
            // Seed / advance the SM-2 schedule from the quiz score.
            reviewSchedule: {
              ...s.reviewSchedule,
              [lessonId]: computeNextReview(
                s.reviewSchedule[lessonId],
                lessonId,
                scoreToQuality(score),
                now
              )
            }
          }
        }),

      recordCircuitQuizResult: (lessonId, cardIndex, passed) =>
        set((s) => ({
          circuitQuizResults: {
            ...s.circuitQuizResults,
            [lessonId]: {
              ...s.circuitQuizResults[lessonId],
              [String(cardIndex)]: passed
            }
          }
        })),

      recordReview: (lessonId, quality) =>
        set((s) => ({
          reviewSchedule: {
            ...s.reviewSchedule,
            [lessonId]: computeNextReview(
              s.reviewSchedule[lessonId],
              lessonId,
              quality,
              new Date().toISOString()
            )
          }
        })),

      setActiveLesson: (lessonId) =>
        set({ activeLessonId: lessonId, activeCardIndex: 0 }),

      setActiveCard: (index) => set({ activeCardIndex: index }),

      advanceCard: () =>
        set((s) => ({ activeCardIndex: s.activeCardIndex + 1 }))
    }),
    {
      name: 'volt-lessons',
      partialize: (s) => ({
        progress: s.progress,
        circuitQuizResults: s.circuitQuizResults,
        reviewSchedule: s.reviewSchedule
      })
    }
  )
)
