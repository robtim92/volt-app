/**
 * Volt — Live simulation loop
 *
 * Watches the circuit (components + wires), rebuilds the netlist on every
 * change (debounced), solves it — in a Web Worker when available, otherwise
 * synchronously (jsdom/tests) — and writes the result to the circuit store.
 */
import { useEffect, useRef } from 'react'
import { useCircuitStore, type SimulationResult } from '@stores/circuitStore'
import { buildNetlist } from '../sim/netlist'
import { solveDC } from '../sim/solver'
import type { SimRequest, SimResponse } from '../sim/simWorker'

const DEBOUNCE_MS = 60

export function useSimulation(): void {
  const components = useCircuitStore((s) => s.components)
  const wires = useCircuitStore((s) => s.wires)
  const setSimResult = useCircuitStore((s) => s.setSimResult)

  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)

  // Create the worker once
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      try {
        workerRef.current = new Worker(new URL('../sim/simWorker.ts', import.meta.url), {
          type: 'module'
        })
      } catch {
        workerRef.current = null // fall back to sync solving
      }
    }
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (components.length === 0) {
      setSimResult(null)
      return
    }

    const timer = setTimeout(() => {
      const { netlist, terminalNodes, warnings } = buildNetlist(components, wires)

      const publish = (solved: ReturnType<typeof solveDC>): void => {
        const result: SimulationResult = {
          solved: solved.solved,
          nodeVoltages: solved.nodeVoltages,
          elementCurrents: solved.elementCurrents,
          terminalNodes,
          warnings,
          error: solved.error
        }
        setSimResult(result)
      }

      const worker = workerRef.current
      if (worker) {
        const requestId = ++requestIdRef.current
        const handler = (e: MessageEvent<SimResponse>): void => {
          if (e.data.requestId !== requestId) return // stale response
          worker.removeEventListener('message', handler)
          publish(e.data.result)
        }
        worker.addEventListener('message', handler)
        const request: SimRequest = { requestId, netlist }
        worker.postMessage(request)
      } else {
        publish(solveDC(netlist))
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [components, wires, setSimResult])
}
