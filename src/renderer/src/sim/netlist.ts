/**
 * Volt — Netlist Builder
 *
 * Converts the canvas representation (components + wires between terminals)
 * into the node-based netlist the MNA solver consumes.
 *
 * Node identification is a union-find over terminals: every wire merges the
 * two terminals it connects. Any group containing a ground component's
 * terminal becomes the 'gnd' node; all other groups get sequential names.
 *
 * DC behaviour of reactive components (steady state):
 *   - capacitor → open circuit (omitted from the netlist)
 *   - inductor  → ideal wire (modelled as a 1 mΩ resistor)
 * These become real dynamic models when transient analysis lands (AC phase).
 */

import { GROUND, LED_PARAMS, type Netlist, type NetlistElement } from './solver'
import { ELEMENTS, type CircuitComponent, type Wire } from './elements'

/** Resistance used for closed switches, ammeters, and DC-shorted inductors */
const SHORT_RESISTANCE = 1e-3
/** Voltmeter input impedance (10 MΩ, like a real multimeter) */
const VOLTMETER_RESISTANCE = 1e7

export interface NetlistBuildResult {
  netlist: Netlist
  /** `${componentId}:${terminalIndex}` → node name (for visualization) */
  terminalNodes: Record<string, string>
  /** Human-readable issues: unconnected terminals, unsupported components... */
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

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildNetlist(
  components: CircuitComponent[],
  wires: Wire[]
): NetlistBuildResult {
  const warnings: string[] = []
  const byId = new Map(components.map((c) => [c.id, c]))
  const uf = new UnionFind()

  const labelOf = (c: CircuitComponent): string => c.label ?? c.id

  // Register every terminal of every component
  const allTerminals: string[] = []
  for (const c of components) {
    const def = ELEMENTS[c.type]
    for (let t = 0; t < def.terminals.length; t++) {
      allTerminals.push(terminalKey(c.id, t))
    }
  }

  // Union terminals connected by wires
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

  // Name the nodes: ground groups first, then sequential
  const groupNames = new Map<string, string>()
  for (const c of components) {
    if (c.type === 'ground') {
      groupNames.set(uf.find(terminalKey(c.id, 0)), GROUND)
    }
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

  // Generate solver elements
  const elements: NetlistElement[] = []
  for (const c of components) {
    const def = ELEMENTS[c.type]

    // Structural components produce no element
    if (c.type === 'ground' || c.type === 'wire_node') continue

    if (c.type === 'transistor_npn') {
      warnings.push(`${labelOf(c)}: transistors are not supported yet`)
      continue
    }

    // Two-terminal electrical components: both ends must be wired
    const unwired = def.terminals
      .map((_, i) => i)
      .filter((i) => !wiredTerminals.has(terminalKey(c.id, i)))
    if (unwired.length > 0) {
      warnings.push(`${labelOf(c)} has an unconnected terminal`)
      continue
    }

    const nodes: [string, string] = [
      terminalNodes[terminalKey(c.id, 0)],
      terminalNodes[terminalKey(c.id, 1)]
    ]
    if (nodes[0] === nodes[1]) {
      // Both ends on the same node: shorted component, contributes nothing
      if (c.type === 'voltage_source') {
        warnings.push(`${labelOf(c)} is short-circuited`)
      }
      continue
    }

    const value = c.value ?? ELEMENTS[c.type].defaultValue ?? 0

    switch (c.type) {
      case 'resistor':
        elements.push({ id: c.id, type: 'resistor', value, nodes })
        break
      case 'voltage_source':
        elements.push({ id: c.id, type: 'voltage_source', value, nodes })
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
        // Open switch: no element. Closed: near-ideal conductor.
        if (c.closed) {
          elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        }
        break
      case 'inductor':
        // DC steady state: inductor is a wire
        elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        break
      case 'capacitor':
        // DC steady state: capacitor is an open circuit — no element
        break
      case 'voltmeter':
        // Near-ideal voltmeter: very high input impedance
        elements.push({ id: c.id, type: 'resistor', value: VOLTMETER_RESISTANCE, nodes })
        break
      case 'ammeter':
        // Near-ideal ammeter: negligible series resistance
        elements.push({ id: c.id, type: 'resistor', value: SHORT_RESISTANCE, nodes })
        break
    }
  }

  return { netlist: { elements }, terminalNodes, warnings }
}
