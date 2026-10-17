/**
 * Volt — Live simulation loop
 *
 * Watches the circuit (components + wires), rebuilds the netlist on every
 * change (debounced), solves it, and writes the result to the circuit store.
 *
 * DC circuits solve in a Web Worker (off the UI thread). AC circuits — detected
 * by the presence of an AC source — solve synchronously on the main thread:
 * they're a single linear complex solve, so the cost is negligible and it keeps
 * the phasor→magnitude/phase conversion in one place.
 */
import { useEffect, useRef } from 'react'
import { useCircuitStore, type SimulationResult } from '@stores/circuitStore'
import { buildNetlist, buildACNetlist } from '../sim/netlist'
import { solveDC } from '../sim/solver'
import { solveAC } from '../sim/acSolver'
import { abs, phaseDeg } from '../sim/complex'
import { formatValue, type CircuitComponent } from '../sim/elements'
import type { SimRequest, SimResponse } from '../sim/simWorker'

const DEBOUNCE_MS = 60

/** Warnings for breakers/GFCIs whose (magnitude) current exceeds their rating. */
function tripWarnings(
  components: CircuitComponent[],
  elementCurrents: Record<string, number>
): string[] {
  const out: string[] = []
  for (const c of components) {
    if ((c.type === 'breaker' || c.type === 'gfci') && c.closed) {
      const rating = c.value ?? Infinity
      const i = Math.abs(elementCurrents[c.id] ?? 0)
      if (i > rating) {
        out.push(`${c.label ?? c.id} tripped — ${formatValue(i, 'A')} exceeds ${formatValue(rating, 'A')} rating`)
      }
    }
  }
  return out
}

export interface UseSimulationOptions {
  /**
   * Publish steady-state DC results. Off when the live (time-domain) simulator
   * owns the result for non-AC circuits (see useLiveSimulation).
   */
  steadyDC?: boolean
}

export function useSimulation({ steadyDC = true }: UseSimulationOptions = {}): void {
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
      // ── AC analysis (an AC source is present) ──
      const acSources = components.filter((c) => c.type === 'ac_voltage_source')
      if (acSources.length > 0) {
        const { netlist, terminalNodes, warnings } = buildACNetlist(components, wires)
        const freqs = acSources.map((s) => s.frequency ?? 60)
        const f = freqs[0]
        const omega = 2 * Math.PI * f
        const allWarnings = [...warnings]
        if (freqs.some((v) => Math.abs(v - f) > 1e-9)) {
          allWarnings.push(`Multiple AC frequencies present — analyzing at ${f} Hz`)
        }

        const ac = solveAC(netlist, omega)

        const nodeVoltages: Record<string, number> = {}
        const nodeVoltagePhase: Record<string, number> = {}
        for (const [node, phasor] of Object.entries(ac.nodeVoltages)) {
          nodeVoltages[node] = abs(phasor)
          nodeVoltagePhase[node] = phaseDeg(phasor)
        }
        const elementCurrents: Record<string, number> = {}
        const elementCurrentPhase: Record<string, number> = {}
        for (const [id, phasor] of Object.entries(ac.elementCurrents)) {
          elementCurrents[id] = abs(phasor)
          elementCurrentPhase[id] = phaseDeg(phasor)
        }

        const result: SimulationResult = {
          solved: ac.solved,
          nodeVoltages,
          elementCurrents,
          terminalNodes,
          warnings: [...allWarnings, ...tripWarnings(components, elementCurrents)],
          error: ac.error,
          ac: true,
          omega,
          nodeVoltagePhase,
          elementCurrentPhase
        }
        setSimResult(result)
        return
      }

      // ── DC analysis ──
      if (!steadyDC) return
      const { netlist, terminalNodes, warnings } = buildNetlist(components, wires)

      const publish = (solved: ReturnType<typeof solveDC>): void => {
        const result: SimulationResult = {
          solved: solved.solved,
          nodeVoltages: solved.nodeVoltages,
          elementCurrents: solved.elementCurrents,
          terminalNodes,
          warnings: [...warnings, ...tripWarnings(components, solved.elementCurrents)],
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
  }, [components, wires, setSimResult, steadyDC])
}
