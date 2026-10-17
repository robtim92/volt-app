/**
 * Volt — Netlist Builder
 *
 * Converts the canvas representation (components + wires between terminals)
 * into the node-based netlists the solvers consume — `buildNetlist` for the DC
 * MNA solver, `buildACNetlist` for the AC phasor solver.
 *
 * Node identification is a union-find over terminals: every wire merges the
 * two terminals it connects. Any group containing a ground component's
 * terminal becomes the 'gnd' node; all other groups get sequential names.
 *
 * DC behaviour of reactive components (steady state):
 *   - capacitor → open circuit (omitted from the netlist)
 *   - inductor  → ideal wire (modelled as a 1 mΩ resistor)
 * In AC analysis these become real complex impedances (see acSolver.ts); the AC
 * builder passes their L/C values straight through.
 */

import { GROUND, LED_PARAMS, type Netlist, type NetlistElement } from './solver'
import type { ACNetlist, ACNetlistElement } from './acSolver'
import type { TransientElement, TransientNetlist } from './transient'
import { DEFAULT_GAUGE, METRES_PER_PIXEL, MIN_WIRE_LENGTH, wireResistance } from './wire'
import { pathLength, wirePath } from './wireRoute'
import {
  BENCH_DEFAULT_LIMIT,
  CHEMISTRIES,
  DEFAULT_CHEMISTRY,
  packOcv,
  packResistance,
  type BatteryParams
} from './battery'
import { ELEMENTS, type CircuitComponent, type Wire } from './elements'

/** Resistance used for closed switches, ammeters, and DC-shorted inductors */
const SHORT_RESISTANCE = 1e-3
/** Voltmeter input impedance (10 MΩ, like a real multimeter) */
const VOLTMETER_RESISTANCE = 1e7
/** Internal series resistance of an LED / rectifier diode (time-domain model) */
const LED_SERIES_RESISTANCE = 2
const DIODE_SERIES_RESISTANCE = 0.1

export interface NetlistBuildResult {
  netlist: Netlist
  /** `${componentId}:${terminalIndex}` → node name (for visualization) */
  terminalNodes: Record<string, string>
  /** Human-readable issues: unconnected terminals, unsupported components... */
  warnings: string[]
}

export interface ACNetlistBuildResult {
  netlist: ACNetlist
  terminalNodes: Record<string, string>
  warnings: string[]
}

export const terminalKey = (componentId: string, terminal: number): string =>
  `${componentId}:${terminal}`

// ── Union-find ───────────────────────────────────────────────────────────────

class UnionFind {
  private parent = new Map<string, string>()

  find(k: string): string {
    let root = this.parent.get(k) ?? k
    if (root !== k) {
      root = this.find(root)
      this.parent.set(k, root) // path compression
    }
    return root
  }

