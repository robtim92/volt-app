/**
 * Volt — Campaign content
 *
 * Chapter 1 · Light It Up — from "close the loop" to an LED that keeps glowing
 * after the battery is disconnected. Every level ships a reference solution
 * that the test suite plays through the live simulator, so no level can ship
 * unsolvable.
 */
import type { CircuitComponent, Wire } from '../sim/elements'
import type { Chapter, Level } from './types'
import { CHAPTER2_LEVELS } from './chapter2'
import { CHAPTER5_LEVELS } from './chapter5'

const c = (
  id: string,
  type: CircuitComponent['type'],
  x: number,
  y: number,
  extra: Partial<CircuitComponent> = {}
): CircuitComponent => ({ id, type, x, y, rotation: 0, label: id, ...extra })

const w = (a: string, at: number, b: string, bt: number): Wire => ({
  id: `w-${a}${at}-${b}${bt}`,
  fromComponentId: a,
  fromTerminal: at,
  toComponentId: b,
  toTerminal: bt
})

const LED_OK = { min: 0.005, max: 0.03 }

// ── 1. Close the Loop ────────────────────────────────────────────────────────
const closeTheLoop: Level = {
  id: 'c1-l1',
  chapterId: 'c1',
  title: 'Close the Loop',
  concept: 'Current only flows around a complete loop.',
  brief:
    'The workshop is dark. On the bench: a 9 V battery, a 470 Ω resistor and an LED. Wire them into one loop — battery (+) through the resistor and LED and back to (−) — and get some light in here. Drag from a terminal dot to another terminal to make a wire.',
  starter: {
    components: [
      c('V1', 'voltage_source', 200, 300, { value: 9 }),
      c('R1', 'resistor', 400, 180, { value: 470 }),
      c('LED1', 'led', 600, 300, { rotation: 90 })
    ],
    wires: []
  },
  palette: ['wire_node'],
  goals: [{ kind: 'all_leds_lit', ...LED_OK, label: 'The LED is lit' }],
  stars: [
    { kind: 'no_burnouts', label: 'Nothing burned out' },
    { kind: 'max_parts', max: 3, label: 'Used only the parts on the bench' }
  ],
  hints: [
    'Every wire joins two terminal dots. You need three wires to make one loop.',
    'Battery + → resistor (either end). Other resistor end → LED top (the anode). LED bottom (cathode) → battery −.',
    'An LED only conducts one way: current goes in the anode (triangle side) and out the cathode (bar side).'
  ],
  debrief:
    'Electric current needs a closed path from the source’s + terminal back to its − terminal. Break the loop anywhere and the current stops everywhere. The resistor limits the current to about (9 V − 2 V) ÷ 470 Ω ≈ 15 mA, which the LED is happy with.',
  xp: 100,
  unlocks: ['resistor', 'led', 'voltage_source'],
  solution: {
    components: [],
    wires: [w('V1', 0, 'R1', 0), w('R1', 1, 'LED1', 0), w('LED1', 1, 'V1', 1)]
  }
}

// ── 2. Magic Smoke ───────────────────────────────────────────────────────────
const magicSmoke: Level = {
  id: 'c1-l2',
  chapterId: 'c1',
  title: 'Let the Smoke Out (or Don’t)',
  concept: 'A series resistor limits current — Ohm’s law: R = V ÷ I.',
  brief:
    'The last apprentice wired this LED straight to the 9 V battery. It glowed for a heartbeat, then smoked. Add a resistor so the LED runs at a safe 10–25 mA. An LED drops about 2 V, so the resistor has to soak up the rest. Try it on purpose without a resistor first if you’re curious — you can replace burnt parts from the Inspector.',
  starter: {
    components: [
      c('V1', 'voltage_source', 200, 300, { value: 9 }),
      c('LED1', 'led', 520, 180)
    ],
    wires: [w('LED1', 1, 'V1', 1)]
  },
  palette: ['resistor', 'wire_node'],
  goals: [{ kind: 'all_leds_lit', min: 0.01, max: 0.025, label: 'LED current between 10 mA and 25 mA' }],
  stars: [
    { kind: 'no_burnouts', label: 'Nothing burned out' },
    { kind: 'led_current_band', min: 0.017, max: 0.022, label: 'Hit the 20 mA sweet spot (17–22 mA)' }
  ],
  hints: [
    'Place a resistor between the battery’s + terminal and the LED’s anode (left side).',
    'Voltage across the resistor ≈ 9 V − 2 V = 7 V. For 20 mA: R = 7 V ÷ 0.02 A.',
    '7 ÷ 0.02 = 350 Ω. Real resistors come in standard values — 330 Ω or 390 Ω both land near 20 mA. Edit the value in the Inspector.'
  ],
  debrief:
    'Ohm’s law sets the current: I = V ÷ R. The resistor sees the battery voltage minus the LED’s ~2 V drop, so 7 V across 390 Ω gives about 18 mA. Without it, nothing but the LED’s tiny internal resistance limits current — hundreds of milliamps — and the LED cooks in a fraction of a second.',
  xp: 120,
  solution: {
    components: [c('R1', 'resistor', 340, 180, { value: 390 })],
    wires: [w('V1', 0, 'R1', 0), w('R1', 1, 'LED1', 0)]
  }
}

