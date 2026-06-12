/**
 * Volt — DC Track lessons (Modules 1–3)
 *
 * Written for the curious adult hobbyist: intuition and analogy first,
 * formulas second, jargon always explained. All circuit presets are verified
 * solvable by the content test suite.
 */
import type { CircuitComponent, CircuitPreset, Lesson, Wire } from './types'

// ── Preset helpers ───────────────────────────────────────────────────────────

let id = 0
const c = (
  type: CircuitComponent['type'],
  x: number,
  y: number,
  extra: Partial<CircuitComponent> = {}
): CircuitComponent => ({
  id: `p${++id}`,
  type,
  x,
  y,
  rotation: 0,
  ...extra
})
const w = (
  from: CircuitComponent,
  fromTerminal: number,
  to: CircuitComponent,
  toTerminal: number
): Wire => ({
  id: `pw${++id}`,
  fromComponentId: from.id,
  fromTerminal,
  toComponentId: to.id,
  toTerminal
})

/** 9V battery driving a 1kΩ resistor through an ammeter. */
function ohmsLawPreset(): CircuitPreset {
  const v1 = c('voltage_source', 180, 160, { value: 9, label: 'V1' })
  const am = c('ammeter', 400, 160, { label: 'AM1' })
  const r1 = c('resistor', 620, 160, { value: 1000, label: 'R1' })
  const gnd = c('ground', 180, 320, { label: 'GND1' })
  return {
    components: [v1, am, r1, gnd],
    wires: [
      w(v1, 0, am, 0),
      w(am, 1, r1, 0),
      w(r1, 1, v1, 1),
      w(v1, 1, gnd, 0)
    ]
  }
}

/** Two resistors in series with a voltmeter across the second. */
function seriesPreset(): CircuitPreset {
  const v1 = c('voltage_source', 180, 160, { value: 12, label: 'V1' })
  const r1 = c('resistor', 400, 160, { value: 1000, label: 'R1' })
  const r2 = c('resistor', 620, 160, { value: 2000, label: 'R2' })
  const vm = c('voltmeter', 620, 320, { label: 'VM1' })
  const gnd = c('ground', 180, 320, { label: 'GND1' })
  return {
    components: [v1, r1, r2, vm, gnd],
    wires: [
      w(v1, 0, r1, 0),
      w(r1, 1, r2, 0),
      w(r2, 1, v1, 1),
      w(vm, 0, r2, 0),
      w(vm, 1, r2, 1),
      w(v1, 1, gnd, 0)
    ]
  }
}

/** Two resistors in parallel with an ammeter on the main branch. */
function parallelPreset(): CircuitPreset {
  const v1 = c('voltage_source', 180, 160, { value: 12, label: 'V1' })
  const am = c('ammeter', 400, 160, { label: 'AM1' })
  const j = c('wire_node', 540, 160, { label: 'N1' })
  const r1 = c('resistor', 620, 100, { value: 1000, label: 'R1' })
  const r2 = c('resistor', 620, 240, { value: 1000, label: 'R2' })
  const gnd = c('ground', 180, 320, { label: 'GND1' })
  return {
    components: [v1, am, j, r1, r2, gnd],
    wires: [
      w(v1, 0, am, 0),
      w(am, 1, j, 0),
      w(j, 0, r1, 0),
      w(j, 0, r2, 0),
      w(r1, 1, v1, 1),
      w(r2, 1, v1, 1),
      w(v1, 1, gnd, 0)
    ]
  }
}

/** LED with a current-limiting resistor and a switch. */
function ledPreset(): CircuitPreset {
  const v1 = c('voltage_source', 180, 160, { value: 5, label: 'V1' })
  const s1 = c('switch', 380, 160, { label: 'S1', closed: false })
  const r1 = c('resistor', 560, 160, { value: 220, label: 'R1' })
  const d1 = c('led', 740, 160, { label: 'D1' })
  const gnd = c('ground', 180, 320, { label: 'GND1' })
  return {
    components: [v1, s1, r1, d1, gnd],
    wires: [
      w(v1, 0, s1, 0),
      w(s1, 1, r1, 0),
      w(r1, 1, d1, 0),
      w(d1, 1, v1, 1),
      w(v1, 1, gnd, 0)
    ]
  }
}

// ── Lessons ──────────────────────────────────────────────────────────────────