  union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

// ── Shared node assignment ─────────────────────────────────────────────────────

interface NodeAssignment {
  terminalNodes: Record<string, string>
  wiredTerminals: Set<string>
  warnings: string[]
  byId: Map<string, CircuitComponent>
}

/** Union-find over terminals → stable node names. Shared by both builders. */
function computeTerminalNodes(
  components: CircuitComponent[],
  wires: Wire[],
  autoGround = false
): NodeAssignment {
  const warnings: string[] = []
  const byId = new Map(components.map((c) => [c.id, c]))
  const uf = new UnionFind()

  const allTerminals: string[] = []
  for (const c of components) {
    const def = ELEMENTS[c.type]
    for (let t = 0; t < def.terminals.length; t++) {
      allTerminals.push(terminalKey(c.id, t))
    }
  }

  const wiredTerminals = new Set<string>()
  for (const w of wires) {
    const from = byId.get(w.fromComponentId)
    const to = byId.get(w.toComponentId)
    if (!from || !to) {
      warnings.push(`Wire ${w.id} references a missing component`)
      continue
    }
    if (
      w.fromTerminal >= ELEMENTS[from.type].terminals.length ||
      w.toTerminal >= ELEMENTS[to.type].terminals.length
    ) {
      warnings.push(`Wire ${w.id} references an invalid terminal`)
      continue
    }
    const a = terminalKey(w.fromComponentId, w.fromTerminal)
    const b = terminalKey(w.toComponentId, w.toTerminal)
    uf.union(a, b)
    wiredTerminals.add(a)
    wiredTerminals.add(b)
  }

  const groupNames = new Map<string, string>()
  for (const c of components) {
    if (c.type === 'ground') {
      groupNames.set(uf.find(terminalKey(c.id, 0)), GROUND)
    }
  }
  if (autoGround && groupNames.size === 0) {
    // No ground placed: reference the negative terminal of the first source,
    // like a battery's (−) post. Beginners don't need to know about ground yet.
    const src = components.find(
      (c) =>
        c.type === 'voltage_source' ||
        c.type === 'ac_voltage_source' ||
        c.type === 'current_source' ||
        c.type === 'battery' ||
        c.type === 'bench_supply'
    )
    if (src) groupNames.set(uf.find(terminalKey(src.id, 1)), GROUND)
  }

  let counter = 0
  const nodeNameOf = (terminal: string): string => {
    const root = uf.find(terminal)
    let name = groupNames.get(root)
    if (!name) {
      counter += 1
      name = `n${counter}`
      groupNames.set(root, name)
    }
    return name
  }

  const terminalNodes: Record<string, string> = {}
  for (const t of allTerminals) terminalNodes[t] = nodeNameOf(t)

  return { terminalNodes, wiredTerminals, warnings, byId }
}

const labelOf = (c: CircuitComponent): string => c.label ?? c.id

/**
 * For a standard two-terminal component: verify both ends are wired and that
 * it isn't shorted. Returns its [nodeA, nodeB] or null (with a warning pushed).
 */
function twoTerminalNodes(
  c: CircuitComponent,
  terminalNodes: Record<string, string>,
  wiredTerminals: Set<string>,
  warnings: string[]
): [string, string] | null {
  const def = ELEMENTS[c.type]
  const unwired = def.terminals
    .map((_, i) => i)
    .filter((i) => !wiredTerminals.has(terminalKey(c.id, i)))
  if (unwired.length > 0) {
    warnings.push(`${labelOf(c)} has an unconnected terminal`)
    return null
  }
  const nodes: [string, string] = [
    terminalNodes[terminalKey(c.id, 0)],
    terminalNodes[terminalKey(c.id, 1)]
  ]
  if (nodes[0] === nodes[1]) {
    if (c.type === 'voltage_source' || c.type === 'ac_voltage_source') {
      warnings.push(`${labelOf(c)} is short-circuited`)
    }
    return null
  }
  return nodes
}

// ── DC builder ─────────────────────────────────────────────────────────────────

export function buildNetlist(
  components: CircuitComponent[],
  wires: Wire[]
): NetlistBuildResult {
  const { terminalNodes, wiredTerminals, warnings } = computeTerminalNodes(components, wires)

  const elements: NetlistElement[] = []
  for (const c of components) {
    if (c.type === 'ground' || c.type === 'wire_node') continue
    if (c.type === 'transistor_npn') {
      warnings.push(`${labelOf(c)}: transistors are not supported yet`)
      continue
    }
    if (c.type === 'transformer') {
      warnings.push(`${labelOf(c)}: transformers require AC analysis (they don't pass DC)`)
      continue
    }

    const nodes = twoTerminalNodes(c, terminalNodes, wiredTerminals, warnings)
    if (!nodes) continue

    const value = c.value ?? ELEMENTS[c.type].defaultValue ?? 0

    switch (c.type) {
      case 'resistor':
        elements.push({ id: c.id, type: 'resistor', value, nodes })
        break
      case 'voltage_source':
      case 'bench_supply':
        elements.push({ id: c.id, type: 'voltage_source', value, nodes })
        break
      case 'battery': {
        const p = batteryParams(c)
        const internal = `${c.id}#int`
        elements.push({ id: c.id, type: 'voltage_source', value: packOcv(p), nodes: [internal, nodes[1]] })
        elements.push({ id: `${c.id}#ri`, type: 'resistor', value: packResistance(p), nodes: [internal, nodes[0]] })
        break
      }
      case 'ac_voltage_source':
        // In DC steady state an AC source averages to 0 V → a short.
        elements.push({ id: c.id, type: 'voltage_source', value: 0, nodes })
        break
      case 'current_source':
        elements.push({ id: c.id, type: 'current_source', value, nodes })
        break
      case 'diode':
        elements.push({ id: c.id, type: 'diode', value: 0, nodes })
        break
      case 'led':
        elements.push({ id: c.id, type: 'diode', value: 0, nodes, params: LED_PARAMS })
        break
      case 'switch':
      case 'breaker':
      case 'gfci':
        // Conductor when on/closed; open (no element) otherwise. Overcurrent
        // tripping is flagged post-solve in useSimulation, not modelled here.
        if (c.closed) {
          elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        }
        break
      case 'inductor':
        elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        break
      case 'capacitor':
        break
      case 'voltmeter':
        elements.push({ id: c.id, type: 'resistor', value: VOLTMETER_RESISTANCE, nodes })
        break
      case 'ammeter':
        elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        break
    }
  }

  return { netlist: { elements }, terminalNodes, warnings }
}

// ── AC builder ─────────────────────────────────────────────────────────────────

/**
 * Build the netlist for single-frequency AC phasor analysis. Reactive elements
 * keep their real L/C values (turned into complex impedances by the solver at ω).
 * Nonlinear parts (diodes/LEDs/transistors) aren't modelled in AC and are
 * dropped with a warning; a DC voltage source becomes a short (0 V AC).
 */
export function buildACNetlist(
  components: CircuitComponent[],
  wires: Wire[]
): ACNetlistBuildResult {
  const { terminalNodes, wiredTerminals, warnings } = computeTerminalNodes(components, wires)

  const elements: ACNetlistElement[] = []
  for (const c of components) {
    if (c.type === 'ground' || c.type === 'wire_node') continue
    if (c.type === 'transistor_npn') {
      warnings.push(`${labelOf(c)}: transistors are not supported in AC analysis`)
      continue
    }
    if (c.type === 'diode' || c.type === 'led') {
      warnings.push(`${labelOf(c)}: diodes are not modelled in AC analysis`)
      continue
    }
    if (c.type === 'transformer') {
      const keys = [0, 1, 2, 3].map((i) => terminalKey(c.id, i))
      const unwired = keys.filter((k) => !wiredTerminals.has(k))
      if (unwired.length > 0) {
        warnings.push(`${labelOf(c)} has an unconnected terminal`)
        continue
      }
      const pPlus = terminalNodes[keys[0]]
      const pMinus = terminalNodes[keys[1]]
      const sPlus = terminalNodes[keys[2]]
      const sMinus = terminalNodes[keys[3]]
      if (pPlus === pMinus || sPlus === sMinus) {
        warnings.push(`${labelOf(c)} has a short-circuited winding`)
        continue
      }
      elements.push({
        id: c.id,
        type: 'transformer',
        value: 0,
        ratio: c.value ?? 2,
        nodes: [pPlus, pMinus],
        secondaryNodes: [sPlus, sMinus]
      })
      continue
    }

    const nodes = twoTerminalNodes(c, terminalNodes, wiredTerminals, warnings)
    if (!nodes) continue

    const value = c.value ?? ELEMENTS[c.type].defaultValue ?? 0

    switch (c.type) {
      case 'resistor':
        elements.push({ id: c.id, type: 'resistor', value, nodes })
        break
      case 'inductor':
        elements.push({ id: c.id, type: 'inductor', value, nodes })
        break
      case 'capacitor':
        elements.push({ id: c.id, type: 'capacitor', value, nodes })
        break
      case 'ac_voltage_source':
        elements.push({
          id: c.id,
          type: 'ac_voltage_source',
          value: 0,
          amplitude: value,
          phaseDeg: c.phase ?? 0,
          nodes
        })
        break
      case 'voltage_source':
      case 'battery':
      case 'bench_supply':
        // A DC source contributes nothing at the analysis frequency → short it.
        warnings.push(`${labelOf(c)}: DC source treated as a short in AC analysis`)
        elements.push({
          id: c.id,
          type: 'ac_voltage_source',
          value: 0,
          amplitude: 0,
          phaseDeg: 0,
          nodes
        })
        break
      case 'current_source':
        // DC current source → open circuit in AC. Drop it.
        warnings.push(`${labelOf(c)}: DC current source is open in AC analysis`)
        break
      case 'switch':
      case 'breaker':
      case 'gfci':
        // Conductor when on/closed; open (no element) otherwise. Overcurrent
        // tripping is flagged post-solve in useSimulation, not modelled here.
        if (c.closed) {
          elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        }
        break
      case 'voltmeter':
        elements.push({ id: c.id, type: 'resistor', value: VOLTMETER_RESISTANCE, nodes })
        break
      case 'ammeter':
        elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        break
    }
  }

  return { netlist: { elements }, terminalNodes, warnings }
}

// ── Transient (time-domain) builder ─────────────────────────────────────────────

export interface TransientNetlistBuildResult {
  netlist: TransientNetlist
  terminalNodes: Record<string, string>
  warnings: string[]
}

export interface TransientBuildOptions {
  /** live state of charge per battery id (falls back to the component's `soc`, then 1) */
  soc?: Record<string, number>
}

/** Length (m) of a wire: its explicit length, or measured from the drawing. */
export function wireLength(w: Wire, byId: Map<string, CircuitComponent>): number {
  if (w.length !== undefined && w.length > 0) return w.length
  const path = wirePath(w, byId)
  if (!path) return MIN_WIRE_LENGTH
  return Math.max(MIN_WIRE_LENGTH, pathLength(path) * METRES_PER_PIXEL)
}

export function batteryParams(c: CircuitComponent, soc?: Record<string, number>): BatteryParams {
  const chemistry = c.chemistry ?? DEFAULT_CHEMISTRY
  return {
    chemistry,
    cells: Math.max(1, Math.round(c.cells ?? CHEMISTRIES[chemistry].defaultCells)),
    soc: soc?.[c.id] ?? c.soc ?? 1
  }
}

/**
 * Build the netlist for time-domain simulation.
 *   - Every wire is a real copper resistor (gauge × length); melted wires are open.
 *   - Capacitors and inductors keep their real values; AC sources become sines.
 *   - Batteries are their open-circuit voltage behind an internal resistance;
 *     bench supplies are voltage sources with a current limit (CV/CC).
 *   - Damaged (burnt-out) components are open circuits.
 *   - With no ground placed, the first source's (−) terminal is the reference.
 */
export function buildTransientNetlist(
  components: CircuitComponent[],
  wires: Wire[],
  opts: TransientBuildOptions = {}
): TransientNetlistBuildResult {
  // Every terminal is its own node; wires connect them as resistors.
  const { terminalNodes, warnings, byId } = computeTerminalNodes(components, [], true)
  const wiredTerminals = new Set<string>()
  const elements: TransientElement[] = []

  for (const w of wires) {
    const from = byId.get(w.fromComponentId)
    const to = byId.get(w.toComponentId)
    if (!from || !to) {
      warnings.push(`Wire ${w.id} references a missing component`)
      continue
    }
    if (
      w.fromTerminal >= ELEMENTS[from.type].terminals.length ||
      w.toTerminal >= ELEMENTS[to.type].terminals.length
    ) {
      warnings.push(`Wire ${w.id} references an invalid terminal`)
      continue
    }
    const a = terminalKey(w.fromComponentId, w.fromTerminal)
    const b = terminalKey(w.toComponentId, w.toTerminal)
    wiredTerminals.add(a)
    wiredTerminals.add(b)
    if (w.damaged) continue // melted → open
    const na = terminalNodes[a]
    const nb = terminalNodes[b]
    if (na === nb) continue // both ends already the same node (e.g. two grounds)
    elements.push({
      id: w.id,
      type: 'resistor',
      value: wireResistance(w.gauge ?? DEFAULT_GAUGE, wireLength(w, byId)),
      nodes: [na, nb]
    })
  }

  for (const c of components) {
    if (c.type === 'ground' || c.type === 'wire_node') continue
    if (c.damaged) continue // burnt out → open circuit
    if (c.type === 'transistor_npn') {
      warnings.push(`${labelOf(c)}: transistors are not supported yet`)
      continue
    }
    if (c.type === 'transformer') {
      warnings.push(`${labelOf(c)}: transformers are shown in AC analysis only`)
      continue
    }

    const nodes = twoTerminalNodes(c, terminalNodes, wiredTerminals, warnings)
    if (!nodes) continue
    const value = c.value ?? ELEMENTS[c.type].defaultValue ?? 0

    switch (c.type) {
      case 'resistor':
      case 'capacitor':
      case 'inductor':
      case 'voltage_source':
      case 'current_source':
        elements.push({ id: c.id, type: c.type, value, nodes })
        break
      case 'battery': {
        const p = batteryParams(c, opts.soc)
        const internal = `${c.id}#int`
        elements.push({ id: c.id, type: 'voltage_source', value: packOcv(p), nodes: [internal, nodes[1]] })
        elements.push({ id: `${c.id}#ri`, type: 'resistor', value: packResistance(p), nodes: [internal, nodes[0]] })
        break
      }
      case 'bench_supply':
        elements.push({
          id: c.id,
          type: 'supply',
          value,
          limit: c.currentLimit ?? BENCH_DEFAULT_LIMIT,
          nodes
        })
        break
      case 'ac_voltage_source':
        elements.push({
          id: c.id,
          type: 'sine_source',
          value,
          frequency: c.frequency ?? 60,
          phaseDeg: c.phase ?? 0,
          nodes
        })
        break
      case 'diode':
      case 'led': {
        // Real junctions have bulk (series) resistance — without it an ideal
        // source straight across an LED would push effectively infinite current.
        const junction = `${c.id}#j`
        elements.push({
          id: c.id,
          type: 'diode',
          value: 0,
          nodes: [nodes[0], junction],
          params: c.type === 'led' ? LED_PARAMS : undefined
        })
        elements.push({
          id: `${c.id}#rs`,
          type: 'resistor',
          value: c.type === 'led' ? LED_SERIES_RESISTANCE : DIODE_SERIES_RESISTANCE,
          nodes: [junction, nodes[1]]
        })
        break
      }
      case 'switch':
      case 'breaker':
      case 'gfci':
        if (c.closed) elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        break
      case 'voltmeter':
        elements.push({ id: c.id, type: 'resistor', value: VOLTMETER_RESISTANCE, nodes })
        break
      case 'ammeter':
        elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        break
    }
  }
  return { netlist: { elements }, terminalNodes, warnings }
}

/**
 * Single-frequency phasor (AC) analysis applies only to linear circuits with an
 * AC source. Anything with diodes/LEDs (rectifiers, clippers) is nonlinear, so
 * the live time-domain simulator owns those even when an AC source is present.
 */
export function usesPhasorAnalysis(components: CircuitComponent[]): boolean {
  return (
    components.some((c) => c.type === 'ac_voltage_source') &&
    !components.some((c) => c.type === 'diode' || c.type === 'led' || c.type === 'transistor_npn')
  )
}
