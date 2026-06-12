/**
 * Volt — Component Registry
 *
 * UI-independent metadata for every placeable circuit component: terminal
 * geometry, default values, units, and display names. The canvas, inspector,
 * palette, and netlist builder all code against this registry.
 *
 * Geometry: positions are in canvas pixels relative to the component centre,
 * unrotated. GRID is the snap size; component terminals always land on grid
 * points so wires line up.
 */

export const GRID = 20

export type ComponentType =
  | 'resistor' | 'capacitor' | 'inductor'
  | 'voltage_source' | 'current_source'
  | 'diode' | 'led' | 'transistor_npn'
  | 'switch' | 'ground' | 'wire_node'
  | 'voltmeter' | 'ammeter'

export interface CircuitComponent {
  id: string
  type: ComponentType
  x: number         // canvas position (pixels, grid-snapped)
  y: number
  rotation: number  // degrees: 0 | 90 | 180 | 270
  value?: number    // resistance Ω, voltage V, current A, capacitance F, inductance H
  label?: string    // user-visible label (R1, V1, ...)
  closed?: boolean  // switches only; default false (open)
}

export interface Wire {
  id: string
  fromComponentId: string
  fromTerminal: number
  toComponentId: string
  toTerminal: number
}

export interface TerminalDef {
  x: number
  y: number
  /** semantic hint for rendering and tooltips */
  name?: string
}

export interface ElementDef {
  type: ComponentType
  displayName: string
  labelPrefix: string
  terminals: TerminalDef[]
  /** null = no editable value (ground, wire node, diode models for now) */
  defaultValue: number | null
  unit: string
  /** show in the sandbox palette? */
  inPalette: boolean
}

