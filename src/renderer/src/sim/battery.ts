/**
 * Volt — Battery and bench-supply models
 *
 * A battery is an ideal voltage (its open-circuit voltage, which falls as it
 * discharges) behind an internal resistance. That resistance is why a shorted
 * AA delivers a few amps instead of thousands, and why a battery's terminal
 * voltage sags under load.
 *
 * Figures are typical datasheet-level values per cell; packs multiply them by
 * the number of cells in series. Open-circuit voltage vs. state of charge uses
 * a simple piecewise-linear curve per chemistry.
 */

export type Chemistry = 'alkaline_aa' | 'alkaline_9v' | 'liion' | 'lifepo4' | 'leadacid'

export interface ChemistryDef {
  name: string
  /** cells in the default pack */
  defaultCells: number
  /** per-cell open-circuit voltage at [0%, 10%, 50%, 90%, 100%] state of charge */
  ocv: [number, number, number, number, number]
  /** per-cell internal resistance (Ω) */
  rInternal: number
  /** capacity (Ah) */
  capacityAh: number
  /** continuous current the pack is happy to deliver (A) */
  maxCurrent: number
}

export const CHEMISTRIES: Record<Chemistry, ChemistryDef> = {
  alkaline_aa: { name: 'AA alkaline', defaultCells: 2, ocv: [1.0, 1.15, 1.3, 1.5, 1.6], rInternal: 0.15, capacityAh: 2.5, maxCurrent: 2 },
  // A 9 V battery is six small alkaline cells
  alkaline_9v: { name: '9 V alkaline', defaultCells: 6, ocv: [1.0, 1.15, 1.3, 1.5, 1.6], rInternal: 0.28, capacityAh: 0.5, maxCurrent: 0.5 },
  liion: { name: 'Li-ion 18650', defaultCells: 1, ocv: [3.0, 3.45, 3.7, 4.05, 4.2], rInternal: 0.05, capacityAh: 3, maxCurrent: 10 },
  lifepo4: { name: 'LiFePO₄', defaultCells: 4, ocv: [2.5, 3.2, 3.3, 3.35, 3.6], rInternal: 0.01, capacityAh: 100, maxCurrent: 100 },
  leadacid: { name: 'Lead-acid', defaultCells: 6, ocv: [1.95, 1.98, 2.06, 2.13, 2.15], rInternal: 0.004, capacityAh: 50, maxCurrent: 100 }
}

export const DEFAULT_CHEMISTRY: Chemistry = 'alkaline_9v'

const SOC_POINTS = [0, 0.1, 0.5, 0.9, 1] as const

/** Per-cell open-circuit voltage at a state of charge (0..1). */
export function cellOcv(chem: Chemistry, soc: number): number {
  const curve = CHEMISTRIES[chem].ocv
  const s = Math.max(0, Math.min(1, soc))
  for (let k = 1; k < SOC_POINTS.length; k++) {
    if (s <= SOC_POINTS[k]) {
      const t = (s - SOC_POINTS[k - 1]) / (SOC_POINTS[k] - SOC_POINTS[k - 1])
      return curve[k - 1] + t * (curve[k] - curve[k - 1])
    }
  }
  return curve[curve.length - 1]
}

export interface BatteryParams {
  chemistry: Chemistry
  cells: number
  soc: number
}

export function packOcv(p: BatteryParams): number {
  return cellOcv(p.chemistry, p.soc) * p.cells
}

export function packResistance(p: BatteryParams): number {
  return CHEMISTRIES[p.chemistry].rInternal * p.cells
}

/** New state of charge after delivering `current` amps for `dt` seconds. */
export function drain(p: BatteryParams, current: number, dt: number): number {
  const ah = CHEMISTRIES[p.chemistry].capacityAh
  return Math.max(0, Math.min(1, p.soc - (current * dt) / (ah * 3600)))
}

/** Hours until empty at a steady current (Infinity when idle or charging). */
export function hoursRemaining(p: BatteryParams, current: number): number {
  if (current <= 1e-9) return Infinity
  return (p.soc * CHEMISTRIES[p.chemistry].capacityAh) / current
}

// ── Bench supply ────────────────────────────────────────────────────────────────

export const BENCH_DEFAULT_LIMIT = 1 // A
export const BENCH_OUTPUT_RESISTANCE = 0.01 // Ω
