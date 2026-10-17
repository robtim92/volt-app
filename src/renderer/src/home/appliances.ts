/**
 * Volt — appliance library for home power systems.
 *
 * Wattages are typical running draws for US appliances. Motors draw an
 * in-rush current for a moment when they start; compressors and heating
 * elements cycle on and off by themselves while switched on.
 */

export type LoadKind = 'resistive' | 'motor' | 'electronic'

export interface Appliance {
  id: string
  name: string
  icon: string
  /** running power (W) */
  watts: number
  volts: 120 | 240
  kind: LoadKind
  /** in-rush: current multiple and how long it lasts (s) */
  surge?: { multiple: number; seconds: number }
  /** self-cycling while switched on (s) */
  cycle?: { onSec: number; offSec: number }
  /** a lighting load (lights up rooms in the 3D house) */
  lighting?: boolean
  /** fixed-in-place appliance (counted by nameplate in the load calculation) */
  fixed?: boolean
  /** heating / cooling (largest one counted at 100% in the load calculation) */
  hvac?: boolean
}

const A = (a: Appliance): [string, Appliance] => [a.id, a]

export const APPLIANCES: Record<string, Appliance> = Object.fromEntries([
  // lighting & electronics
  A({ id: 'led_lights', name: 'LED lights', icon: '💡', watts: 100, volts: 120, kind: 'electronic', lighting: true }),
  A({ id: 'incandescent', name: 'Incandescent lights', icon: '💡', watts: 600, volts: 120, kind: 'resistive', lighting: true }),
  A({ id: 'outdoor_lights', name: 'Outdoor lights', icon: '🔦', watts: 150, volts: 120, kind: 'electronic', lighting: true }),
  A({ id: 'tv', name: 'TV & electronics', icon: '📺', watts: 250, volts: 120, kind: 'electronic' }),
  A({ id: 'computer', name: 'Desktop computer', icon: '🖥️', watts: 350, volts: 120, kind: 'electronic' }),
  // kitchen
  A({ id: 'microwave', name: 'Microwave', icon: '🍲', watts: 1500, volts: 120, kind: 'electronic' }),
  A({ id: 'toaster', name: 'Toaster', icon: '🍞', watts: 1100, volts: 120, kind: 'resistive' }),
  A({ id: 'kettle', name: 'Electric kettle', icon: '🫖', watts: 1500, volts: 120, kind: 'resistive' }),
  A({ id: 'coffee', name: 'Coffee maker', icon: '☕', watts: 1000, volts: 120, kind: 'resistive' }),
  A({ id: 'fridge', name: 'Refrigerator', icon: '🧊', watts: 150, volts: 120, kind: 'motor', surge: { multiple: 6, seconds: 0.5 }, cycle: { onSec: 900, offSec: 1500 } }),
  A({ id: 'dishwasher', name: 'Dishwasher', icon: '🍽️', watts: 1200, volts: 120, kind: 'resistive', fixed: true }),
  A({ id: 'disposal', name: 'Garbage disposal', icon: '🌀', watts: 600, volts: 120, kind: 'motor', surge: { multiple: 5, seconds: 0.3 }, fixed: true }),
  A({ id: 'range', name: 'Electric range', icon: '🍳', watts: 8000, volts: 240, kind: 'resistive', fixed: true }),
  // comfort
  A({ id: 'space_heater', name: 'Space heater', icon: '🔥', watts: 1500, volts: 120, kind: 'resistive' }),
  A({ id: 'window_ac', name: 'Window AC', icon: '❄️', watts: 1200, volts: 120, kind: 'motor', surge: { multiple: 4, seconds: 0.4 }, cycle: { onSec: 600, offSec: 600 } }),
  A({ id: 'central_ac', name: 'Central AC (3 ton)', icon: '🌬️', watts: 3500, volts: 240, kind: 'motor', surge: { multiple: 5, seconds: 0.3 }, cycle: { onSec: 900, offSec: 900 }, fixed: true, hvac: true }),
  A({ id: 'water_heater', name: 'Water heater', icon: '🚿', watts: 4500, volts: 240, kind: 'resistive', cycle: { onSec: 1200, offSec: 2400 }, fixed: true }),
  A({ id: 'hair_dryer', name: 'Hair dryer', icon: '💨', watts: 1500, volts: 120, kind: 'resistive' }),
  // laundry
  A({ id: 'washer', name: 'Washing machine', icon: '🧺', watts: 500, volts: 120, kind: 'motor', surge: { multiple: 4, seconds: 0.5 } }),
  A({ id: 'dryer', name: 'Electric dryer', icon: '👕', watts: 5600, volts: 240, kind: 'resistive', fixed: true }),
  // garage & outdoor
  A({ id: 'ev_l2', name: 'EV charger (32 A)', icon: '🚗', watts: 7680, volts: 240, kind: 'electronic', fixed: true }),
  A({ id: 'table_saw', name: 'Table saw', icon: '🪚', watts: 1800, volts: 120, kind: 'motor', surge: { multiple: 5, seconds: 0.25 } }),
  A({ id: 'air_compressor', name: 'Air compressor', icon: '🛞', watts: 1800, volts: 120, kind: 'motor', surge: { multiple: 5, seconds: 0.5 }, cycle: { onSec: 120, offSec: 240 } }),
  A({ id: 'well_pump', name: 'Well pump', icon: '💧', watts: 1500, volts: 240, kind: 'motor', surge: { multiple: 5, seconds: 0.5 }, cycle: { onSec: 60, offSec: 600 }, fixed: true }),
  A({ id: 'garage_door', name: 'Garage door opener', icon: '🚪', watts: 500, volts: 120, kind: 'motor', surge: { multiple: 4, seconds: 0.4 } })
])

export const ROOMS = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Laundry', 'Garage', 'Outdoor', 'Utility', 'Shed'] as const

/** Rooms where the (simplified) code expects GFCI protection on receptacle circuits. */
export const GFCI_ROOMS = new Set(['Kitchen', 'Bathroom', 'Laundry', 'Garage', 'Outdoor', 'Shed'])
/** Rooms where the (simplified) code expects AFCI protection. */
export const AFCI_ROOMS = new Set(['Living room', 'Bedroom', 'Kitchen', 'Laundry'])
