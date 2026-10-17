/**
 * Per-frame readings for 3D renderers: the live snapshot when the live engine
 * owns the result, otherwise the stored (steady/AC) result.
 */
import { useCircuitStore, type SimulationResult } from '@stores/circuitStore'
import { liveFrame } from '@stores/liveSimStore'

export function displayResult(): SimulationResult | null {
  const stored = useCircuitStore.getState().simResult
  const snap = liveFrame.snapshot
  // AC phasor results are peak magnitudes; the live engine still has the
  // instantaneous time-domain values, which is what the bench should animate.
  if (snap?.solved && stored) {
    return {
      ...stored,
      solved: true,
      nodeVoltages: snap.nodeVoltages,
      elementCurrents: snap.elementCurrents,
      terminalNodes: liveFrame.terminalNodes
    }
  }
  return stored
}

export function currentOf(r: SimulationResult | null, id: string): number {
  return r?.elementCurrents[id] ?? 0
}
