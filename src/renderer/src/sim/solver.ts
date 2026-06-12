/**
 * Volt — DC Circuit Solver (Modified Nodal Analysis)
 *
 * Pure-TypeScript linear MNA engine. No DOM dependencies — designed to be
 * wrapped in a Web Worker (Phase 1, canvas integration step).
 *
 * Currently supported elements (linear DC):
 *   - resistor        value = resistance in ohms (Ω)
 *   - voltage_source  value = DC voltage in volts (V), nodes[0] = positive terminal
 *   - current_source  value = DC current in amps (A), pushes current out of nodes[0]
 *                     into the external circuit and back into nodes[1]
 *
 * Nonlinear elements (diode, LED, BJT) arrive next via Newton-Raphson iteration
 * around this linear core.
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

export type ElementType = 'resistor' | 'voltage_source' | 'current_source'

export interface NetlistElement {
  id: string
  type: ElementType
  value: number
  /** [first terminal, second terminal]. For sources, nodes[0] is the + terminal. */
  nodes: [string, string]
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
  error?: string
}

// ── Validation ───────────────────────────────────────────────────────────────

function validate(netlist: Netlist): string | null {
  if (netlist.elements.length === 0) return 'Circuit is empty'

  const nodes = new Set<string>()
  for (const el of netlist.elements) {
    if (!Number.isFinite(el.value)) return `Element ${el.id} has an invalid value`
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
    // Partial pivot: find the row with the largest magnitude in this column
    let pivotRow = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivotRow][col])) pivotRow = r
    }
    if (Math.abs(A[pivotRow][col]) < SINGULAR_EPS) return null

    if (pivotRow !== col) {
      ;[A[col], A[pivotRow]] = [A[pivotRow], A[col]]
      ;[b[col], b[pivotRow]] = [b[pivotRow], b[col]]
    }

    // Eliminate below
    for (let r = col + 1; r < n; r++) {
      const factor = A[r][col] / A[col][col]
      if (factor === 0) continue
      for (let c = col; c < n; c++) A[r][c] -= factor * A[col][c]
      b[r] -= factor * b[col]
    }
  }

  // Back-substitution
  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row]
    for (let c = row + 1; c < n; c++) sum -= A[row][c] * x[c]
    x[row] = sum / A[row][row]
  }
  return x
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
  const numVSources = voltageSources.length
  const size = numNodes + numVSources

  if (size === 0) return fail('Circuit has no nodes to solve')

  // A·x = z, where x = [node voltages..., v-source currents...]
  const A: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0))
  const z = new Array<number>(size).fill(0)

  // idx() returns -1 for ground, which means "skip the stamp"
  const idx = (node: string): number => (node === GROUND ? -1 : nodeIndex.get(node)!)

  for (const el of netlist.elements) {
    const [a, b] = el.nodes
    const ia = idx(a)
    const ib = idx(b)

    if (el.type === 'resistor') {
      const g = 1 / el.value
      if (ia >= 0) A[ia][ia] += g
      if (ib >= 0) A[ib][ib] += g
      if (ia >= 0 && ib >= 0) {
        A[ia][ib] -= g
        A[ib][ia] -= g
      }
    } else if (el.type === 'current_source') {
      // Pushes current out of nodes[0] into the circuit, returns at nodes[1]
      if (ia >= 0) z[ia] += el.value
      if (ib >= 0) z[ib] -= el.value
    }
  }

  voltageSources.forEach((vs, k) => {
    const row = numNodes + k
    const ia = idx(vs.nodes[0]) // + terminal
    const ib = idx(vs.nodes[1]) // - terminal
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

  const x = solveLinearSystem(A, z)
  if (x === null)
    return fail(
      'Circuit could not be solved — check for voltage source loops or isolated components'
    )

  // ── Extract results ──
  const nodeVoltages: Record<string, number> = { [GROUND]: 0 }
  for (const [name, i] of nodeIndex) nodeVoltages[name] = x[i]

  const voltageAt = (node: string): number => nodeVoltages[node] ?? 0

  const elementCurrents: Record<string, number> = {}
  for (const el of netlist.elements) {
    if (el.type === 'resistor') {
      elementCurrents[el.id] = (voltageAt(el.nodes[0]) - voltageAt(el.nodes[1])) / el.value
    } else if (el.type === 'current_source') {
      // Current through the source itself flows nodes[1] → nodes[0] internally;
      // from the nodes[0] → nodes[1] perspective that is -value.
      elementCurrents[el.id] = -el.value
    }
  }
  voltageSources.forEach((vs, k) => {
    elementCurrents[vs.id] = x[numNodes + k]
  })

  return { solved: true, nodeVoltages, elementCurrents }
}
