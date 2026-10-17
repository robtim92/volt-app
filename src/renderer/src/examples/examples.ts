/**
 * Volt — Example circuits
 *
 * Ready-made circuits that load into the sandbox, double as guided tutorials
 * ("try this, notice that"), and stay fully editable. Every example is checked
 * by the test suite: it must wire up cleanly, run in the live simulator, and
 * not burn anything out on its own.
 */
import type { CircuitComponent, Wire } from '../sim/elements'
import type { CircuitPreset } from '../lessons/types'
import type { BenchView } from '../stores/uiStore'

export type ExampleCategory = 'Basics' | 'Power & wiring' | 'Time & energy' | 'AC & signals' | 'Protection & safety'

export interface ExampleCircuit {
  id: string
  title: string
  category: ExampleCategory
  level: 'Beginner' | 'Intermediate'
  /** one line for the gallery card */
  summary: string
  /** the idea it demonstrates, shown at the top of the guide */
  concept: string
  circuit: CircuitPreset
  /** guided steps: what to do and what to notice */
  steps: string[]
  /** suggested sim speed (sim seconds per real second) */
  timeScale?: number
  /** open the oscilloscope on load */
  scope?: boolean
  /** suggested view */
  view?: BenchView
}

const c = (
  id: string,
  type: CircuitComponent['type'],
  x: number,
  y: number,
  extra: Partial<CircuitComponent> = {}
): CircuitComponent => ({ id, type, x, y, rotation: 0, label: id, ...extra })
const w = (a: string, at: number, b: string, bt: number, extra: Partial<Wire> = {}): Wire => ({
  id: `w-${a}${at}-${b}${bt}`,
  fromComponentId: a,
  fromTerminal: at,
  toComponentId: b,
  toTerminal: bt,
  ...extra
})
/** house wiring: 14 AWG, the standard pairing for a 15 A breaker */
const AWG14 = { gauge: 14 }
const V = 90 // rotation for vertical parts (terminal 0 on top)

