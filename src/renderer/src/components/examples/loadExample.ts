/** Load an example circuit into the sandbox with a fresh simulation and its suggested settings. */
import { useCircuitStore } from '@stores/circuitStore'
import { useLiveSimStore } from '@stores/liveSimStore'
import { useUIStore } from '@stores/uiStore'
import { getExample } from '../../examples/examples'

export function loadExample(id: string): void {
  const ex = getExample(id)
  if (!ex) return
  const circuit = JSON.parse(JSON.stringify(ex.circuit)) as typeof ex.circuit
  const live = useLiveSimStore.getState()
  live.requestReset()
  live.setRunning(true)
  live.setTimeScale(ex.timeScale ?? 1)
  const ui = useUIStore.getState()
  ui.openExample(id)
  ui.setScopeOpen(ex.scope ?? false)
  if (ex.view) ui.setBenchView(ex.view)
  useCircuitStore.getState().loadCircuitData(circuit.components, circuit.wires)
}
