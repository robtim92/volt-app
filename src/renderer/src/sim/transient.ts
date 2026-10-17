/**
 * Volt — Transient (time-domain) circuit simulator
 *
 * Steps a circuit forward in time so things that *change* can be watched:
 * capacitors charging, inductors resisting changes in current, LEDs blinking,
 * sine sources sweeping, inductive kickback when a switch opens.
 *
 * Method (the same family SPICE / Falstad use):
 *   - Modified Nodal Analysis, re-solved once per timestep.
 *   - Capacitors and inductors are replaced by "companion models": a
 *     conductance plus a history current source that encodes the element's
 *     state from the previous step. Trapezoidal integration by default (keeps
 *     LC oscillations from artificially decaying); backward Euler for the first
 *     step after any topology change (damps the numerical ringing that
 *     trapezoidal would otherwise produce at a discontinuity).
 *   - Diodes/LEDs use Newton-Raphson inside each step, seeded with the
 *     previous step's junction voltage, so it typically converges in 2–4 passes.
 *   - A tiny conductance (GSHUNT) from every node to ground keeps momentarily
 *     floating nodes (e.g. behind an open switch) solvable.
 *
 * State (capacitor voltages, inductor currents, diode junction voltages) is
 * keyed by element id and can be carried into a rebuilt simulator, so editing
 * the circuit or flipping a switch doesn't reset a charged capacitor.
 *
 * Pure TypeScript, no DOM — unit-tested directly and worker-ready.
 */
import {
  GROUND,
  SILICON_DIODE_PARAMS,
  VT,
  diodeConductance,
  diodeCurrent,
  limitJunctionVoltage,
  solveLinearSystem,
  type DiodeParams
} from './solver'

export type TransientElementType =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'voltage_source'
  | 'sine_source'
  | 'current_source'
  | 'diode'

export interface TransientElement {
  id: string
  type: TransientElementType
  /** R (Ω), C (F), L (H), V (V), I (A); sine_source: peak amplitude (V) */
  value: number
  /** nodes[0] = + terminal / anode / first terminal */
  nodes: [string, string]
  /** sine_source only */
  frequency?: number
  /** sine_source only, degrees. v(t) = A·sin(2πft + φ) */
  phaseDeg?: number
  /** diode only */
  params?: DiodeParams
}

export interface TransientNetlist {
  elements: TransientElement[]
}

/** Per-element state carried between steps (and across rebuilds). */
export interface TransientState {
  time: number
  /** capacitor id → voltage across it (nodes[0] − nodes[1]) */
  capVoltage: Record<string, number>
  /** capacitor id → current through it at the last step (for trapezoidal) */
  capCurrent: Record<string, number>
  /** inductor id → current nodes[0] → nodes[1] */
  indCurrent: Record<string, number>
  /** inductor id → voltage across it at the last step (for trapezoidal) */
  indVoltage: Record<string, number>
  /** diode id → junction voltage (NR seed) */
  junction: Record<string, number>
}

export interface TransientEvent {
  kind: 'arc'
  elementId: string
  /** Voltage that caused the event */
  volts: number
}

export interface TransientSnapshot {
  solved: boolean
  time: number
  nodeVoltages: Record<string, number>
  /** element id → current nodes[0] → nodes[1] (SPICE sign convention for sources) */
  elementCurrents: Record<string, number>
  error?: string
}

export const emptyTransientState = (): TransientState => ({
  time: 0,
  capVoltage: {},
  capCurrent: {},
  indCurrent: {},
  indVoltage: {},
  junction: {}
})

/** Node-to-ground leakage that keeps floating nodes solvable (1 GΩ). */
const GSHUNT = 1e-9
const MAX_NR = 60
const NR_TOL = 1e-7
/** An inductor forced above this voltage "arcs" — its current collapses to 0. */
export const ARC_VOLTAGE = 1000

export interface TransientOptions {
  /** Use backward Euler throughout instead of trapezoidal (more damping). */
  backwardEuler?: boolean
}

function validate(netlist: TransientNetlist): string | null {
  if (netlist.elements.length === 0) return 'Circuit is empty'
  let hasGround = false
  for (const el of netlist.elements) {
    if (el.type !== 'diode' && !Number.isFinite(el.value))
      return `Element ${el.id} has an invalid value`
    if (el.type === 'resistor' && el.value <= 0) return `Resistor ${el.id} must have positive resistance`
    if ((el.type === 'capacitor' || el.type === 'inductor') && el.value <= 0)
      return `${el.id} must have a positive value`
    if (el.nodes[0] === GROUND || el.nodes[1] === GROUND) hasGround = true
  }
  if (!hasGround) return 'Circuit has no ground reference — add a ground connection'
  return null
}

