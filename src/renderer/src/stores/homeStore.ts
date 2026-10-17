/**
 * Volt — Home workspace store (Phase H)
 *
 * The design (panel, circuits, loads) is persisted. The live runtime (clock,
 * readings, breaker heat) is held in `homeLive` and advanced every animation
 * frame; the store publishes a `tick` a few times a second so the UI updates
 * without re-rendering at 60 fps.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BranchCircuit, BreakerState, HomeDesign, HomeRuntime, LoadInstance, TripEvent } from '../home/types'
import { newRuntime, slotsOf } from '../home/homeSim'
import { HOME_EXAMPLES, starterHome } from '../home/examples'

export const homeLive: { runtime: HomeRuntime } = { runtime: newRuntime() }

export const SPEEDS = [1, 10, 60, 600] as const

interface HomeState {
  design: HomeDesign
  selectedCircuitId: string | null
  playing: boolean
  speed: number
  /** bumps a few times a second while the clock runs */
  tick: number
  /** recent trips, newest last (shown as toasts) */
  trips: (TripEvent & { at: number; key: number })[]
  activeExampleId: string | null
  exampleStep: number

  setDesign: (d: HomeDesign) => void
  patchDesign: (patch: Partial<HomeDesign>) => void
  updateCircuit: (id: string, patch: Partial<BranchCircuit>) => void
  addCircuit: (poles: 1 | 2) => string | null
  removeCircuit: (id: string) => void
  addLoad: (circuitId: string, appliance: string) => void
  updateLoad: (circuitId: string, loadId: string, patch: Partial<LoadInstance>) => void
  removeLoad: (circuitId: string, loadId: string) => void
  setBreaker: (id: string, state: BreakerState) => void
  setMain: (state: BreakerState) => void
  applyTrips: (trips: TripEvent[]) => void
  dismissTrip: (key: number) => void
  select: (id: string | null) => void
  setPlaying: (p: boolean) => void
  setSpeed: (s: number) => void
  publish: () => void
  resetClock: () => void
  loadExample: (id: string) => void
  closeExample: () => void
  setExampleStep: (n: number) => void
}

/** First free panel space for a breaker with this many poles (double-poles stack in one column). */
export function freeSlot(d: HomeDesign, poles: 1 | 2, ignoreId?: string): number | null {
  const used = new Set(d.circuits.filter((c) => c.id !== ignoreId).flatMap(slotsOf))
  for (let s = 1; s <= d.spaces; s++) {
    if (used.has(s)) continue
    if (poles === 1) return s
    if (s + 2 <= d.spaces && !used.has(s + 2)) return s
  }
  return null
}

let tripKey = 0

