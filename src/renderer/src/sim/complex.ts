/**
 * Volt — Complex arithmetic + complex linear solver
 *
 * Foundation for the AC phasor solver (Phase 4). Phasor-domain MNA is identical
 * in structure to the DC solver but operates over complex admittances, so the
 * matrix and right-hand side are complex. This module provides the minimal
 * complex algebra plus a complex Gaussian-elimination solver that mirrors the
 * real `solveLinearSystem` in solver.ts.
 *
 * Pure and DOM-free — runs in the Web Worker and under Vitest unchanged.
 */

export interface Complex {
  re: number
  im: number
}

// ── Construction ──────────────────────────────────────────────────────────────

export const cplx = (re: number, im = 0): Complex => ({ re, im })
export const ZERO: Complex = { re: 0, im: 0 }
export const ONE: Complex = { re: 1, im: 0 }
/** Imaginary unit j. */
export const J: Complex = { re: 0, im: 1 }

/** Build a complex number from polar form (magnitude, angle in radians). */
export function fromPolar(mag: number, angleRad: number): Complex {
  return { re: mag * Math.cos(angleRad), im: mag * Math.sin(angleRad) }
}

// ── Arithmetic ────────────────────────────────────────────────────────────────

export const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im })
export const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im })
export const neg = (a: Complex): Complex => ({ re: -a.re, im: -a.im })
export const conj = (a: Complex): Complex => ({ re: a.re, im: -a.im })
export const scale = (a: Complex, s: number): Complex => ({ re: a.re * s, im: a.im * s })

export const mul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re
})

export function div(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom
  }
}

/** Reciprocal 1/a — used to turn an impedance into an admittance. */
export function inv(a: Complex): Complex {
  const denom = a.re * a.re + a.im * a.im
  return { re: a.re / denom, im: -a.im / denom }
}

// ── Magnitude / phase ─────────────────────────────────────────────────────────

export const abs = (a: Complex): number => Math.hypot(a.re, a.im)
/** Phase angle in radians, (-π, π]. */
export const phase = (a: Complex): number => Math.atan2(a.im, a.re)
/** Phase angle in degrees. */
export const phaseDeg = (a: Complex): number => (phase(a) * 180) / Math.PI

// ── Complex linear system ─────────────────────────────────────────────────────

/**
 * Solve A·x = b for complex A, b via Gaussian elimination with partial pivoting
 * (pivot chosen by largest magnitude). Mutates copies, not the inputs. Returns
 * null if the matrix is singular within tolerance.
 */
export function solveComplexLinearSystem(A: Complex[][], b: Complex[]): Complex[] | null {
  const n = A.length
  const SINGULAR_EPS = 1e-12

  // Work on shallow-copied rows so callers' matrices aren't mutated.
  const M = A.map((row) => row.map((c) => ({ ...c })))
  const y = b.map((c) => ({ ...c }))

  for (let col = 0; col < n; col++) {
    let pivotRow = col
    let pivotMag = abs(M[col][col])
    for (let r = col + 1; r < n; r++) {
      const m = abs(M[r][col])
      if (m > pivotMag) {
        pivotMag = m
        pivotRow = r
      }
    }
    if (pivotMag < SINGULAR_EPS) return null

    if (pivotRow !== col) {
      ;[M[col], M[pivotRow]] = [M[pivotRow], M[col]]
      ;[y[col], y[pivotRow]] = [y[pivotRow], y[col]]
    }

    for (let r = col + 1; r < n; r++) {
      const factor = div(M[r][col], M[col][col])
      if (factor.re === 0 && factor.im === 0) continue
      for (let c = col; c < n; c++) M[r][c] = sub(M[r][c], mul(factor, M[col][c]))
      y[r] = sub(y[r], mul(factor, y[col]))
    }
  }

  const x = new Array<Complex>(n).fill(ZERO)
  for (let row = n - 1; row >= 0; row--) {
    let sum = y[row]
    for (let c = row + 1; c < n; c++) sum = sub(sum, mul(M[row][c], x[c]))
    x[row] = div(sum, M[row][row])
  }
  return x
}
