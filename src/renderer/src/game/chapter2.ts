/**
 * Volt — Campaign Chapter 2 · Real Power
 *
 * Built on Step 5: real batteries (internal resistance, runtime), copper wire
 * with a gauge and a length, and a current-limited bench supply. Two Predict
 * missions and two Fix missions.
 */
import type { CircuitComponent, Wire } from '../sim/elements'
import type { Level } from './types'

const c = (id: string, type: CircuitComponent['type'], x: number, y: number, extra: Partial<CircuitComponent> = {}): CircuitComponent => ({
  id,
  type,
  x,
  y,
  rotation: 0,
  label: id,
  ...extra
})
const w = (a: string, at: number, b: string, bt: number, extra: Partial<Wire> = {}): Wire => ({
  id: `w-${a}${at}-${b}${bt}`,
  fromComponentId: a,
  fromTerminal: at,
  toComponentId: b,
  toTerminal: bt,
  ...extra
})
const V = 90

// ── 1. Under Load (Predict) ─────────────────────────────────────────────────
const underLoad: Level = {
  id: 'c2-l1',
  chapterId: 'c2',
  type: 'predict',
  title: 'Under Load',
  concept: 'A battery is an ideal voltage behind an internal resistance: V = OCV − I × r.',
  brief:
    'Your 9 V battery reads 9.5 V with a light 100 Ω load. You need to add a heavy load: a 15 Ω resistor in parallel with the first. Before you build it, predict what the voltmeter will read. Hint: a 9 V alkaline has about 1.7 Ω inside it.',
  starter: {
    components: [
      c('B1', 'battery', 180, 300, { chemistry: 'alkaline_9v', rotation: V }),
      c('VM1', 'voltmeter', 320, 300, { rotation: V }),
      c('R1', 'resistor', 460, 300, { value: 100, rating: 2, rotation: V, label: 'Light load' }),
      c('GND', 'ground', 180, 440)
    ],
    wires: [w('B1', 0, 'VM1', 0), w('VM1', 0, 'R1', 0), w('B1', 1, 'VM1', 1), w('VM1', 1, 'R1', 1), w('B1', 1, 'GND', 0)]
  },
  palette: ['resistor', 'wire_node'],
  predict: { prompt: 'Battery voltage with both loads connected', unit: 'V', measure: { kind: 'voltage', a: 'B1:0', b: 'B1:1' } },
  goals: [{ kind: 'measure', measure: { kind: 'current', id: 'B1' }, min: 0.55, max: 0.9, label: 'Draw 0.55–0.9 A from the battery' }],
  holdSeconds: 1,
  stars: [
    { kind: 'prediction', tolerance: 0.05, label: 'Prediction within 5%' },
    { kind: 'no_burnouts', label: 'Nothing overheated' }
  ],
  hints: [
    'Put a 15 Ω resistor across R1: one end to the top rail, the other to the bottom rail.',
    'Total load ≈ 100 Ω ∥ 15 Ω ≈ 13 Ω. Add the battery’s ~1.7 Ω: I ≈ 9.6 V ÷ 14.7 Ω ≈ 0.65 A.',
    'The battery loses I × r ≈ 0.65 A × 1.7 Ω ≈ 1.1 V inside itself, so the meter reads about 8.5 V.'
  ],
  debrief:
    'A real battery has resistance inside it. The more current you draw, the more voltage it loses internally (I × r), so the terminal voltage sags under load. That is why a flashlight dims when a motor starts on the same battery, and why big currents need low-resistance lithium cells.',
  xp: 150,
  solution: {
    components: [c('R2', 'resistor', 600, 300, { value: 15, rating: 10, rotation: V, label: 'Heavy load' })],
    wires: [w('R1', 0, 'R2', 0), w('R1', 1, 'R2', 1)],
    prediction: 8.5
  }
}

