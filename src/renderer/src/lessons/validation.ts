/**
 * Volt — Circuit Quiz Validation
 *
 * Validates a learner's circuit against a set of declarative CircuitConditions.
 * Runs entirely on the main thread (synchronous) — circuits in lessons are small
 * enough that worker overhead isn't warranted.
 */

import { buildNetlist, terminalKey } from '../sim/netlist'
import { solveDC } from '../sim/solver'
import type { CircuitComponent, Wire } from '../sim/elements'
import type { CircuitCondition } from './types'

export interface ValidationResult {
  passed: boolean
  /** Labels of all failing conditions — shown to the learner as actionable feedback. */
  failures: string[]
}

/**
 * Validate a learner's circuit against a set of declarative conditions.
 * All conditions must pass for `passed` to be true.
 */
export function validateCircuitQuiz(
  components: CircuitComponent[],
  wires: Wire[],
  conditions: CircuitCondition[]
): ValidationResult {
  const failures: string[] = []

  // Build netlist + solve once; reuse results for every condition.
  const { netlist, terminalNodes } = buildNetlist(components, wires)
  const result = solveDC(netlist)

  for (const cond of conditions) {
    switch (cond.type) {
      case 'circuit_solves': {
        if (!result.solved) {
          failures.push(cond.label)
        }
        break
      }

      case 'component_type_current': {
        if (!result.solved) {
          failures.push(cond.label)
          break
        }
        // Find all components of the given type and check each one's current.
        const matching = components.filter((c) => c.type === cond.componentType)
        if (matching.length === 0) {
          failures.push(cond.label)
          break
        }
        // At least one component of the type must be in [min, max].
        const anyPass = matching.some((comp) => {
          const current = Math.abs(result.elementCurrents[comp.id] ?? NaN)
          const ok =
            (cond.min === undefined || current >= cond.min) &&
            (cond.max === undefined || current <= cond.max)
          return ok
        })
        if (!anyPass) {
          failures.push(cond.label)
        }
        break
      }

      case 'voltmeter_reads': {
        if (!result.solved) {
          failures.push(cond.label)
          break
        }
        // Find the first voltmeter and read voltage at terminal 0.
        const vm = components.find((c) => c.type === 'voltmeter')
        if (!vm) {
          failures.push(cond.label)
          break
        }
        const node = terminalNodes[terminalKey(vm.id, 0)]
        const voltage = node !== undefined ? (result.nodeVoltages[node] ?? NaN) : NaN
        const ok =
          Number.isFinite(voltage) &&
          (cond.min === undefined || voltage >= cond.min) &&
          (cond.max === undefined || voltage <= cond.max)
        if (!ok) {
          failures.push(cond.label)
        }
        break
      }

      case 'component_present': {
        const count = cond.count ?? 1
        const found = components.filter((c) => c.type === cond.componentType).length
        if (found < count) {
          failures.push(cond.label)
        }
        break
      }

      case 'component_absent': {
        const found = components.some((c) => c.type === cond.componentType)
        if (found) {
          failures.push(cond.label)
        }
        break
      }
    }
  }

  return { passed: failures.length === 0, failures }
}
