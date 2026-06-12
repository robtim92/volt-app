/**
 * Volt — DC Circuit Solver (Modified Nodal Analysis)
 *
 * Pure-TypeScript MNA engine. No DOM dependencies — designed to be wrapped in
 * a Web Worker.
 *
 * Supported elements:
 *   - resistor        value = resistance in ohms (Ω)
 *   - voltage_source  value = DC voltage in volts (V), nodes[0] = positive terminal
 *   - current_source  value = DC current in amps (A), pushes current out of nodes[0]
 *                     into the external circuit and back into nodes[1]
 *   - diode           nonlinear, Shockley model; nodes[0] = anode, nodes[1] = cathode;
 *                     `params` selects the model (defaults to a 1N4148-style silicon
 *                     diode; use LED_PARAMS for LEDs). `value` is ignored.
 *
 * Nonlinear circuits are solved by Newton-Raphson iteration: each diode is
 * replaced by its linearized companion model (conductance Geq + current source
 * Ieq) and the linear system is re-solved until the junction voltages stop
 * changing. SPICE-style junction voltage limiting (pnjlim) keeps the
 * exponential from overflowing, and a small Gmin conductance across each
 * junction keeps reverse-biased circuits non-singular.
 *
 * Conventions (matching SPICE where applicable):
 *   - The ground node is named 'gnd' and is the 0 V reference. Every circuit
 *     must reference it.
 *   - elementCurrents[id] is the current flowing through the element from
 *     nodes[0] to nodes[1]. For a voltage source driving a load, this is the
 *     current entering the positive terminal — negative when sourcing power,
 *     exactly as SPICE reports it.
 */

export const GROUND = 'gnd'

/** Thermal voltage kT/q at ~27 °C */
const VT = 0.02585
/** Minimum junction conductance — keeps reverse-biased circuits solvable */
const GMIN = 1e-12
const MAX_NR_ITERATIONS = 200
/** Convergence: max junction voltage change per iteration */
const NR_TOLERANCE = 1e-9

export type ElementType = 'resistor' | 'voltage_source' | 'current_source' | 'diode'

export interface DiodeParams {
  /** Saturation current Is (A) */
  saturationCurrent: number
  /** Emission coefficient n (ideality factor) */
  emissionCoefficient: number
}

/** 1N4148-style small-signal silicon diode (Vf ≈ 0.6–0.7 V) */
export const SILICON_DIODE_PARAMS: DiodeParams = {
  saturationCurrent: 2.52e-9,
  emissionCoefficient: 1.752
}

/** Generic red LED (Vf ≈ 1.8–2.0 V at typical currents) */
export const LED_PARAMS: DiodeParams = {
  saturationCurrent: 1e-18,
  emissionCoefficient: 2
}

export interface NetlistElement {
  id: string
  type: ElementType
  value: number
  /** [first terminal, second terminal]. For sources, nodes[0] is the + terminal; for diodes, the anode. */
  nodes: [string, string]
  /** Diode model parameters; ignored for other element types. */
  params?: DiodeParams
}

export interface Netlist {
  elements: NetlistElement[]
}

export interface SolveResult {
  solved: boolean
  /** node name → voltage (V). Includes 'gnd' at exactly 0. */
  nodeVoltages: Record<string, number>
  /** element id → current (A) flowing from nodes[0] to nodes[1]. */
  elementCurrents: Record<string, number>
  /** Newton-Raphson iterations used (1 for purely linear circuits). */
  iterations?: number
  error?: string
}

// ── Validation ───────────────────────────────────────────────────────────────

function validate(netlist: Netlist): string | null {
  if (netlist.elements.length === 0) return 'Circuit is empty'

  const nodes = new Set<string>()
  for (const el of netlist.elements) {
    if (el.type !== 'diode' && !Number.isFinite(el.value))
      return `Element ${el.id} has an invalid value`
    if (el.type === 'resistor' && el.value <= 0)
      return `Resistor ${el.id} must have positive resistance`
    nodes.add(el.nodes[0])
    nodes.add(el.nodes[1])
  }

  if (!nodes.has(GROUND))
    return 'Circuit has no ground reference — add a ground connection'

  // Every node must be reachable from ground through elements, otherwise the
  // matrix is singular (floating subcircuit).
  const adjacency = new Map<string, string[]>()
  for (const el of netlist.elements) {
    const [a, b] = el.nodes
    if (!adjacency.has(a)) adjacency.set(a, [])
    if (!adjacency.has(b)) adjacency.set(b, [])
    adjacency.get(a)!.push(b)
    adjacency.get(b)!.push(a)
  }
  const visited = new Set<string>([GROUND])
  const queue = [GROUND]
  while (queue.length > 0) {
    const n = queue.pop()!
    for (const next of adjacency.get(n) ?? []) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push(next)
      }
    }
  }
  for (const n of nodes) {
    if (!visited.has(n))
      return `Node "${n}" is not connected to ground (floating subcircuit)`
  }

  return null
}

