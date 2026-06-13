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

/** 12V source, 470Ω resistor, ammeter — for demonstrating power dissipation. */
function powerPreset(): CircuitPreset {
  const v1 = c('voltage_source', 180, 160, { value: 12, label: 'V1' })
  const am = c('ammeter', 400, 160, { label: 'AM1' })
  const r1 = c('resistor', 620, 160, { value: 470, label: 'R1' })
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

/**
 * 12V source, 2kΩ series resistor, then 3kΩ ∥ 6kΩ — for demonstrating KVL
 * and KCL. I_main = 3 mA; splits to 2 mA (R2) + 1 mA (R3).
 */
function kirchhoffPreset(): CircuitPreset {
  const v1 = c('voltage_source', 180, 260, { value: 12, label: 'V1' })
  const am1 = c('ammeter', 340, 260, { label: 'AM1' })
  const r1 = c('resistor', 500, 260, { value: 2000, label: 'R1' })
  const j = c('wire_node', 660, 260, { label: 'J1' })
  const r2 = c('resistor', 780, 160, { value: 3000, label: 'R2' })
  const r3 = c('resistor', 780, 360, { value: 6000, label: 'R3' })
  const gnd = c('ground', 180, 440, { label: 'GND1' })
  return {
    components: [v1, am1, r1, j, r2, r3, gnd],
    wires: [
      w(v1, 0, am1, 0),
      w(am1, 1, r1, 0),
      w(r1, 1, j, 0),
      w(j, 0, r2, 0),
      w(j, 0, r3, 0),
      w(r2, 1, v1, 1),
      w(r3, 1, v1, 1),
      w(v1, 1, gnd, 0)
    ]
  }
}

/**
 * 5V source, 10kΩ resistor, capacitor (DC = open), voltmeter across cap.
 * Shows the DC steady state: capacitor fully charged to ~5V, no current flows.
 */
function rcPreset(): CircuitPreset {
  const v1 = c('voltage_source', 180, 200, { value: 5, label: 'V1' })
  const r1 = c('resistor', 400, 200, { value: 10000, label: 'R1' })
  const cap = c('capacitor', 620, 200, { value: 100e-6, label: 'C1' })
  const vm = c('voltmeter', 620, 340, { label: 'VM1' })
  const gnd = c('ground', 180, 380, { label: 'GND1' })
  return {
    components: [v1, r1, cap, vm, gnd],
    wires: [
      w(v1, 0, r1, 0),
      w(r1, 1, cap, 0),
      w(cap, 1, v1, 1),
      w(vm, 0, cap, 0),
      w(vm, 1, cap, 1),
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
  },
  // ── dc-ohm-2: Power & Energy ────────────────────────────────────────────────
  {
    id: 'dc-ohm-2',
    track: 'dc',
    module: "Ohm's Law & Power",
    title: 'Power & Energy',
    summary: "Every flowing electron gives up energy somewhere — here's how to calculate where and how much.",
    estMinutes: 9,
    cards: [
      {
        type: 'concept',
        title: 'Power is energy per second',
        body: `When current flows through a resistor, electrical energy converts to heat. Power tells you how fast — measured in watts (W), where one watt equals one joule per second.

The fundamental formula:

P = V × I

Power equals voltage times current. A circuit at 5 V drawing 100 mA dissipates 5 × 0.1 = 0.5 W. A microcontroller might use 0.05 W; your laptop charger delivers ~60 W; a kettle pulls ~2000 W.`
      },
      {
        type: 'concept',
        title: 'Two more useful forms',
        body: `Combine P = V × I with Ohm's Law (V = I × R) and you get two more arrangements:

P = I² × R — use when you know the current through the component.
P = V² ÷ R — use when you know the voltage across it.

All three give the same answer; pick whichever requires the fewest steps. Designing a current-limiting resistor? Use I²R. Checking a divider output? Use V²/R.`
      },
      {
        type: 'concept',
        title: 'Power ratings and heat',
        body: `Every physical resistor has a maximum power rating — the most heat it can dissipate without damage. Common values: ⅛ W, ¼ W, ½ W, 1 W. Rule of thumb: derate to 50% of rating for long-term reliability.

The circuit below: 12 V across a 470 Ω resistor, with an ammeter confirming the current. The ammeter reads ~25.5 mA.

P = I² × R = (0.0255)² × 470 ≈ 0.31 W

A standard ¼ W (0.25 W) resistor would be over its limit here. You'd need at least a ½ W part. The simulator doesn't smoke — real ones do.`,
        circuitLabel: 'Open the power dissipation circuit',
        circuit: powerPreset()
      },
      {
        type: 'quiz',
        question: 'A 9 V supply drives a circuit drawing 30 mA. How much power is dissipated?',
        choices: ['2.7 W', '270 mW', '27 mW', '0.27 mW'],
        answerIndex: 1,
        explanation: 'P = V × I = 9 × 0.030 = 0.27 W = 270 mW.'
      },
      {
        type: 'quiz',
        question: 'A 470 Ω resistor carries 25 mA. What power does it dissipate?',
        choices: ['11.75 W', '293.75 mW', '29.4 mW', '118 mW'],
        answerIndex: 1,
        explanation: 'P = I² × R = (0.025)² × 470 = 0.000625 × 470 ≈ 0.294 W ≈ 294 mW.'
      },
      {
        type: 'quiz',
        question: '7 V appears across a 330 Ω resistor. Can a ¼ W (0.25 W) resistor handle it safely?',
        choices: [
          'Yes — it dissipates about 148 mW, comfortably under 250 mW',
          'No — the power exceeds the rating',
          'Yes, but only briefly before it overheats',
          'Only if it is a metal-film type'
        ],
        answerIndex: 0,
        explanation: 'P = V² ÷ R = 49 ÷ 330 ≈ 0.148 W = 148 mW, which is below the 250 mW rating. (Though 148/250 ≈ 59% — just above the 50% derating rule, so a ½ W part would be the professional choice.)'
      }
    ]
  },
  // ── dc-kirckhoff-1: Kirchhoff's Laws ────────────────────────────────────────
  {
    id: 'dc-kirckhoff-1',
    track: 'dc',
    module: "Kirchhoff's Laws",
    title: "Kirchhoff's Laws",
    summary: 'Two rules — one about voltages around a loop, one about currents at a node — that unlock any circuit.',
    estMinutes: 12,
    cards: [
      {
        type: 'concept',
        title: 'KVL: the voltage law',
        body: `Kirchhoff's Voltage Law (KVL): the sum of all voltages around any closed loop is exactly zero.

This is just conservation of energy. Travelling around a loop, voltage rises across sources and falls across resistors. When you arrive back where you started, the net change must be zero — you can't gain or lose energy going in a circle.

Example: a 9 V source, a 1 kΩ drop of 3 V, and a 2 kΩ drop of 6 V.
Loop sum: +9 − 3 − 6 = 0 ✓

KVL lets you write equations for unknown voltages in any loop. It works even in circuits too complex to solve by inspection.`
      },
      {
        type: 'concept',
        title: 'KCL: the current law',
        body: `Kirchhoff's Current Law (KCL): the sum of all currents entering a node equals the sum of all currents leaving.

This is conservation of charge: electrons don't accumulate or vanish at a junction. Whatever flows in must flow out.

Example: 5 mA arrives at a node. Two branches leave. If one carries 3 mA, the other must carry 2 mA.

Together, KVL and KCL are the foundation of all circuit analysis. Every technique — voltage dividers, Thevenin equivalents, op-amp analysis — is KVL and KCL applied systematically.`
      },
      {
        type: 'concept',
        title: 'Both laws working together',
        body: `The circuit below: 12 V source, 2 kΩ in series (R1), then 3 kΩ (R2) and 6 kΩ (R3) in parallel.

KCL at the junction: the ammeter on the main branch reads 3 mA. This splits: 2 mA through R2 (6 V ÷ 3 kΩ) and 1 mA through R3 (6 V ÷ 6 kΩ). Total leaving = 3 mA = total entering ✓

KVL around the outer loop: +12 − (3 mA × 2 kΩ) − (2 mA × 3 kΩ) = 12 − 6 − 6 = 0 ✓

Try adding a voltmeter across R1 and R2 separately and verify the drops add to 12 V.`,
        circuitLabel: 'Open the KVL/KCL circuit',
        circuit: kirchhoffPreset()
      },
      {
        type: 'quiz',
        question: 'A series loop has a 12 V source, R1 dropping 7 V, and R2. What does R2 drop?',
        choices: ['7 V', '5 V', '12 V', 'Not determinable without knowing R2'],
        answerIndex: 1,
        explanation: 'KVL: voltages around the loop sum to zero. +12 − 7 − V_R2 = 0, so V_R2 = 5 V. You do not need to know the resistance values.'
      },
      {
        type: 'quiz',
        question: '10 mA flows into a junction. Branch A carries 4 mA and branch B carries 3 mA. Branch C carries…',
        choices: ['10 mA', '7 mA', '3 mA', '1 mA'],
        answerIndex: 2,
        explanation: 'KCL: currents in = currents out. 10 = 4 + 3 + I_C, so I_C = 3 mA.'
      },
      {
        type: 'quiz',
        question: 'Why do KVL and KCL always hold, regardless of circuit complexity?',
        choices: [
          'They are empirical rules that work well for low-frequency circuits',
          'KVL follows from conservation of energy; KCL from conservation of charge',
          'They are defined by the IEEE component standard',
          'They only hold for resistive circuits with DC sources'
        ],
        answerIndex: 1,
        explanation: "KVL: you can't gain net energy traversing a closed path (conservation of energy). KCL: charge can't appear or disappear at a node (conservation of charge). Both hold at all frequencies in lumped-circuit analysis."
      }
    ]
  },
  // ── dc-rc-1: RC & RL Time Constants ─────────────────────────────────────────
  {
    id: 'dc-rc-1',
    track: 'dc',
    module: 'Reactive Components',
    title: 'RC & RL Time Constants',
    summary: "Capacitors and inductors don't respond instantly — they follow a predictable exponential curve.",
    estMinutes: 12,
    cards: [
      {
        type: 'concept',
        title: 'Capacitors store charge',
        body: `A capacitor is two conductive plates separated by an insulator. Applying voltage pushes charge onto the plates — positive on one side, negative on the other. The stored charge creates a voltage that opposes the source: the capacitor "pushes back."

Key relationship: Q = C × V — charge (coulombs) equals capacitance (farads) times voltage.

Unlike a resistor, a fully charged capacitor blocks DC current entirely. But while it's charging or discharging, current definitely flows. This makes capacitors essential for timing, filtering, and energy storage.`
      },
      {
        type: 'concept',
        title: 'The RC time constant',
        body: `How fast a capacitor charges depends on how much resistance limits the charging current. The time constant τ (tau) captures this in one product:

τ = R × C    (ohms × farads = seconds)

The charging curve after connecting a source:
V(t) = V_s × (1 − e^(−t/τ))

At t = 1τ: charged to 63% of supply (1 − 1/e ≈ 0.632)
At t = 2τ: 86%
At t = 3τ: 95%
At t = 5τ: 99.3% — considered "fully charged" in practice

A 10 kΩ resistor and a 100 μF capacitor: τ = 10,000 × 0.0001 = 1 second.`
      },
      {
        type: 'concept',
        title: 'Steady state in the simulator',
        body: `The Volt simulator solves DC steady state — the condition long after everything has settled. For a capacitor, this means fully charged: it acts as an open circuit and the full source voltage appears across it.

The circuit below: 5 V through 10 kΩ into a 100 μF capacitor. In steady state, no current flows and the voltmeter reads ~5 V — the stored voltage on the capacitor plates.

The charging transient (the curve from 0 V to 5 V over ~5 seconds) requires time-domain simulation. That's coming in the AC track, where you'll use an oscilloscope to watch the waveform in real time.`,
        circuitLabel: 'Open the RC circuit (steady state)',
        circuit: rcPreset()
      },
      {
        type: 'concept',
        title: 'Inductors and RL circuits',
        body: `An inductor is a coil of wire that stores energy in a magnetic field. It is the dual of a capacitor: where a capacitor opposes changes in voltage, an inductor opposes changes in current.

The RL time constant: τ = L ÷ R (henries ÷ ohms = seconds)

At switch-on (t = 0): the inductor acts like an open circuit — current starts at zero.
At steady state (t >> τ): the inductor is a short circuit (a plain wire) — full current flows, limited only by resistance.

In the DC simulator, an inductor always shows its final, fully-conducting state. The characteristic rise curve is, again, a topic for time-domain simulation.`
      },
      {
        type: 'quiz',
        question: 'R = 22 kΩ, C = 47 μF. What is the RC time constant?',
        choices: ['47 ms', '1.034 s', '2.13 ms', '470 s'],
        answerIndex: 1,
        explanation: 'τ = R × C = 22,000 × 0.000047 = 1.034 s.'
      },
      {
        type: 'quiz',
        question: 'After exactly one time constant, a capacitor charging toward 12 V has reached approximately…',
        choices: ['6 V (50%)', '7.6 V (63%)', '11.4 V (95%)', '3 V (25%)'],
        answerIndex: 1,
        explanation: 'After 1τ: V = V_s × (1 − 1/e) ≈ 0.632 × 12 ≈ 7.6 V. The "63% after one tau" figure is worth memorising.'
      },
      {
        type: 'quiz',
        question: 'You need a 500 ms time constant. You have a 10 μF capacitor. What resistor do you need?',
        choices: ['5 kΩ', '50 kΩ', '500 kΩ', '5 MΩ'],
        answerIndex: 1,
        explanation: 'τ = R × C → R = τ ÷ C = 0.5 ÷ 0.000010 = 50,000 Ω = 50 kΩ.'
      }
    ]
  }
]
