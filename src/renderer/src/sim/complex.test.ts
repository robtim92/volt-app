import { describe, it, expect } from 'vitest'
import {
  cplx,
  add,
  sub,
  mul,
  div,
  inv,
  abs,
  phaseDeg,
  fromPolar,
  solveComplexLinearSystem,
  type Complex
} from './complex'

const near = (a: Complex, re: number, im: number, p = 9): void => {
  expect(a.re).toBeCloseTo(re, p)
  expect(a.im).toBeCloseTo(im, p)
}

describe('complex arithmetic', () => {
  it('adds, subtracts, multiplies', () => {
    near(add(cplx(1, 2), cplx(3, -1)), 4, 1)
    near(sub(cplx(1, 2), cplx(3, -1)), -2, 3)
    // (1+2j)(3+4j) = 3 + 4j + 6j + 8j^2 = -5 + 10j
    near(mul(cplx(1, 2), cplx(3, 4)), -5, 10)
  })

  it('divides and inverts', () => {
    // (1+0j)/(1+1j) = (1-1j)/2
    near(div(cplx(1, 0), cplx(1, 1)), 0.5, -0.5)
    // 1/(0+1j) = -j
    near(inv(cplx(0, 1)), 0, -1)
  })

  it('magnitude and phase, polar round-trip', () => {
    expect(abs(cplx(3, 4))).toBeCloseTo(5, 9)
    expect(phaseDeg(cplx(0, 1))).toBeCloseTo(90, 9)
    expect(phaseDeg(cplx(-1, 0))).toBeCloseTo(180, 9)
    const z = fromPolar(2, Math.PI / 3)
    expect(abs(z)).toBeCloseTo(2, 9)
    expect(phaseDeg(z)).toBeCloseTo(60, 9)
  })
})

describe('solveComplexLinearSystem', () => {
  it('solves a 1x1 system', () => {
    // (1+j) x = 2  →  x = 2/(1+j) = 1 - j
    const x = solveComplexLinearSystem([[cplx(1, 1)]], [cplx(2, 0)])
    expect(x).not.toBeNull()
    near(x![0], 1, -1)
  })

  it('solves a 2x2 complex system', () => {
    // [[1, j],[ -j, 1]] x = [1, 0]
    // det = 4 - (j)(-j) = 3 ≠ 0 (non-singular)
    const A = [
      [cplx(2, 0), cplx(0, 1)],
      [cplx(0, -1), cplx(2, 0)]
    ]
    const b = [cplx(1, 0), cplx(0, 0)]
    const x = solveComplexLinearSystem(A, b)!
    // Verify by substitution: A·x ≈ b
    const r0 = add(mul(A[0][0], x[0]), mul(A[0][1], x[1]))
    const r1 = add(mul(A[1][0], x[0]), mul(A[1][1], x[1]))
    near(r0, 1, 0, 9)
    near(r1, 0, 0, 9)
  })

  it('returns null for a singular matrix', () => {
    const A = [
      [cplx(1, 0), cplx(2, 0)],
      [cplx(2, 0), cplx(4, 0)]
    ]
    expect(solveComplexLinearSystem(A, [cplx(1, 0), cplx(2, 0)])).toBeNull()
  })

  it('does not mutate its inputs', () => {
    const A = [[cplx(2, 0)]]
    const b = [cplx(4, 0)]
    solveComplexLinearSystem(A, b)
    expect(A[0][0]).toEqual(cplx(2, 0))
    expect(b[0]).toEqual(cplx(4, 0))
  })
})
