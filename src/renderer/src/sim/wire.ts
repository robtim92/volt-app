/**
 * Volt — Wire gauge model
 *
 * Real wire has resistance. American Wire Gauge (AWG) fixes a wire's diameter:
 *   d(n) = 0.127 mm × 92^((36 − n) / 39)
 * (gauge 0000 = −3, 000 = −2, 00 = −1). Copper resistance per metre follows
 * from R = ρ L / A. Each gauge also gets a practical current rating
 * ("ampacity"): above it the insulation overheats.
 *
 * Ratings are teaching approximations: building wire (14–4 AWG) uses the
 * common US 60 °C column (14 AWG = 15 A, 12 = 20 A, 10 = 30 A …); thinner
 * hookup wire uses typical PVC hookup-wire ratings. Real ratings depend on
 * insulation, bundling and ambient temperature.
 */
import { GRID } from './elements'

/** Annealed copper resistivity at 20 °C (Ω·m) — the IACS standard wire tables use */
export const COPPER_RESISTIVITY = 1.724e-8
/** Free-electron density of copper (m⁻³) — for drift-velocity visuals */
export const COPPER_ELECTRON_DENSITY = 8.5e28
export const ELECTRON_CHARGE = 1.602e-19

/** Default wire on the bench: 22 AWG solid hookup wire */
export const DEFAULT_GAUGE = 22
/** Drawn wires: one grid square = 1 cm of wire */
export const METRES_PER_PIXEL = 0.01 / GRID
/** Shortest wire we model (a solder bridge) */
export const MIN_WIRE_LENGTH = 0.005

/** Gauges offered in the UI, thick → thin */
export const GAUGE_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30] as const

export function gaugeLabel(awg: number): string {
  if (awg <= 0) return `${'0'.repeat(1 - awg)} AWG` // 0 → "0 AWG", −1 → "00 AWG"
  return `${awg} AWG`
}

export function diameterMm(awg: number): number {
  return 0.127 * Math.pow(92, (36 - awg) / 39)
}

/** Cross-sectional area (m²) */
export function areaM2(awg: number): number {
  const r = diameterMm(awg) / 2000
  return Math.PI * r * r
}

export function areaMm2(awg: number): number {
  return areaM2(awg) * 1e6
}

/** Resistance per metre of copper wire (Ω/m) */
export function ohmsPerMetre(awg: number): number {
  return COPPER_RESISTIVITY / areaM2(awg)
}

const AMPACITY: Record<number, number> = {
  4: 70, 6: 55, 8: 40, 10: 30, 12: 20, 14: 15,
  16: 10, 18: 7, 20: 5, 22: 3, 24: 2, 26: 1.3, 28: 0.8, 30: 0.5
}

/** Practical current rating (A) */
export function ampacity(awg: number): number {
  if (AMPACITY[awg] !== undefined) return AMPACITY[awg]
  // Outside the table: scale with area (heat removal ~ surface, but area is a fair guide)
  return 3 * (areaM2(awg) / areaM2(22))
}

/** Electron drift velocity (m/s) for a current in a wire: v = I / (n q A) */
export function driftVelocity(current: number, awg: number): number {
  return Math.abs(current) / (COPPER_ELECTRON_DENSITY * ELECTRON_CHARGE * areaM2(awg))
}

export interface WireProps {
  gauge?: number
  /** metres; undefined = measured from the drawing */
  length?: number
}

/** Length of a drawn wire (m) from its endpoints in canvas pixels. */
export function drawnLength(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(MIN_WIRE_LENGTH, Math.hypot(bx - ax, by - ay) * METRES_PER_PIXEL)
}

export function wireResistance(gauge: number, lengthM: number): number {
  return ohmsPerMetre(gauge) * lengthM
}