// ── Linear algebra ───────────────────────────────────────────────────────────

/**
 * Solve A·x = b in place via Gaussian elimination with partial pivoting.
 * Returns null if the matrix is singular (within tolerance).
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length
  const SINGULAR_EPS = 1e-12

  for (let col = 0; col < n; col++) {
    let pivotRow = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivotRow][col])) pivotRow = r
    }
    if (Math.abs(A[pivotRow][col]) < SINGULAR_EPS) return null

    if (pivotRow !== col) {
      ;[A[col], A[pivotRow]] = [A[pivotRow], A[col]]
      ;[b[col], b[pivotRow]] = [b[pivotRow], b[col]]
    }

    for (let r = col + 1; r < n; r++) {
      const factor = A[r][col] / A[col][col]
      if (factor === 0) continue
      for (let c = col; c < n; c++) A[r][c] -= factor * A[col][c]
      b[r] -= factor * b[col]
    }
  }

  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row]
    for (let c = row + 1; c < n; c++) sum -= A[row][c] * x[c]
    x[row] = sum / A[row][row]
  }
  return x
}

// ── Diode model ──────────────────────────────────────────────────────────────

function diodeCurrent(vd: number, p: DiodeParams): number {
  const nvt = p.emissionCoefficient * VT
  return p.saturationCurrent * (Math.exp(vd / nvt) - 1) + GMIN * vd
}

function diodeConductance(vd: number, p: DiodeParams): number {
  const nvt = p.emissionCoefficient * VT
  return (p.saturationCurrent / nvt) * Math.exp(vd / nvt) + GMIN
}

/**
 * SPICE-style junction voltage limiting (pnjlim). Prevents Newton-Raphson from
 * overshooting into exponential overflow while still allowing convergence.
 */
function limitJunctionVoltage(vNew: number, vOld: number, p: DiodeParams): number {
  const nvt = p.emissionCoefficient * VT
  const vCrit = nvt * Math.log(nvt / (Math.SQRT2 * p.saturationCurrent))

  if (vNew > vCrit && Math.abs(vNew - vOld) > 2 * nvt) {
    if (vOld > 0) {
      const arg = 1 + (vNew - vOld) / nvt
      return arg > 0 ? vOld + nvt * Math.log(arg) : vCrit
    }
    return vCrit
  }
  return vNew
}

// ── MNA solver ───────────────────────────────────────────────────────────────

