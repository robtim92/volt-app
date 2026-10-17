/**
 * Volt — home power examples (Phase H1). Each loads into the Home workspace
 * with a short guide, and is checked by the test suite.
 */
import type { BranchCircuit, BreakerType, HomeDesign } from './types'

export interface HomeExample {
  id: string
  title: string
  summary: string
  concept: string
  steps: string[]
  /** suggested clock speed */
  speed?: number
  design: HomeDesign
}

let seq = 0
const load = (appliance: string, on = false): { id: string; appliance: string; on: boolean } => ({ id: `ld${++seq}`, appliance, on })

function circuit(
  id: string,
  name: string,
  room: string,
  slot: number,
  amps: number,
  gauge: number,
  lengthFt: number,
  loads: { id: string; appliance: string; on: boolean }[],
  opts: { poles?: 1 | 2; type?: BreakerType } = {}
): BranchCircuit {
  return { id, name, room, slot, poles: opts.poles ?? 1, amps, type: opts.type ?? 'standard', state: 'on', gauge, lengthFt, loads, fault: 'none' }
}

export function starterHome(): HomeDesign {
  seq = 0
  return {
    name: 'Starter home',
    sqft: 1800,
    serviceAmps: 200,
    mainAmps: 200,
    mainState: 'on',
    spaces: 24,
    circuits: [
      circuit('kitchen1', 'Kitchen counter 1', 'Kitchen', 1, 20, 12, 35, [load('microwave', true), load('toaster'), load('kettle')], { type: 'dual' }),
      circuit('kitchen2', 'Kitchen counter 2', 'Kitchen', 2, 20, 12, 40, [load('coffee')], { type: 'dual' }),
      circuit('fridge', 'Refrigerator', 'Kitchen', 3, 20, 12, 30, [load('fridge', true)], { type: 'dual' }),
      circuit('living', 'Living room', 'Living room', 4, 15, 14, 45, [load('led_lights', true), load('tv', true)], { type: 'afci' }),
      circuit('bedroom', 'Bedroom', 'Bedroom', 5, 15, 14, 55, [load('led_lights', true), load('space_heater')], { type: 'afci' }),
      circuit('bath', 'Bathroom', 'Bathroom', 6, 20, 12, 40, [load('led_lights', true), load('hair_dryer')], { type: 'gfci' }),
      circuit('laundry', 'Laundry', 'Laundry', 7, 20, 12, 30, [load('washer')], { type: 'dual' }),
      circuit('garage', 'Garage', 'Garage', 8, 20, 12, 25, [load('led_lights'), load('garage_door')], { type: 'gfci' }),
      circuit('dryer', 'Dryer', 'Laundry', 9, 30, 10, 30, [load('dryer')], { poles: 2 }),
      circuit('water', 'Water heater', 'Utility', 10, 30, 10, 20, [load('water_heater', true)], { poles: 2 }),
      circuit('range', 'Range', 'Kitchen', 13, 40, 8, 30, [load('range')], { poles: 2 }),
      circuit('ac', 'Central AC', 'Outdoor', 14, 30, 10, 50, [load('central_ac', true)], { poles: 2 })
    ]
  }
}

export function shedHome(): HomeDesign {
  seq = 100
  return {
    name: 'House with a shed',
    sqft: 1400,
    serviceAmps: 200,
    mainAmps: 200,
    mainState: 'on',
    spaces: 20,
    circuits: [
      circuit('kitchen1', 'Kitchen counter', 'Kitchen', 1, 20, 12, 30, [load('microwave'), load('fridge', true)], { type: 'dual' }),
      circuit('living', 'Living room', 'Living room', 2, 15, 14, 40, [load('led_lights', true), load('tv', true)], { type: 'afci' }),
      circuit('shed', 'Shed feed', 'Shed', 3, 20, 12, 150, [load('led_lights', true), load('table_saw')], { type: 'gfci' }),
      circuit('water', 'Water heater', 'Utility', 5, 30, 10, 20, [load('water_heater', true)], { poles: 2 })
    ]
  }
}

export function blankHome(): HomeDesign {
  return { name: 'My home', sqft: 1500, serviceAmps: 200, mainAmps: 200, mainState: 'on', spaces: 24, circuits: [] }
}

export const HOME_EXAMPLES: HomeExample[] = [
  {
    id: 'starter-kitchen',
    title: 'Starter home: the breakfast trip',
    summary: 'A 200 A home with 12 circuits. One kitchen circuit keeps tripping at breakfast.',
    concept: 'Each 20 A kitchen circuit carries about 2,400 W. Heating appliances use a lot of it.',
    speed: 10,
    steps: [
      'The house is running normally: lights, TV, fridge, water heater and AC. Watch legs A and B share the load.',
      'Breakfast: on Kitchen counter 1, switch on the toaster and the kettle. Together with the microwave that is about 4,100 W, around 34 A on a 20 A breaker.',
      'Wait. The breaker heats up and trips after a little over a minute of house time (about 7 seconds at 10×). Everything on that circuit goes off.',
      'Fix it: turn the kettle off on Kitchen counter 1 and on on Kitchen counter 2, then reset the breaker. Two circuits share the load and neither trips.',
      'Try a fault: set Bathroom to "ground fault" and switch on the hair dryer. The GFCI trips at once. Then set it to an ordinary breaker and try again.'
    ],
    design: starterHome()
  },
  {
    id: 'shed-run',
    title: 'A long run to the shed',
    summary: 'A table saw at the end of 150 ft of 12 AWG wire starves for voltage.',
    concept: 'Long, thin runs drop voltage: R = ρ × length ÷ area, both ways. Over 3% is a common design limit.',
    speed: 1,
    steps: [
      'The shed is fed by 150 ft of 12 AWG on a 20 A breaker. With only the lights on, the drop is tiny.',
      'Switch on the table saw. About 15 A flows and the shed sees roughly 113 V: a 6% drop, flagged on the circuit card.',
      'Change the wire to 10 AWG: still about 4%. 8 AWG brings it under 3%.',
      'Now try a 30 A breaker on the 12 AWG run. It is flagged as dangerous: the breaker no longer protects the wire.'
    ],
    design: shedHome()
  }
]
