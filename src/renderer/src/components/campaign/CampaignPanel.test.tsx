import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CampaignPanel from './CampaignPanel'
import { useGameStore } from '@stores/gameStore'
import { useUIStore } from '@stores/uiStore'

beforeEach(() => {
  localStorage.clear()
  useGameStore.getState().resetProgress()
  useUIStore.setState({ activeLevelId: null, activePanel: 'campaign' })
})

describe('CampaignPanel', () => {
  it('unlocks only the first level for a new player', () => {
    render(<CampaignPanel />)
    expect(screen.getByRole('button', { name: /Level 1: Close the Loop$/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Level 2: .*\(locked\)/ })).toBeDisabled()
    expect(screen.getByTestId('xp-total')).toHaveTextContent('0 XP')
  })

  it('opens a mission card and starts the level in the sandbox', () => {
    render(<CampaignPanel />)
    fireEvent.click(screen.getByRole('button', { name: /Level 1: Close the Loop$/ }))
    expect(screen.getByTestId('mission-card')).toHaveTextContent('Close the Loop')
    fireEvent.click(screen.getByRole('button', { name: /Start mission/ }))
    expect(useUIStore.getState().activeLevelId).toBe('c1-l1')
    expect(useUIStore.getState().activePanel).toBe('sandbox')
  })

  it('records completion: XP, stars, unlocks and badges', () => {
    const r = useGameStore.getState().recordCompletion('c1-l1', 3, [true, true])
    expect(r.xpGained).toBe(200)
    expect(r.newBadges).toEqual(expect.arrayContaining(['first-light', 'three-star']))
    const s = useGameStore.getState()
    expect(s.collection).toContain('led')
    render(<CampaignPanel />)
    expect(screen.getByRole('button', { name: /Level 2: / })).toBeEnabled()
    // replaying for fewer stars pays nothing
    expect(useGameStore.getState().recordCompletion('c1-l1', 2, [true, false]).xpGained).toBe(0)
    expect(useGameStore.getState().completed['c1-l1'].stars).toBe(3)
  })
})