export const EXAMPLES: ExampleCircuit[] = [
  // ── Basics ──────────────────────────────────────────────────────────────────
  {
    id: 'led-resistor',
    title: 'LED + current-limiting resistor',
    category: 'Basics',
    level: 'Beginner',
    summary: 'The most common circuit in electronics, and why the resistor matters.',
    concept: 'A series resistor sets the LED current: I ≈ (supply − 2 V) ÷ R.',
    circuit: {
      components: [
        c('V1', 'voltage_source', 200, 300, { value: 9 }),
        c('R1', 'resistor', 380, 180, { value: 470 }),
        c('LED1', 'led', 580, 180),
        c('GND', 'ground', 200, 420)
      ],
      wires: [w('V1', 0, 'R1', 0), w('R1', 1, 'LED1', 0), w('LED1', 1, 'V1', 1), w('V1', 1, 'GND', 0)]
    },
    steps: [
      'The LED is lit at about 15 mA. Select the LED to read its current and temperature in the Inspector.',
      'Change R1 to 220 Ω. More current flows and the LED gets brighter and warmer (≈ 32 mA, just over its rating).',
      'Now try 47 Ω. The LED is pushed far past its limit and burns out within a second. Use “Replace part” or ⟲ reset to fix it.',
      'Rule of thumb for a 20 mA LED: R = (supply − 2 V) ÷ 0.02 A. For 9 V that gives 350 Ω; 330 Ω or 390 Ω are the nearest standard values.'
    ]
  },
  {
    id: 'voltage-divider',
    title: 'Voltage divider',
    category: 'Basics',
    level: 'Beginner',
    summary: 'Two resistors split a voltage in proportion to their values.',
    concept: 'Vout = Vin × R2 ÷ (R1 + R2).',
    circuit: {
      components: [
        c('V1', 'voltage_source', 160, 300, { value: 12 }),
        c('R1', 'resistor', 360, 180, { value: 2000 }),
        c('R2', 'resistor', 520, 280, { value: 1000, rotation: V }),
        c('VM1', 'voltmeter', 700, 280, { rotation: V }),
        c('GND', 'ground', 160, 420)
      ],
      wires: [
        w('V1', 0, 'R1', 0),
        w('R1', 1, 'R2', 0),
        w('R2', 0, 'VM1', 0),
        w('R2', 1, 'VM1', 1),
        w('R2', 1, 'V1', 1),
        w('V1', 1, 'GND', 0)
      ]
    },
    steps: [
      'The voltmeter reads 4 V: 12 V × 1 kΩ ÷ (2 kΩ + 1 kΩ).',
      'Make R2 2 kΩ. The two resistors are now equal, so the output is half the supply: 6 V.',
      'Add a 1 kΩ resistor across R2 (a “load”). The output sags, because the load sits in parallel with R2 and lowers its effective resistance.',
      'This is why dividers are used for reference voltages and sensors, but not to power things.'
    ]
  },
  {
    id: 'series-parallel',
    title: 'Series vs. parallel LEDs',
    category: 'Basics',
    level: 'Beginner',
    summary: 'One string in series, one branch in parallel, side by side.',
    concept: 'Series parts share one current; parallel branches each get the full voltage.',
    circuit: {
      components: [
        c('V1', 'voltage_source', 120, 300, { value: 9 }),
        c('R1', 'resistor', 280, 160, { value: 220 }),
        c('LED1', 'led', 440, 160),
        c('LED2', 'led', 600, 160),
        c('R2', 'resistor', 280, 300, { value: 390 }),
        c('LED3', 'led', 440, 300),
        c('GND', 'ground', 120, 420)
      ],
      wires: [
        w('V1', 0, 'R1', 0),
        w('V1', 0, 'R2', 0),
        w('R1', 1, 'LED1', 0),
        w('LED1', 1, 'LED2', 0),
        w('LED2', 1, 'V1', 1),
        w('R2', 1, 'LED3', 0),
        w('LED3', 1, 'V1', 1),
        w('V1', 1, 'GND', 0)
      ]
    },
    steps: [
      'Select LED1 and then LED2: the same current flows through both, because a series string is one path.',
      'Each LED drops about 2 V, so the series string leaves only ~5 V for R1. The parallel branch’s R2 sees ~7 V.',
      'Delete LED1. The whole series string goes dark, but LED3 on its own branch stays lit.',
      'Undo (↶) to bring LED1 back.'
    ]
  },
  {
    id: 'kirchhoff-current',
    title: 'Current splits at a junction',
    category: 'Basics',
    level: 'Intermediate',
    summary: 'Ammeters on every branch show Kirchhoff’s current law in action.',
    concept: 'Current into a junction equals current out: A1 = A2 + A3 + A4.',
    circuit: {
      components: [
        c('V1', 'voltage_source', 120, 300, { value: 6 }),
        c('A1', 'ammeter', 260, 160),
        c('N1', 'wire_node', 460, 160, { label: undefined }),
        c('R1', 'resistor', 460, 240, { value: 220, rotation: V }),
        c('R2', 'resistor', 580, 240, { value: 470, rotation: V }),
        c('R3', 'resistor', 700, 240, { value: 1000, rotation: V }),
        c('A2', 'ammeter', 460, 360, { rotation: V }),
        c('A3', 'ammeter', 580, 360, { rotation: V }),
        c('A4', 'ammeter', 700, 360, { rotation: V }),
        c('GND', 'ground', 120, 420)
      ],
      wires: [
        w('V1', 0, 'A1', 0),
        w('A1', 1, 'N1', 0),
        w('N1', 0, 'R1', 0),
        w('R1', 0, 'R2', 0),
        w('R2', 0, 'R3', 0),
        w('R1', 1, 'A2', 0),
        w('R2', 1, 'A3', 0),
        w('R3', 1, 'A4', 0),
        w('A2', 1, 'V1', 1),
        w('A2', 1, 'A3', 1),
        w('A3', 1, 'A4', 1),
        w('V1', 1, 'GND', 0)
      ]
    },
    steps: [
      'Add up A2 + A3 + A4: it matches A1 (about 27 + 13 + 6 = 46 mA).',
      'The smallest resistor carries the most current, because every branch sees the same 6 V.',
      'Change R3 to 100 Ω. Total current jumps, and R3 starts to warm up (6 V across 100 Ω is 0.36 W, over its ¼ W rating).',
      'Ammeters go in series with what they measure. Try wiring one straight across the battery and watch its fuse blow.'
    ]
  },

  // ── Time & energy ───────────────────────────────────────────────────────────
  {
    id: 'rc-charging',
    title: 'Capacitor charging (RC time constant)',
    category: 'Time & energy',
    level: 'Beginner',
    summary: 'Watch a capacitor fill up along its exponential curve.',
    concept: 'τ = R × C. After 1 τ the capacitor reaches 63%; after 5 τ it is essentially full.',
    circuit: {
      components: [
        c('V1', 'voltage_source', 120, 300, { value: 9 }),
        c('SW1', 'switch', 260, 160, { closed: false }),
        c('R1', 'resistor', 420, 160, { value: 1000 }),
        c('C1', 'capacitor', 560, 260, { value: 1e-3, rotation: V }),
        c('VM1', 'voltmeter', 700, 260, { rotation: V }),
        c('GND', 'ground', 120, 420)
      ],
      wires: [
        w('V1', 0, 'SW1', 0),
        w('SW1', 1, 'R1', 0),
        w('R1', 1, 'C1', 0),
        w('C1', 0, 'VM1', 0),
        w('C1', 1, 'VM1', 1),
        w('C1', 1, 'V1', 1),
        w('V1', 1, 'GND', 0)
      ]
    },
    scope: true,
    steps: [
      'Double-click (or double-tap) SW1 to close it. The scope traces the capacitor voltage rising.',
      'With 1 kΩ and 1000 µF, τ = 1 s: about 5.7 V after one second, and nearly 9 V after five.',
      'Open the switch again. The capacitor holds its charge, apart from a slow leak through the voltmeter’s 10 MΩ.',
      'Change C1 to 100 µF and repeat: ten times faster. Or make R1 10 kΩ: ten times slower.'
    ]
  },
  {
    id: 'inductive-kickback',
    title: 'Inductive kickback & the flyback diode',
    category: 'Time & energy',
    level: 'Intermediate',
    summary: 'Interrupt an inductor’s current and it fights back with a spark.',
    concept: 'An inductor resists changes in current: V = L × dI/dt. Stopping it suddenly makes a huge voltage.',
    circuit: {
      components: [
        c('V1', 'voltage_source', 120, 300, { value: 12 }),
        c('SW1', 'switch', 260, 160, { closed: true }),
        c('R1', 'resistor', 420, 160, { value: 100, rating: 5, label: 'R1 (5 W)' }),
        c('L1', 'inductor', 560, 260, { value: 1, rotation: V }),
        c('GND', 'ground', 120, 420)
      ],
      wires: [w('V1', 0, 'SW1', 0), w('SW1', 1, 'R1', 0), w('R1', 1, 'L1', 0), w('L1', 1, 'V1', 1), w('V1', 1, 'GND', 0)]
    },
    timeScale: 0.1,
    scope: true,
    steps: [
      'Current builds up gradually through L1 (τ = L ÷ R = 10 ms; the sim runs at 1/10 speed so you can see it).',
      'Open SW1. The inductor tries to keep its current flowing, the voltage spikes past 1000 V, and it arcs across the switch.',
      'Add a diode across L1 with its cathode (bar) at the top, where R1 connects, and its anode at the bottom. Close the switch, wait, then open it again.',
      'No spark this time: the “flyback” diode gives the current a safe loop to die away in. Every relay and motor driver needs one.'
    ]
  },

  // ── AC & signals ───────────────────────────────────────────────────────────
  {
    id: 'half-wave-rectifier',
    title: 'Half-wave rectifier + smoothing',
    category: 'AC & signals',
    level: 'Intermediate',
    summary: 'A diode turns AC into bumpy DC; a capacitor smooths it out.',
    concept: 'A diode only conducts one way, so only the positive half of each cycle reaches the load.',
    circuit: {
      components: [
        c('Vac1', 'ac_voltage_source', 160, 300, { value: 10, frequency: 50 }),
        c('D1', 'diode', 340, 160),
        c('R1', 'resistor', 520, 260, { value: 1000, rotation: V }),
        c('GND', 'ground', 160, 420)
      ],
      wires: [w('Vac1', 0, 'D1', 0), w('D1', 1, 'R1', 0), w('R1', 1, 'Vac1', 1), w('Vac1', 1, 'GND', 0)]
    },
    timeScale: 0.01,
    scope: true,
    steps: [
      'The scope shows the 50 Hz input and the output across R1. The sim runs at 1/100 speed so each cycle takes two seconds.',
      'The output is only the positive humps, each about 0.7 V lower than the input peak (the diode’s drop).',
      'Add a 100 µF capacitor across R1. It charges on each hump and feeds the load in between, giving DC with a small ripple.',
      'Try 470 µF for less ripple, or lower R1 (a heavier load) for more.'
    ]
  },
  {
    id: 'rc-lowpass',
    title: 'RC low-pass filter',
    category: 'AC & signals',
    level: 'Intermediate',
    summary: 'Low frequencies pass, high frequencies are blocked.',
    concept: 'Cutoff frequency fc = 1 ÷ (2π × R × C). Here: 1 kΩ and 1 µF give fc ≈ 159 Hz.',
    circuit: {
      components: [
        c('Vac1', 'ac_voltage_source', 160, 300, { value: 10, frequency: 159 }),
        c('R1', 'resistor', 360, 180, { value: 1000 }),
        c('C1', 'capacitor', 540, 280, { value: 1e-6, rotation: V }),
        c('GND', 'ground', 160, 420)
      ],
      wires: [w('Vac1', 0, 'R1', 0), w('R1', 1, 'C1', 0), w('C1', 1, 'Vac1', 1), w('Vac1', 1, 'GND', 0)]
    },
    scope: true,
    steps: [
      'Select C1 to put its voltage on the scope. At the cutoff frequency the output is about 71% of the input and lags it by 45°.',
      'Select Vac1 and set its frequency to 1600 Hz. The output shrinks to about a tenth: high frequencies are filtered out.',
      'Now try 16 Hz. The output almost matches the input: low frequencies pass straight through.',
      'Swap R1 and C1 and you have a high-pass filter. Try it.'
    ]
  },
  {
    id: 'rlc-resonance',
    title: 'Series RLC resonance',
    category: 'AC & signals',
    level: 'Intermediate',
    summary: 'At one frequency the inductor and capacitor cancel out.',
    concept: 'Resonance: f₀ = 1 ÷ (2π√(LC)). There the current is limited only by R.',
    circuit: {
      components: [
        c('Vac1', 'ac_voltage_source', 140, 300, { value: 10, frequency: 5033 }),
        c('R1', 'resistor', 320, 180, { value: 100 }),
        c('L1', 'inductor', 500, 180, { value: 1e-3 }),
        c('C1', 'capacitor', 680, 280, { value: 1e-6, rotation: V }),
        c('GND', 'ground', 140, 420)
      ],
      wires: [w('Vac1', 0, 'R1', 0), w('R1', 1, 'L1', 0), w('L1', 1, 'C1', 0), w('C1', 1, 'Vac1', 1), w('Vac1', 1, 'GND', 0)]
    },
    scope: true,
    steps: [
      'With 1 mH and 1 µF, resonance is at about 5033 Hz. Select R1: the current is the maximum possible, 10 V ÷ 100 Ω = 100 mA peak.',
      'Set the source to 2000 Hz, then 12000 Hz. The current drops sharply either side of resonance.',
      'Select L1 and C1 at resonance. Each has a large voltage, but they are opposite in phase and cancel.',
      'Lower R1 to 10 Ω for a sharper, higher peak (a higher “Q”).'
    ]
  },

  // ── Power & wiring ─────────────────────────────────────────────────────────
  {
    id: 'battery-sag',
    title: 'A real battery under load',
    category: 'Power & wiring',
    level: 'Beginner',
    summary: 'Draw more current and the battery’s voltage sags, and it drains faster.',
    concept: 'A battery is an ideal voltage behind a small internal resistance: V = OCV − I × r.',
    circuit: {
      components: [
        c('B1', 'battery', 180, 300, { chemistry: 'alkaline_9v', rotation: V }),
        c('R1', 'resistor', 420, 300, { value: 100, rating: 2, rotation: V, label: 'Light load' }),
        c('SW1', 'switch', 580, 220, { closed: false, rotation: V }),
        c('R2', 'resistor', 580, 360, { value: 15, rating: 10, rotation: V, label: 'Heavy load' }),
        c('VM1', 'voltmeter', 300, 300, { rotation: V }),
        c('GND', 'ground', 180, 440)
      ],
      wires: [
        w('B1', 0, 'VM1', 0),
        w('VM1', 0, 'R1', 0),
        w('R1', 0, 'SW1', 0),
        w('SW1', 1, 'R2', 0),
        w('B1', 1, 'VM1', 1),
        w('VM1', 1, 'R1', 1),
        w('R1', 1, 'R2', 1),
        w('B1', 1, 'GND', 0)
      ]
    },
    steps: [
      'A fresh 9 V alkaline reads about 9.5 V with only the 100 Ω light load: it delivers under 0.1 A. Select B1 to see its charge and internal resistance.',
      'Double-click SW1 to add the 15 Ω heavy load. The voltmeter sags by about a volt: 0.65 A through roughly 1.7 Ω of internal resistance.',
      'Watch “time left” on B1 shrink. Speed the sim up and the charge bar drains, and the voltage falls as it empties.',
      'Change B1’s chemistry to Li-ion (2 cells). Its internal resistance is tiny, so the sag almost disappears. That is why power tools use lithium packs.'
    ],
    view: 'split'
  },
  {
    id: 'long-wire-drop',
    title: 'Long wires and voltage drop',
    category: 'Power & wiring',
    level: 'Intermediate',
    summary: 'A 12 V lamp at the end of a 10 m run of thin wire gets much less than 12 V.',
    concept: 'Wire is a resistor too: R = ρ × length ÷ area. Thin, long runs waste voltage as heat.',
    circuit: {
      components: [
        c('PS1', 'bench_supply', 180, 300, { value: 12, currentLimit: 10, rotation: V }),
        c('R1', 'resistor', 640, 300, { value: 1.44, rating: 150, rotation: V, label: 'Lamp 100 W' }),
        c('VM1', 'voltmeter', 780, 300, { rotation: V }),
        c('GND', 'ground', 180, 440)
      ],
      wires: [
        w('PS1', 0, 'R1', 0, { gauge: 18, length: 10 }),
        w('R1', 1, 'PS1', 1, { gauge: 18, length: 10 }),
        w('R1', 0, 'VM1', 0),
        w('R1', 1, 'VM1', 1),
        w('PS1', 1, 'GND', 0)
      ]
    },
    steps: [
      'Each wire to the lamp is 10 m of 18 AWG: about 0.21 Ω each way. The lamp sees only about 9.3 V and draws about 6.5 A.',
      'Select a long wire and look at its voltage drop. About 1.4 V is lost in each wire, warming it instead of lighting the lamp.',
      'Change both long wires to 12 AWG. Thicker copper has a quarter of the resistance, so the lamp gets back above 11 V.',
      'Now try 22 AWG (rated about 3 A). The lamp drops to about 7 V and the wire glows: it is carrying well over its rating. Push enough current and a wire melts open.',
      'Use 🔍 “Look inside the wire” to see why: the same current squeezed through a smaller copper area makes the electrons drift faster.'
    ],
    view: 'split'
  },
  {
    id: 'bench-current-limit',
    title: 'Bench supply current limit',
    category: 'Power & wiring',
    level: 'Beginner',
    summary: 'A current-limited supply can run an LED with no resistor, until you raise the limit.',
    concept: 'A bench supply holds its voltage (CV) until the load wants more than the limit, then holds the current (CC) and lets the voltage drop.',
    circuit: {
      components: [
        c('PS1', 'bench_supply', 180, 300, { value: 12, currentLimit: 0.02, rotation: V }),
        c('A1', 'ammeter', 380, 180),
        c('LED1', 'led', 580, 180),
        c('GND', 'ground', 180, 440)
      ],
      wires: [w('PS1', 0, 'A1', 0), w('A1', 1, 'LED1', 0), w('LED1', 1, 'PS1', 1), w('PS1', 1, 'GND', 0)]
    },
    steps: [
      'The supply is set to 12 V with a 20 mA limit. An LED on 12 V with no resistor would normally burn out instantly.',
      'Instead the supply switches to CC (constant current): its display drops to about 2 V and the ammeter reads 20 mA. The LED is happy.',
      'Select PS1 and raise the current limit to 0.1 A. The LED is pushed to 100 mA and burns out within a second.',
      'Set the limit back to 0.02 A and replace the LED. Engineers set a low current limit when powering an untested circuit for the first time.'
    ]
  },

  // ── Protection & safety ────────────────────────────────────────────────────
  {
    id: 'breaker-overload',
    title: 'Overloaded circuit & breaker',
    category: 'Protection & safety',
    level: 'Beginner',
    summary: 'Turn on one appliance too many and the breaker trips.',
    concept: 'A 15 A breaker protects the wiring: about 1800 W at 120 V before it trips.',
    circuit: {
      components: [
        c('Vac1', 'ac_voltage_source', 120, 300, { value: 170, frequency: 60, label: 'Mains 120 V' }),
        c('CB1', 'breaker', 260, 160, { value: 15, closed: true }),
        c('SW1', 'switch', 460, 220, { closed: true, rotation: V }),
        c('SW2', 'switch', 600, 220, { closed: false, rotation: V }),
        c('SW3', 'switch', 740, 220, { closed: true, rotation: V }),
        c('R1', 'resistor', 460, 340, { value: 14.4, rating: 2000, rotation: V, label: 'Heater 1 kW' }),
        c('R2', 'resistor', 600, 340, { value: 12, rating: 2000, rotation: V, label: 'Microwave 1.2 kW' }),
        c('R3', 'resistor', 740, 340, { value: 144, rating: 200, rotation: V, label: 'Lamp 100 W' }),
        c('GND', 'ground', 120, 420)
      ],
      wires: [
        w('Vac1', 0, 'CB1', 0, AWG14),
        w('CB1', 1, 'SW1', 0, AWG14),
        w('SW1', 0, 'SW2', 0, AWG14),
        w('SW2', 0, 'SW3', 0, AWG14),
        w('SW1', 1, 'R1', 0, AWG14),
        w('SW2', 1, 'R2', 0, AWG14),
        w('SW3', 1, 'R3', 0, AWG14),
        w('R1', 1, 'Vac1', 1, AWG14),
        w('R1', 1, 'R2', 1, AWG14),
        w('R2', 1, 'R3', 1, AWG14),
        w('Vac1', 1, 'GND', 0, AWG14)
      ]
    },
    steps: [
      'The heater and lamp are on: about 9 A from a 120 V supply (170 V peak). Select CB1 to see its load.',
      'Double-click SW2 to switch on the microwave too. The total jumps to about 18 A and the breaker trips within a second.',
      'Turn something off, then reset CB1 from the Inspector. It holds again.',
      'The wires are 14 AWG, rated about 15 A. Select one and change it to 22 AWG (rated about 3 A): it melts at the normal 9 A load, long before the 15 A breaker reacts. That is why the breaker must match the wire.',
      'This is a simulation. Real mains wiring is dangerous: always leave it to a licensed electrician.'
    ]
  }
]

export const EXAMPLE_CATEGORIES: ExampleCategory[] = ['Basics', 'Power & wiring', 'Time & energy', 'AC & signals', 'Protection & safety']

export function getExample(id: string): ExampleCircuit | undefined {
  return EXAMPLES.find((e) => e.id === id)
}