// ── 2. Long Life ────────────────────────────────────────────────────────────
const longLife: Level = {
  id: 'c2-l2',
  chapterId: 'c2',
  type: 'build',
  title: 'Long Life',
  concept: 'Battery life ≈ capacity (Ah) ÷ current (A).',
  brief:
    'A trail marker light has to run for two days on one 9 V battery. The battery holds about 0.5 Ah. Pick a resistor that keeps the LED visibly lit (at least 4 mA) but lets the battery last 40 hours or more.',
  starter: {
    components: [c('B1', 'battery', 200, 300, { chemistry: 'alkaline_9v', rotation: V }), c('LED1', 'led', 520, 180), c('GND', 'ground', 200, 440)],
    wires: [w('LED1', 1, 'B1', 1), w('B1', 1, 'GND', 0)]
  },
  palette: ['resistor', 'wire_node'],
  goals: [
    { kind: 'all_leds_lit', min: 0.004, max: 0.03, label: 'LED lit (at least 4 mA)' },
    { kind: 'battery_runtime', id: 'B1', hours: 40, label: 'Battery lasts 40 hours or more' }
  ],
  holdSeconds: 1,
  stars: [
    { kind: 'led_current_band', min: 0.008, max: 0.0125, label: 'Bright but thrifty: 8–12.5 mA' },
    { kind: 'max_parts', max: 3, label: 'Just one resistor' }
  ],
  hints: [
    '40 hours from 0.5 Ah means the current must stay below 0.5 ÷ 40 = 12.5 mA.',
    'The resistor drops about 9.6 V − 2 V ≈ 7.6 V. For 10 mA: R = 7.6 ÷ 0.01 = 760 Ω.',
    'Try 820 Ω: about 9 mA, and select the battery to see its “time left”.'
  ],
  debrief:
    'Capacity is current × time. Half an amp-hour runs 10 mA for 50 hours, or 500 mA for one hour. Engineers budget current exactly like this: pick the brightness you need, then check the battery life.',
  xp: 150,
  solution: {
    components: [c('R1', 'resistor', 360, 180, { value: 820 })],
    wires: [w('B1', 0, 'R1', 0), w('R1', 1, 'LED1', 0)]
  }
}

// ── 3. Melted! (Fix) ────────────────────────────────────────────────────────
const melted: Level = {
  id: 'c2-l3',
  chapterId: 'c2',
  type: 'fix',
  title: 'Melted!',
  concept: 'Every wire gauge has a current rating (ampacity). Thicker wire (smaller AWG number) carries more.',
  brief:
    'Someone wired a 100 W, 12 V work lamp with thin 22 AWG hookup wire, and both wires melted. Replace them with wire that can carry the lamp’s current (about 8 A) without running past its rating.',
  starter: {
    components: [
      c('PS1', 'bench_supply', 180, 300, { value: 12, currentLimit: 10, rotation: V }),
      c('R1', 'resistor', 480, 300, { value: 1.44, rating: 150, rotation: V, label: 'Lamp 100 W' }),
      c('GND', 'ground', 180, 440)
    ],
    wires: [w('PS1', 0, 'R1', 0, { damaged: true }), w('R1', 1, 'PS1', 1, { damaged: true }), w('PS1', 1, 'GND', 0)]
  },
  palette: ['wire_node'],
  goals: [
    { kind: 'wires_intact', label: 'No melted wires' },
    { kind: 'measure', measure: { kind: 'current', id: 'R1' }, min: 7, max: 9, label: 'Lamp drawing 7–9 A' },
    { kind: 'wires_within_rating', label: 'Every wire within its rating' }
  ],
  holdSeconds: 2,
  stars: [
    { kind: 'no_burnouts', label: 'Didn’t melt another wire' },
    { kind: 'wire_awg_range', min: 14, max: 16, wires: ['w-PS10-R10', 'w-R11-PS11'], label: 'Right-sized: 14–16 AWG, no wasted copper' }
  ],
  hints: [
    'Select a melted wire. Before you press “Replace wire”, change its gauge, or it will melt again.',
    'The lamp draws 12 V ÷ 1.44 Ω ≈ 8.3 A. Look at the gauge list: each one shows its rating.',
    '18 AWG is rated 7 A (too small). 16 AWG is rated 10 A. Set both wires to 16 AWG, then replace them.'
  ],
  debrief:
    'Current heats a wire (P = I²R), and a thin wire has more resistance per metre, so it heats more. Ampacity is the current a gauge can carry without overheating its insulation. Matching the wire to the load is the first rule of safe wiring, from a work lamp to a whole house.',
  xp: 150,
  solution: {
    components: [],
    wires: [],
    wirePatches: { 'w-PS10-R10': { gauge: 16, damaged: false }, 'w-R11-PS11': { gauge: 16, damaged: false } }
  }
}

