import { describe, it, expect } from 'vitest'
import { binomialMod } from '../../core/algebra/combinatorics'
import { binomialMod as facadeBinomialMod } from '../../core'

// 参考实现：朴素 Pascal 三角（仅适用于小 n，用于交叉验证 Lucas 版）
function naiveBinomialMod(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0
  const C: number[][] = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= n; i++) {
    C[i][0] = 1 % p
    for (let j = 1; j <= i; j++) {
      C[i][j] = (C[i - 1][j - 1] + C[i - 1][j]) % p
    }
  }
  return C[n][k]
}

// 参考实现：BigInt 精确组合数取模（用于大 n 交叉验证，验证无整数溢出）
function bigBinomialMod(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0
  const r = Math.min(k, n - k)
  let num = 1n
  let den = 1n
  for (let i = 0; i < r; i++) {
    num *= BigInt(n - i)
    den *= BigInt(i + 1)
  }
  const C = num / den
  return Number(C % BigInt(p))
}

describe('binomialMod', () => {
  it('从门面可 import（协议面导出）', () => {
    expect(facadeBinomialMod).toBe(binomialMod)
    expect(typeof facadeBinomialMod).toBe('function')
  })

  it('越界输入返回 0', () => {
    expect(binomialMod(5, -1, 7)).toBe(0)
    expect(binomialMod(5, 6, 7)).toBe(0)
    expect(binomialMod(-1, 0, 7)).toBe(0)
    expect(binomialMod(5, 2, 1)).toBe(0) // 非素数模数不支持
  })

  it('边界：C(n,0) 与 C(n,n) 恒为 1', () => {
    expect(binomialMod(0, 0, 7)).toBe(1)
    expect(binomialMod(2000, 0, 1009)).toBe(1)
    expect(binomialMod(2000, 2000, 1009)).toBe(1)
  })

  it('小 n 与朴素 Pascal 一致（多素数）', () => {
    for (const p of [2, 3, 5, 7, 11, 13]) {
      for (let n = 0; n <= 30; n++) {
        for (let k = 0; k <= n; k++) {
          expect(binomialMod(n, k, p), `C(${n},${k}) mod ${p}`).toBe(naiveBinomialMod(n, k, p))
        }
      }
    }
  })

  it('已知值：C(10,3)=120', () => {
    expect(binomialMod(10, 3, 7)).toBe(120 % 7) // 1
    expect(binomialMod(10, 3, 5)).toBe(120 % 5) // 0
    expect(binomialMod(10, 3, 11)).toBe(120 % 11) // 10
    expect(binomialMod(10, 3, 13)).toBe(120 % 13) // 3
  })

  it('Lucas 定理处理 p ≤ n（朴素阶乘会失效的情形）', () => {
    // C(6,3)=20, mod 2 = 0（Lucas 首对位即判定 0）
    expect(binomialMod(6, 3, 2)).toBe(0)
    // C(5,2)=10, mod 3 = 1
    expect(binomialMod(5, 2, 3)).toBe(1)
    // C(100, 50) mod 2（巨大但偶）应为 0 或与 BigInt 一致
    expect(binomialMod(100, 50, 2)).toBe(bigBinomialMod(100, 50, 2))
  })

  it('大 n（2000 量级）与 BigInt 精确值一致，无整数溢出', () => {
    const cases: [number, number, number][] = [
      [2000, 1000, 1009],
      [2000, 500, 997],
      [1999, 999, 1999],
      [2000, 3, 1009],
      [1536, 768, 2], // p=2，二进制 Lucas
      [2000, 1999, 2003], // k 接近 n
    ]
    for (const [n, k, p] of cases) {
      expect(binomialMod(n, k, p), `C(${n},${k}) mod ${p}`).toBe(bigBinomialMod(n, k, p))
    }
  })
})
