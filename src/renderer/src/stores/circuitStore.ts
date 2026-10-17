import { create } from 'zustand'
import { nextLabel, type CircuitComponent, type ComponentType, type Wire } from '../sim/elements'
import { healJunctions, splitWire } from '../sim/junction'

// Re-export the canonical circuit types so existing imports keep working
export type { CircuitComponent, ComponentType, Wire }

export interface SimulationResult {
  solved: boolean
  /** node name → voltage (V) */
  nodeVoltages: Record<string, number>
  /** component id → current (A) flowing terminal 0 → terminal 1 */
  elementCurrents: Record<string, number>
  /** `${componentId}:${terminalIndex}` → node name */
  terminalNodes: Record<string, string>
  /** netlist warnings (unconnected terminals, etc.) */
  warnings: string[]
  error?: string

  // ── AC analysis (single-frequency phasor) ──
  /** True when this result came from the AC phasor solver. */
  ac?: boolean
  /** Analysis angular frequency in rad/s (AC only). */
  omega?: number
  /** node → voltage phase in degrees (AC only). In AC mode nodeVoltages holds peak magnitudes. */
  nodeVoltagePhase?: Record<string, number>
  /** component id → current phase in degrees (AC only). In AC mode elementCurrents holds peak magnitudes. */
  elementCurrentPhase?: Record<string, number>

  // ── Live (time-domain) simulation ──
  /** True when this result is an instantaneous value from the live simulator. */
  live?: boolean
  /** Simulated time (s) of a live result. */
  time?: number
}

/** Undo/redo snapshot — only the circuit graph, not transient UI/sim state. */
interface Snapshot {
  components: CircuitComponent[]
  wires: Wire[]
}

const HISTORY_LIMIT = 50

interface CircuitState {
  components: CircuitComponent[]
  wires: Wire[]
  simResult: SimulationResult | null
  /** Increments whenever a whole circuit is loaded (views re-frame on change). */
  loadToken: number

  // ── Selection ──
  /** Primary selected component (drives the single-component Inspector). */
  selectedComponentId: string | null
  /** All selected components (marquee / multi-select). */
  selectedIds: string[]
  /** Selected wire, for the net (voltage/current) preview. */
  selectedWireId: string | null

  // ── Undo/redo ──
  past: Snapshot[]
  future: Snapshot[]

  // ── Mutations ──
  addComponent: (component: CircuitComponent) => void
  removeComponent: (id: string) => void
  removeComponents: (ids: string[]) => void
  updateComponent: (id: string, patch: Partial<CircuitComponent>) => void
  /** Change a wire's properties (gauge, length, damaged). No history push. */
  updateWire: (id: string, patch: Partial<Wire>) => void
  toggleSwitch: (id: string) => void
  addWire: (wire: Wire) => void
  removeWire: (id: string) => void
  /**
   * Finish a wire on the middle of another wire: split that wire at a new
   * junction and connect to it. Returns the junction's id (null if the point
   * landed on the target wire's end).
   */
  connectToWire: (wire: Omit<Wire, 'toComponentId' | 'toTerminal'>, targetWireId: string, x: number, y: number) => string | null
  setSimResult: (result: SimulationResult | null) => void
  clearCircuit: () => void
  /** Replace the whole circuit (used by load/import) */
  loadCircuitData: (components: CircuitComponent[], wires: Wire[]) => void

  // ── Selection actions ──
  selectComponent: (id: string | null) => void
  setSelection: (ids: string[]) => void
  selectWire: (id: string | null) => void
  clearSelection: () => void

  // ── History actions ──
  /** Push the current graph onto the undo stack (call before a drag / edit). */
  checkpoint: () => void
  undo: () => void
  redo: () => void
}

const snap = (s: { components: CircuitComponent[]; wires: Wire[] }): Snapshot => ({
  components: s.components,
  wires: s.wires
})

/** Returns the history fields for a mutating action: push current onto past, clear future. */
const pushPast = (s: CircuitState): Pick<CircuitState, 'past' | 'future'> => ({
  past: [...s.past, snap(s)].slice(-HISTORY_LIMIT),
  future: []
})

/**
 * Remove parts and wires, then tidy the junctions they touched: a junction
 * being deleted that joins exactly two wires merges them instead of cutting
 * them, and a junction left joining two wires merges back into one wire.
 */
function removeAndHeal(
  components: CircuitComponent[],
  wires: Wire[],
  componentIds: string[],
  wireIds: string[]
): { components: CircuitComponent[]; wires: Wire[] } {
  const idSet = new Set(componentIds)
  let g = { components, wires }
  const merging = components.filter(
    (c) => idSet.has(c.id) && c.type === 'wire_node' && wires.filter((w) => w.fromComponentId === c.id || w.toComponentId === c.id).length === 2
  )
  if (merging.length) {
    g = healJunctions(g, new Set(merging.map((c) => c.id)))
    for (const c of merging) if (!g.components.some((cc) => cc.id === c.id)) idSet.delete(c.id)
  }
  const removedWires = g.wires.filter(
    (w) => wireIds.includes(w.id) || idSet.has(w.fromComponentId) || idSet.has(w.toComponentId)
  )
  const touched = new Set(removedWires.flatMap((w) => [w.fromComponentId, w.toComponentId]))
  g = {
    components: g.components.filter((c) => !idSet.has(c.id)),
    wires: g.wires.filter((w) => !removedWires.includes(w))
  }
  return healJunctions(g, touched)
}

