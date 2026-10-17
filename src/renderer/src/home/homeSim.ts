/**
 * Volt — home power-flow simulation (Phase H1)
 *
 * Each step solves every branch circuit on its own: the source (120 V for one
 * pole, 240 V for two) feeds the wire run, and the appliances sit at the far
 * end. Heating elements and motors are fixed impedances (motors draw in-rush
 * while starting); electronics draw constant power. Breakers trip on a
 * thermal curve (heat ∝ I², slow) or magnetically (≥ 10× rating, instant);
 * GFCIs trip on current leaking to ground and AFCIs on arcing.
 */
import { ampacity, ohmsPerMetre } from '../sim/wire'
import { APPLIANCES } from './appliances'
import type { BranchCircuit, CircuitReading, HomeDesign, HomeRuntime, Leg, TripEvent } from './types'

/** breaker thermal time constant (s) */
export const BREAKER_TAU = 120
/** thermal trip threshold, in (I / rating)² — about 114% held indefinitely */
export const THERMAL_TRIP = 1.3
/** magnetic (instant) trip at this multiple of the rating */
export const MAGNETIC_TRIP = 10
/** wire insulation thermal time constant (s) */
export const WIRE_TAU = 600
/** a ground fault through a person or a wet appliance (A) */
export const GROUND_LEAK = 0.1
/** GFCI trip threshold (A) */
export const GFCI_TRIP = 0.005
/** bolted short at the far end of the run (Ω) */
const SHORT_OHMS = 0.02
const MAX_SUBSTEP = 0.1

export const ohmsPerFoot = (gauge: number): number => ohmsPerMetre(gauge) * 0.3048

/** Which bus leg a panel space is on: rows alternate A, B, A, B… (two spaces per row). */
export function legOfSlot(slot: number): Leg {
  return Math.ceil(slot / 2) % 2 === 1 ? 'A' : 'B'
}

export function legsOf(c: BranchCircuit): Leg[] {
  return c.poles === 2 ? [legOfSlot(c.slot), legOfSlot(c.slot + 2)] : [legOfSlot(c.slot)]
}

/** Panel spaces a breaker occupies (a double-pole takes the space below it too). */
export function slotsOf(c: BranchCircuit): number[] {
  return c.poles === 2 ? [c.slot, c.slot + 2] : [c.slot]
}

export const nominalVolts = (c: BranchCircuit): 120 | 240 => (c.poles === 2 ? 240 : 120)

/** Does this appliance run on this circuit's voltage? */
export function voltageMatches(c: BranchCircuit, applianceId: string): boolean {
  const a = APPLIANCES[applianceId]
  return !!a && a.volts === nominalVolts(c)
}

function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

export function newRuntime(): HomeRuntime {
  return { t: 0, breakerHeat: {}, wireHeat: {}, mainHeat: 0, loadAge: {}, loadRunning: {}, readings: {}, legs: { A: 0, B: 0, N: 0 }, totalWatts: 0, kwh: 0 }
}

const ZERO = (c: BranchCircuit): CircuitReading => ({ amps: 0, volts: 0, nominal: nominalVolts(c), watts: 0, dropPct: 0, surging: false, legs: legsOf(c) })

/** Solve one energized branch circuit given which loads are running. */
export function solveCircuit(c: BranchCircuit, running: (loadId: string) => boolean, age: (loadId: string) => number): CircuitReading {
  const Vs = nominalVolts(c)
  const Rw = 2 * c.lengthFt * ohmsPerFoot(c.gauge)
  let G = 0
  let P = 0
  let surging = false
  for (const l of c.loads) {
    if (!running(l.id)) continue
    const a = APPLIANCES[l.appliance]
    if (!a || a.volts !== Vs) continue
    if (a.kind === 'electronic') {
      P += a.watts
      continue
    }
    const inRush = a.surge && age(l.id) < a.surge.seconds ? a.surge.multiple : 1
    if (inRush > 1) surging = true
    G += (a.watts * inRush) / (Vs * Vs)
  }
  if (c.fault === 'short') G += 1 / SHORT_OHMS
  // V at the load: V = Vs − Rw·(G·V + P/V); a few fixed-point passes
  let V: number = Vs
  for (let k = 0; k < 12; k++) {
    const Ip = P / Math.max(V, 0.3 * Vs)
    V = (Vs - Rw * Ip) / (1 + Rw * G)
  }
  V = Math.max(0, V)
  const I = G * V + P / Math.max(V, 0.3 * Vs)
  return {
    amps: I,
    volts: V,
    nominal: Vs,
    watts: c.fault === 'short' ? 0 : V * I,
    dropPct: ((Vs - V) / Vs) * 100,
    surging,
    legs: legsOf(c)
  }
}