export const ELEMENTS: Record<ComponentType, ElementDef> = {
  resistor: {
    type: 'resistor',
    displayName: 'Resistor',
    labelPrefix: 'R',
    terminals: [{ x: -2 * GRID, y: 0 }, { x: 2 * GRID, y: 0 }],
    defaultValue: 1000,
    unit: 'Ω',
    inPalette: true
  },
  capacitor: {
    type: 'capacitor',
    displayName: 'Capacitor',
    labelPrefix: 'C',
    terminals: [{ x: -2 * GRID, y: 0 }, { x: 2 * GRID, y: 0 }],
    defaultValue: 1e-6,
    unit: 'F',
    inPalette: true
  },
  inductor: {
    type: 'inductor',
    displayName: 'Inductor',
    labelPrefix: 'L',
    terminals: [{ x: -2 * GRID, y: 0 }, { x: 2 * GRID, y: 0 }],
    defaultValue: 1e-3,
    unit: 'H',
    inPalette: true
  },
  voltage_source: {
    type: 'voltage_source',
    displayName: 'Voltage Source',
    labelPrefix: 'V',
    terminals: [{ x: -2 * GRID, y: 0, name: '+' }, { x: 2 * GRID, y: 0, name: '−' }],
    defaultValue: 5,
    unit: 'V',
    inPalette: true
  },
  current_source: {
    type: 'current_source',
    displayName: 'Current Source',
    labelPrefix: 'I',
    terminals: [{ x: -2 * GRID, y: 0, name: 'out' }, { x: 2 * GRID, y: 0, name: 'in' }],
    defaultValue: 0.01,
    unit: 'A',
    inPalette: true
  },
  diode: {
    type: 'diode',
    displayName: 'Diode',
    labelPrefix: 'D',
    terminals: [{ x: -2 * GRID, y: 0, name: 'anode' }, { x: 2 * GRID, y: 0, name: 'cathode' }],
    defaultValue: null,
    unit: '',
    inPalette: true
  },
  led: {
    type: 'led',
    displayName: 'LED',
    labelPrefix: 'D',
    terminals: [{ x: -2 * GRID, y: 0, name: 'anode' }, { x: 2 * GRID, y: 0, name: 'cathode' }],
    defaultValue: null,
    unit: '',
    inPalette: true
  },
  switch: {
    type: 'switch',
    displayName: 'Switch',
    labelPrefix: 'S',
    terminals: [{ x: -2 * GRID, y: 0 }, { x: 2 * GRID, y: 0 }],
    defaultValue: null,
    unit: '',
    inPalette: true
  },
  ground: {
    type: 'ground',
    displayName: 'Ground',
    labelPrefix: 'GND',
    terminals: [{ x: 0, y: -GRID }],
    defaultValue: null,
    unit: '',
    inPalette: true
  },
  voltmeter: {
    type: 'voltmeter',
    displayName: 'Voltmeter',
    labelPrefix: 'VM',
    terminals: [{ x: -2 * GRID, y: 0, name: '+' }, { x: 2 * GRID, y: 0, name: '−' }],
    defaultValue: null,
    unit: '',
    inPalette: true
  },
  ammeter: {
    type: 'ammeter',
    displayName: 'Ammeter',
    labelPrefix: 'AM',
    terminals: [{ x: -2 * GRID, y: 0 }, { x: 2 * GRID, y: 0 }],
    defaultValue: null,
    unit: '',
    inPalette: true
  },
  wire_node: {
    type: 'wire_node',
    displayName: 'Junction',
    labelPrefix: 'N',
    terminals: [{ x: 0, y: 0 }],
    defaultValue: null,
    unit: '',
    inPalette: true
  },
  transistor_npn: {
    type: 'transistor_npn',
    displayName: 'NPN Transistor',
    labelPrefix: 'Q',
    terminals: [
      { x: -2 * GRID, y: 0, name: 'base' },
      { x: 2 * GRID, y: -2 * GRID, name: 'collector' },
      { x: 2 * GRID, y: 2 * GRID, name: 'emitter' }
    ],
    defaultValue: null,
    unit: '',
    inPalette: false // Phase 1 follow-up: needs Ebers-Moll model in the solver
  }
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

/** Rotate a point by a component rotation (multiples of 90°). */
export function rotatePoint(x: number, y: number, rotation: number): { x: number; y: number } {
  const r = ((rotation % 360) + 360) % 360
  switch (r) {
    case 90:  return { x: -y, y: x }
    case 180: return { x: -x, y: -y }
    case 270: return { x: y, y: -x }
    default:  return { x, y }
  }
}

/** Absolute canvas position of a component terminal. */
export function terminalPosition(
  comp: CircuitComponent,
  terminalIndex: number
): { x: number; y: number } {
  const def = ELEMENTS[comp.type]
  const t = def.terminals[terminalIndex]
  if (!t) return { x: comp.x, y: comp.y }
  const p = rotatePoint(t.x, t.y, comp.rotation)
  return { x: comp.x + p.x, y: comp.y + p.y }
}

export const snapToGrid = (v: number): number => Math.round(v / GRID) * GRID

// ── Value formatting ─────────────────────────────────────────────────────────

const SUFFIXES: Array<[number, string]> = [
  [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']
]

/** 4700 → "4.7k", 0.01 → "10m", 5 → "5" (unit appended if provided) */
export function formatValue(value: number, unit = ''): string {
  if (value === 0) return `0${unit ? ' ' + unit : ''}`
  const abs = Math.abs(value)
  let scaled = value
  let suffix = ''
  for (const [mult, s] of SUFFIXES) {
    if (abs >= mult) {
      scaled = value / mult
      suffix = s
      break
    }
  }
  // up to 3 significant-ish digits, trim trailing zeros
  const text = parseFloat(scaled.toPrecision(3)).toString()
  return `${text}${suffix}${unit ? ' ' + unit : ''}`
}

const SUFFIX_MULTIPLIERS: Record<string, number> = {
  G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9, p: 1e-12
}

/** Parse "4.7k", "10m", "100" → number. Returns null for invalid input. */
export function parseValue(text: string): number | null {
  const m = text.trim().match(/^(-?\d*\.?\d+)\s*([GMkKmuµnp])?/)
  if (!m || m[1] === undefined) return null
  const base = parseFloat(m[1])
  if (!Number.isFinite(base)) return null
  const mult = m[2] ? SUFFIX_MULTIPLIERS[m[2]] : 1
  return base * mult
}

/** Next available label for a component type, e.g. R1, R2, V1... */
export function nextLabel(type: ComponentType, existing: CircuitComponent[]): string {
  const prefix = ELEMENTS[type].labelPrefix
  const taken = new Set(existing.map((c) => c.label))
  for (let i = 1; ; i++) {
    const candidate = `${prefix}${i}`
    if (!taken.has(candidate)) return candidate
  }
}
