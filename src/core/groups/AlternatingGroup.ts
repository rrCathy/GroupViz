import type { GroupElement, Generator, Group } from '../types'
import { guardError } from '../result'

function applyPermutation(p: number[], q: number[]): number[] {
  return q.map((_, i) => p[q[i] - 1])
}

function permToString(p: number[]): string {
  const cycles: number[][] = []
  const visited = new Array(p.length).fill(false)

  for (let i = 0; i < p.length; i++) {
    if (!visited[i]) {
      const cycle: number[] = []
      let j = i
      while (!visited[j]) {
        visited[j] = true
        cycle.push(j + 1)
        j = p[j] - 1
      }
      if (cycle.length > 1) cycles.push(cycle)
    }
  }

  if (cycles.length === 0) return 'e'
  const parts = cycles.map(c => `(${c.join('')})`)
  // 与 SymmetricGroup 同口径：单循环括号冗余，去掉以保持紧凑（`(234)` → `234`）；
  // 多循环必须保留括号，否则 `(12)(34)` 会被剥成有歧义的 `12)(34`。
  // （旧实现单循环一律带括号，A_n 与 S_n 两套记法；反馈单 2.4.0 附带发现 2 要求统一。）
  return parts.length === 1 ? parts[0].slice(1, -1) : parts.join('')
}

function permutationParity(p: number[]): number {
  let inversions = 0
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) {
      if (p[i] > p[j]) inversions++
    }
  }
  return inversions % 2
}

function findPermIndex(elements: GroupElement[], perm: number[]): number {
  const idx = elements.findIndex(el =>
    el.value.every((v, i) => v === perm[i])
  )
  if (idx === -1) {
    console.warn('findPermIndex: permutation not found, falling back to identity')
    return 0
  }
  return idx
}

/**
 * A_n 本地构造上限（门与构造器共用的**同一常量**）。
 *
 * 为什么是 6：A₆ = 360 元素（枚举 6! = 720 个置换再筛偶），与 S₆ 同一份枚举规模；
 * n ≥ 7 的 A_n 元素数 ≥ 2520，远超静态线（STATIC_LIMIT=240），符号层一律走后端 GAP。
 * 此前 groupFactory 的 `A_{n}` 门写 `<= 6` 而本构造器 `n > 5` 抛错——门比构造器宽，
 * `A_6` 过门后死在构造器（feedback/BUGREPORT-groupviz-2.4.0-alternating-cap.md）。
 */
export const ALTERNATING_GROUP_MAX_DEGREE = 6

export function createAlternatingGroup(n: number): Group {
  if (n < 3) throw guardError('n must be at least 3')
  if (n > ALTERNATING_GROUP_MAX_DEGREE) {
    throw guardError(`A_{n} for n > ${ALTERNATING_GROUP_MAX_DEGREE} is too large`, 'overflow')
  }

  const allPerms: number[][] = []

  function generatePerms(current: number[]): void {
    if (current.length === n) {
      allPerms.push([...current])
      return
    }
    for (let i = 1; i <= n; i++) {
      if (!current.includes(i)) {
        current.push(i)
        generatePerms(current)
        current.pop()
      }
    }
  }

  generatePerms([])

  const elements: GroupElement[] = []
  allPerms.forEach(perm => {
    if (permutationParity(perm) === 0) {
      elements.push({
        id: perm.join(','),
        label: permToString(perm),
        value: [...perm]
      })
    }
  })

  function getGenerator(name: string, symbol: string, color: string, perm: number[]): Generator {
    const gen: Generator = {
      name, symbol, color,
      apply: (el: GroupElement) => {
        const result = applyPermutation(el.value, perm)
        const idx = findPermIndex(elements, result)
        return elements[idx]
      },
      inverse: null as unknown as Generator
    }
    gen.inverse = {
      name: `${name}^{-1}`, symbol: `${symbol}^{-1}`, color,
      apply: (el: GroupElement) => {
        const inverse = perm.map((_, i) => perm.indexOf(i + 1) + 1)
        const result = applyPermutation(el.value, inverse)
        const idx = findPermIndex(elements, result)
        return elements[idx]
      },
      inverse: gen
    }
    return gen
  }

  const generators: Generator[] = []
  if (n === 3) {
    const perm = Array.from({ length: n }, (_, j) => j + 1); [perm[0], perm[1], perm[2]] = [perm[1], perm[2], perm[0]]
    generators.push(getGenerator('c1', '(123)', '#ff6b6b', perm))
  } else if (n === 4) {
    // A4: a=(12)(34) order 2, b=(234) order 3 -> 12 vertices, 18 edges = truncated tetrahedron
    const a = Array.from({ length: n }, (_, j) => j + 1); [a[0], a[1], a[2], a[3]] = [a[1], a[0], a[3], a[2]]
    const b = Array.from({ length: n }, (_, j) => j + 1)
    const tmp = b[1]; b[1] = b[2]; b[2] = b[3]; b[3] = tmp
    generators.push(getGenerator('a', '(12)(34)', '#ff6b6b', a))
    generators.push(getGenerator('b', '(234)', '#4ecdc4', b))
  } else if (n === 5) {
    // A5: a=(12345) order 5, b=(12)(34) order 2 -> 3-regular 60 vertices 90 edges,
    // Cayley graph ≅ truncated icosahedron skeleton (planar, Group Explorer style).
    // 旧生成元 (12)(34),(135) 的凯莱图非截角二十面体骨架（DFS 同构失败 601 calls）。
    const a = Array.from({ length: n }, (_, j) => j + 1)
    const a0 = a[0]; a[0] = a[1]; a[1] = a[2]; a[2] = a[3]; a[3] = a[4]; a[4] = a0
    const b = Array.from({ length: n }, (_, j) => j + 1); [b[0], b[1], b[2], b[3]] = [b[1], b[0], b[3], b[2]]
    generators.push(getGenerator('a', '(12345)', '#ff6b6b', a))
    generators.push(getGenerator('b', '(12)(34)', '#4ecdc4', b))
  } else {
    // n ≥ 6（当前上限 6）：相邻 3-循环生成集 σ_i = (i, i+1, i+2)，i = 1..n−2
    // （定理：A_n = ⟨σ_1, …, σ_{n−2}⟩）。生成对不能随便挑——闭包不足时界面会给出
    // 「生成元生成不出这个群」的假象（反馈实测反例：(123) + (12345) 闭包只有 60 阶）；
    // 本集闭包 = 全群由 groups.test 逐条锁定。
    const palette = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa']
    for (let i = 0; i + 2 < n; i++) {
      const perm = Array.from({ length: n }, (_, j) => j + 1)
      const tmp = perm[i]; perm[i] = perm[i + 1]; perm[i + 1] = perm[i + 2]; perm[i + 2] = tmp
      generators.push(getGenerator(`c${i + 1}`, `(${i + 1}${i + 2}${i + 3})`, palette[i % palette.length], perm))
    }
  }

  function multiply(a: GroupElement, b: GroupElement): GroupElement {
    const result = applyPermutation(a.value, b.value)
    const idx = findPermIndex(elements, result)
    return elements[idx]
  }

  function inverse(element: GroupElement): GroupElement {
    const inv = element.value.map((_, i) => element.value.indexOf(i + 1) + 1)
    const idx = findPermIndex(elements, inv)
    return elements[idx]
  }

  const identity = elements.find(el =>
    el.value.every((v, i) => v === i + 1)
  )!

  return {
    name: `Alternating Group A_{${n}}`,
    symbol: `A_{${n}}`,
    order: elements.length,
    elements,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian: n <= 3
  }
}
