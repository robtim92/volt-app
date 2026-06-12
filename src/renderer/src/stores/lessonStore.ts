import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Types ────────────────────────────────────────────────────────────────────
// Lesson content will be loaded from JSON files in Phase 2.
// This store defines the shape for progress tracking and navigation.

export type TrackId = 'dc' | 'ac' | 'digital'

export interface LessonProgress {
  lessonId: string
  completed: boolean
  lastQuizScore?: number   // 0–100
  lastVisitedAt?: string   // ISO timestamp
}

export interface LessonState {
  // Progress — persisted to localStorage
  progress: Record<string, LessonProgress>  // key: lessonId

  // Navigation state — not persisted
  activeLessonId: string | null
  activeCardIndex: number

  // Actions
  markLessonComplete: (lessonId: string) => void
  recordQuizScore: (lessonId: string, score: number) => void
  setActiveLesson: (lessonId: string | null) => void
  setActiveCard: (index: number) => void
  advanceCard: () => void
}

export const useLessonStore = create<LessonState>()(
  persist(
    (set) => ({
      progress: {},
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

      setActiveLesson: (lessonId) =>
        set({ activeLessonId: lessonId, activeCardIndex: 0 }),

      setActiveCard: (index) => set({ activeCardIndex: index }),

      advanceCard: () =>
        set((s) => ({ activeCardIndex: s.activeCardIndex + 1 }))
    }),
    {
      name: 'volt-lessons',
      partialize: (s) => ({ progress: s.progress })  // only persist completion data
    }
  )
)