const sourceVoltage = (el: TransientElement, t: number): number =>
  el.type === 'sine_source'
    ? el.value * Math.sin(2 * Math.PI * (el.frequency ?? 60) * t + ((el.phaseDeg ?? 0) * Math.PI) / 180)
    : el.value

/**
 * A transient simulator bound to one netlist (one circuit topology). Rebuild it
 * when the circuit changes, passing the previous `state` to keep continuity.
 */
export class TransientSimulator {
  readonly netlist: TransientNetlist
  readonly error: string | null
  state: TransientState
  private nodeIndex = new Map<string, number>()
  private vsources: TransientElement[] = []
  private size = 0
  private x: number[] = []
  private firstStep = true
  private opts: TransientOptions
  private lastSnapshot: TransientSnapshot
  /** Events raised during the most recent advance() (consumed by the caller). */
  events: TransientEvent[] = []

  constructor(netlist: TransientNetlist, previous?: TransientState, opts: TransientOptions = {}) {
    this.netlist = netlist
    this.opts = opts
    this.error = validate(netlist)
    this.state = carryState(netlist, previous)
    for (const el of netlist.elements) {
      for (const n of el.nodes) {
        if (n !== GROUND && !this.nodeIndex.has(n)) this.nodeIndex.set(n, this.nodeIndex.size)
      }
    }
    this.vsources = netlist.elements.filter(
      (e) => e.type === 'voltage_source' || e.type === 'sine_source'
    )
    this.size = this.nodeIndex.size + this.vsources.length
    this.x = new Array<number>(this.size).fill(0)
    this.lastSnapshot = {
      solved: false,
      time: this.state.time,
      nodeVoltages: { [GROUND]: 0 },
      elementCurrents: {},
      error: this.error ?? undefined
    }
  }

  get time(): number {
    return this.state.time
  }

  snapshot(): TransientSnapshot {
    return this.lastSnapshot
  }

  /**
   * Solve the circuit "now" without advancing time (capacitors hold their
   * voltage, inductors their current). Used after an edit while paused.
   */
  settleInstant(): TransientSnapshot {
    if (this.error) return this.lastSnapshot
    const saved = cloneState(this.state)
    const ok = this.step(1e-9, true)
    const snap = ok ? this.buildSnapshot(1e-9, true) : this.failSnapshot()
    // Restore — an instantaneous solve must not change the stored history
    this.state = saved
    this.state.junction = { ...this.state.junction }
    this.lastSnapshot = { ...snap, time: this.state.time }
    return this.lastSnapshot
  }

  /**
   * Advance simulated time by `duration` seconds using steps no larger than
   * `maxStep`. Returns the snapshot at the end. Caps the number of steps at
   * `maxSteps` (the remaining time is dropped, so a heavy circuit slows down
   * rather than freezing the UI).
   */
  advance(duration: number, maxStep: number, maxSteps = 2000): TransientSnapshot {
    this.events = []
    if (this.error) return this.lastSnapshot
    if (duration <= 0) return this.lastSnapshot
    const n = Math.min(maxSteps, Math.max(1, Math.ceil(duration / maxStep)))
    const dt = duration / Math.ceil(duration / maxStep) // uniform steps
    for (let k = 0; k < n; k++) {
      const be = this.opts.backwardEuler === true || this.firstStep
      if (!this.step(dt, be)) {
        this.lastSnapshot = this.failSnapshot()
        return this.lastSnapshot
      }
      this.commit(dt, be)
      this.firstStep = false
    }
    this.lastSnapshot = this.buildSnapshot(dt, false)
    return this.lastSnapshot
  }

  private failSnapshot(): TransientSnapshot {
    return {
      solved: false,
      time: this.state.time,
      nodeVoltages: { [GROUND]: 0 },
      elementCurrents: {},
      error: 'Circuit could not be solved — check for loops of voltage sources'
    }
  }

  private idx(node: string): number {
    return node === GROUND ? -1 : this.nodeIndex.get(node)!
  }

  private v(node: string, x = this.x): number {
    const i = this.idx(node)
    return i < 0 ? 0 : x[i]
  }

  /** Solve one step of length dt into this.x. Returns false if singular / NR fails. */
  private step(dt: number, be: boolean): boolean {
    const t = this.state.time + dt
    const st = this.state
    const numNodes = this.nodeIndex.size
    const diodes = this.netlist.elements.filter((e) => e.type === 'diode')
    const junction = diodes.map((d) => {
      const seed = st.junction[d.id]
      if (seed !== undefined) return seed
      const p = d.params ?? SILICON_DIODE_PARAMS
      const nvt = p.emissionCoefficient * VT
      return nvt * Math.log(nvt / (Math.SQRT2 * p.saturationCurrent))
    })

    const assemble = (): number[] | null => {
      const n = this.size
      const A: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))
      const z = new Array<number>(n).fill(0)
      const g = (ia: number, ib: number, val: number): void => {
        if (ia >= 0) A[ia][ia] += val
        if (ib >= 0) A[ib][ib] += val
        if (ia >= 0 && ib >= 0) {
          A[ia][ib] -= val
          A[ib][ia] -= val
        }
      }
      // current `i` flowing a → b through the element: leaves node a, enters b
      const flow = (ia: number, ib: number, i: number): void => {
        if (ia >= 0) z[ia] -= i
        if (ib >= 0) z[ib] += i
      }
      for (let k = 0; k < numNodes; k++) A[k][k] += GSHUNT