const fmtA = (a: number): string => (a >= 100 ? `${Math.round(a)} A` : `${a.toFixed(1)} A`)

/**
 * Advance the home by dt simulated seconds. Returns the new runtime and any
 * breakers that tripped (the caller marks them tripped in the design).
 */
export function stepHome(design: HomeDesign, rt0: HomeRuntime, dt: number): { runtime: HomeRuntime; trips: TripEvent[] } {
  const rt: HomeRuntime = {
    ...rt0,
    breakerHeat: { ...rt0.breakerHeat },
    wireHeat: { ...rt0.wireHeat },
    loadAge: { ...rt0.loadAge },
    loadRunning: { ...rt0.loadRunning },
    readings: {}
  }
  const trips: TripEvent[] = []
  const tripped = new Set<string>()
  let mainOn = design.mainState === 'on'
  const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP))
  const h = dt / steps

  for (let s = 0; s < steps; s++) {
    rt.t += h
    let A120 = 0
    let B120 = 0
    let I240 = 0
    let total = 0
    for (const c of design.circuits) {
      const energized = mainOn && c.state === 'on' && !tripped.has(c.id)
      // which loads draw power right now
      for (const l of c.loads) {
        const a = APPLIANCES[l.appliance]
        let run = energized && l.on && !!a && a.volts === nominalVolts(c)
        if (run && a?.cycle) {
          const period = a.cycle.onSec + a.cycle.offSec
          const phase = (rt.t + hash01(l.id) * period) % period
          run = phase < a.cycle.onSec
        }
        if (run) rt.loadAge[l.id] = rt.loadRunning[l.id] ? (rt.loadAge[l.id] ?? 0) + h : 0
        rt.loadRunning[l.id] = run
      }
      const r = energized
        ? solveCircuit(c, (id) => !!rt.loadRunning[id], (id) => rt.loadAge[id] ?? 0)
        : ZERO(c)
      rt.readings[c.id] = r
      total += r.watts
      if (c.poles === 2) I240 += r.amps
      else if (r.legs[0] === 'A') A120 += r.amps
      else B120 += r.amps

      // protection
      const heat0 = rt.breakerHeat[c.id] ?? 0
      const x = r.amps / c.amps
      const heat = x * x + (heat0 - x * x) * Math.exp(-h / BREAKER_TAU)
      rt.breakerHeat[c.id] = heat
      const w0 = rt.wireHeat[c.id] ?? 0
      const xw = r.amps / ampacity(c.gauge)
      rt.wireHeat[c.id] = xw * xw + (w0 - xw * xw) * Math.exp(-h / WIRE_TAU)
      if (!energized) continue
      const anyRunning = c.loads.some((l) => rt.loadRunning[l.id])
      let trip: TripEvent | null = null
      if (r.amps >= MAGNETIC_TRIP * c.amps) {
        trip = { id: c.id, kind: 'short', message: `⚡ ${c.name} tripped instantly: about ${fmtA(r.amps)} flowed, a short circuit. The breaker's magnetic trip opens in a few milliseconds.` }
      } else if (c.fault === 'ground' && anyRunning && (c.type === 'gfci' || c.type === 'dual')) {
        trip = { id: c.id, kind: 'ground', message: `🛡️ ${c.name}'s GFCI tripped: ${Math.round(GROUND_LEAK * 1000)} mA was leaking to ground. A GFCI cuts power at about 5 mA, fast enough to prevent a dangerous shock.` }
      } else if (c.fault === 'arc' && r.amps > 0.5 && (c.type === 'afci' || c.type === 'dual')) {
        trip = { id: c.id, kind: 'arc', message: `🛡️ ${c.name}'s AFCI tripped: it detected arcing (a damaged cord or loose connection), a common cause of house fires.` }
      } else if (heat >= THERMAL_TRIP) {
        trip = { id: c.id, kind: 'overload', message: `🔥 ${c.name} tripped on overload: ${fmtA(r.amps)} on a ${c.amps} A breaker. Turn something off or move a load to another circuit, then reset it.` }
      }
      if (trip) {
        trips.push(trip)
        tripped.add(c.id)
        rt.breakerHeat[c.id] = 0
      }
    }
    const A = A120 + I240
    const B = B120 + I240
    rt.legs = { A, B, N: Math.abs(A120 - B120) }
    rt.totalWatts = total
    rt.kwh += (total * h) / 3.6e6
    if (mainOn) {
      const x = Math.max(A, B) / design.mainAmps
      rt.mainHeat = x * x + (rt.mainHeat - x * x) * Math.exp(-h / BREAKER_TAU)
      if (rt.mainHeat >= THERMAL_TRIP) {
        trips.push({ id: 'main', kind: 'overload', message: `🔥 The ${design.mainAmps} A main breaker tripped: ${fmtA(Math.max(A, B))} on one leg. The whole house is off. Reduce the load before resetting.` })
        mainOn = false
        rt.mainHeat = 0
      }
    }
  }
  return { runtime: rt, trips }
}