// ── 4. The Long Run ─────────────────────────────────────────────────────────
const longRun: Level = {
  id: 'c2-l4',
  chapterId: 'c2',
  type: 'build',
  title: 'The Long Run',
  concept: 'Wire resistance = resistivity × length ÷ area. Long runs need thicker wire.',
  brief:
    'The same 12 V lamp now sits at the end of a 10 m run, each way, of 18 AWG. It only gets about 9.3 V and looks dim. Choose a gauge that delivers at least 11 V to the lamp, without buying thicker copper than you need.',
  starter: {
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
  palette: ['wire_node'],
  goals: [
    { kind: 'measure', measure: { kind: 'voltage', a: 'R1:0', b: 'R1:1' }, min: 11, max: 12.5, label: 'At least 11 V at the lamp' },
    { kind: 'wires_within_rating', label: 'Every wire within its rating' }
  ],
  holdSeconds: 1,
  stars: [
    { kind: 'no_burnouts', label: 'Nothing melted' },
    { kind: 'wire_awg_range', min: 12, max: 12, wires: ['w-PS10-R10', 'w-R11-PS11'], label: 'Thinnest gauge that works' }
  ],
  hints: [
    'Select one of the long wires: the Inspector shows its resistance and voltage drop.',
    'Each step of 6 AWG numbers halves the diameter… or roughly every 3 numbers doubles the area and halves the resistance.',
    '14 AWG gets the lamp to about 10.8 V, not quite enough. 12 AWG gets it past 11 V.'
  ],
  debrief:
    'Both wires are part of the circuit, so a 10 m run is really 20 m of copper in series with the lamp. Every volt lost in the wire is wasted as heat. Electricians limit voltage drop to about 3–5% by going up in gauge for long runs; you will meet this again in Home Power.',
  xp: 150,
  solution: {
    components: [],
    wires: [],
    wirePatches: { 'w-PS10-R10': { gauge: 12 }, 'w-R11-PS11': { gauge: 12 } }
  }
}

// ── 5. Current Limit (Predict) ──────────────────────────────────────────────
const currentLimit: Level = {
  id: 'c2-l5',
  chapterId: 'c2',
  type: 'predict',
  title: 'Current Limit',
  concept: 'A bench supply holds its voltage (CV) until the load wants more than the limit, then holds the current (CC).',
  brief:
    'Power a bare LED from the 12 V bench supply, with no resistor, by setting the supply’s current limit to about 20 mA. Careful: it’s set to 1 A now, which would cook the LED. Before you connect it, predict what voltage the supply will show once it is limiting the current.',
  starter: {
    components: [
      c('PS1', 'bench_supply', 180, 300, { value: 12, currentLimit: 1, rotation: V }),
      c('A1', 'ammeter', 380, 180),
      c('LED1', 'led', 580, 180),
      c('GND', 'ground', 180, 440)
    ],
    wires: [w('PS1', 0, 'A1', 0), w('A1', 1, 'LED1', 0), w('PS1', 1, 'GND', 0)]
  },
  palette: ['wire_node'],
  predict: { prompt: 'Supply output voltage while it is limiting to 20 mA', unit: 'V', measure: { kind: 'voltage', a: 'PS1:0', b: 'PS1:1' } },
  goals: [
    { kind: 'all_leds_lit', min: 0.015, max: 0.025, label: 'LED at 15–25 mA' },
    { kind: 'supply_mode', id: 'PS1', mode: 'CC', label: 'Supply in CC (current-limit) mode' }
  ],
  holdSeconds: 1,
  stars: [
    { kind: 'prediction', tolerance: 0.1, label: 'Prediction within 10%' },
    { kind: 'no_burnouts', label: 'The LED survived' }
  ],
  hints: [
    'Select PS1 and set its current limit to 0.02 A first. Then wire the LED’s right side to the supply’s − terminal.',
    'In CC mode the supply lowers its voltage until only the limit current flows.',
    'An LED needs only about 2 V to pass 20 mA, so that is roughly what the display will show, not 12 V.'
  ],
  debrief:
    'The supply’s 12 V is a ceiling, not a promise. In constant-current mode it outputs whatever voltage pushes exactly the limit current through the load: here about 2 V, the LED’s forward voltage. Setting a low current limit is how engineers safely power a circuit for the first time.',
  xp: 150,
  solution: {
    components: [],
    wires: [w('LED1', 1, 'PS1', 1)],
    componentPatches: { PS1: { currentLimit: 0.02 } },
    prediction: 2
  }
}

// ── 6. Porch Light (Fix) ────────────────────────────────────────────────────
const porchLight: Level = {
  id: 'c2-l6',
  chapterId: 'c2',
  type: 'fix',
  title: 'Porch Light',
  concept: 'Troubleshoot with meters: find where the voltage stops, then fix what’s there.',
  brief:
    'A 12 V porch light runs off a lead-acid battery, and it won’t light. There are two faults. Use the voltmeter to find them, repair them, and get the LED glowing at 15–30 mA.',
  starter: {
    components: [
      c('B1', 'battery', 180, 300, { chemistry: 'leadacid', rotation: V }),
      c('SW1', 'switch', 340, 180, { closed: true }),
      c('R1', 'resistor', 500, 180, { value: 470 }),
      c('LED1', 'led', 680, 180),
      c('GND', 'ground', 180, 440)
    ],
    // the LED is wired backwards, and its return wire has melted open
    wires: [w('B1', 0, 'SW1', 0), w('SW1', 1, 'R1', 0), w('R1', 1, 'LED1', 1), w('LED1', 0, 'B1', 1, { damaged: true }), w('B1', 1, 'GND', 0)]
  },
  palette: ['voltmeter', 'ammeter', 'wire_node'],
  goals: [
    { kind: 'all_leds_lit', min: 0.015, max: 0.03, label: 'LED at 15–30 mA' },
    { kind: 'wires_intact', label: 'No broken wires' }
  ],
  holdSeconds: 1,
  stars: [
    { kind: 'no_burnouts', label: 'Nothing burned out' },
    { kind: 'max_parts', max: 6, label: 'Repair, don’t rebuild (6 parts or fewer)' }
  ],
  hints: [
    'One wire is drawn red and dashed: it has melted open. Select it and press “Replace wire”.',
    'Even with that fixed, no current flows. Look at the LED: current must enter its left side (the anode, the flat side of the triangle) and leave from the bar.',
    'The resistor is wired to the LED’s right side. Delete both LED wires (right-click, or select + Delete wire) and wire resistor → LED left, LED right → battery −.'
  ],
  debrief:
    'Real troubleshooting is a search: an open wire stops all current, and an LED (a diode) only conducts one way. Measuring voltages point by point tells you where the circuit is broken: full voltage across a gap means the break is there.',
  xp: 150,
  solution: {
    components: [],
    removeWires: ['w-R11-LED11', 'w-LED10-B11'],
    wires: [w('R1', 1, 'LED1', 0), w('LED1', 1, 'B1', 1)]
  }
}

export const CHAPTER2_LEVELS: Level[] = [underLoad, longLife, melted, longRun, currentLimit, porchLight]
