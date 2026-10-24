/**
 * Volt — Campaign Chapter 5 · Home Power
 *
 * Missions in the Home workspace (Phase H1): overloaded kitchen circuits,
 * voltage drop on a long feed, a hidden arcing fault, a kitchen wired to
 * (simplified) code, and squeezing an EV charger onto a 100 A service.
 * Goals are checked against the live home simulation; hold times are in
 * house time.
 */
import type { BranchCircuit, HomeDesign } from '../home/types'
import { shedHome, starterHome } from '../home/examples'
import type { Level } from './types'

const NO_BENCH = { components: [], wires: [] }

const patchCircuit = (d: HomeDesign, id: string, patch: Partial<BranchCircuit>): HomeDesign => ({
  ...d,
  circuits: d.circuits.map((c) => (c.id === id ? { ...c, ...patch } : c))
})
const setLoad = (d: HomeDesign, circuitId: string, appliance: string, on: boolean): HomeDesign => ({
  ...d,
  circuits: d.circuits.map((c) => (c.id === circuitId ? { ...c, loads: c.loads.map((l) => (l.appliance === appliance ? { ...l, on } : l)) } : c))
})
const circuit = (id: string, name: string, room: string, slot: number, loads: [string, boolean][], extra: Partial<BranchCircuit> = {}): BranchCircuit => ({
  id,
  name,
  room,
  slot,
  poles: 1,
  amps: 20,
  type: 'dual',
  state: 'on',
  gauge: 12,
  lengthFt: 35,
  loads: loads.map(([appliance, on], i) => ({ id: `${id}-l${i}`, appliance, on })),
  fault: 'none',
  ...extra
})

// ── 1. Breakfast Rush ───────────────────────────────────────────────────────
const breakfastRush: Level = {
  id: 'c5-l1',
  chapterId: 'c5',
  type: 'fix',
  title: 'Breakfast Rush',
  concept: 'A 20 A, 120 V circuit carries about 2,400 W. Heating appliances use most of that on their own.',
  brief:
    'Every morning the microwave, toaster and kettle all run on Kitchen counter 1, and every morning the breaker trips. Rearrange the kitchen so all three can run together for five minutes of house time with nothing tripping.',
  starter: NO_BENCH,
  palette: [],
  home: {
    starter: () => {
      let d = starterHome()
      d = setLoad(d, 'kitchen1', 'toaster', true)
      d = setLoad(d, 'kitchen1', 'kettle', true)
      return d
    },
    solve: (d) => {
      // kettle to counter 2, toaster to a new third counter circuit
      let out = {
        ...d,
        circuits: d.circuits.map((c) =>
          c.id === 'kitchen1'
            ? { ...c, state: 'on' as const, loads: c.loads.filter((l) => l.appliance === 'microwave') }
            : c.id === 'kitchen2'
              ? { ...c, loads: [...c.loads, { id: 'kettle-moved', appliance: 'kettle', on: true }] }
              : c
        )
      }
      out = { ...out, circuits: [...out.circuits, circuit('kitchen3', 'Kitchen counter 3', 'Kitchen', 17, [['toaster', true]])] }
      return out
    },
    speed: 10
  },
  goals: [
    { kind: 'home_loads_on', appliances: ['microwave', 'toaster', 'kettle'], label: 'Microwave, toaster and kettle all on' },
    { kind: 'home_all_on', label: 'No breakers tripped or off' }
  ],
  holdSeconds: 300,
  stars: [
    { kind: 'home_circuit_load_max', pct: 100, label: 'No circuit over its rating' },
    { kind: 'home_circuit_load_max', pct: 80, label: 'Every circuit under 80% (room to spare)' }
  ],
  hints: [
    'Select Kitchen counter 1. Microwave 1,500 W + toaster 1,100 W + kettle 1,500 W ≈ 34 A on a 20 A breaker.',
    'Move the kettle: remove it from counter 1 and add one to Kitchen counter 2. Then reset counter 1.',
    'Microwave + toaster is still about 22 A (108%). For three stars, add a third 20 A dual-function kitchen circuit (12 AWG) for the toaster.'
  ],
  debrief:
    'Breakers protect the wire by tripping when current stays above the rating, sooner the bigger the overload. Kitchens get at least two 20 A countertop circuits for exactly this reason, and electricians keep everyday loads under about 80% of a breaker so it never runs hot.',
  xp: 200,
  solution: NO_BENCH
}