      for (const el of this.netlist.elements) {
        const ia = this.idx(el.nodes[0])
        const ib = this.idx(el.nodes[1])
        switch (el.type) {
          case 'resistor':
            g(ia, ib, 1 / el.value)
            break
          case 'current_source':
            // pushes current out of nodes[0] into the circuit → flows b→a internally
            flow(ib, ia, el.value)
            break
          case 'capacitor': {
            const v0 = st.capVoltage[el.id] ?? 0
            const i0 = st.capCurrent[el.id] ?? 0
            const geq = be ? el.value / dt : (2 * el.value) / dt
            const ihist = be ? geq * v0 : geq * v0 + i0
            // i = geq·v − ihist  →  conductance + source injecting ihist into a
            g(ia, ib, geq)
            flow(ib, ia, ihist)
            break
          }
          case 'inductor': {
            const i0 = st.indCurrent[el.id] ?? 0
            const v0 = st.indVoltage[el.id] ?? 0
            const geq = be ? dt / el.value : dt / (2 * el.value)
            const ihist = be ? i0 : i0 + geq * v0
            // i = geq·v + ihist (a → b)
            g(ia, ib, geq)
            flow(ia, ib, ihist)
            break
          }
        }
      }
      diodes.forEach((d, k) => {
        const p = d.params ?? SILICON_DIODE_PARAMS
        const vd = junction[k]
        const geq = diodeConductance(vd, p)
        const ieq = diodeCurrent(vd, p) - geq * vd
        const ia = this.idx(d.nodes[0])
        const ib = this.idx(d.nodes[1])
        g(ia, ib, geq)
        flow(ia, ib, ieq)
      })
      this.vsources.forEach((vs, k) => {
        const row = numNodes + k
        const ia = this.idx(vs.nodes[0])
        const ib = this.idx(vs.nodes[1])
        if (ia >= 0) {
          A[ia][row] += 1
          A[row][ia] += 1
        }
        if (ib >= 0) {
          A[ib][row] -= 1
          A[row][ib] -= 1
        }
        z[row] = sourceVoltage(vs, t)
      })
      return solveLinearSystem(A, z)
    }

    if (diodes.length === 0) {
      const x = assemble()
      if (!x) return false
      this.x = x
      return true
    }

    for (let iter = 0; iter < MAX_NR; iter++) {
      const x = assemble()
      if (!x) return false
      let maxDelta = 0
      diodes.forEach((d, k) => {
        const p = d.params ?? SILICON_DIODE_PARAMS
        const raw = this.v(d.nodes[0], x) - this.v(d.nodes[1], x)
        const next = limitJunctionVoltage(raw, junction[k], p)
        maxDelta = Math.max(maxDelta, Math.abs(next - junction[k]))
        junction[k] = next
      })
      this.x = x
      if (maxDelta < NR_TOL) {
        diodes.forEach((d, k) => (st.junction[d.id] = junction[k]))
        return true
      }
    }
    // Not fully converged: accept the last iterate (keeps animation alive);
    // a stuck diode will settle over the next steps.
    diodes.forEach((d, k) => (st.junction[d.id] = junction[k]))
    return true
  }

  /** Update reactive-element state after a successful step. */
  private commit(dt: number, be: boolean): void {
    const st = this.state
    for (const el of this.netlist.elements) {
      if (el.type === 'capacitor') {
        const v1 = this.v(el.nodes[0]) - this.v(el.nodes[1])
        const v0 = st.capVoltage[el.id] ?? 0
        const i0 = st.capCurrent[el.id] ?? 0
        const i1 = be ? (el.value / dt) * (v1 - v0) : ((2 * el.value) / dt) * (v1 - v0) - i0
        st.capVoltage[el.id] = v1
        st.capCurrent[el.id] = i1
      } else if (el.type === 'inductor') {
        const v1 = this.v(el.nodes[0]) - this.v(el.nodes[1])
        const v0 = st.indVoltage[el.id] ?? 0
        const i0 = st.indCurrent[el.id] ?? 0
        let i1 = be ? i0 + (dt / el.value) * v1 : i0 + (dt / (2 * el.value)) * (v1 + v0)
        let vStore = v1
        if (Math.abs(v1) > ARC_VOLTAGE) {
          // Interrupted inductor current: the field collapses through a spark.
          this.events.push({ kind: 'arc', elementId: el.id, volts: v1 })
          i1 = 0
          vStore = 0
          this.firstStep = true // restart integration cleanly
        }
        st.indCurrent[el.id] = i1
        st.indVoltage[el.id] = vStore
      }
    }
    st.time += dt
  }

  private buildSnapshot(dt: number, be: boolean): TransientSnapshot {
    const st = this.state
    const nodeVoltages: Record<string, number> = { [GROUND]: 0 }
    for (const [name, i] of this.nodeIndex) nodeVoltages[name] = this.x[i]
    const vd = (el: TransientElement): number => this.v(el.nodes[0]) - this.v(el.nodes[1])
    const elementCurrents: Record<string, number> = {}
    for (const el of this.netlist.elements) {
      switch (el.type) {
        case 'resistor':
          elementCurrents[el.id] = vd(el) / el.value
          break
        case 'current_source':
          elementCurrents[el.id] = -el.value
          break
        case 'capacitor': {
          if (be) {
            // instantaneous solve: current implied by the tiny step
            const v0 = st.capVoltage[el.id] ?? 0
            elementCurrents[el.id] = (el.value / dt) * (vd(el) - v0)
          } else {
            elementCurrents[el.id] = st.capCurrent[el.id] ?? 0
          }
          break
        }
        case 'inductor':
          elementCurrents[el.id] = be
            ? (st.indCurrent[el.id] ?? 0) + (dt / el.value) * vd(el)
            : (st.indCurrent[el.id] ?? 0)
          break
        case 'diode':
          elementCurrents[el.id] = diodeCurrent(vd(el), el.params ?? SILICON_DIODE_PARAMS)
          break
      }
    }
    const numNodes = this.nodeIndex.size
    this.vsources.forEach((vs, k) => {
      elementCurrents[vs.id] = this.x[numNodes + k]
    })
    return { solved: true, time: st.time, nodeVoltages, elementCurrents }
  }
}

