/**
 * Regression: at real frame rates (~16 ms/frame) the hold timer must still
 * accumulate and the level must complete.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { useLevelRunner } from './useLevelRunner'
import { useUIStore } from '@stores/uiStore'
import { useGameStore } from '@stores/gameStore'
import { useCircuitStore } from '@stores/circuitStore'
import { liveFrame } from '@stores/liveSimStore'
import { getLevel } from '../game/levels'
import { buildTransientNetlist } from '../sim/netlist'
import { TransientSimulator } from '../sim/transient'

function Runner(): null {
  useLevelRunner()
  return null
}

describe('useLevelRunner', () => {
  let frames: FrameRequestCallback[] = []
  beforeEach(() => {
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    localStorage.clear()
    useGameStore.getState().resetProgress()
    useUIStore.setState({ activeLevelId: null })
  })

  it('completes a solved level when frames arrive every 16 ms', () => {
    const level = getLevel('c1-l1')!
    render(<Runner />)
    act(() => useUIStore.getState().startLevel(level.id))
    // Apply the reference solution and a matching live snapshot
    const comps = [...level.starter.components, ...level.solution.components]
    const wires = [...level.starter.wires, ...level.solution.wires]
    act(() => useCircuitStore.getState().loadCircuitData(comps, wires))
    const built = buildTransientNetlist(comps, wires)
    const sim = new TransientSimulator(built.netlist)
    liveFrame.terminalNodes = built.terminalNodes
    liveFrame.time = 0
    for (let k = 0; k < 120 && !useGameStore.getState().lastCompletion; k++) {
      liveFrame.snapshot = sim.advance(1 / 60, 1e-3)
      liveFrame.time = sim.time
      const pending = frames
      frames = []
      act(() => pending.forEach((cb) => cb(k * 16.7)))
    }
    expect(useGameStore.getState().lastCompletion?.levelId).toBe('c1-l1')
    expect(useGameStore.getState().lastCompletion?.stars).toBe(3)
  })
})
