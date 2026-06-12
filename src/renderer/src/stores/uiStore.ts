import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Track = 'dc' | 'ac' | 'digital'
type Panel = 'lessons' | 'sandbox' | 'dashboard' | 'settings'

interface UIState {
  darkMode: boolean
  activeTrack: Track
  activePanel: Panel
  sidebarOpen: boolean

  toggleDarkMode: () => void
  setActiveTrack: (track: Track) => void
  setActivePanel: (panel: Panel) => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Defaults
      darkMode: false,
      activeTrack: 'dc',
      activePanel: 'sandbox',
      sidebarOpen: true,

      // Actions
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setActiveTrack: (track) => set({ activeTrack: track }),
      setActivePanel: (panel) => set({ activePanel: panel }),
      setSidebarOpen: (open) => set({ sidebarOpen: open })
    }),
    {
      name: 'volt-ui',              // localStorage key
      partialize: (s) => ({         // only persist user preferences, not transient UI state
        darkMode: s.darkMode,
        activeTrack: s.activeTrack
      })
    }
  )
)
