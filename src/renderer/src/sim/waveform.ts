/**
 * Volt — Time-domain waveform reconstruction
 *
 * The AC solver returns phasors (peak magnitude + phase). The oscilloscope
 * turns those back into instantaneous signals v(t) = peak·cos(ωt + φ) so a
 * learner can see amplitude and phase directly. Pure and unit-tested.
 */

/** Period of a sinusoid at angular frequency ω (rad/s), in seconds. */
export function periodSeconds(omega: number): number {
  return (2 * Math.PI) / omega
}

/** Instantaneous value of peak·cos(ωt + φ) at time t (seconds). */
export function instantaneous(
  peak: number,
  phaseDeg: number,
  omega: number,
  t: number
): number {
  return peak * Math.cos(omega * t + (phaseDeg * Math.PI) / 180)
}

export interface WaveSamples {
  /** sample times (seconds) */
  t: number[]
  /** sample values */
  v: number[]
}

/**
 * Sample peak·cos(ωt + φ) across `periods` full periods, `samples` intervals
 * (so t/v have samples+1 points, inclusive of both endpoints).
 */
export function sampleWave(
  peak: number,
  phaseDeg: number,
  omega: number,
  periods = 2,
  samples = 240
): WaveSamples {
  const total = periodSeconds(omega) * periods
  const t: number[] = []
  const v: number[] = []
  for (let i = 0; i <= samples; i++) {
    const tt = (total * i) / samples
    t.push(tt)
    v.push(instantaneous(peak, phaseDeg, omega, tt))
  }
  return { t, v }
}
