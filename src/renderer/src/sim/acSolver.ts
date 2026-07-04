/**
 * Volt — AC Phasor Solver (single-frequency steady state)
 *
 * Complex Modified Nodal Analysis at one angular frequency ω. Structurally
 * identical to the DC solver (solver.ts) but every stamp is a complex
 * admittance, so the system is solved once with the complex linear solver — no
 * Newton-Raphson, because linear R/L/C networks are linear in the phasor
 * domain.
 *
 * Element impedances at angular frequency ω:
 *   - resistor   Z = R           → Y = 1/R
 *   - inductor   Z = jωL         → Y = 1/(jωL) = -j/(ωL)
 *   - capacitor  Z = 1/(jωC)     → Y = jωC
 *
 * Sources carry a phasor: `amplitude` (peak) and `phaseDeg`. All sources are
 * analyzed at the same ω (single-frequency steady state). Results are complex
 * phasors; use abs()/phaseDeg() from complex.ts, or the rms() helper here.
 *
 * Pure and DOM-free — designed to run in the Web Worker.
 */

import {
  type Complex,
  cplx,
  add,
  sub,
  mul,
  abs,
  fromPolar
} from './complex'
import { solveComplexLinearSystem } from './complex'

export const GROUND = 'gnd'

export type ACElementType =
  | 'resistor'
  | 'inductor'
  | 'capacitor'
  | 'ac_voltage_source'
  | 'ac_current_source'
  | 'transformer'

export interface ACNetlistElement {
  id: string
  type: ACElementType
  /** [first terminal, second terminal]. For sources, nodes[0] is the + terminal. */
  nodes: [string, string]
  /** R in Ω, L in henries, C in farads. Ignored for sources. */
  value: number
  /** Source phasor peak amplitude (V or A). Sources only. */
  amplitude?: number
  /** Source phasor phase in degrees (default 0). Sources only. */
  phaseDeg?: number
  /** Transformer secondary [+, −] nodes (transformer only). */
  secondaryNodes?: [string, string]
  /** Ideal transformer turns ratio Np:Ns (transformer only). */
  ratio?: number
}

export interface ACNetlist {
  elements: ACNetlistElement[]
}

export interface ACSolveResult {
  solved: boolean
  /** angular frequency the solve was run at (rad/s) */
  omega: number
  /** node name → complex voltage phasor (peak). Includes 'gnd' at 0. */
  nodeVoltages: Record<string, Complex>
  /** element id → complex current phasor (peak), nodes[0] → nodes[1]. */
  elementCurrents: Record<string, Complex>
  error?: string
}

/** RMS magnitude of a peak phasor (peak / √2). */
export function rms(phasor: Complex): number {
  return abs(phasor) / Math.SQRT2
}

// ── Validation (mirrors solver.ts) ────────────────────────────────────────────

function validate(netlist: ACNetlist): string | null {
  if (netlist.elements.length === 0) return 'Circuit is empty'

  const nodes = new Set<string>()
  for (const el of netlist.elements) {
    const isSource = el.type === 'ac_voltage_source' || el.type === 'ac_current_source'
    if (!isSource && el.type !== 'transformer' && !(Number.isFinite(el.value) && el.value > 0)) {
      return `Element ${el.id} has an invalid value`
    }
    nodes.add(el.nodes[0])
    nodes.add(el.nodes[1])
    if (el.secondaryNodes) {
      nodes.add(el.secondaryNodes[0])
      nodes.add(el.secondaryNodes[1])
    }
  }

  if (!nodes.has(GROUND))
    return 'Circuit has no ground reference — add a ground connection'

  const adjacency = new Map<string, string[]>()
  for (const el of netlist.elements) {
    const [a, b] = el.nodes
    if (!adjacency.has(a)) adjacency.set(a, [])
    if (!adjacency.has(b)) adjacency.set(b, [])
    adjacency.get(a)!.push(b)
    adjacency.get(b)!.push(a)
    if (el.secondaryNodes) {
      const [c, d] = el.secondaryNodes
      if (!adjacency.has(c)) adjacency.set(c, [])
      if (!adjacency.has(d)) adjacency.set(d, [])
      adjacency.get(c)!.push(d)
      adjacency.get(d)!.push(c)
    }
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
    if (!visited.has(n)) return `Node "${n}" is not connected to ground (floating subcircuit)`
  }

  return null
}

// ── Admittance of a passive element at ω ──────────────────────────────────────

function admittance(el: ACNetlistElement, omega: number): Complex {
  switch (el.type) {
    case 'resistor':
      return cplx(1 / el.value, 0)
    case 'inductor':
      // Y = 1/(jωL) = -j/(ωL)
      return cplx(0, -1 / (omega * el.value))
    case 'capacitor':
      // Y = jωC
      return cplx(0, omega * el.value)
    default:
      return cplx(0, 0)
  }
}

// ── Solver ────────────────────────────────────────────────────────────────────