export const DC_LESSONS: Lesson[] = [
  {
    id: 'dc-fund-1',
    track: 'dc',
    module: 'Fundamentals',
    title: 'Voltage, Current & Resistance',
    summary: 'The three quantities every circuit is built on — with a water analogy that actually holds up.',
    estMinutes: 8,
    cards: [
      {
        type: 'concept',
        title: 'Electricity is moving charge',
        body: `Every wire is full of electrons — tiny charged particles. When they all drift in the same direction, we call that an electric current.

Here's the surprising part: the electrons themselves crawl along slowly, but the *push* that moves them travels near the speed of light. Flip a switch and the whole circuit responds at once, like water in a hose that's already full.`
      },
      {
        type: 'concept',
        title: 'Voltage is the push',
        body: `Voltage (measured in volts, V) is the electrical pressure that pushes charge through a circuit. A 9 V battery pushes harder than a 1.5 V battery.

Think of a water tower: the higher the tank, the more pressure at the tap. Voltage is always measured *between two points* — it's a difference in pressure, not an absolute amount. That's why a bird can sit on one power line safely: both feet are at the same voltage, so nothing pushes current through the bird.`
      },
      {
        type: 'concept',
        title: 'Current is the flow',
        body: `Current (measured in amperes or "amps", A) is how much charge flows past a point per second — the gallons-per-minute of electricity.

In the simulator you'll see current animated as moving dashes along the wires. A small LED circuit might carry 0.015 A (15 milliamps, written 15 mA). A toaster pulls about 8 A. A car starter motor: over 100 A.`
      },
      {
        type: 'concept',
        title: 'Resistance is the squeeze',
        body: `Resistance (measured in ohms, Ω) is how much a material fights the flow of current. A narrow pipe resists water flow; a thin or poorly-conducting wire resists current.

Resistors are components built to have a precise, deliberate resistance. They tame current, divide voltage, and protect delicate parts like LEDs. Most circuits would burn out instantly without them.`
      },
      {
        type: 'quiz',
        question: 'A bird sits on a single high-voltage power line. Why is it unharmed?',
        choices: [
          'Feathers are good insulators',
          'Both feet are at the same voltage, so no current flows through the bird',
          'The wire current avoids living things',
          'Power lines carry no voltage, only current'
        ],
        answerIndex: 1,
        explanation: 'Current needs a voltage *difference* to flow. With both feet on the same wire, there is no pressure difference across the bird — so essentially no current takes that path.'
      },
      {
        type: 'quiz',
        question: 'Which unit measures how much charge flows per second?',
        choices: ['Volt (V)', 'Ohm (Ω)', 'Ampere (A)', 'Watt (W)'],
        answerIndex: 2,
        explanation: 'The ampere measures current — the rate of charge flow. Volts measure the push, ohms the opposition to flow.'
      },
      {
        type: 'quiz',
        question: 'In the water analogy, resistance is most like…',
        choices: [
          'The height of the water tower',
          'The width of the pipe (narrow pipe = more resistance)',
          'The amount of water in the tank',
          'The temperature of the water'
        ],
        answerIndex: 1,
        explanation: 'A narrow pipe restricts flow the way a high resistance restricts current. Tower height is voltage; flow rate is current.'
      }
    ]
  },
  {
    id: 'dc-ohm-1',
    track: 'dc',
    module: "Ohm's Law & Power",
    title: "Ohm's Law",
    summary: 'One small equation — V = I × R — that lets you predict every simple circuit before you build it.',
    estMinutes: 10,
    cards: [
      {
        type: 'concept',
        title: 'The most useful equation in electronics',
        body: `Push, flow, and squeeze are connected by one beautifully simple rule:

V = I × R

Voltage equals current times resistance. Push harder (more V) and more current flows. Resist more (more R) and less current flows. That's the whole law.

Rearranged, it answers the two questions you'll ask constantly:
I = V ÷ R — "how much current will flow?"
R = V ÷ I — "what resistor do I need?"`
      },
      {
        type: 'concept',
        title: 'Worked example',
        body: `A 9 V battery is connected across a 1 kΩ (1000 Ω) resistor. How much current flows?

I = V ÷ R
I = 9 ÷ 1000
I = 0.009 A = 9 mA

That's it. Before you ever connect anything, you know exactly what the circuit will do. Open the circuit below and check the ammeter — then try changing the resistor to 500 Ω or the battery to 4.5 V and predict the reading before you look.`,
        circuit: undefined,
        circuitLabel: undefined
      },
      {
        type: 'concept',
        title: 'See it live',
        body: `This circuit is the example from the previous card: a 9 V source, a 1 kΩ resistor, and an ammeter (which reads the current without disturbing it).

Things to try:
• Select R1 and change its value to 500 — the current should double.
• Change V1 to 4.5 — the current should halve.
• Watch the moving dashes speed up and slow down as current changes.`,
        circuitLabel: 'Open the Ohm’s Law circuit',
        circuit: ohmsLawPreset()
      },
      {
        type: 'quiz',
        question: 'A 12 V supply drives a 4 kΩ resistor. What current flows?',
        choices: ['48 A', '3 A', '3 mA', '0.3 mA'],
        answerIndex: 2,
        explanation: 'I = V ÷ R = 12 ÷ 4000 = 0.003 A = 3 mA.'
      },
      {
        type: 'quiz',
        question: 'You want exactly 10 mA to flow from a 5 V supply. What resistor do you need?',
        choices: ['50 Ω', '500 Ω', '5 kΩ', '0.5 Ω'],
        answerIndex: 1,
        explanation: 'R = V ÷ I = 5 ÷ 0.010 = 500 Ω.'
      },
      {
        type: 'quiz',
        question: 'If you double the resistance while keeping the voltage the same, the current…',
        choices: ['Doubles', 'Stays the same', 'Halves', 'Drops to zero'],
        answerIndex: 2,
        explanation: 'I = V ÷ R: with V fixed, doubling R halves I. Current and resistance are inversely related.'
      }
    ]
  },
  {
    id: 'dc-topo-1',
    track: 'dc',
    module: 'Circuit Topology',
    title: 'Series Circuits',
    summary: 'Components in a single file line: one path, one current, and voltages that add up.',
    estMinutes: 10,
    cards: [
      {
        type: 'concept',
        title: 'One path, one current',
        body: `Components are in series when current has exactly one path through them — like beads on a string.

The key fact: the same current flows through every series component. It has nowhere else to go. If 5 mA flows through the first resistor, exactly 5 mA flows through the second.`
      },
      {
        type: 'concept',
        title: 'Resistances add, voltages divide',
        body: `Series resistors simply add up:

R_total = R1 + R2 + …

A 1 kΩ and a 2 kΩ in series behave like one 3 kΩ resistor. The supply voltage splits across them *in proportion to their resistance* — the bigger resistor takes the bigger share. This is called a voltage divider, and it's one of the most-used patterns in all of electronics.`
      },
      {
        type: 'concept',
        title: 'Measure the divider',
        body: `Below: 12 V across a 1 kΩ + 2 kΩ series pair, with a voltmeter across the 2 kΩ.

Predict first: total resistance is 3 kΩ, so I = 12 ÷ 3000 = 4 mA. The 2 kΩ resistor drops V = I × R = 0.004 × 2000 = 8 V. The voltmeter should read 8 V — two thirds of the supply, because R2 is two thirds of the total resistance.

Try swapping the resistor values and predicting the new reading before you look.`,
        circuitLabel: 'Open the voltage divider',
        circuit: seriesPreset()
      },
      {
        type: 'quiz',
        question: 'Three resistors — 100 Ω, 220 Ω, and 680 Ω — are in series. Total resistance?',
        choices: ['1000 Ω', '333 Ω', '68 Ω', '320 Ω'],
        answerIndex: 0,
        explanation: 'Series resistances add: 100 + 220 + 680 = 1000 Ω.'
      },
      {
        type: 'quiz',
        question: 'In a series circuit, which quantity is the same through every component?',
        choices: ['Voltage', 'Current', 'Resistance', 'Power'],
        answerIndex: 1,
        explanation: 'There is only one path, so the same current flows everywhere. Voltage divides across components in proportion to their resistance.'
      },
      {
        type: 'quiz',
        question: 'A 9 V supply feeds 1 kΩ and 2 kΩ in series. What voltage appears across the 1 kΩ?',
        choices: ['9 V', '6 V', '4.5 V', '3 V'],
        answerIndex: 3,
        explanation: 'I = 9 ÷ 3000 = 3 mA. V across 1 kΩ = 0.003 × 1000 = 3 V (one third of the supply for one third of the resistance).'
      }
    ]
  },
  {
    id: 'dc-topo-2',
    track: 'dc',
    module: 'Circuit Topology',
    title: 'Parallel Circuits',
    summary: 'Side-by-side paths: same voltage everywhere, current splits, and resistance goes *down*.',
    estMinutes: 10,
    cards: [
      {
        type: 'concept',
        title: 'Same voltage, split current',
        body: `Components are in parallel when both their ends connect to the same two points — side-by-side lanes on the same highway.

Two facts define parallel circuits:
• Every parallel branch sees the same voltage (its ends are literally connected to the same nodes).
• The total current splits between branches — more goes through the easier (lower-resistance) path.`
      },
      {
        type: 'concept',
        title: 'More paths = less resistance',
        body: `Adding a parallel branch always *lowers* total resistance — you've opened another lane for traffic.

For two resistors: R_total = (R1 × R2) ÷ (R1 + R2)

Two 1 kΩ resistors in parallel make 500 Ω. Equal resistors halve; in general the result is always smaller than the smallest branch. This is why plugging more appliances into one outlet increases the total current drawn.`
      },
      {
        type: 'concept',
        title: 'Watch the current split',
        body: `Below: 12 V driving two 1 kΩ resistors in parallel, with an ammeter on the main branch.

Each branch sees the full 12 V, so each carries 12 mA. The ammeter reads the total: 24 mA — exactly as if the supply drove a single 500 Ω resistor.

Try changing R2 to 2 kΩ: its branch drops to 6 mA, the total to 18 mA. The branches don't affect each other — that's why your kitchen lights don't dim when the fridge starts (much).`,
        circuitLabel: 'Open the parallel circuit',
        circuit: parallelPreset()
      },
      {
        type: 'quiz',
        question: 'Two 2 kΩ resistors are wired in parallel. Total resistance?',
        choices: ['4 kΩ', '2 kΩ', '1 kΩ', '500 Ω'],
        answerIndex: 2,
        explanation: 'Equal resistors in parallel halve: (2000 × 2000) ÷ (2000 + 2000) = 1 kΩ.'
      },
      {
        type: 'quiz',
        question: 'In a parallel circuit, which quantity is the same across every branch?',
        choices: ['Current', 'Voltage', 'Resistance', 'Power'],
        answerIndex: 1,
        explanation: 'All branches connect to the same two nodes, so they all see the same voltage. The current divides among them.'
      },
      {
        type: 'quiz',
        question: 'You add a third parallel branch to a circuit. The total resistance…',
        choices: ['Increases', 'Stays the same', 'Decreases', 'Becomes zero'],
        answerIndex: 2,
        explanation: 'Every new parallel path makes it easier for current to flow overall, so total resistance always drops.'
      }
    ]
  },
  {
    id: 'dc-semi-1',
    track: 'dc',
    module: 'Semiconductor Basics',
    title: 'Diodes & LEDs',
    summary: 'One-way valves for current — and the glowing variety that lights up nearly everything.',
    estMinutes: 9,
    cards: [
      {
        type: 'concept',
        title: 'The one-way valve',
        body: `A diode lets current flow in one direction and blocks it in the other — a check valve for electricity.

Current flows from the anode (the triangle in the symbol) to the cathode (the bar), but only once the forward voltage pushes hard enough — about 0.6–0.7 V for a standard silicon diode. Below that, almost nothing flows. Reversed, the diode blocks essentially all current.`
      },
      {
        type: 'concept',
        title: 'LEDs: diodes that glow',
        body: `An LED (light-emitting diode) is a diode that converts current directly into light. It behaves like a regular diode but with a higher forward voltage — roughly 1.8–2.2 V for red, up to ~3.3 V for blue and white.

The critical rule: an LED cannot limit its own current. Connect one straight across a battery and it will draw far too much, overheat, and die — often instantly. Every LED needs a current-limiting resistor in series.`
      },
      {
        type: 'concept',
        title: 'Light it up',
        body: `Below: a 5 V supply, a switch, a 220 Ω resistor, and a red LED — the "hello world" of electronics.

Double-click the switch (or use the Inspector) to close it. The LED should glow, carrying about (5 − 1.9) ÷ 220 ≈ 14 mA — comfortably inside the typical 20 mA limit.

Try lowering R1 to 100 Ω and watch the current rise. In a real circuit, going much further would cook the LED; in the simulator, you get to learn that lesson for free.`,
        circuitLabel: 'Open the LED circuit',
        circuit: ledPreset()
      },
      {
        type: 'quiz',
        question: 'Why does an LED need a series resistor?',
        choices: [
          'To make it glow brighter',
          'To limit the current to a safe level',
          'To raise the voltage across the LED',
          'It doesn’t — resistors are optional'
        ],
        answerIndex: 1,
        explanation: 'An LED conducts more and more current as voltage rises past its forward voltage, with almost nothing holding it back. The series resistor sets a safe current: I = (V_supply − V_LED) ÷ R.'
      },
      {
        type: 'quiz',
        question: 'A diode is connected so its cathode faces the + terminal of a battery. What happens?',
        choices: [
          'Normal current flows',
          'The diode blocks — almost no current flows',
          'The diode glows',
          'The battery drains instantly'
        ],
        answerIndex: 1,
        explanation: 'That is reverse bias: the one-way valve is closed, and only a negligible leakage current flows.'
      },
      {
        type: 'quiz',
        question: 'A red LED (V_f ≈ 2 V) runs from 5 V through a 220 Ω resistor. Roughly what current flows?',
        choices: ['23 mA', '14 mA', '2 mA', '90 mA'],
        answerIndex: 1,
        explanation: 'The resistor sees 5 − 2 = 3 V, so I = 3 ÷ 220 ≈ 13.6 mA ≈ 14 mA.'
      }
    ]
  }
]