export interface CircuitWarning {
  level: 'danger' | 'warn' | 'info'
  text: string
}

/** Design and live warnings for one circuit (simplified code notes are labelled). */
export function circuitWarnings(c: BranchCircuit, r: CircuitReading | undefined, wireHeat: number, gfciRooms: Set<string>, afciRooms: Set<string>): CircuitWarning[] {
  const out: CircuitWarning[] = []
  const amp = ampacity(c.gauge)
  if (c.amps > amp) out.push({ level: 'danger', text: `${c.amps} A breaker on ${c.gauge} AWG wire (rated about ${amp} A): the wire can overheat before the breaker trips. Use thicker wire or a smaller breaker.` })
  if (wireHeat > 1.1) out.push({ level: 'danger', text: 'The wire is running hotter than its rating.' })
  for (const l of c.loads) {
    const a = APPLIANCES[l.appliance]
    if (a && !voltageMatches(c, l.appliance)) out.push({ level: 'warn', text: `${a.name} needs ${a.volts} V; this is a ${nominalVolts(c)} V circuit, so it won't run.` })
  }
  if (r && r.amps > 0.5 && r.dropPct > 3) out.push({ level: 'warn', text: `Voltage drop is ${r.dropPct.toFixed(1)}% (${r.volts.toFixed(0)} V at the far end). Over 3% is a common design limit: use a heavier gauge for long runs.` })
  if (c.fault === 'ground' && c.type !== 'gfci' && c.type !== 'dual') out.push({ level: 'danger', text: 'Current is leaking to ground and nothing is stopping it: a shock hazard. A GFCI breaker would trip.' })
  if (c.fault === 'arc' && c.type !== 'afci' && c.type !== 'dual') out.push({ level: 'danger', text: 'An arcing fault is heating a connection: a fire risk an ordinary breaker cannot see. An AFCI breaker would trip.' })
  if (c.poles === 1 && gfciRooms.has(c.room) && c.type !== 'gfci' && c.type !== 'dual') out.push({ level: 'info', text: `Code note (simplified): ${c.room.toLowerCase()} receptacles need GFCI protection.` })
  if (c.poles === 1 && afciRooms.has(c.room) && c.type !== 'afci' && c.type !== 'dual') out.push({ level: 'info', text: `Code note (simplified): ${c.room.toLowerCase()} circuits need AFCI protection.` })
  return out
}
