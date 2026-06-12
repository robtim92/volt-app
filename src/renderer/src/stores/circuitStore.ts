import { create } from 'zustand'

// ── Types ────────────────────────────────────────────────────────────────────
// These will expand substantially in Phase 1 when the MNA solver and canvas
// are built. For now they define the shape the rest of the app will code against.

export type ComponentType =
  | 'resistor' | 'capacitor' | 'inductor'
  | 'voltage_source' | 'current_source'
  | 'diode' | 'led' | 'transistor_npn'
  | 'switch' | 'ground' | 'wire_node'

export interface CircuitComponent {
  id: string
  type: ComponentType
  x: number         // canvas position (pixels)
  y: number
  rotation: number  // degrees: 0 | 90 | 180 | 270
  value?: number    // e.g. resistance in Ω, capacitance in F
  label?: string    // user-visible label
}

export interface Wire {
  id: string
  fromComponentId: string
  fromTerminal: number   // terminal index on the component
  toComponentId: string
  toTerminal: number
}

export interface SimulationResult {
  nodeVoltages: Record<string, number>    // node id → voltage (V)
  branchCurrents: Record<string, number>  // wire id → current (A)
  solved: boolean
  error?: string
}

interface CircuitState {
  components: CircuitComponent[]
  wires: Wire[]
  simResult: SimulationResult | null
  selectedComponentId: string | null

  // Actions — implementations come in Phase 1 with the canvas
  addComponent: (component: CircuitComponent) => void
  removeComponent: (id: string) => void
  updateComponent: (id: string, patch: Partial<CircuitComponent>) => void
  addWire: (wire: Wire) => void
  removeWire: (id: string) => void
  setSimResult: (result: SimulationResult) => void
  selectComponent: (id: string | null) => void
  clearCircuit: () => void
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
      wires: s.wires.filter((w) => w.fromComponentId !== id && w.toComponentId !== id)
    })),

  updateComponent: (id, patch) =>
    set((s) => ({
      components: s.components.map((c) => (c.id === id ? { ...c, ...patch } : c))
    })),

  addWire: (wire) =>
    set((s) => ({ wires: [...s.wires, wire] })),

  removeWire: (id) =>
    set((s) => ({ wires: s.wires.filter((w) => w.id !== id) })),

  setSimResult: (result) => set({ simResult: result }),

  selectComponent: (id) => set({ selectedComponentId: id }),

  clearCircuit: () =>
    set({ components: [], wires: [], simResult: null, selectedComponentId: null })
}))