// ── 3. Chain Reaction (series) ──────────────────────────────────────────────
const chainReaction: Level = {
  id: 'c1-l3',
  chapterId: 'c1',
  title: 'Chain Reaction',
  concept: 'In series, the same current flows through everything and the voltage drops add up.',
  brief:
    'Two LEDs, one battery, one resistor allowed. Chain them in series — one path, one after another — so both light at 10–25 mA. Each LED takes about 2 V, so there’s less left over for the resistor this time.',
  starter: {
    components: [
      c('V1', 'voltage_source', 160, 300, { value: 9 }),
      c('LED1', 'led', 460, 180),
      c('LED2', 'led', 660, 300, { rotation: 90 })
    ],
    wires: []
  },
  palette: ['resistor', 'wire_node'],
  goals: [{ kind: 'all_leds_lit', min: 0.01, max: 0.025, count: 2, label: 'Both LEDs between 10 mA and 25 mA' }],
  stars: [
    { kind: 'no_burnouts', label: 'Nothing burned out' },
    { kind: 'max_parts', max: 4, label: 'Only one resistor' }
  ],
  hints: [
    'Series means a single loop: battery + → resistor → LED1 → LED2 → battery −.',
    'Two LEDs drop about 4 V together, leaving ~5 V for the resistor.',
    '5 V ÷ 0.02 A = 250 Ω. Try 220 Ω or 270 Ω.'
  ],
  debrief:
    'There’s only one path, so the same current flows through every part — one resistor can protect both LEDs. The voltages add: ~2 V + ~2 V for the LEDs plus ~5 V across the resistor equals the battery’s 9 V. That’s Kirchhoff’s voltage law.',
  xp: 140,
  solution: {
    components: [c('R1', 'resistor', 300, 180, { value: 270 })],
    wires: [w('V1', 0, 'R1', 0), w('R1', 1, 'LED1', 0), w('LED1', 1, 'LED2', 0), w('LED2', 1, 'V1', 1)]
  }
}

// ── 4. Branch Out (parallel) ────────────────────────────────────────────────
const branchOut: Level = {
  id: 'c1-l4',
  chapterId: 'c1',
  title: 'Branch Out',
  concept: 'Parallel branches each get the full voltage; their currents add at the source.',
  brief:
    'A 5 V USB supply can’t push current through two LEDs in series with room to spare. Wire the LEDs in parallel instead — side by side, each across the supply with its own resistor — so both light at 10–25 mA.',
  starter: {
    components: [
      c('V1', 'voltage_source', 160, 300, { value: 5 }),
      c('LED1', 'led', 560, 180),
      c('LED2', 'led', 560, 420)
    ],
    wires: []
  },
  palette: ['resistor', 'wire_node'],
  goals: [{ kind: 'all_leds_lit', min: 0.01, max: 0.025, count: 2, label: 'Both LEDs between 10 mA and 25 mA' }],
  stars: [
    { kind: 'no_burnouts', label: 'Nothing burned out' },
    { kind: 'source_current_max', max: 0.045, label: 'Supply current under 45 mA' }
  ],
  hints: [
    'Each branch is its own little loop: + → resistor → LED → −. Both branches share the supply’s two terminals.',
    'Each resistor sees 5 V − 2 V = 3 V. For 20 mA: 3 ÷ 0.02 = 150 Ω.',
    'The supply delivers the sum of the branch currents: 20 mA + 20 mA = 40 mA.'
  ],
  debrief:
    'Every parallel branch sits across the full 5 V, so each LED gets its own current, set by its own resistor. At the supply the branch currents add — Kirchhoff’s current law. That’s why adding more parallel loads draws more current from the source.',
  xp: 160,
  solution: {
    components: [
      c('R1', 'resistor', 360, 180, { value: 150 }),
      c('R2', 'resistor', 360, 420, { value: 150 })
    ],
    wires: [
      w('V1', 0, 'R1', 0),
      w('R1', 1, 'LED1', 0),
      w('LED1', 1, 'V1', 1),
      w('V1', 0, 'R2', 0),
      w('R2', 1, 'LED2', 0),
      w('LED2', 1, 'V1', 1)
    ]
  }
}

