/**
 * Volt — Wire measurement helpers
 *
 * Small, pure functions that derive a wire's electrical readings from a solved
 * SimulationResult. Shared by the canvas (animated current + on-wire readout)
 * and the Inspector (net preview panel), and unit-tested in isolation.
 */
import type { Wire } from './elements'
import type { SimulationResult } from '../stores/circuitStore'
import { terminalKey } from './netlist'

/**
 * Current flowing along a wire, from its `from` endpoint to its `to` endpoint.
 * Returns null when neither endpoint's component has a known current.
 *
 * Element currents run terminal 0 → terminal 1 *inside* the component; at
 * terminal 1 the current exits into the attached wire.
 */
export function wireCurrent(wire: Wire, sim: SimulationResult): number | null {
  // Live simulation: wires are real resistors, so their current is measured directly
  const own = sim.elementCurrents[wire.id]
  if (own !== undefined) return own
  const fromI = sim.elementCurrents[wire.fromComponentId]
  if (fromI !== undefined) {
    return wire.fromTerminal === 1 ? fromI : -fromI
  }
  const toI = sim.elementCurrents[wire.toComponentId]
  if (toI !== undefined) {
    return -(wire.toTerminal === 1 ? toI : -toI)
  }
  return null
}

/**
 * Node (net) voltage a wire sits at. Both endpoints of a wire share a node, so
 * either terminal yields the same value; we read the `from` endpoint.
 */
export function wireNetVoltage(wire: Wire, sim: SimulationResult): number | null {
  const node = sim.terminalNodes[terminalKey(wire.fromComponentId, wire.fromTerminal)]
  const v = node !== undefined ? sim.nodeVoltages[node] : undefined
  return v ?? null
}
