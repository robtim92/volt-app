/**
 * Volt — Live simulation loop
 *
 * Runs the time-domain simulator continuously on requestAnimationFrame:
 *   - rebuilds the simulator whenever the circuit changes, carrying capacitor
 *     charge / inductor current / diode state across the rebuild;
 *   - advances simulated time by (real elapsed × timeScale), in timesteps fine
 *     enough for the circuit's own time constants;
 *   - steps the heat model and applies failures (burnout → damaged part,
 *     breaker/GFCI → trips open), emitting visual effects + a teaching message;
 *   - writes per-frame data to `liveFrame`, and — for circuits without an AC
 *     source — publishes the instantaneous result to circuitStore.simResult at
 *     ~15 Hz so the inspector, meters and status bar show live values.
 *
 * AC-source circuits keep their phasor (RMS∠phase) result from useSimulation;
 * the live engine still runs for them so breakers trip and the 3D bench animates.
 */
import { useEffect, useRef } from 'react'
import { useCircuitStore, type SimulationResult } from '@stores/circuitStore'
import { liveFrame, useLiveSimStore, HISTORY_SECONDS_MAX } from '@stores/liveSimStore'
import { batteryParams, buildTransientNetlist, usesPhasorAnalysis } from '../sim/netlist'
import { drain, packOcv } from '../sim/battery'
import { TransientSimulator, suggestMaxStep } from '../sim/transient'
import { stepThermal } from '../sim/thermal'
import type { CircuitComponent, Wire } from '../sim/elements'

const PUBLISH_INTERVAL_MS = 66
const MAX_FRAME_SECONDS = 0.1
/** Max solver steps per animation frame before the sim slows below real time */
const STEP_BUDGET = 1500

const isInternal = (id: string): boolean => id.includes('#')

function toSimResult(
  sim: TransientSimulator,
  terminalNodes: Record<string, string>,
  warnings: string[]
): SimulationResult {
  const snap = sim.snapshot()
  const elementCurrents: Record<string, number> = {}
  for (const [id, i] of Object.entries(snap.elementCurrents)) {
    if (!isInternal(id)) elementCurrents[id] = i
  }
  let error = sim.error ?? snap.error
  if (error === 'Circuit is empty') {
    // parts placed but nothing wired yet — guide rather than scold
    error = 'Nothing is connected yet — drag from one terminal dot to another to add a wire'
  }
  return {
    solved: sim.error === null && snap.solved,
    nodeVoltages: snap.nodeVoltages,
    elementCurrents,
    terminalNodes,
    warnings,
    error,
    live: true,
    time: snap.time
  }
}