// ── 2. Shed Power ───────────────────────────────────────────────────────────
const shedPower: Level = {
  id: 'c5-l2',
  chapterId: 'c5',
  type: 'build',
  title: 'Shed Power',
  concept: 'Voltage drop grows with length and shrinks with thicker wire. Keep it under 3%.',
  brief:
    'The shed is 150 ft from the panel on 12 AWG wire. When the table saw runs, the lights dim and the saw bogs down: the drop is about 6%. Rewire the run so the drop stays under 3% with the saw running, safely and without overspending on copper.',
  starter: NO_BENCH,
  palette: [],
  home: {
    starter: () => setLoad(shedHome(), 'shed', 'table_saw', true),
    solve: (d) => patchCircuit(d, 'shed', { gauge: 8 }),
    speed: 1
  },
  goals: [
    { kind: 'home_loads_on', appliances: ['table_saw'], label: 'Table saw running' },
    { kind: 'home_drop_max', circuit: 'shed', maxPct: 3, label: 'Shed voltage drop under 3%' },
    { kind: 'home_no_hazards', label: 'No safety hazards' },
    { kind: 'home_all_on', label: 'No breakers tripped or off' }
  ],
  holdSeconds: 20,
  stars: [
    { kind: 'home_gauge_range', circuit: 'shed', min: 8, max: 8, label: 'Thinnest wire that works (8 AWG)' },
    { kind: 'home_breaker_type', circuit: 'shed', types: ['gfci', 'dual'], label: 'Shed still GFCI-protected' }
  ],
  hints: [
    'Select the Shed feed circuit and watch “Voltage drop” as you change the wire.',
    '10 AWG gets the drop to about 3.8%. Not quite.',
    '8 AWG brings it to about 2.4%. A bigger breaker won’t help: drop depends on the wire, not the breaker.'
  ],
  debrief:
    'The run is 150 ft out and 150 ft back, so 300 ft of copper sits in series with the saw. Every gauge step down (smaller number) lowers that resistance. Motors and lights at the end of long runs are where voltage drop really shows.',
  xp: 200,
  solution: NO_BENCH
}

// ── 3. Hidden Hazard (Fix) ──────────────────────────────────────────────────
const hiddenHazard: Level = {
  id: 'c5-l3',
  chapterId: 'c5',
  type: 'fix',
  title: 'Hidden Hazard',
  concept: 'An arcing fault can start a fire without ever tripping an ordinary breaker. AFCI breakers detect it.',
  brief:
    'The homeowner smells something hot in the bedroom, but no breaker has tripped. Find the circuit with the problem, make it safe, and bring it up to (simplified) code.',
  starter: NO_BENCH,
  palette: [],
  home: {
    starter: () => patchCircuit(starterHome(), 'bedroom', { type: 'standard', fault: 'arc' }),
    solve: (d) => patchCircuit(d, 'bedroom', { type: 'afci', fault: 'none' }),
    speed: 10
  },
  goals: [
    { kind: 'home_no_hazards', label: 'No safety hazards anywhere' },
    { kind: 'home_all_on', label: 'Everything powered' }
  ],
  holdSeconds: 60,
  stars: [
    { kind: 'home_code_ok', label: 'Whole house up to code' },
    { kind: 'no_burnouts', label: 'Fixed it without a single trip' }
  ],
  hints: [
    'Select each circuit and read its warnings at the bottom of the card. One is red.',
    'The bedroom circuit has an arcing fault (a damaged cord) on an ordinary breaker, which can’t see arcs.',
    'Set its fault to “No fault” (replace the cord), then change the breaker to AFCI so it would catch the next one.'
  ],
  debrief:
    'An arc in a frayed cord draws normal-looking current, so a standard breaker never trips, yet the arc can reach thousands of degrees. AFCI breakers watch the current’s waveform for the signature of arcing. That is why codes now require them in bedrooms and living spaces.',
  xp: 200,
  solution: NO_BENCH
}

