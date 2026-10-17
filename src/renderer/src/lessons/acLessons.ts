/**
 * Volt — AC & Residential Track lessons
 *
 * Alternating current, reactance and impedance, filters and resonance,
 * transformers and residential wiring, and an NEC reference. Written for the
 * curious adult hobbyist; every circuit preset is verified by the content test
 * suite (AC presets solve in the phasor solver).
 *
 * Safety: residential AC content carries an explicit disclaimer. This app is a
 * teaching simulator, not a substitute for a licensed electrician or the code.
 */
import type { CircuitComponent, CircuitPreset, Lesson, Wire } from './types'

// ── Preset helpers ───────────────────────────────────────────────────────────

let id = 0
const c = (
  type: CircuitComponent['type'],
  x: number,
  y: number,
  extra: Partial<CircuitComponent> = {}
): CircuitComponent => ({ id: `ap${++id}`, type, x, y, rotation: 0, ...extra })
const w = (
  from: CircuitComponent,
  fromTerminal: number,
  to: CircuitComponent,
  toTerminal: number
): Wire => ({ id: `apw${++id}`, fromComponentId: from.id, fromTerminal, toComponentId: to.id, toTerminal })

/** AC source across a resistor — a clean sine to view on the scope. */
function acSinePreset(): CircuitPreset {
  const v = c('ac_voltage_source', 200, 200, { value: 10, frequency: 60, label: 'Vac1' })
  const r = c('resistor', 460, 200, { value: 100, label: 'R1' })
  const g = c('ground', 200, 360, { label: 'GND1' })
  return {
    components: [v, r, g],
    wires: [w(v, 0, r, 0), w(r, 1, v, 1), w(v, 1, g, 0)]
  }
}

/** RC low-pass: the output lags the input and rolls off above the cutoff. */
function rcLowPassPreset(): CircuitPreset {
  const v = c('ac_voltage_source', 160, 200, { value: 10, frequency: 160, label: 'Vac1' })
  const r = c('resistor', 380, 200, { value: 1000, label: 'R1' })
  const cap = c('capacitor', 600, 200, { value: 1e-6, label: 'C1' })
  const g = c('ground', 160, 360, { label: 'GND1' })
  return {
    components: [v, r, cap, g],
    wires: [w(v, 0, r, 0), w(r, 1, cap, 0), w(cap, 1, g, 0), w(v, 1, g, 0)]
  }
}

/** Series RLC — resonates where XL and XC cancel. */
function rlcPreset(): CircuitPreset {
  const v = c('ac_voltage_source', 140, 200, { value: 10, frequency: 5033, label: 'Vac1' })
  const r = c('resistor', 320, 200, { value: 100, label: 'R1' })
  const l = c('inductor', 500, 200, { value: 1e-3, label: 'L1' })
  const cap = c('capacitor', 680, 200, { value: 1e-6, label: 'C1' })
  const g = c('ground', 140, 360, { label: 'GND1' })
  return {
    components: [v, r, l, cap, g],
    wires: [w(v, 0, r, 0), w(r, 1, l, 0), w(l, 1, cap, 0), w(cap, 1, g, 0), w(v, 1, g, 0)]
  }
}

/** 2:1 step-down transformer feeding a resistive load (shared ground). */
function transformerPreset(): CircuitPreset {
  const v = c('ac_voltage_source', 140, 200, { value: 10, frequency: 60, label: 'Vac1' })
  const t = c('transformer', 380, 220, { value: 2, label: 'T1' })
  const r = c('resistor', 640, 200, { value: 100, label: 'R1' })
  const g = c('ground', 140, 380, { label: 'GND1' })
  return {
    components: [v, t, r, g],
    wires: [
      w(v, 0, t, 0), // Vac+ → P+
      w(v, 1, g, 0), // Vac− → gnd
      w(t, 1, g, 0), // P−   → gnd
      w(t, 2, r, 0), // S+   → load
      w(r, 1, g, 0), // load → gnd
      w(t, 3, g, 0) // S−   → gnd
    ]
  }
}

/** A breaker in series with a load — the protective device conducts normally. */
function breakerPreset(): CircuitPreset {
  const v = c('voltage_source', 160, 200, { value: 12, label: 'V1' })
  const cb = c('breaker', 360, 200, { value: 15, closed: true, label: 'CB1' })
  const r = c('resistor', 560, 200, { value: 100, label: 'R1' })
  const g = c('ground', 160, 360, { label: 'GND1' })
  return {
    components: [v, cb, r, g],
    wires: [w(v, 0, cb, 0), w(cb, 1, r, 0), w(r, 1, v, 1), w(v, 1, g, 0)]
  }
}

