import type { Group, GroupElement, Generator } from '../types'
import { guardError } from '../result'

function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}

function modInv(a: number, p: number): number {
  let t = 0
  let newT = 1
  let r = p
  let newR = ((a % p) + p) % p
  while (newR !== 0) {
    const q = Math.floor(r / newR)
    ;[t, newT] = [newT, t - q * newT]
    ;[r, newR] = [newR, r - q * newR]
  }
  if (r > 1) throw guardError(`modInv: ${a} is not invertible mod ${p}`)
  if (t < 0) t += p
  return t
}

// 2x2 matrix [a b; c d] over Z/pZ encoded as [a, b, c, d] (row-major).
export type GL2Matrix = [number, number, number, number]

export function matrixLabel(m: GL2Matrix): string {
  return `\\begin{smallmatrix}${m[0]}&${m[1]}\\\\${m[2]}&${m[3]}\\end{smallmatrix}`
}

export function multiplyGL2(m: GL2Matrix, n: GL2Matrix, p: number): GL2Matrix {
  return [
    (m[0] * n[0] + m[1] * n[2]) % p,
    (m[0] * n[1] + m[1] * n[3]) % p,
    (m[2] * n[0] + m[3] * n[2]) % p,
    (m[2] * n[1] + m[3] * n[3]) % p,
  ]
}

export function inverseGL2(m: GL2Matrix, p: number): GL2Matrix {
  const det = ((m[0] * m[3] - m[1] * m[2]) % p + p) % p
  const dinv = modInv(det, p)
  return [
    (m[3] * dinv) % p,
    ((-m[1] * dinv) % p + p) % p,
    ((-m[2] * dinv) % p + p) % p,
    (m[0] * dinv) % p,
  ]
}

export function detGL2(m: GL2Matrix, p: number): number {
  return ((m[0] * m[3] - m[1] * m[2]) % p + p) % p
}

// GL(2,p): the general linear group of invertible 2x2 matrices over Z/pZ.
// Generators: a = [[1,1],[0,1]] (order p) and b = [[0,1],[1,0]] (order 2).
// Since b·a·b = [[1,0],[1,1]] and SL(2,p) = <a, bab> for p >= 2 (p=2 gives S3),
// <a, b> = SL(2,p) ∪ b·SL(2,p) = GL(2,p) because b ∉ SL (det(b) = -1 mod p).
export function createGL2(p: number): Group {
  if (!isPrime(p) || p < 2) throw guardError(`GL(2,${p}): p must be a prime >= 2`)

  const mats: GL2Matrix[] = []
  const matIdx = new Map<string, number>()
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      for (let c = 0; c < p; c++) {
        for (let d = 0; d < p; d++) {
          if (detGL2([a, b, c, d], p) !== 0) {
            matIdx.set(`${a},${b},${c},${d}`, mats.length)
            mats.push([a, b, c, d])
          }
        }
      }
    }
  }

  const elements: GroupElement[] = mats.map((m, i) => ({
    id: `m${i}`,
    label: matrixLabel(m),
    value: m,
  }))
  const identity = elements[matIdx.get(`1,0,0,1`)!]

  function mul(a: GroupElement, b: GroupElement): GroupElement {
    const m = multiplyGL2(a.value as GL2Matrix, b.value as GL2Matrix, p)
    return elements[matIdx.get(`${m[0]},${m[1]},${m[2]},${m[3]}`)!]
  }

  const genA: Generator = {
    name: 'a', symbol: 'a', color: '#ff6b6b',
    apply: (el) => mul(el, elements[matIdx.get('1,1,0,1')!]),
    inverse: null as unknown as Generator,
  }
  const genB: Generator = {
    name: 'b', symbol: 'b', color: '#4ecdc4',
    apply: (el) => mul(el, elements[matIdx.get('0,1,1,0')!]),
    inverse: null as unknown as Generator,
  }
  genA.inverse = {
    name: 'a^{-1}', symbol: 'a^{-1}', color: '#ff6b6b',
    apply: (el) => mul(el, elements[matIdx.get(`1,${p - 1},0,1`)!]),
    inverse: genA,
  }
  genB.inverse = genB

  return {
    name: `General Linear Group GL(2, ${p})`,
    symbol: `GL(2, ${p})`,
    order: mats.length,
    elements,
    generators: [genA, genB],
    multiply: mul,
    inverse: (el) => {
      const inv = inverseGL2(el.value as GL2Matrix, p)
      return elements[matIdx.get(`${inv[0]},${inv[1]},${inv[2]},${inv[3]}`)!]
    },
    identity,
    isAbelian: false,
  }
}