export function useLiveSimulation(): void {
  const components = useCircuitStore((s) => s.components)
  const wires = useCircuitStore((s) => s.wires)
  const resetToken = useLiveSimStore((s) => s.resetToken)

  const simRef = useRef<TransientSimulator | null>(null)
  const metaRef = useRef<{
    terminalNodes: Record<string, string>
    warnings: string[]
    maxStep: number
    ownsResult: boolean
    components: CircuitComponent[]
    wires: Wire[]
  }>({ terminalNodes: {}, warnings: [], maxStep: 1e-3, ownsResult: true, components: [], wires: [] })
  const lastPublishRef = useRef(0)

  const publish = (force = false): void => {
    const sim = simRef.current
    const meta = metaRef.current
    if (!sim) return
    const now = performance.now()
    if (!force && now - lastPublishRef.current < PUBLISH_INTERVAL_MS) return
    lastPublishRef.current = now
    if (meta.ownsResult) {
      useCircuitStore.getState().setSimResult(toSimResult(sim, meta.terminalNodes, meta.warnings))
    }
  }

  // Reset: back to t = 0, everything discharged, cooled and repaired
  useEffect(() => {
    if (resetToken === 0) return
    simRef.current = null
    liveFrame.heat = {}
    liveFrame.history = []
    liveFrame.time = 0
    liveFrame.soc = {}
    liveFrame.supplyMode = {}
    const { components: comps, wires: ws, updateComponent, updateWire } = useCircuitStore.getState()
    for (const c of comps) if (c.damaged) updateComponent(c.id, { damaged: false })
    for (const w of ws) if (w.damaged) updateWire(w.id, { damaged: false })
    useLiveSimStore.getState().setClock(0, 1)
  }, [resetToken])

  // Rebuild whenever the circuit changes
  useEffect(() => {
    if (components.length === 0) {
      simRef.current = null
      liveFrame.snapshot = null
      liveFrame.history = []
      return
    }
    for (const c of components) {
      if (c.type === 'battery' && liveFrame.soc[c.id] === undefined) liveFrame.soc[c.id] = c.soc ?? 1
    }
    const built = buildTransientNetlist(components, wires, { soc: liveFrame.soc })
    const sim = new TransientSimulator(built.netlist, simRef.current?.state)
    simRef.current = sim
    metaRef.current = {
      terminalNodes: built.terminalNodes,
      warnings: built.warnings,
      maxStep: suggestMaxStep(built.netlist),
      ownsResult: !usesPhasorAnalysis(components),
      components,
      wires
    }
    // Immediate solve so readouts update without waiting for a frame
    const snap = sim.settleInstant()
    liveFrame.snapshot = snap
    liveFrame.terminalNodes = built.terminalNodes
    liveFrame.frame++
    publish(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [components, wires, resetToken])

  // Animation loop
  useEffect(() => {
    if (typeof requestAnimationFrame === 'undefined') return
    let raf = 0
    let last = performance.now()
    let lastClock = 0

    const tick = (now: number): void => {
      const wall = Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - last) / 1000))
      last = now
      const sim = simRef.current
      const live = useLiveSimStore.getState()
      if (sim && !sim.error && live.running && wall > 0) {
        const meta = metaRef.current
        const wanted = wall * live.timeScale
        const steps = Math.ceil(wanted / meta.maxStep)
        const duration = steps > STEP_BUDGET ? STEP_BUDGET * meta.maxStep : wanted
        const t0 = sim.time
        const snap = sim.advance(duration, meta.maxStep, STEP_BUDGET)
        const advanced = sim.time - t0

        liveFrame.snapshot = snap
        liveFrame.time = sim.time
        liveFrame.frame++
        if (snap.solved) {
          liveFrame.history.push({ t: sim.time, v: snap.nodeVoltages })
          if (liveFrame.history.length > HISTORY_SECONDS_MAX) liveFrame.history.shift()
        }

        // Inductive kickback sparks
        for (const ev of sim.events) {
          live.pushEffect({ componentId: ev.elementId, kind: 'arc' })
        }

        // Batteries drain; their voltage follows their state of charge
        if (snap.solved && advanced > 0) {
          for (const c of meta.components) {
            if (c.type !== 'battery' || c.damaged) continue
            const p = batteryParams(c, liveFrame.soc)
            const delivered = -(snap.elementCurrents[c.id] ?? 0)
            liveFrame.soc[c.id] = drain(p, delivered, advanced)
            sim.setSourceValue(c.id, packOcv({ ...p, soc: liveFrame.soc[c.id] }))
          }
          for (const c of meta.components) {
            if (c.type === 'bench_supply') liveFrame.supplyMode[c.id] = sim.supplyMode(c.id)
          }
        }

        // Heat & damage
        if (snap.solved && advanced > 0) {
          const res = stepThermal(
            meta.components,
            { ...snap, terminalNodes: meta.terminalNodes },
            liveFrame.heat,
            advanced,
            meta.wires
          )
          liveFrame.heat = res.heat
          if (res.events.length > 0) {
            const { updateComponent, updateWire } = useCircuitStore.getState()
            const wireIds = new Set(meta.wires.map((w) => w.id))
            // Apply locally too, so the next frame doesn't re-fire before React rebuilds
            meta.wires = meta.wires.map((w) =>
              res.events.some((e) => e.componentId === w.id) ? { ...w, damaged: true } : w
            )
            meta.components = meta.components.map((c) => {
              const ev = res.events.find((e) => e.componentId === c.id)
              if (!ev) return c
              return ev.kind === 'trip' ? { ...c, closed: false } : { ...c, damaged: true }
            })
            for (const ev of res.events) {
              live.pushEffect({ componentId: ev.componentId, kind: ev.kind, message: ev.message })
              if (wireIds.has(ev.componentId)) updateWire(ev.componentId, { damaged: true })
              else if (ev.kind === 'trip') updateComponent(ev.componentId, { closed: false })
              else updateComponent(ev.componentId, { damaged: true })
            }
          }
        }

        if (now - lastClock > 100) {
          lastClock = now
          live.setClock(sim.time, wanted > 0 ? Math.min(1, advanced / wanted) : 1)
        }
        publish()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