// ── 4. Kitchen to Code (Design) ─────────────────────────────────────────────
const kitchenToCode: Level = {
  id: 'c5-l4',
  chapterId: 'c5',
  type: 'design',
  title: 'Kitchen to Code',
  concept: 'Kitchens need several 20 A circuits, with GFCI and AFCI protection.',
  brief:
    'A renovation left the whole kitchen on one 15 A circuit: fridge, microwave, toaster, dishwasher and disposal. Design the kitchen circuits so everything can run at once, safely, and to (simplified) code.',
  starter: NO_BENCH,
  palette: [],
  home: {
    starter: () => ({
      name: 'Kitchen renovation',
      sqft: 1600,
      serviceAmps: 200,
      mainAmps: 200,
      mainState: 'on',
      spaces: 20,
      circuits: [
        circuit('kitchen', 'Kitchen', 'Kitchen', 1, [['fridge', true], ['microwave', true], ['toaster', true], ['dishwasher', true], ['disposal', true]], {
          amps: 15,
          gauge: 14,
          type: 'standard'
        }),
        circuit('living', 'Living room', 'Living room', 2, [['led_lights', true], ['tv', true]], { amps: 15, gauge: 14, type: 'afci', lengthFt: 45 })
      ]
    }),
    solve: (d) => ({
      ...d,
      circuits: [
        ...d.circuits.filter((c) => c.id !== 'kitchen'),
        circuit('kitchen', 'Counter 1', 'Kitchen', 1, [['fridge', true], ['microwave', true]]),
        circuit('k2', 'Counter 2', 'Kitchen', 3, [['toaster', true], ['disposal', true]]),
        circuit('k3', 'Dishwasher', 'Kitchen', 4, [['dishwasher', true]])
      ]
    }),
    speed: 10
  },
  goals: [
    { kind: 'home_loads_on', appliances: ['fridge', 'microwave', 'toaster', 'dishwasher', 'disposal'], label: 'All five kitchen appliances on' },
    { kind: 'home_all_on', label: 'No breakers tripped or off' },
    { kind: 'home_no_hazards', label: 'No safety hazards' }
  ],
  holdSeconds: 300,
  stars: [
    { kind: 'home_code_ok', label: 'Up to code: dual-function (GFCI + AFCI) kitchen breakers' },
    { kind: 'home_circuit_load_max', pct: 80, label: 'Every circuit under 80%' }
  ],
  hints: [
    'Everything together is about 4,500 W, nearly 38 A. No single 120 V circuit can carry that.',
    'Use 20 A breakers with 12 AWG wire (a 20 A breaker on 14 AWG is a hazard). Set protection to Dual function.',
    'Three circuits work: fridge + microwave, toaster + disposal, and the dishwasher on its own.'
  ],
  debrief:
    'Spreading heavy loads across circuits keeps each one under its rating, matching each breaker to its wire keeps the wire safe, and GFCI + AFCI protection guards against shocks near water and arcing in cords. Real kitchens use the same pattern: two or more 20 A countertop circuits plus dedicated circuits for big appliances.',
  xp: 250,
  solution: NO_BENCH
}

// ── 5. Service Squeeze (Design) ─────────────────────────────────────────────
const serviceSqueeze: Level = {
  id: 'c5-l5',
  chapterId: 'c5',
  type: 'design',
  title: 'Service Squeeze',
  concept: 'The service load calculation decides whether a house’s electrical service is big enough.',
  brief:
    'This older home has a 100 A service, and the owners just bought an electric car. With the 32 A EV charger added, the load calculation comes out over 100 A. Make it fit without upgrading the service.',
  starter: NO_BENCH,
  palette: [],
  home: {
    starter: () => {
      const d = starterHome()
      return {
        ...d,
        name: 'Older home with an EV',
        serviceAmps: 100,
        mainAmps: 100,
        circuits: [
          ...d.circuits,
          circuit('ev', 'EV charger', 'Garage', 17, [['ev_l2', true]], { poles: 2, amps: 40, gauge: 8, type: 'standard', lengthFt: 40 })
        ]
      }
    },
    // swap the electric range for gas: remove its circuit
    solve: (d) => ({ ...d, circuits: d.circuits.filter((c) => c.id !== 'range') }),
    speed: 10
  },
  goals: [
    { kind: 'home_loads_on', appliances: ['ev_l2'], label: 'EV charging' },
    { kind: 'home_service_fits', label: 'Load calculation within the service' },
    { kind: 'home_all_on', label: 'No breakers tripped or off' }
  ],
  holdSeconds: 120,
  stars: [
    { kind: 'home_service_max', amps: 100, label: 'Kept the 100 A service (no upgrade)' },
    { kind: 'no_burnouts', label: 'No trips along the way' }
  ],
  hints: [
    'Select the main (or deselect every circuit) to see the load calculation. It counts fixed appliances, the biggest heating/cooling load and 3 VA per square foot.',
    'Big fixed electric appliances push it over: the range (8 kW), dryer (5.6 kW) and water heater (4.5 kW).',
    'Switching one appliance to gas does it: remove the Range circuit (a gas range needs no 240 V circuit).'
  ],
  debrief:
    'A service upgrade can cost thousands, so electricians run the load calculation first. Diversity (not everything runs at once) is built in: the first 10 kVA counts fully, the rest at 40%. Switching one big appliance to gas, or adding a load-management device for the EV, often makes the numbers work.',
  xp: 250,
  solution: NO_BENCH
}

export const CHAPTER5_LEVELS: Level[] = [breakfastRush, shedPower, hiddenHazard, kitchenToCode, serviceSqueeze]
