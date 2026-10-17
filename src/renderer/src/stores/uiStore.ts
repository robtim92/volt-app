import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CircuitQuizCard } from '../lessons/types'

type Track = 'dc' | 'ac' | 'digital'
type Panel = 'lessons' | 'sandbox' | 'dashboard' | 'settings'
export type BenchView = '2d' | 'split' | '3d'

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
  /** Whether the AI assistant slide-over is open (transient, not persisted). */
  aiPanelOpen: boolean
  /** Whether the oscilloscope drawer is open (transient, not persisted). */
  scopeOpen: boolean
  /** Set when the learner launches a circuit quiz from the lesson player. */
  activeCircuitQuiz: ActiveCircuitQuiz | null
  /** Sandbox view: schematic, 3D bench, or both side by side (persisted). */
  benchView: BenchView

  toggleDarkMode: () => void
  setActiveTrack: (track: Track) => void
  setActivePanel: (panel: Panel) => void
  setSidebarOpen: (open: boolean) => void
  setAIPanelOpen: (open: boolean) => void
  toggleAIPanel: () => void
  setScopeOpen: (open: boolean) => void
  toggleScope: () => void
  setBenchView: (view: BenchView) => void
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
      aiPanelOpen: false,
      scopeOpen: false,
      activeCircuitQuiz: null,
      benchView: 'split',

      // Actions
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setActiveTrack: (track) => set({ activeTrack: track }),
      setActivePanel: (panel) => set({ activePanel: panel }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setAIPanelOpen: (open) => set({ aiPanelOpen: open }),
      toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
      setScopeOpen: (open) => set({ scopeOpen: open }),
      toggleScope: () => set((s) => ({ scopeOpen: !s.scopeOpen })),
      setBenchView: (benchView) => set({ benchView }),
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
        hasOnboarded: s.hasOnboarded,
        benchView: s.benchView
      })
    }
  )
)