// ── Safety disclaimer (reused) ────────────────────────────────────────────────

const SAFETY_DISCLAIMER = `⚠ Safety first — read this before anything else.

This is an educational simulator. Real residential AC (120 V and 240 V in North America, 230 V in much of the world) is genuinely dangerous and can be lethal. The current that trips a breaker is many times more than the current that can stop a human heart.

Never work on live circuits. Everything in this track is for understanding how AC behaves — not a substitute for a licensed electrician, proper tools, or your local electrical code. When in doubt, hire a professional.`

// ── Lessons ──────────────────────────────────────────────────────────────────

export const AC_LESSONS: Lesson[] = [
  {
    id: 'ac-fund-1',
    track: 'ac',
    module: 'AC Fundamentals',
    title: 'Alternating Current & RMS',
    summary: 'Why the current in your walls reverses 120 times a second — and what "120 volts" really means.',
    estMinutes: 10,
    cards: [
      {
        type: 'concept',
        title: 'Current that changes its mind',
        body: `In the DC track, current flowed one way — battery plus to minus. Alternating current (AC) instead reverses direction over and over, tracing a smooth sine wave: positive, back to zero, negative, and around again.

Your wall outlet does this 60 times per second in North America (60 Hz) or 50 times per second across most of Europe and Asia (50 Hz). The generator at the power plant is literally a spinning magnet, and that rotation is what shapes the sine.`
      },
      {
        type: 'concept',
        title: 'Peak, and the more useful RMS',
        body: `A sine wave's peak is its highest instantaneous value. But the voltage swings between +peak and −peak, spending most of its time somewhere in between — so peak alone overstates how much work it does.

RMS (root-mean-square) is the "DC-equivalent" value: the steady voltage that would deliver the same power to a resistor. For a sine, RMS = peak ÷ √2 ≈ 0.707 × peak.

So "120 V" from your outlet is the RMS value. The peak is actually about 170 V. Volt reports AC readings in RMS, just like a real multimeter.`,
        circuit: acSinePreset(),
        circuitLabel: 'View a sine on the scope'
      },
      {
        type: 'concept',
        title: 'Frequency and period',
        body: `Frequency (f, in hertz) is how many full cycles happen each second. Period (T) is how long one cycle takes: T = 1 ÷ f.

At 60 Hz, one cycle takes about 16.7 milliseconds. Open the sandbox, place an AC source, and toggle the ∿ Scope — the waveform view reconstructs the sine so you can see frequency and amplitude directly.`
      },
      {
        type: 'quiz',
        question: 'A wall outlet is rated 120 V (RMS). Roughly what is its peak voltage?',
        choices: ['120 V', '85 V', '170 V', '240 V'],
        answerIndex: 2,
        explanation: 'Peak = RMS × √2 ≈ 120 × 1.414 ≈ 170 V. RMS is the DC-equivalent value, which is why it reads lower than the peak.'
      },
      {
        type: 'quiz',
        question: 'What is the period of a 50 Hz sine wave?',
        choices: ['50 ms', '20 ms', '5 ms', '2 ms'],
        answerIndex: 1,
        explanation: 'T = 1 ÷ f = 1 ÷ 50 = 0.02 s = 20 ms.'
      }
    ]
  },
  {
    id: 'ac-react-1',
    track: 'ac',
    module: 'Reactance & Impedance',
    title: 'Capacitors, Inductors & Reactance',
    summary: 'In AC, capacitors and inductors "resist" in a frequency-dependent way — and shift the phase.',
    estMinutes: 12,
    cards: [
      {
        type: 'concept',
        title: 'Reactance: resistance that depends on frequency',
        body: `In DC steady state a capacitor blocks current (open) and an inductor passes it (a wire). In AC, both partially oppose current in a way that depends on frequency — that opposition is called reactance (X), measured in ohms.

Capacitive reactance falls as frequency rises: Xᴄ = 1 ÷ (2πfC). A capacitor passes high frequencies more easily.

Inductive reactance rises with frequency: Xʟ = 2πfL. An inductor fights fast changes.`
      },
      {
        type: 'concept',
        title: 'Phase: current and voltage out of step',
        body: `A resistor's voltage and current rise and fall together — in phase. Capacitors and inductors break that lockstep.

In a capacitor, current leads voltage by 90° (the current peaks a quarter-cycle before the voltage). In an inductor, current lags voltage by 90°. A handy mnemonic: "ELI the ICE man" — in an inductor (L), voltage E leads current I; in a capacitor (C), current I leads voltage E.`,
        circuit: rcLowPassPreset(),
        circuitLabel: 'See the phase shift on the scope'
      },
      {
        type: 'concept',
        title: 'Impedance ties it together',
        body: `Impedance (Z) is the total opposition to AC — resistance and reactance combined. Because reactance shifts phase, they don't just add; they combine like the sides of a right triangle: Z = √(R² + X²), with a phase angle set by how much reactance is present.

Volt's AC solver works entirely in impedance. Select a component or wire and the Inspector shows the RMS value and its phase angle; the scope draws the matching waveform.`
      },
      {
        type: 'quiz',
        question: 'As frequency increases, the reactance of a capacitor…',
        choices: ['Increases', 'Decreases', 'Stays the same', 'Becomes infinite'],
        answerIndex: 1,
        explanation: 'Xᴄ = 1 ÷ (2πfC): higher f means lower reactance, so capacitors pass high frequencies more readily.'
      },
      {
        type: 'quiz',
        question: 'In a purely inductive load, the current…',
        choices: [
          'Leads the voltage by 90°',
          'Lags the voltage by 90°',
          'Is in phase with the voltage',
          'Is zero'
        ],
        answerIndex: 1,
        explanation: 'For an inductor, current lags voltage by 90° (ELI: E leads I in an L).'
      }
    ]
  },
  {
    id: 'ac-filter-1',
    track: 'ac',
    module: 'Filters & Resonance',
    title: 'Filters & Resonance',
    summary: 'Combine R, L and C to pass some frequencies and block others — and find the resonant peak.',
    estMinutes: 12,
    cards: [
      {
        type: 'concept',
        title: 'High-pass and low-pass',
        body: `Pair a resistor with a capacitor and you get a filter. In an RC low-pass, the output is taken across the capacitor: low frequencies pass, high ones are shunted to ground. Swap the components and you get a high-pass.

The cutoff frequency — where the output drops to about 70.7% (−3 dB) of the input — is f_c = 1 ÷ (2πRC). At the cutoff, the output also lags the input by 45°.`,
        circuit: rcLowPassPreset(),
        circuitLabel: 'Probe the RC filter output'
      },
      {
        type: 'concept',
        title: 'Series RLC and resonance',
        body: `Put R, L and C in series and something special happens at one frequency: the resonant frequency f₀ = 1 ÷ (2π√(LC)). There, inductive and capacitive reactance are equal and cancel, leaving only the resistance.

At resonance the impedance is at its minimum, so the current peaks and is exactly in phase with the source. Radios use this to tune in one station and reject the rest.`,
        circuit: rlcPreset(),
        circuitLabel: 'Explore the RLC circuit'
      },
      {
        type: 'concept',
        title: 'Q and bandwidth',
        body: `How sharp is the resonant peak? That's the quality factor, Q = (1 ÷ R)·√(L ÷ C). A high-Q circuit has a narrow, tall peak (very selective); a low-Q circuit is broad and gentle.

Near resonance the voltage across the inductor or capacitor can be much larger than the source — a Q of 10 means roughly ten times the input voltage appears across the reactive parts.`
      },
      {
        type: 'quiz',
        question: 'At the cutoff frequency of an RC low-pass filter, the output amplitude is about…',
        choices: ['100% of input', '90.9% of input', '70.7% of input', '50% of input'],
        answerIndex: 2,
        explanation: 'The −3 dB cutoff is where output falls to 1 ÷ √2 ≈ 70.7% of the input, with a 45° phase lag.'
      },
      {
        type: 'quiz',
        question: 'In a series RLC circuit at resonance, the current is…',
        choices: [
          'At its minimum',
          'At its maximum and in phase with the source',
          'Ninety degrees out of phase',
          'Zero'
        ],
        answerIndex: 1,
        explanation: 'At f₀ the reactances cancel, impedance is just R (a minimum), so current peaks and is in phase with the source.'
      }
    ]
  },
  {
    id: 'ac-resi-1',
    track: 'ac',
    module: 'Transformers & Residential',
    title: 'Transformers & Residential Wiring',
    summary: 'How AC voltage is stepped up and down, and how power reaches your outlets — safely.',
    estMinutes: 12,
    cards: [
      {
        type: 'concept',
        title: SAFETY_DISCLAIMER.split('\n')[0],
        body: SAFETY_DISCLAIMER
      },
      {
        type: 'concept',
        title: 'Transformers trade volts for amps',
        body: `A transformer is two coils sharing a magnetic core. AC in the primary induces AC in the secondary; the turns ratio sets the voltage ratio: V_secondary = V_primary × (N_secondary ÷ N_primary).

Step the voltage down and the available current steps up by the same factor — power in equals power out (minus small losses). This is why the grid transmits at hundreds of thousands of volts (low current, low loss) and transformers step it down near your home.`,
        circuit: transformerPreset(),
        circuitLabel: 'Try a 2:1 step-down transformer'
      },
      {
        type: 'concept',
        title: 'Split-phase 120/240 V',
        body: `A typical North American home is fed split-phase: a center-tapped transformer gives two 120 V "hot" legs that are 240 V apart. Standard outlets use one hot leg plus neutral (120 V); large appliances like dryers and ranges use both legs (240 V).

The neutral is bonded to ground at the panel, giving the system a safe reference. The breaker panel divides this into branch circuits, each protected against overcurrent.`
      },
      {
        type: 'concept',
        title: 'Breakers and GFCIs',
        body: `A circuit breaker trips when current exceeds its rating (say 15 A or 20 A), protecting the wiring from overheating. In Volt, a breaker conducts normally and flags a trip when the current through it exceeds its rating.

A GFCI (ground-fault circuit interrupter) watches for current leaking to ground — as little as ~5 mA — and cuts power fast to protect people, which is why they're required near water. Volt models a simplified leakage-trip version of a GFCI as a teaching aid.`,
        circuit: breakerPreset(),
        circuitLabel: 'Try a breaker in series'
      },
      {
        type: 'quiz',
        question: 'A 2:1 step-down transformer is fed 240 V. What does the secondary deliver?',
        choices: ['480 V', '240 V', '120 V', '60 V'],
        answerIndex: 2,
        explanation: 'V_secondary = 240 × (1 ÷ 2) = 120 V. Voltage steps down by the turns ratio; available current steps up by the same factor.'
      },
      {
        type: 'quiz',
        question: 'What does a GFCI primarily protect against?',
        choices: [
          'Overloading the wiring with too much current',
          'Current leaking to ground (a shock hazard to people)',
          'Voltage spikes from lightning',
          'Low voltage / brownouts'
        ],
        answerIndex: 1,
        explanation: 'A GFCI trips on a small imbalance between hot and neutral — current leaking to ground — to protect people. A breaker handles overcurrent to protect wiring.'
      }
    ]
  },
  {
    id: 'ac-nec-1',
    track: 'ac',
    module: 'Code Reference',
    title: 'NEC Reference & Safety',
    summary: 'An educational tour of the code ideas behind safe residential wiring — not a substitute for the real thing.',
    estMinutes: 9,
    cards: [
      {
        type: 'concept',
        title: SAFETY_DISCLAIMER.split('\n')[0],
        body: `${SAFETY_DISCLAIMER}

The notes below summarize *ideas* from the U.S. National Electrical Code (NEC) for learning purposes only. Codes change, vary by region, and are enforced by inspectors — always consult the current code and a licensed professional.`
      },
      {
        type: 'concept',
        title: 'Grounding and bonding',
        body: `Grounding gives fault current a safe path back to the source so a breaker can trip, and keeps exposed metal at earth potential. The NEC requires the electrical system to be grounded and metal enclosures bonded together.

The neutral and ground are bonded at exactly one point — the main service panel — and kept separate everywhere downstream. That single bonding point prevents normal current from flowing on grounding conductors.`
      },
      {
        type: 'concept',
        title: 'Breaker sizing and wire ampacity',
        body: `A breaker must protect the wire it feeds: the wire's ampacity (safe current capacity) has to be at least the breaker rating. Common pairings are 15 A breakers with 14-gauge wire and 20 A breakers with 12-gauge wire — never a big breaker on a thin wire, which could let the wire overheat before the breaker trips.

GFCI protection is required in wet or outdoor areas (kitchens, bathrooms, garages, outdoors); AFCI protection, which detects dangerous arcing, is required in many living areas.`,
        circuit: breakerPreset(),
        circuitLabel: 'Inspect a breaker circuit'
      },
      {
        type: 'quiz',
        question: 'Which breaker/wire pairing is appropriate?',
        choices: [
          '20 A breaker on 14-gauge wire',
          '15 A breaker on 14-gauge wire',
          '30 A breaker on 14-gauge wire',
          'Any breaker on any wire'
        ],
        answerIndex: 1,
        explanation: 'The breaker must protect the wire. 14-gauge is rated ~15 A, so a 15 A breaker fits; a 20 A or 30 A breaker could let 14-gauge wire overheat before tripping.'
      },
      {
        type: 'quiz',
        question: 'Where are the neutral and ground bonded together?',
        choices: [
          'At every outlet',
          'At each branch-circuit breaker',
          'At a single point — the main service panel',
          'They are never connected'
        ],
        answerIndex: 2,
        explanation: 'Neutral and ground are bonded at one point (the main panel) and kept separate downstream, so normal current stays off the grounding conductors.'
      }
    ]
  }
]
