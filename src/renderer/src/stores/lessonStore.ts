import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

  // Navigation state — not persisted
  activeLessonId: string | null
  activeCardIndex: number

  // Actions
  markLessonComplete: (lessonId: string) => void
  recordQuizScore: (lessonId: string, score: number) => void
  recordCircuitQuizResult: (lessonId: string, cardIndex: number, passed: boolean) => void
  setActiveLesson: (lessonId: string | null) => void
  setActiveCard: (index: number) => void
  advanceCard: () => void
}

export const useLessonStore = create<LessonState>()(
  persist(
    (set) => ({
      progress: {},
      circuitQuizResults: {},
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
        set((s) => ({
          progress: {
            ...s.progress,
            [lessonId]: {
              ...s.progress[lessonId],
              lessonId,
              completed: s.progress[lessonId]?.completed ?? false,
              lastQuizScore: score
            }
          }
        })),

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

      setActiveLesson: (lessonId) =>
        set({ activeLessonId: lessonId, activeCardIndex: 0 }),

      setActiveCard: (index) => set({ activeCardIndex: index }),

      advanceCard: () =>
        set((s) => ({ activeCardIndex: s.activeCardIndex + 1 }))
    }),
    {
      name: 'volt-lessons',
      partialize: (s) => ({ progress: s.progress, circuitQuizResults: s.circuitQuizResults })
    }
  )
)
