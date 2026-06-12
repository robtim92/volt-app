import { create } from 'zustand'
import type { CircuitComponent, ComponentType, Wire } from '../sim/elements'

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
}

interface CircuitState {
  components: CircuitComponent[]
  wires: Wire[]
  simResult: SimulationResult | null
  selectedComponentId: string | null

  addComponent: (component: CircuitComponent) => void
  removeComponent: (id: string) => void
  updateComponent: (id: string, patch: Partial<CircuitComponent>) => void
  toggleSwitch: (id: string) => void
  addWire: (wire: Wire) => void
  removeWire: (id: string) => void
  setSimResult: (result: SimulationResult | null) => void
  selectComponent: (id: string | null) => void
  clearCircuit: () => void
  /** Replace the whole circuit (used by load/import) */
  loadCircuitData: (components: CircuitComponent[], wires: Wire[]) => void
}

export const useCircuitStore = create<CircuitState>()((set) => ({
  components: [],
  wires: [],
  simResult: null,
  selectedComponentId: null,

  addComponent: (component) =>
    set((s) => ({ components: [...s.components, component] })),

  removeComponent: (id) =>
    set((s) => ({
      components: s.components.filter((c) => c.id !== id),
      wires: s.wires.filter((w) => w.fromComponentId !== id && w.toComponentId !== id),
      selectedComponentId: s.selectedComponentId === id ? null : s.selectedComponentId
    })),

  updateComponent: (id, patch) =>
    set((s) => ({
      components: s.components.map((c) => (c.id === id ? { ...c, ...patch } : c))
    })),

  toggleSwitch: (id) =>
    set((s) => ({
      components: s.components.map((c) =>
        c.id === id && c.type === 'switch' ? { ...c, closed: !c.closed } : c
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
      return { wires: [...s.wires, wire] }
    }),

  removeWire: (id) => set((s) => ({ wires: s.wires.filter((w) => w.id !== id) })),

  setSimResult: (result) => set({ simResult: result }),

  selectComponent: (id) => set({ selectedComponentId: id }),

  clearCircuit: () =>
    set({ components: [], wires: [], simResult: null, selectedComponentId: null }),

  loadCircuitData: (components, wires) =>
    set({ components, wires, simResult: null, selectedComponentId: null })
}))