// ── 5. Afterglow (RC) ────────────────────────────────────────────────────────
const afterglow: Level = {
  id: 'c1-l5',
  chapterId: 'c1',
  title: 'Afterglow',
  concept: 'A capacitor stores charge and releases it over time — the RC time constant.',
  brief:
    'Make a night-light that keeps glowing after the power is cut. Add a capacitor so that when you open the switch (double-click it), the LED stays lit for at least a full second on stored charge alone.',
  starter: {
    components: [
      c('V1', 'voltage_source', 160, 300, { value: 9 }),
      c('SW1', 'switch', 320, 180, { closed: true }),
      c('R1', 'resistor', 500, 180, { value: 470 }),
      c('LED1', 'led', 680, 300, { rotation: 90 })
    ],
    wires: [w('V1', 0, 'SW1', 0), w('SW1', 1, 'R1', 0), w('R1', 1, 'LED1', 0), w('LED1', 1, 'V1', 1)]
  },
  palette: ['capacitor', 'wire_node'],
  goals: [
    { kind: 'switch_open', label: 'The switch is open (power cut)' },
    { kind: 'source_current_max', max: 1e-4, label: 'No current from the battery' },
    { kind: 'leds_lit', count: 1, min: 0.001, max: 0.03, label: 'The LED is still lit' }
  ],
  holdSeconds: 1,
  stars: [
    { kind: 'no_burnouts', label: 'Nothing burned out' },
    { kind: 'max_parts', max: 5, label: 'Just one capacitor' }
  ],
  hints: [
    'Put the capacitor where it can feed the resistor and LED after the switch opens: from the switch’s right terminal to the battery’s − terminal.',
    'The glow lasts roughly a few × R × C. With 470 Ω, 470 µF gives τ ≈ 0.2 s — not enough.',
    'Try 2200 µF (type “2200u” in the Inspector). Close the switch to charge it, wait a moment, then double-click the switch to open it.'
  ],
  debrief:
    'While the switch is closed the capacitor charges to 9 V. When it opens, the capacitor becomes the power source and discharges through the resistor and LED. The current fades with time constant τ = R × C — 470 Ω × 2200 µF ≈ 1 s — so a bigger capacitor (or resistor) means a longer afterglow.',
  xp: 200,
  unlocks: ['capacitor', 'switch'],
  solution: {
    components: [c('C1', 'capacitor', 500, 420, { value: 2200e-6, rotation: 90 })],
    wires: [w('SW1', 1, 'C1', 0), w('C1', 1, 'V1', 1)],
    actions: [{ at: 1.5, toggle: 'SW1' }]
  }
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'c1',
    number: 1,
    title: 'Light It Up',
    subtitle: 'Loops, resistors, series & parallel, and your first capacitor',
    icon: '💡',
    levels: [closeTheLoop, magicSmoke, chainReaction, branchOut, afterglow]
  },
  {
    id: 'c2',
    number: 2,
    title: 'Real Power',
    subtitle: 'Batteries that sag and drain, wire that heats, and a current-limited supply',
    icon: '🔋',
    levels: CHAPTER2_LEVELS,
    requires: { chapter: 'c1', stars: 8 }
  },
  {
    id: 'c5',
    number: 5,
    title: 'Home Power',
    subtitle: 'Breakers, voltage drop, hidden faults and the service load calculation',
    icon: '🏠',
    levels: CHAPTER5_LEVELS,
    requires: { chapter: 'c2', stars: 10 }
  }
]

/** Chapters planned but not built yet (shown on the map as coming soon). */
export const COMING_SOON = [
  { number: 3, title: 'Time & Diodes', icon: '⏱️', subtitle: 'RC timers, blinkers, rectifiers and flyback diodes' },
  { number: 4, title: 'AC & Protection', icon: '〰️', subtitle: 'The scope, transformers, breakers and GFCIs' }
]

export const chapterOf = (levelId: string): Chapter | undefined => CHAPTERS.find((ch) => ch.levels.some((l) => l.id === levelId))

export const ALL_LEVELS: Level[] = CHAPTERS.flatMap((ch) => ch.levels)

export function getLevel(id: string): Level | undefined {
  return ALL_LEVELS.find((l) => l.id === id)
}

/** The level after `id` (within the campaign), if any. */
export function nextLevel(id: string): Level | undefined {
  const ch = chapterOf(id)
  if (!ch) return undefined
  const i = ch.levels.findIndex((l) => l.id === id)
  return ch.levels[i + 1]
}
