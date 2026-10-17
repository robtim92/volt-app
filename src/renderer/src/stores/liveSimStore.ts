/**
 * Volt — Live (time-domain) simulation store
 *
 * React-facing state for the running simulation: play/pause, time scale, the
 * simulated clock, and short-lived visual effects (burnouts, sparks, trips)
 * that renderers turn into smoke, flashes and particles.
 *
 * Per-frame data (instantaneous voltages/currents, heat, scope history) lives
 * in the mutable `liveFrame` object instead, so the canvas and the 3D bench can
 * read it every animation frame without triggering React re-renders.
 */
import { create } from 'zustand'
import type { TransientSnapshot } from '../sim/transient'

export type EffectKind = 'burnout' | 'pop' | 'fuse' | 'trip' | 'arc'

export interface LiveEffect {
  id: number
  componentId: string
  kind: EffectKind
  /** performance.now() when it happened */
  at: number
  message?: string
}

export interface ScopeSample {
  t: number
  v: Record<string, number>
}

/** Mutable per-frame data. Read freely; only the live-simulation hook writes it. */
export const liveFrame = {
  snapshot: null as TransientSnapshot | null,
  terminalNodes: {} as Record<string, string>,
  /** component id → heat θ (≈1 at the part's rating) */
  heat: {} as Record<string, number>,
  /** simulated seconds */
  time: 0,
  /** battery id → state of charge 0..1 */
  soc: {} as Record<string, number>,
  /** bench supply id → regulation mode */
  supplyMode: {} as Record<string, 'CV' | 'CC'>,
  /** rolling node-voltage history for the time-domain scope */
  history: [] as ScopeSample[],
  /** bumps whenever liveFrame changes (cheap change detection for renderers) */
  frame: 0
}

export const HISTORY_SECONDS_MAX = 600 // samples kept (~10 s at 60 fps)

interface LiveSimState {
  running: boolean
  /** simulated seconds per real second */
  timeScale: number
  /** published at ~10 Hz for UI readouts */
  simTime: number
  /** < 1 when the circuit is too heavy to keep up with the requested speed */
  speedRatio: number
  effects: LiveEffect[]
  /** Latest failure message (shown as a toast) */
  lastMessage: string | null
  /** increments to ask the engine to reset (t = 0, discharge, cool down, repair) */
  resetToken: number

  setRunning: (running: boolean) => void
  toggleRunning: () => void
  setTimeScale: (scale: number) => void
  requestReset: () => void
  setClock: (simTime: number, speedRatio: number) => void
  pushEffect: (e: Omit<LiveEffect, 'id' | 'at'>) => void
  dismissMessage: () => void
}

let effectId = 0
const EFFECT_LIFETIME_MS = 4000

export const useLiveSimStore = create<LiveSimState>()((set) => ({
  running: true,
  timeScale: 1,
  simTime: 0,
  speedRatio: 1,
  effects: [],
  lastMessage: null,
  resetToken: 0,

  setRunning: (running) => set({ running }),
  toggleRunning: () => set((s) => ({ running: !s.running })),
  setTimeScale: (timeScale) => set({ timeScale }),
  requestReset: () => set((s) => ({ resetToken: s.resetToken + 1, effects: [], lastMessage: null })),
  setClock: (simTime, speedRatio) => set({ simTime, speedRatio }),
  pushEffect: (e) =>
    set((s) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const fresh = s.effects.filter((x) => now - x.at < EFFECT_LIFETIME_MS)
      return {
        effects: [...fresh, { ...e, id: ++effectId, at: now }],
        lastMessage: e.message ?? s.lastMessage
      }
    }),
  dismissMessage: () => set({ lastMessage: null })
}))

/** Time-scale presets offered in the UI (sim seconds per real second). */
export const TIME_SCALES = [0.001, 0.01, 0.1, 0.25, 1, 4] as const