export function solveAC(netlist: ACNetlist, omega: number): ACSolveResult {
  const fail = (error: string): ACSolveResult => ({
    solved: false,
    omega,
    nodeVoltages: {},
    elementCurrents: {},
    error
  })

  if (!(omega > 0)) return fail('AC analysis requires a positive frequency')

  const validationError = validate(netlist)
  if (validationError) return fail(validationError)

  // Index non-ground nodes
  const nodeIndex = new Map<string, number>()
  for (const el of netlist.elements) {
    for (const n of el.nodes) {
      if (n !== GROUND && !nodeIndex.has(n)) nodeIndex.set(n, nodeIndex.size)
    }
    if (el.secondaryNodes) {
      for (const n of el.secondaryNodes) {
        if (n !== GROUND && !nodeIndex.has(n)) nodeIndex.set(n, nodeIndex.size)
      }
    }
  }
  const numNodes = nodeIndex.size

  const vSources = netlist.elements.filter((e) => e.type === 'ac_voltage_source')
  const numVSources = vSources.length
  const transformers = netlist.elements.filter((e) => e.type === 'transformer')
  const numTransformers = transformers.length
  const size = numNodes + numVSources + numTransformers
  if (size === 0) return fail('Circuit has no nodes to solve')

  const idx = (node: string): number => (node === GROUND ? -1 : nodeIndex.get(node)!)

  const A: Complex[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => cplx(0, 0))
  )
  const z: Complex[] = Array.from({ length: size }, () => cplx(0, 0))

  const stampAdmittance = (ia: number, ib: number, Y: Complex): void => {
    if (ia >= 0) A[ia][ia] = add(A[ia][ia], Y)
    if (ib >= 0) A[ib][ib] = add(A[ib][ib], Y)
    if (ia >= 0 && ib >= 0) {
      A[ia][ib] = sub(A[ia][ib], Y)
      A[ib][ia] = sub(A[ib][ia], Y)
    }
  }

  const stampCurrent = (ia: number, ib: number, I: Complex): void => {
    if (ia >= 0) z[ia] = add(z[ia], I)
    if (ib >= 0) z[ib] = sub(z[ib], I)
  }

  // Passive elements + current sources
  for (const el of netlist.elements) {
    const ia = idx(el.nodes[0])
    const ib = idx(el.nodes[1])
    if (el.type === 'resistor' || el.type === 'inductor' || el.type === 'capacitor') {
      stampAdmittance(ia, ib, admittance(el, omega))
    } else if (el.type === 'ac_current_source') {
      const I = fromPolar(el.amplitude ?? 0, ((el.phaseDeg ?? 0) * Math.PI) / 180)
      stampCurrent(ia, ib, I)
    }
  }

  // Voltage sources — augmented MNA rows
  vSources.forEach((vs, k) => {
    const row = numNodes + k
    const ia = idx(vs.nodes[0])
    const ib = idx(vs.nodes[1])
    if (ia >= 0) {
      A[ia][row] = add(A[ia][row], cplx(1, 0))
      A[row][ia] = add(A[row][ia], cplx(1, 0))
    }
    if (ib >= 0) {
      A[ib][row] = sub(A[ib][row], cplx(1, 0))
      A[row][ib] = sub(A[row][ib], cplx(1, 0))
    }
    z[row] = fromPolar(vs.amplitude ?? 0, ((vs.phaseDeg ?? 0) * Math.PI) / 180)
  })

  // Ideal transformers — one extra current unknown (primary current) each.
  // Constraint: (v_p+ − v_p−) = n·(v_s+ − v_s−);  ampere-turns: i_s = −n·i_p.
  transformers.forEach((tf, k) => {
    const row = numNodes + numVSources + k
    const n = tf.ratio ?? 1
    const one = cplx(1, 0)
    const nn = cplx(n, 0)
    const [pp, pm] = tf.nodes
    const [sp, sm] = tf.secondaryNodes ?? [GROUND, GROUND]
    const ipp = idx(pp), ipm = idx(pm), isp = idx(sp), ism = idx(sm)
    // primary current i_p flows into p+ and out of p−
    if (ipp >= 0) { A[ipp][row] = add(A[ipp][row], one); A[row][ipp] = add(A[row][ipp], one) }
    if (ipm >= 0) { A[ipm][row] = sub(A[ipm][row], one); A[row][ipm] = sub(A[row][ipm], one) }
    // secondary current −n·i_p into s+ and out of s−
    if (isp >= 0) { A[isp][row] = sub(A[isp][row], nn); A[row][isp] = sub(A[row][isp], nn) }
    if (ism >= 0) { A[ism][row] = add(A[ism][row], nn); A[row][ism] = add(A[row][ism], nn) }
    z[row] = cplx(0, 0)
  })

  const x = solveComplexLinearSystem(A, z)
  if (x === null)
    return fail('Circuit could not be solved — check for source loops or isolated components')

  // Node voltages
  const nodeVoltages: Record<string, Complex> = { [GROUND]: cplx(0, 0) }
  for (const [name, i] of nodeIndex) nodeVoltages[name] = x[i]
  const vAt = (node: string): Complex => nodeVoltages[node] ?? cplx(0, 0)

  // Element currents
  const elementCurrents: Record<string, Complex> = {}
  for (const el of netlist.elements) {
    if (el.type === 'resistor' || el.type === 'inductor' || el.type === 'capacitor') {
      const vDrop = sub(vAt(el.nodes[0]), vAt(el.nodes[1]))
      elementCurrents[el.id] = mul(vDrop, admittance(el, omega))
    } else if (el.type === 'ac_current_source') {
      // Through the source nodes[0] → nodes[1] is -I (current is pushed out of nodes[0])
      const I = fromPolar(el.amplitude ?? 0, ((el.phaseDeg ?? 0) * Math.PI) / 180)
      elementCurrents[el.id] = cplx(-I.re, -I.im)
    }
  }
  vSources.forEach((vs, k) => {
    elementCurrents[vs.id] = x[numNodes + k]
  })
  transformers.forEach((tf, k) => {
    elementCurrents[tf.id] = x[numNodes + numVSources + k]
  })

  return { solved: true, omega, nodeVoltages, elementCurrents }
}

// Re-export the admittance helper for tests/inspection.
export { admittance as elementAdmittance }
