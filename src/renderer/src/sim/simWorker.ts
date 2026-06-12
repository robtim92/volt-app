/**
 * Volt — Simulation Web Worker
 *
 * Thin wrapper: receives a netlist, runs the (synchronous, CPU-bound) MNA
 * solve off the UI thread, posts the result back. All logic lives in
 * solver.ts so it can be unit-tested directly.
 */
import { solveDC, type Netlist, type SolveResult } from './solver'

export interface SimRequest {
  requestId: number
  netlist: Netlist
}

export interface SimResponse {
  requestId: number
  result: SolveResult
}

self.onmessage = (e: MessageEvent<SimRequest>): void => {
  const { requestId, netlist } = e.data
  const result = solveDC(netlist)
  const response: SimResponse = { requestId, result }
  self.postMessage(response)
}
