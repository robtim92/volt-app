/**
 * Volt — Home power systems (Phase H): data model
 *
 * A US split-phase home: a 120/240 V service feeds a panel with two hot bus
 * legs (A and B). Single-pole breakers take one leg (120 V); double-pole
 * breakers take both (240 V). Each branch circuit is a breaker, a wire run
 * (gauge + one-way length) and the appliances plugged into it.
 *
 * This is a teaching model: electrical-code rules are simplified and labelled.
 */

export type BreakerType = 'standard' | 'gfci' | 'afci' | 'dual'
export type BreakerState = 'on' | 'off' | 'tripped'
/** a fault you can inject on a circuit to see how protection responds */
export type CircuitFault = 'none' | 'ground' | 'arc' | 'short'
export type Leg = 'A' | 'B'

export interface LoadInstance {
  id: string
  /** key into APPLIANCES */
  appliance: string
  /** switched on by the user (cycling appliances still cycle while on) */
  on: boolean
}

export interface BranchCircuit {
  id: string
  name: string
  /** room it serves (drives the 3D house and code notes) */
  room: string
  /** first panel space (1-based; odd = left column, even = right) */
  slot: number
  poles: 1 | 2
  /** breaker rating (A) */
  amps: number
  type: BreakerType
  state: BreakerState
  /** conductor size (AWG, copper) */
  gauge: number
  /** one-way length of the run from the panel (ft) */
  lengthFt: number
  loads: LoadInstance[]
  fault?: CircuitFault
}

export interface HomeDesign {
  name: string
  /** conditioned floor area (ft²), for the load calculation */
  sqft: number
  /** utility service size (A) */
  serviceAmps: number
  /** main breaker rating (A) */
  mainAmps: number
  mainState: BreakerState
  /** panel spaces */
  spaces: number
  circuits: BranchCircuit[]
}

export interface CircuitReading {
  /** current in the hot conductor(s) (A) */
  amps: number
  /** voltage at the far end of the run (V) */
  volts: number
  /** nominal voltage (120 or 240) */
  nominal: number
  /** power delivered to the loads (W) */
  watts: number
  /** voltage drop as % of nominal */
  dropPct: number
  /** load currently starting up (motor in-rush) */
  surging: boolean
  legs: Leg[]
}

export interface HomeRuntime {
  /** simulated seconds since start */
  t: number
  breakerHeat: Record<string, number>
  wireHeat: Record<string, number>
  mainHeat: number
  /** seconds each load has been running (for in-rush) */
  loadAge: Record<string, number>
  /** whether each load is drawing power right now (cycling appliances switch on and off) */
  loadRunning: Record<string, boolean>
  readings: Record<string, CircuitReading>
  legs: { A: number; B: number; N: number }
  totalWatts: number
  /** energy used since start (kWh) */
  kwh: number
}

export type TripKind = 'overload' | 'short' | 'ground' | 'arc'

export interface TripEvent {
  /** circuit id, or 'main' */
  id: string
  kind: TripKind
  message: string
}
