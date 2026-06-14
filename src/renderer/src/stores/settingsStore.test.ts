import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore, hasApiKey, DEFAULT_AI_MODEL } from './settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ apiKey: '', aiModel: DEFAULT_AI_MODEL })
  })

  it('starts with no key and the default model', () => {
    const s = useSettingsStore.getState()
    expect(s.apiKey).toBe('')
    expect(s.aiModel).toBe(DEFAULT_AI_MODEL)
    expect(hasApiKey(s)).toBe(false)
  })

  it('sets and trims the key, then reports configured', () => {
    useSettingsStore.getState().setApiKey('  sk-ant-abc  ')
    const s = useSettingsStore.getState()
    expect(s.apiKey).toBe('sk-ant-abc')
    expect(hasApiKey(s)).toBe(true)
  })

  it('clears the key', () => {
    useSettingsStore.getState().setApiKey('sk-ant-abc')
    useSettingsStore.getState().clearApiKey()
    expect(hasApiKey(useSettingsStore.getState())).toBe(false)
  })

  it('falls back to the default model when set to blank', () => {
    useSettingsStore.getState().setAiModel('   ')
    expect(useSettingsStore.getState().aiModel).toBe(DEFAULT_AI_MODEL)
  })
})