export const useHomeStore = create<HomeState>()(
  persist(
    (set, get) => ({
      design: starterHome(),
      selectedCircuitId: null,
      playing: true,
      speed: 1,
      tick: 0,
      trips: [],
      activeExampleId: null,
      exampleStep: 0,

      setDesign: (design) => {
        homeLive.runtime = newRuntime()
        set({ design, selectedCircuitId: null, trips: [], tick: get().tick + 1 })
      },
      patchDesign: (patch) => set((s) => ({ design: { ...s.design, ...patch } })),
      updateCircuit: (id, patch) =>
        set((s) => {
          const d = s.design
          let next = { ...patch }
          // a pole change may need a new space
          if (patch.poles && patch.poles !== d.circuits.find((c) => c.id === id)?.poles) {
            const trial = { ...d, circuits: d.circuits.map((c) => (c.id === id ? { ...c, ...patch } : c)) }
            const me = trial.circuits.find((c) => c.id === id)!
            const others = new Set(trial.circuits.filter((c) => c.id !== id).flatMap(slotsOf))
            const fits = slotsOf(me).every((sl) => sl <= d.spaces && !others.has(sl))
            if (!fits) {
              const slot = freeSlot(d, patch.poles, id)
              if (slot === null) return {}
              next = { ...next, slot }
            }
          }
          return { design: { ...d, circuits: d.circuits.map((c) => (c.id === id ? { ...c, ...next } : c)) } }
        }),
      addCircuit: (poles) => {
        const d = get().design
        const slot = freeSlot(d, poles)
        if (slot === null) return null
        const id = `c-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`
        const c: BranchCircuit = {
          id,
          name: poles === 2 ? 'New 240 V circuit' : 'New circuit',
          room: poles === 2 ? 'Utility' : 'Living room',
          slot,
          poles,
          amps: poles === 2 ? 30 : 15,
          type: 'standard',
          state: 'on',
          gauge: poles === 2 ? 10 : 14,
          lengthFt: 40,
          loads: [],
          fault: 'none'
        }
        set({ design: { ...d, circuits: [...d.circuits, c] }, selectedCircuitId: id })
        return id
      },
      removeCircuit: (id) =>
        set((s) => ({
          design: { ...s.design, circuits: s.design.circuits.filter((c) => c.id !== id) },
          selectedCircuitId: s.selectedCircuitId === id ? null : s.selectedCircuitId
        })),
      addLoad: (circuitId, appliance) =>
        set((s) => ({
          design: {
            ...s.design,
            circuits: s.design.circuits.map((c) =>
              c.id === circuitId ? { ...c, loads: [...c.loads, { id: `l-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`, appliance, on: true }] } : c
            )
          }
        })),
      updateLoad: (circuitId, loadId, patch) =>
        set((s) => ({
          design: {
            ...s.design,
            circuits: s.design.circuits.map((c) =>
              c.id === circuitId ? { ...c, loads: c.loads.map((l) => (l.id === loadId ? { ...l, ...patch } : l)) } : c
            )
          }
        })),
      removeLoad: (circuitId, loadId) =>
        set((s) => ({
          design: {
            ...s.design,
            circuits: s.design.circuits.map((c) => (c.id === circuitId ? { ...c, loads: c.loads.filter((l) => l.id !== loadId) } : c))
          }
        })),
      setBreaker: (id, state) => {
        if (state === 'on') homeLive.runtime.breakerHeat[id] = 0
        set((s) => ({ design: { ...s.design, circuits: s.design.circuits.map((c) => (c.id === id ? { ...c, state } : c)) } }))
      },
      setMain: (mainState) => {
        if (mainState === 'on') homeLive.runtime.mainHeat = 0
        set((s) => ({ design: { ...s.design, mainState } }))
      },
      applyTrips: (trips) =>
        set((s) => {
          let d = s.design
          for (const t of trips) {
            d = t.id === 'main' ? { ...d, mainState: 'tripped' } : { ...d, circuits: d.circuits.map((c) => (c.id === t.id ? { ...c, state: 'tripped' } : c)) }
          }
          const at = homeLive.runtime.t
          return { design: d, trips: [...s.trips, ...trips.map((t) => ({ ...t, at, key: ++tripKey }))].slice(-4) }
        }),
      dismissTrip: (key) => set((s) => ({ trips: s.trips.filter((t) => t.key !== key) })),
      select: (selectedCircuitId) => set({ selectedCircuitId }),
      setPlaying: (playing) => set({ playing }),
      setSpeed: (speed) => set({ speed }),
      publish: () => set((s) => ({ tick: s.tick + 1 })),
      resetClock: () => {
        homeLive.runtime = newRuntime()
        set((s) => ({ tick: s.tick + 1, trips: [] }))
      },
      loadExample: (id) => {
        const ex = HOME_EXAMPLES.find((e) => e.id === id)
        if (!ex) return
        homeLive.runtime = newRuntime()
        set((s) => ({
          design: structuredClone(ex.design),
          activeExampleId: id,
          exampleStep: 0,
          selectedCircuitId: null,
          trips: [],
          speed: ex.speed ?? 1,
          playing: true,
          tick: s.tick + 1
        }))
      },
      closeExample: () => set({ activeExampleId: null, exampleStep: 0 }),
      setExampleStep: (exampleStep) => set({ exampleStep })
    }),
    {
      name: 'volt-home',
      partialize: (s) => ({ design: s.design, speed: s.speed })
    }
  )
)