function cloneState(s: TransientState): TransientState {
  return {
    time: s.time,
    capVoltage: { ...s.capVoltage },
    capCurrent: { ...s.capCurrent },
    indCurrent: { ...s.indCurrent },
    indVoltage: { ...s.indVoltage },
    junction: { ...s.junction }
  }
}

/** Keep state only for elements that still exist (by id). */
function carryState(netlist: TransientNetlist, prev?: TransientState): TransientState {
  const next = emptyTransientState()
  if (!prev) return next
  next.time = prev.time
  for (const el of netlist.elements) {
    if (el.type === 'capacitor' && prev.capVoltage[el.id] !== undefined) {
      next.capVoltage[el.id] = prev.capVoltage[el.id]
      // A topology change invalidates the old current; BE first step ignores it anyway.
      next.capCurrent[el.id] = 0
    } else if (el.type === 'inductor' && prev.indCurrent[el.id] !== undefined) {
      next.indCurrent[el.id] = prev.indCurrent[el.id]
      next.indVoltage[el.id] = 0
    } else if (el.type === 'diode' && prev.junction[el.id] !== undefined) {
      next.junction[el.id] = prev.junction[el.id]
    }
  }
  return next
}

/**
 * Pick a sensible maximum timestep for a netlist: fine enough to resolve sine
 * sources (64 points per period) and the fastest RC/RL/LC time scale we can
 * cheaply estimate, but never coarser than 1 ms.
 */
export function suggestMaxStep(netlist: TransientNetlist): number {
  let dt = 1e-3
  // Ignore near-zero "wire" resistances (closed switches, ammeters, junction
  // bulk resistance) — they don't set a visible time scale.
  const rs = netlist.elements
    .filter((e) => e.type === 'resistor' && e.value >= 1 && !e.id.includes('#'))
    .map((e) => e.value)
  const rMin = rs.length ? Math.min(...rs) : 1
  const rMax = rs.length ? Math.max(...rs) : 1
  for (const el of netlist.elements) {
    if (el.type === 'sine_source' && el.frequency && el.frequency > 0)
      dt = Math.min(dt, 1 / (el.frequency * 64))
    // Time constants: RC with the smallest R, L/R with the largest R
    if (el.type === 'capacitor') dt = Math.min(dt, (rMin * el.value) / 20)
    if (el.type === 'inductor') dt = Math.min(dt, el.value / rMax / 20)
  }
  const ls = netlist.elements.filter((e) => e.type === 'inductor')
  const cs = netlist.elements.filter((e) => e.type === 'capacitor')
  for (const l of ls) for (const c of cs) dt = Math.min(dt, (2 * Math.PI * Math.sqrt(l.value * c.value)) / 64)
  return Math.max(dt, 1e-8)
}