export function solveDC(netlist: Netlist): SolveResult {
  const fail = (error: string): SolveResult => ({
    solved: false,
    nodeVoltages: {},
    elementCurrents: {},
    error
  })

  const validationError = validate(netlist)
  if (validationError) return fail(validationError)

  // Assign matrix indices to non-ground nodes
  const nodeIndex = new Map<string, number>()
  for (const el of netlist.elements) {
    for (const n of el.nodes) {
      if (n !== GROUND && !nodeIndex.has(n)) nodeIndex.set(n, nodeIndex.size)
    }
  }
  const numNodes = nodeIndex.size

  const voltageSources = netlist.elements.filter((e) => e.type === 'voltage_source')
  const diodes = netlist.elements.filter((e) => e.type === 'diode')
  const numVSources = voltageSources.length
  const size = numNodes + numVSources

  if (size === 0) return fail('Circuit has no nodes to solve')

  // idx() returns -1 for ground, which means "skip the stamp"
  const idx = (node: string): number => (node === GROUND ? -1 : nodeIndex.get(node)!)

  /** Build and solve the MNA system for a given set of diode junction voltage guesses. */
  const solveIteration = (junctionVoltages: number[]): number[] | null => {
    const A: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0))
    const z = new Array<number>(size).fill(0)

    const stampConductance = (ia: number, ib: number, g: number): void => {
      if (ia >= 0) A[ia][ia] += g
      if (ib >= 0) A[ib][ib] += g
      if (ia >= 0 && ib >= 0) {
        A[ia][ib] -= g
        A[ib][ia] -= g
      }
    }
    const stampCurrent = (ia: number, ib: number, i: number): void => {
      // current i injected into node a, drawn from node b
      if (ia >= 0) z[ia] += i
      if (ib >= 0) z[ib] -= i
    }

    for (const el of netlist.elements) {
      const ia = idx(el.nodes[0])
      const ib = idx(el.nodes[1])
      if (el.type === 'resistor') {
        stampConductance(ia, ib, 1 / el.value)
      } else if (el.type === 'current_source') {
        stampCurrent(ia, ib, el.value)
      }
    }

    diodes.forEach((d, k) => {
      const p = d.params ?? SILICON_DIODE_PARAMS
      const vd = junctionVoltages[k]
      const geq = diodeConductance(vd, p)
      const ieq = diodeCurrent(vd, p) - geq * vd
      const ia = idx(d.nodes[0])
      const ib = idx(d.nodes[1])
      stampConductance(ia, ib, geq)
      // companion current source points anode → cathode, i.e. it draws ieq
      // out of the anode node and injects it at the cathode
      stampCurrent(ib, ia, ieq)
    })

    voltageSources.forEach((vs, k) => {
      const row = numNodes + k
      const ia = idx(vs.nodes[0])
      const ib = idx(vs.nodes[1])
      if (ia >= 0) {
        A[ia][row] += 1
        A[row][ia] += 1
      }
      if (ib >= 0) {
        A[ib][row] -= 1
        A[row][ib] -= 1
      }
      z[row] = vs.value
    })

    return solveLinearSystem(A, z)
  }

  const junctionVoltageOf = (x: number[], d: NetlistElement): number => {
    const ia = idx(d.nodes[0])
    const ib = idx(d.nodes[1])
    return (ia >= 0 ? x[ia] : 0) - (ib >= 0 ? x[ib] : 0)
  }

  // ── Solve: single linear pass, or Newton-Raphson when diodes are present ──
  let x: number[] | null = null
  let iterations = 0

  if (diodes.length === 0) {
    x = solveIteration([])
    iterations = 1
    if (x === null)
      return fail(
        'Circuit could not be solved — check for voltage source loops or isolated components'
      )
  } else {
    // Initial guess: every junction at its critical voltage
    let guesses = diodes.map((d) => {
      const p = d.params ?? SILICON_DIODE_PARAMS
      const nvt = p.emissionCoefficient * VT
      return nvt * Math.log(nvt / (Math.SQRT2 * p.saturationCurrent))
    })

    let converged = false
    for (let iter = 1; iter <= MAX_NR_ITERATIONS; iter++) {
      iterations = iter
      x = solveIteration(guesses)
      if (x === null)
        return fail(
          'Circuit could not be solved — check for voltage source loops or isolated components'
        )

      const solved = x
      const newGuesses = diodes.map((d, k) => {
        const p = d.params ?? SILICON_DIODE_PARAMS
        return limitJunctionVoltage(junctionVoltageOf(solved, d), guesses[k], p)
      })

      const maxDelta = Math.max(...newGuesses.map((v, k) => Math.abs(v - guesses[k])))
      guesses = newGuesses
      if (maxDelta < NR_TOLERANCE) {
        converged = true
        break
      }
    }

    if (!converged)
      return fail('Simulation did not converge — try adding series resistance to diodes')

    // Final consistent solve with converged junction voltages
    x = solveIteration(guesses)
    if (x === null) return fail('Circuit could not be solved')
  }

  // ── Extract results ──
  const nodeVoltages: Record<string, number> = { [GROUND]: 0 }
  for (const [name, i] of nodeIndex) nodeVoltages[name] = x[i]

  const voltageAt = (node: string): number => nodeVoltages[node] ?? 0

  const elementCurrents: Record<string, number> = {}
  for (const el of netlist.elements) {
    if (el.type === 'resistor') {
      elementCurrents[el.id] = (voltageAt(el.nodes[0]) - voltageAt(el.nodes[1])) / el.value
    } else if (el.type === 'current_source') {
      // Through the source itself, nodes[0] → nodes[1] is -value
      elementCurrents[el.id] = -el.value
    } else if (el.type === 'diode') {
      const p = el.params ?? SILICON_DIODE_PARAMS
      elementCurrents[el.id] = diodeCurrent(voltageAt(el.nodes[0]) - voltageAt(el.nodes[1]), p)
    }
  }
  voltageSources.forEach((vs, k) => {
    elementCurrents[vs.id] = x![numNodes + k]
  })

  return { solved: true, nodeVoltages, elementCurrents, iterations }
}
