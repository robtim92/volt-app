import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Volt — Settings store
 *
 * Holds user configuration that isn't lesson progress or UI layout. Right now
 * that's just the optional Claude API key powering the AI assistant add-on
 * (Phase 3). The key is stored in localStorage and used to call the Anthropic
 * API directly from the client — see ai/aiClient.ts and the security note in
 * the Settings panel.
 */

/** Default model for the AI assistant — Haiku, for latency/cost. */
export const DEFAULT_AI_MODEL = 'claude-haiku-4-5-20251001'

interface SettingsState {
  /** Anthropic API key (empty string = not configured). Persisted. */
  apiKey: string
  /** Model id used for assistant requests. Persisted. */
  aiModel: string

  setApiKey: (key: string) => void
  clearApiKey: () => void
  setAiModel: (model: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      aiModel: DEFAULT_AI_MODEL,

      setApiKey: (key) => set({ apiKey: key.trim() }),
      clearApiKey: () => set({ apiKey: '' }),
      setAiModel: (model) => set({ aiModel: model.trim() || DEFAULT_AI_MODEL })
    }),
    {
      name: 'volt-settings',
      partialize: (s) => ({ apiKey: s.apiKey, aiModel: s.aiModel })
    }
  )
)

/** True when an API key is configured — gates the AI assistant UI. */
export function hasApiKey(state: { apiKey: string }): boolean {
  return state.apiKey.trim().length > 0
}
