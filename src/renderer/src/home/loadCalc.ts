/**
 * Volt — service load calculation (simplified from the NEC 220.82 optional
 * method for dwellings). A teaching estimate, not a substitute for a real
 * calculation by an electrician.
 *
 *   general = 3 VA/ft² + 1500 VA per kitchen (small-appliance) circuit (min 2)
 *             + 1500 VA laundry + nameplate of fixed appliances
 *   demand  = first 10 kVA at 100% + the rest at 40% + largest heating/cooling load
 *   amps    = demand ÷ 240 V
 */
import { APPLIANCES } from './appliances'
import type { HomeDesign } from './types'

export interface LoadCalc {
  lighting: number
  smallAppliance: number
  laundry: number
  fixed: number
  hvac: number
  demandVA: number
  amps: number
  /** % of the service rating */
  pctOfService: number
}

export function serviceLoad(d: HomeDesign): LoadCalc {
  const lighting = 3 * d.sqft
  const kitchenCircuits = d.circuits.filter((c) => c.room === 'Kitchen' && c.poles === 1 && c.loads.some((l) => !APPLIANCES[l.appliance]?.fixed)).length
  const smallAppliance = 1500 * Math.max(2, kitchenCircuits)
  const laundry = d.circuits.some((c) => c.room === 'Laundry' && c.poles === 1) ? 1500 : 0
  let fixed = 0
  let hvac = 0
  for (const c of d.circuits) {
    for (const l of c.loads) {
      const a = APPLIANCES[l.appliance]
      if (!a) continue
      if (a.hvac) hvac = Math.max(hvac, a.watts)
      else if (a.fixed) fixed += a.watts
    }
  }
  const general = lighting + smallAppliance + laundry + fixed
  const demandVA = Math.min(general, 10000) + 0.4 * Math.max(0, general - 10000) + hvac
  const amps = demandVA / 240
  return { lighting, smallAppliance, laundry, fixed, hvac, demandVA, amps, pctOfService: (amps / d.serviceAmps) * 100 }
}