const clearedSelection = {
  selectedComponentId: null,
  selectedIds: [] as string[],
  selectedWireId: null
}

export const useCircuitStore = create<CircuitState>()((set) => ({
  components: [],
  wires: [],
  simResult: null,
  loadToken: 0,
  selectedComponentId: null,
  selectedIds: [],
  selectedWireId: null,
  past: [],
  future: [],

  addComponent: (component) =>
    set((s) => ({ ...pushPast(s), components: [...s.components, component] })),

  removeComponent: (id) =>
    set((s) => ({
      ...pushPast(s),
      ...removeAndHeal(s.components, s.wires, [id], []),
      selectedComponentId: s.selectedComponentId === id ? null : s.selectedComponentId,
      selectedIds: s.selectedIds.filter((sid) => sid !== id)
    })),

  removeComponents: (ids) =>
    set((s) => {
      if (ids.length === 0) return {}
      return {
        ...pushPast(s),
        ...removeAndHeal(s.components, s.wires, ids, []),
        ...clearedSelection
      }
    }),

  // Note: no history push — used continuously during drags. Callers that want an
  // undoable edit (inspector value/rotate, drag start) call checkpoint() first.
  updateComponent: (id, patch) =>
    set((s) => ({
      components: s.components.map((c) => (c.id === id ? { ...c, ...patch } : c))
    })),

  updateWire: (id, patch) =>
    set((s) => ({ wires: s.wires.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),

  toggleSwitch: (id) =>
    set((s) => ({
      ...pushPast(s),
      components: s.components.map((c) =>
        c.id === id && (c.type === 'switch' || c.type === 'breaker' || c.type === 'gfci')
          ? { ...c, closed: !c.closed }
          : c
      )
    })),

  addWire: (wire) =>
    set((s) => {
      // No duplicate wires between the same two terminals, no self-wires
      const same = (w: Wire): boolean =>
        (w.fromComponentId === wire.fromComponentId &&
          w.fromTerminal === wire.fromTerminal &&
          w.toComponentId === wire.toComponentId &&
          w.toTerminal === wire.toTerminal) ||
        (w.fromComponentId === wire.toComponentId &&
          w.fromTerminal === wire.toTerminal &&
          w.toComponentId === wire.fromComponentId &&
          w.toTerminal === wire.fromTerminal)
      if (
        (wire.fromComponentId === wire.toComponentId &&
          wire.fromTerminal === wire.toTerminal) ||
        s.wires.some(same)
      ) {
        return s
      }
      return { ...pushPast(s), wires: [...s.wires, wire] }
    }),

  removeWire: (id) =>
    set((s) => ({
      ...pushPast(s),
      ...removeAndHeal(s.components, s.wires, [], [id]),
      selectedWireId: s.selectedWireId === id ? null : s.selectedWireId
    })),

  connectToWire: (wire, targetWireId, x, y) => {
    let junctionId: string | null = null
    set((s) => {
      const id = `wire_node-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
      const split = splitWire(s, targetWireId, x, y, id, nextLabel('wire_node', s.components))
      if (!split) return s
      junctionId = id
      const w: Wire = { ...wire, toComponentId: id, toTerminal: 0 }
      if (w.fromComponentId === id) return s
      return { ...pushPast(s), components: split.components, wires: [...split.wires, w] }
    })
    return junctionId
  },

  setSimResult: (result) => set({ simResult: result }),

  clearCircuit: () =>
    set((s) => ({
      ...pushPast(s),
      components: [],
      wires: [],
      simResult: null,
      ...clearedSelection
    })),

  loadCircuitData: (components, wires) =>
    set((s) => ({
      ...pushPast(s),
      components,
      wires,
      simResult: null,
      loadToken: s.loadToken + 1,
      ...clearedSelection
    })),

  // ── Selection ──
  selectComponent: (id) =>
    set({
      selectedComponentId: id,
      selectedIds: id ? [id] : [],
      selectedWireId: null
    }),

  setSelection: (ids) =>
    set({
      selectedIds: ids,
      selectedComponentId: ids.length === 1 ? ids[0] : null,
      selectedWireId: null
    }),

  selectWire: (id) =>
    set({ selectedWireId: id, selectedComponentId: null, selectedIds: [] }),

  clearSelection: () => set(clearedSelection),

  // ── History ──
  checkpoint: () => set((s) => pushPast(s)),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {}
      const previous = s.past[s.past.length - 1]
      return {
        components: previous.components,
        wires: previous.wires,
        past: s.past.slice(0, -1),
        future: [snap(s), ...s.future].slice(0, HISTORY_LIMIT),
        ...clearedSelection
      }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {}
      const next = s.future[0]
      return {
        components: next.components,
        wires: next.wires,
        past: [...s.past, snap(s)].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        ...clearedSelection
      }
    })
}))
