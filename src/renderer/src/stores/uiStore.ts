import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CircuitQuizCard } from '../lessons/types'

type Track = 'dc' | 'ac' | 'digital'
type Panel = 'lessons' | 'sandbox' | 'dashboard' | 'settings'

export interface ActiveCircuitQuiz {
  /** Lesson id + card index — used to record the result. */
  lessonId: string
  cardIndex: number
  card: CircuitQuizCard
  /** How many failed attempts so far (controls hint reveal). */
  attempts: number
  /** Whether the learner has passed this attempt. */
  passed: boolean
  /** Failure labels from the last validation run. */
  failures: string[]
}

interface UIState {
  darkMode: boolean
  activeTrack: Track
  activePanel: Panel
  sidebarOpen: boolean
  hasOnboarded: boolean
  /** Set when the learner launches a circuit quiz from the lesson player. */
  activeCircuitQuiz: ActiveCircuitQuiz | null

  toggleDarkMode: () => void
  setActiveTrack: (track: Track) => void
  setActivePanel: (panel: Panel) => void
  setSidebarOpen: (open: boolean) => void
  completeOnboarding: () => void
  startCircuitQuiz: (lessonId: string, cardIndex: number, card: CircuitQuizCard) => void
  setCircuitQuizResult: (passed: boolean, failures: string[]) => void
  clearCircuitQuiz: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Defaults
      darkMode: false,
      activeTrack: 'dc',
      activePanel: 'sandbox',
      sidebarOpen: true,
      hasOnboarded: false,
      activeCircuitQuiz: null,

      // Actions
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setActiveTrack: (track) => set({ activeTrack: track }),
      setActivePanel: (panel) => set({ activePanel: panel }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      completeOnboarding: () => set({ hasOnboarded: true }),
      startCircuitQuiz: (lessonId, cardIndex, card) =>
        set({
          activeCircuitQuiz: { lessonId, cardIndex, card, attempts: 0, passed: false, failures: [] },
          activePanel: 'sandbox'
        }),
      setCircuitQuizResult: (passed, failures) =>
        set((s) =>
          s.activeCircuitQuiz
            ? { activeCircuitQuiz: { ...s.activeCircuitQuiz, passed, failures, attempts: s.activeCircuitQuiz.attempts + 1 } }
            : {}
        ),
      clearCircuitQuiz: () => set({ activeCircuitQuiz: null })
    }),
    {
      name: 'volt-ui',              // localStorage key
      partialize: (s) => ({         // only persist user preferences, not transient UI state
        darkMode: s.darkMode,
        activeTrack: s.activeTrack,
        hasOnboarded: s.hasOnboarded
      })
    }
  )
)
