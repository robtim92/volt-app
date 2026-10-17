/**
 * Volt — 3D bench helpers (pure, unit-tested)
 *
 * Maps schematic coordinates onto the workbench, computes framing bounds, and
 * derives resistor colour bands from a resistance value.
 */
import { GRID, terminalPosition, type CircuitComponent } from '../../sim/elements'

/** World units per schematic pixel: two grid squares = one world unit. */
export const WORLD_SCALE = 1 / (2 * GRID)
/** Height at which wires attach to part leads. */
export const LEAD_HEIGHT = 0.06

export function toWorld(x: number, y: number): [number, number, number] {
  return [x * WORLD_SCALE, LEAD_HEIGHT, y * WORLD_SCALE]
}

/** Three.js Y-rotation for a schematic rotation (degrees clockwise on screen). */
export const toWorldRotation = (deg: number): number => (-deg * Math.PI) / 180

export function terminalWorld(c: CircuitComponent, t: number): [number, number, number] {
  const p = terminalPosition(c, t)
  return toWorld(p.x, p.y)
}

export interface Bounds {
  center: [number, number, number]
  /** largest horizontal extent (world units) */
  size: number
}

export function circuitBounds(components: CircuitComponent[]): Bounds {
  if (components.length === 0) return { center: [0, 0, 0], size: 6 }
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const c of components) {
    const [x, , z] = toWorld(c.x, c.y)
    minX = Math.min(minX, x - 1)
    maxX = Math.max(maxX, x + 1)
    minZ = Math.min(minZ, z - 1)
    maxZ = Math.max(maxZ, z + 1)
  }
  return {
    center: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2],
    size: Math.max(4, maxX - minX, maxZ - minZ)
  }
}

// ── Resistor colour code ───────────────────────────────────────────────────────

export const BAND_COLORS = [
  '#111111', // 0 black
  '#7a4b22', // 1 brown
  '#d32f2f', // 2 red
  '#f57c00', // 3 orange
  '#fdd835', // 4 yellow
  '#2e7d32', // 5 green
  '#1565c0', // 6 blue
  '#7b1fa2', // 7 violet
  '#9e9e9e', // 8 grey
  '#fafafa' // 9 white
] as const
export const GOLD = '#c9a227'
export const SILVER = '#b0b0b0'

/**
 * 4-band colour code: two significant digits, a multiplier, ±5 % gold.
 * 4700 Ω → yellow violet red gold. Returns digit/multiplier indices too so the
 * UI can teach the code.
 */
export function resistorBands(ohms: number): { colors: string[]; digits: [number, number]; exponent: number } {
  if (!(ohms > 0) || !Number.isFinite(ohms)) {
    return { colors: [BAND_COLORS[0], BAND_COLORS[0], BAND_COLORS[0], GOLD], digits: [0, 0], exponent: 0 }
  }
  let exponent = Math.floor(Math.log10(ohms)) - 1
  let sig = Math.round(ohms / Math.pow(10, exponent))
  if (sig >= 100) {
    sig = Math.round(sig / 10)
    exponent += 1
  }
  const d1 = Math.floor(sig / 10)
  const d2 = sig % 10
  let mult: string
  if (exponent === -1) mult = GOLD
  else if (exponent === -2) mult = SILVER
  else mult = BAND_COLORS[Math.max(0, Math.min(9, exponent))]
  return { colors: [BAND_COLORS[d1], BAND_COLORS[d2], mult, GOLD], digits: [d1, d2], exponent }
}

/** Same warm/cool voltage colouring the schematic uses, as an [r,g,b] 0..1 triple. */
export function voltageRGB(v: number, maxAbs: number): [number, number, number] {
  const neutral: [number, number, number] = [0.55, 0.6, 0.68]
  if (maxAbs < 1e-9) return neutral
  const t = Math.max(-1, Math.min(1, v / maxAbs))
  if (Math.abs(t) < 0.02) return neutral
  const a = Math.abs(t)
  const warm: [number, number, number] = [0.95, 0.45, 0.12]
  const cool: [number, number, number] = [0.2, 0.5, 0.95]
  const target = t > 0 ? warm : cool
  return [
    neutral[0] + (target[0] - neutral[0]) * a,
    neutral[1] + (target[1] - neutral[1]) * a,
    neutral[2] + (target[2] - neutral[2]) * a
  ]
}
