import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AIAssistantPanel from './AIAssistantPanel'
import { useSettingsStore, DEFAULT_AI_MODEL } from '@stores/settingsStore'

describe('AIAssistantPanel gating', () => {
  beforeEach(() => {
    useSettingsStore.setState({ apiKey: '', aiModel: DEFAULT_AI_MODEL })
  })

  it('renders nothing when no API key is configured', () => {
    const { container } = render(<AIAssistantPanel />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the launcher once a key is set', () => {
    useSettingsStore.setState({ apiKey: 'sk-ant-test', aiModel: DEFAULT_AI_MODEL })
    render(<AIAssistantPanel />)
    expect(screen.getByLabelText('Toggle Volt AI assistant')).toBeInTheDocument()
  })
})
