import type { Group, GroupElement, Generator } from '../types'
import { COLOR_PALETTE } from '../types'
import { findAllSubgroups, findAllNormalSubgroups, getConjugacyClasses, getGroupCenter, isSimpleGroup } from '../algebra/subgroups'
import type { Subgroup } from '../algebra/subgroups'
import { createCyclicGroup } from './CyclicGroup'
import { createSymmetricGroup } from './SymmetricGroup'
import { createDihedralGroup } from './DihedralGroup'
import { createAlternatingGroup } from './AlternatingGroup'
import { createKleinFour, createQuaternion } from './SpecialGroup'
import { SMALL_GROUP_DATA, type SmallGroupRecord } from './smallGroupData'

// ─── Precomputed Data Interface ────────────────────────────────────────────

export interface PrecomputedData {
  subgroups: Subgroup[]
  normalSubgroups: Subgroup[]
  conjugacyClasses: GroupElement[][]
  center: GroupElement[]
  isSimple: boolean
}

// ─── Small Group Entry ─────────────────────────────────────────────────────

export interface SmallGroupEntry {
  order: number
  index: number
  group: Group
  precomputed: PrecomputedData
}

// Direct Product Z4 x Z2 (order 8, abelian)

export function createZ4xZ2(): Group {
  const nA = 4, nB = 2
  const elements: GroupElement[] = []
  for (let b = 0; b < nB; b++) {
    for (let a = 0; a < nA; a++) {
      elements.push({
        id: `e${a}${b}`,
        label: `(${a},${b})`,
        value: [a, b]
      })
    }
  }

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    const a = (x.value[0] + y.value[0]) % nA
    const b = (x.value[1] + y.value[1]) % nB
    return elements[a + b * nA]
  }

  function inv(el: GroupElement): GroupElement {
    return elements[((-el.value[0] + nA) % nA) + el.value[1] * nA]
  }

  const identity = elements[0]

  const genA: Generator = {
    name: 'a', symbol: 'a', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] + 1) % nA) + el.value[1] * nA],
    inverse: null as unknown as Generator
  }
  const genB: Generator = {
    name: 'b', symbol: 'b', color: '#4ecdc4',
    apply: (el: GroupElement) => elements[el.value[0] + ((el.value[1] + 1) % nB) * nA],
    inverse: null as unknown as Generator
  }
  genA.inverse = genA
  genB.inverse = genB

  return {
    name: 'C_{4} \\times C_{2}',
    symbol: 'C_{4}\\times C_{2}',
    order: 8,
    elements,
    generators: [genA, genB],
    multiply: mul,
    inverse: inv,
    identity,
    isAbelian: true,
    exponent: 4
  }
}

// Direct Product Z2 x Z2 x Z2 (order 8, abelian)

export function createZ2xZ2xZ2(): Group {
  const elements: GroupElement[] = []
  for (let i = 0; i < 8; i++) {
    elements.push({
      id: `e${(i>>2)&1}${(i>>1)&1}${i&1}`,
      label: `(${(i>>2)&1},${(i>>1)&1},${i&1})`,
      value: [(i>>2)&1, (i>>1)&1, i&1]
    })
  }

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    const a = x.value[0] ^ y.value[0]
    const b = x.value[1] ^ y.value[1]
    const c = x.value[2] ^ y.value[2]
    return elements[(a << 2) | (b << 1) | c]
  }

  function inv(el: GroupElement): GroupElement { return el }
  const identity = elements[0]

  function makeGen(name: string, symbol: string, color: string, bit: number): Generator {
    const shift = 2 - bit
    const gen: Generator = {
      name, symbol, color,
      apply: (el: GroupElement) => {
        const i = (el.value[0] << 2) | (el.value[1] << 1) | el.value[2]
        return elements[i ^ (1 << shift)]
      },
      inverse: null as unknown as Generator
    }
    gen.inverse = gen
    return gen
  }

  return {
    name: 'C_{2} \\times C_{2} \\times C_{2}',
    symbol: 'C_{2}^{3}',
    order: 8,
    elements,
    generators: [makeGen('a', 'a', '#ff6b6b', 2), makeGen('b', 'b', '#4ecdc4', 1), makeGen('c', 'c', '#ffd93d', 0)],
    multiply: mul,
    inverse: inv,
    identity,
    isAbelian: true,
    exponent: 2
  }
}

// Direct Product Z3 x Z3 (order 9, abelian)

export function createZ3xZ3(): Group {
  const n = 3
  const elements: GroupElement[] = []
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      elements.push({ id: `e${a}${b}`, label: `(${a},${b})`, value: [a, b] })
    }
  }

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    return elements[((x.value[0] + y.value[0]) % n) * n + ((x.value[1] + y.value[1]) % n)]
  }

  function inv(el: GroupElement): GroupElement {
    return elements[((-el.value[0] + n) % n) * n + ((-el.value[1] + n) % n)]
  }

  const identity = elements[0]

  const genA: Generator = {
    name: 'a', symbol: 'a', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] + 1) % n) * n + el.value[1]],
    inverse: null as unknown as Generator
  }
  const genB: Generator = {
    name: 'b', symbol: 'b', color: '#4ecdc4',
    apply: (el: GroupElement) => elements[el.value[0] * n + ((el.value[1] + 1) % n)],
    inverse: null as unknown as Generator
  }
  genA.inverse = {
    name: 'a^{-1}', symbol: 'a^{-1}', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] - 1 + n) % n) * n + el.value[1]],
    inverse: genA
  }
  genB.inverse = {
    name: 'b^{-1}', symbol: 'b^{-1}', color: '#4ecdc4',
    apply: (el: GroupElement) => elements[el.value[0] * n + ((el.value[1] - 1 + n) % n)],
    inverse: genB
  }

  return {
    name: 'C_{3}^{2}',
    symbol: 'C_{3}^{2}',
    order: 9,
    elements,
    generators: [genA, genB],
    multiply: mul,
    inverse: inv,
    identity,
    isAbelian: true,
    exponent: 3
  }
}

// Direct Product Z6 x Z2 (order 12, abelian, non-cyclic)

export function createZ6xZ2(): Group {
  const nA = 6, nB = 2
  const elements: GroupElement[] = []
  for (let b = 0; b < nB; b++) {
    for (let a = 0; a < nA; a++) {
      elements.push({
        id: `e${a}${b}`,
        label: `(${a},${b})`,
        value: [a, b]
      })
    }
  }

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    const a = (x.value[0] + y.value[0]) % nA
    const b = (x.value[1] + y.value[1]) % nB
    return elements[a + b * nA]
  }

  function inv(el: GroupElement): GroupElement {
    return elements[((-el.value[0] + nA) % nA) + el.value[1] * nA]
  }

  const identity = elements[0]

  const genA: Generator = {
    name: 'a', symbol: 'a', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] + 1) % nA) + el.value[1] * nA],
    inverse: null as unknown as Generator
  }
  const genB: Generator = {
    name: 'b', symbol: 'b', color: '#4ecdc4',
    apply: (el: GroupElement) => elements[el.value[0] + ((el.value[1] + 1) % nB) * nA],
    inverse: null as unknown as Generator
  }
  genA.inverse = {
    name: 'a^{-1}', symbol: 'a^{-1}', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] - 1 + nA) % nA) + el.value[1] * nA],
    inverse: genA
  }
  genB.inverse = genB

  return {
    name: 'C_{6} \\times C_{2}',
    symbol: 'C_{6}\\times C_{2}',
    order: 12,
    elements,
    generators: [genA, genB],
    multiply: mul,
    inverse: inv,
    identity,
    isAbelian: true,
    exponent: 6
  }
}

// ─── Table-Driven Group from GAP SmallGroups Data (orders 16-31) ──────────

// Convert a GAP StructureDescription into a front-end TeX symbol.
// Rules:
//   - Cyclic C_{n} keeps 'C'; any other leading C-family token maps to Z
//     (guards isGroupCyclic() misdetection, e.g. C4 x C4, C5 : C4).
//   - Dihedral Dk (GAP order k) maps to the front-end rotation convention
//     D_{k/2} (front-end D_{n} has order 2n), e.g. D16 -> D_{8}.
//   - ' x ' -> '\times ', ' : ' kept verbatim.
//   - GAP cannot distinguish some isomorphism types (e.g. two groups with
//     StructureDescription "(C4 x C2) : C2"); ensureTable() disambiguates
//     symbol collisions by falling back to 'SmallGroup(n,i)'.
function structureToSymbol(_n: number, _i: number, structure: string): string {
  let s = structure
  // 循环群统一用 C 记号（isGroupCyclic 已升级为元素阶精确检测，
  // 不再依赖符号首字母，复合符号如 'C_{2} \times C_{2} \times S_{3}' 不会误判为循环群）
  s = s.replace(/(^|[^A-Za-z])D(\d+)/g, (_m, pre: string, k: string) => {
    const kk = parseInt(k, 10)
    if (kk % 2 === 0 && kk >= 6) return `${pre}D_{${kk / 2}}`
    return `${pre}D${k}`
  })
  s = s.replace(/([A-Za-z]+)(\d+)/g, '$1_{$2}')
  s = s.replace(/ x /g, '\\times ')
  s = s.replace(/ : /g, ':')
  return s
}

// 词项（{g, e} 生成元序号/幂）→ TeX 标签：与展示群的 wordToCanonicalString 同约定
// （a^2 / a^{10} / a b），幂按相邻同生成元合并（BFS 词可能含 a·a 这样的相邻项）。
function wordToLabel(terms: { g: number; e: number }[], genNames: string[]): string {
  const out: { g: number; e: number }[] = []
  for (const t of terms) {
    const last = out[out.length - 1]
    if (last && last.g === t.g) {
      last.e += t.e
      if (last.e === 0) out.pop()
    } else {
      out.push({ g: t.g, e: t.e })
    }
  }
  return out
    .map(t => {
      const sym = genNames[t.g] ?? `g${t.g}`
      if (t.e === 1) return sym
      if (t.e >= 2 && t.e < 10) return `${sym}^${t.e}`
      return `${sym}^{${t.e}}`
    })
    .join(' ')
}

// 生成元词标签：从单位元沿生成元做 BFS，给每个元素一个最短生成元词作为标签
// （单位元 = 'e'），使元素标签与生成元名字一一对应（a、b、a^2、a b …），
// 替换原先无意义的 g_0..g_{n-1}，也让 HomomorphismView/SemidirectProductView 等
// 按 label 查找生成元元素的逻辑对表驱动群生效。
function assignWordLabels(
  elements: GroupElement[],
  generators: Generator[],
  mul: (x: GroupElement, y: GroupElement) => GroupElement,
  n: number
): void {
  const id = elements[0]
  id.label = 'e'
  if (generators.length === 0) return
  const genEls = generators.map(g => g.apply(id))
  const genNames = generators.map(g => g.name)
  const words = new Map<string, { g: number; e: number }[]>()
  words.set(id.id, [])
  const queue: GroupElement[] = [id]
  let head = 0
  while (head < queue.length && words.size < n) {
    const cur = queue[head++]
    const curWord = words.get(cur.id)!
    for (let gi = 0; gi < genEls.length; gi++) {
      const next = mul(cur, genEls[gi])
      if (words.has(next.id)) continue
      const nextWord = [...curWord, { g: gi, e: 1 }]
      words.set(next.id, nextWord)
      next.label = wordToLabel(nextWord, genNames)
      queue.push(next)
    }
  }
}

// 二面体群的规范词形：旋转 = a^i（按离散对数），反射 = a^i b。
// BFS 最短词对旋转元素可能给出 b a b 这类混合词（数学正确但不符合
// 《群论彩图版》的 r^i / r^i s 约定），此处按标准生成元 (a=r, b=s) 重写。
function applyDihedralNormalForm(
  elements: GroupElement[],
  generators: Generator[],
  mul: (x: GroupElement, y: GroupElement) => GroupElement,
  n: number
): void {
  if (generators.length < 2) return
  const m = n / 2
  const r = generators[0].apply(elements[0])
  const s = generators[1].apply(elements[0])
  const log = new Map<string, number>()
  let cur = elements[0]
  for (let i = 0; i < m; i++) {
    log.set(cur.id, i)
    cur = mul(cur, r)
  }
  if (log.size !== m) return
  const powLabel = (i: number): string => {
    if (i === 0) return 'e'
    if (i === 1) return 'a'
    return i < 10 ? `a^${i}` : `a^{${i}}`
  }
  for (const el of elements) {
    const i = log.get(el.id)
    if (i !== undefined) {
      el.label = powLabel(i)
    } else {
      const j = log.get(mul(el, s).id)
      if (j !== undefined) el.label = j === 0 ? 'b' : `${powLabel(j)} b`
    }
  }
}

function createTableGroup(order: number, gapIndex: number): Group {
  const rec = SMALL_GROUP_DATA.find(r => r.n === order && r.i === gapIndex)
  if (!rec) {
    throw new Error(`SmallGroups: no data for SmallGroup(${order},${gapIndex})`)
  }
  const n = order
  const elements: GroupElement[] = []
  for (let k = 0; k < n; k++) {
    elements.push({ id: `g${k}`, label: `g_{${k}}`, value: [k] })
  }
  const symbol = structureToSymbol(n, gapIndex, rec.structure)
  const table = rec.table

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    return elements[table[x.value[0]][y.value[0]] - 1]
  }

  function inv(el: GroupElement): GroupElement {
    const row = table[el.value[0]]
    for (let k = 0; k < n; k++) {
      if (row[k] === 1) return elements[k]
    }
    return elements[0]
  }

  const generators: Generator[] = buildGenerators(rec, elements, n, table, mul, inv)
  assignWordLabels(elements, generators, mul, n)
  if (/^D(\d+)$/.test(rec.structure)) {
    applyDihedralNormalForm(elements, generators, mul, n)
  }

  return {
    name: symbol,
    symbol,
    order: n,
    elements,
    generators,
    multiply: mul,
    inverse: inv,
    identity: elements[0],
    isAbelian: rec.abelian,
    exponent: rec.exponent
  }
}

// 生成元标准化：GAP 的 rec.gens 是任意最小生成集（二面体群可能给两个反射），
// 会破坏凯莱图布局的对称性。对 D_m 结构重建标准生成元 (r, s)：
// r = 阶 m 元素（旋转）、s = 反射（阶 2 且不在 ⟨r⟩ 中），并验证 ⟨r, s⟩ = G。
// 其他结构保持 rec.gens。
function buildGenerators(
  rec: SmallGroupRecord,
  elements: GroupElement[],
  n: number,
  table: number[][],
  mul: (x: GroupElement, y: GroupElement) => GroupElement,
  inv: (el: GroupElement) => GroupElement
): Generator[] {
  const genPositions: number[] = rec.gens.slice()
  const dm = /^D(\d+)$/.exec(rec.structure)
  if (dm) {
    const m = n / 2
    let rIdx = -1
    for (let k = 1; k < n && rIdx < 0; k++) {
      let cur = k
      let cnt = 1
      while (cur !== 0) {
        cur = table[cur][k] - 1
        cnt++
      }
      if (cnt === m) rIdx = k
    }
    if (rIdx >= 0) {
      const rotSet = new Set<number>()
      let cur = 0
      for (let i = 0; i < m; i++) {
        rotSet.add(cur)
        cur = table[cur][rIdx] - 1
      }
      const refs: number[] = []
      for (let k = 0; k < n; k++) if (!rotSet.has(k)) refs.push(k)
      if (refs.length === m && refs.length > 0) {
        const s0 = refs[0]
        const closure = new Set<number>()
        let p = 0
        for (let i = 0; i < m; i++) {
          closure.add(p)
          closure.add(table[p][s0] - 1)
          p = table[p][rIdx] - 1
        }
        if (closure.size === n) {
          genPositions.length = 0
          genPositions.push(rIdx + 1, s0 + 1)
        }
      }
    }
  }
  // QD16（准二面体，半直积 C₈⋊C₂）：GAP 的 rec.gens = [g1(阶4), g2(阶2)]，
  // g1 = a² 使重布线布局内环只有 4 元环。重建标准生成元 (a, b)：
  // a = 阶 8 元素、b = 阶 2 元素且 bab = a³，验证 ⟨a, b⟩ = G。
  // 使 rewiring 布局内环呈现完整 8 元环 + b 边径向连接副本盘。
  if (rec.structure === 'QD16') {
    const isOrder = (k: number, want: number): boolean => {
      let cur = k
      let cnt = 1
      while (cur !== 0) {
        cur = table[cur][k] - 1
        cnt++
        if (cnt > want) return false
      }
      return cnt === want
    }
    let aIdx = -1
    for (let k = 1; k < n && aIdx < 0; k++) {
      if (isOrder(k, 8)) aIdx = k
    }
    if (aIdx >= 0) {
      let a3 = aIdx
      for (let i = 0; i < 2; i++) a3 = table[a3][aIdx] - 1
      const powSet = new Set<number>()
      let cur = 0
      do {
        powSet.add(cur)
        cur = table[cur][aIdx] - 1
      } while (cur !== 0)
      let bIdx = -1
      for (let k = 1; k < n && bIdx < 0; k++) {
        if (powSet.has(k)) continue
        if (!isOrder(k, 2)) continue
        const bab = table[table[k][aIdx] - 1][k] - 1
        if (bab !== a3) continue
        const closure = new Set<number>()
        let p = 0
        for (let i = 0; i < 8; i++) {
          closure.add(p)
          closure.add(table[p][k] - 1)
          p = table[p][aIdx] - 1
        }
        if (closure.size === n) bIdx = k
      }
      if (bIdx >= 0) {
        genPositions.length = 0
        genPositions.push(aIdx + 1, bIdx + 1)
      }
    }
  }
  // 注册表 (16,13)：(C₄×C₂):C₂——GAP 生成元 [g1,g2,g3] 阶为 [2,2,4]，
  // 重建 Group Explorer 标准生成元 (a,b,c)：a 阶 4、b 阶 2（与 a 交换）、
  // c 阶 2（与 a 交换、绕 b 扭转为 b·a²，即 φ(c)(b) = b·a²），⟨a,b,c⟩ = G。
  if (rec.n === 16 && rec.i === 13) {
    const isOrder = (k: number, want: number): boolean => {
      let cur = k
      let cnt = 1
      while (cur !== 0) {
        cur = table[cur][k] - 1
        cnt++
        if (cnt > want) return false
      }
      return cnt === want
    }
    const powSet = (k: number): Set<number> => {
      const s = new Set<number>()
      let cur = 0
      do {
        s.add(cur)
        cur = table[cur][k] - 1
      } while (cur !== 0)
      return s
    }
    const closureSize = (gens: number[]): number => {
      const s = new Set<number>([0])
      const stack = [0]
      while (stack.length > 0) {
        const x = stack.pop()!
        for (const g of gens) {
          const y = Math.min(table[x][g] - 1, table[g][x] - 1)
          const z = table[x][g] - 1
          if (!s.has(z)) {
            s.add(z)
            stack.push(z)
          }
          if (y !== z && !s.has(y)) {
            s.add(y)
            stack.push(y)
          }
        }
      }
      return s.size
    }
    let aIdx = -1
    for (let k = 1; k < n && aIdx < 0; k++) {
      if (isOrder(k, 4) && powSet(k).size === 4) aIdx = k
    }
    if (aIdx >= 0) {
      const aPow = powSet(aIdx)
      let bIdx = -1
      for (let k = 1; k < n && bIdx < 0; k++) {
        if (aPow.has(k)) continue
        if (!isOrder(k, 2)) continue
        if (table[aIdx][k] - 1 !== table[k][aIdx] - 1) continue
        bIdx = k
      }
      if (bIdx >= 0) {
        const nSet = new Set<number>()
        let aCur = 0
        for (let i = 0; i < 4; i++) {
          let bCur = 0
          for (let j = 0; j < 2; j++) {
            nSet.add(table[aCur][bCur] - 1)
            bCur = table[bCur][bIdx] - 1
          }
          aCur = table[aCur][aIdx] - 1
        }
        let cIdx = -1
        for (let k = 1; k < n && cIdx < 0; k++) {
          if (nSet.has(k)) continue
          if (!isOrder(k, 2)) continue
          if (table[aIdx][k] - 1 !== table[k][aIdx] - 1) continue
          // c·b·c = b·a²
          const cbc = table[table[k][bIdx] - 1][k] - 1
          const ba2 = table[table[bIdx][aIdx] - 1][aIdx] - 1
          if (cbc !== ba2) continue
          if (closureSize([aIdx, bIdx, k]) === n) cIdx = k
        }
        if (cIdx >= 0) {
          genPositions.length = 0
          genPositions.push(aIdx + 1, bIdx + 1, cIdx + 1)
        }
      }
    }
  }
  // Q₁₆（广义四元数群，Group Explorer 记为 Q₈ 因下标惯例 Q_{阶/2}）：
  // GAP 的 rec.gens = [g1, g2] 均为阶 4 元素，凯莱图看不出 8 元环。
  // 重建 Group Explorer Q_8.group 标准生成元 (a, b)：a 阶 8、b 阶 4，
  // b² = a⁴（中心元素）、aba = b（a 共轭翻转 b），⟨a, b⟩ = G。
  if (rec.structure === 'Q16') {
    const isOrder = (k: number, want: number): boolean => {
      let cur = k
      let cnt = 1
      while (cur !== 0) {
        cur = table[cur][k] - 1
        cnt++
        if (cnt > want) return false
      }
      return cnt === want
    }
    let aIdx = -1
    for (let k = 1; k < n && aIdx < 0; k++) {
      if (isOrder(k, 8)) aIdx = k
    }
    if (aIdx >= 0) {
      // a⁴（= b²）
      let a4 = aIdx
      for (let i = 0; i < 3; i++) a4 = table[a4][aIdx] - 1
      let bIdx = -1
      for (let k = 1; k < n && bIdx < 0; k++) {
        if (!isOrder(k, 4)) continue
        if (table[k][k] - 1 !== a4) continue
        // aba = b
        if (table[table[aIdx][k] - 1][aIdx] - 1 !== k) continue
        const closure = new Set<number>()
        let p = 0
        for (let i = 0; i < 8; i++) {
          closure.add(p)
          let q = p
          for (let j = 0; j < 4; j++) {
            closure.add(q)
            q = table[q][k] - 1
          }
          p = table[p][aIdx] - 1
        }
        if (closure.size === n) bIdx = k
      }
      if (bIdx >= 0) {
        genPositions.length = 0
        genPositions.push(aIdx + 1, bIdx + 1)
      }
    }
  }
  return genPositions.map((pos, idx) => {
    const name = String.fromCharCode(97 + idx)
    const genEl = elements[pos - 1]
    const gen: Generator = {
      name, symbol: name,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      apply: (el: GroupElement) => mul(el, genEl),
      inverse: null as unknown as Generator
    }
    gen.inverse = {
      name: `${name}^{-1}`, symbol: `${name}^{-1}`, color: gen.color,
      apply: (el: GroupElement) => mul(el, inv(genEl)),
      inverse: gen
    }
    return gen
  })
}

// ─── Registry: All Groups of Order < 32 ────────────────────────────────────

function compile(group: Group): PrecomputedData {
  return {
    subgroups: findAllSubgroups(group),
    normalSubgroups: findAllNormalSubgroups(group),
    conjugacyClasses: getConjugacyClasses(group),
    center: getGroupCenter(group),
    isSimple: isSimpleGroup(group)
  }
}

type GroupFactory = () => Group

const FACTORIES: { order: number; index: number; factory: GroupFactory }[] = [
  { order: 1, index: 0, factory: () => createCyclicGroup(1) },
  { order: 2, index: 0, factory: () => createCyclicGroup(2) },
  { order: 3, index: 0, factory: () => createCyclicGroup(3) },
  { order: 4, index: 0, factory: () => createCyclicGroup(4) },
  { order: 4, index: 1, factory: createKleinFour },
  { order: 5, index: 0, factory: () => createCyclicGroup(5) },
  { order: 6, index: 0, factory: () => createCyclicGroup(6) },
  { order: 6, index: 1, factory: () => createSymmetricGroup(3) },
  { order: 7, index: 0, factory: () => createCyclicGroup(7) },
  { order: 8, index: 0, factory: () => createCyclicGroup(8) },
  { order: 8, index: 1, factory: createZ4xZ2 },
  { order: 8, index: 2, factory: createZ2xZ2xZ2 },
  { order: 8, index: 3, factory: () => createDihedralGroup(4) },
  { order: 8, index: 4, factory: createQuaternion },
  { order: 9, index: 0, factory: () => createCyclicGroup(9) },
  { order: 9, index: 1, factory: createZ3xZ3 },
  { order: 10, index: 0, factory: () => createCyclicGroup(10) },
  { order: 10, index: 1, factory: () => createDihedralGroup(5) },
  { order: 11, index: 0, factory: () => createCyclicGroup(11) },
  { order: 12, index: 0, factory: () => createCyclicGroup(12) },
  { order: 12, index: 1, factory: createZ6xZ2 },
  { order: 12, index: 2, factory: () => createDihedralGroup(6) },
  { order: 12, index: 3, factory: () => createAlternatingGroup(4) },
  { order: 13, index: 0, factory: () => createCyclicGroup(13) },
  { order: 14, index: 0, factory: () => createCyclicGroup(14) },
  { order: 14, index: 1, factory: () => createDihedralGroup(7) },
  { order: 15, index: 0, factory: () => createCyclicGroup(15) },
  { order: 12, index: 4, factory: () => createTableGroup(12, 1) },
  // Orders 16-31 (GAP SmallGroups data, index i is GAP's 1-based index)
  ...SMALL_GROUP_DATA.filter(r => r.n >= 16).map(r => ({
    order: r.n,
    index: r.i - 1,
    factory: () => createTableGroup(r.n, r.i)
  })),
]

// ─── Lazy-Initialized Table ────────────────────────────────────────────────

let _table: SmallGroupEntry[] | null = null
let _byOrder: Map<number, SmallGroupEntry[]> | null = null
let _bySymbol: Map<string, SmallGroupEntry> | null = null

function ensureTable(): void {
  if (_table) return
  _table = FACTORIES.map(def => {
    const group = def.factory()
    const precomputed = compile(group)
    return { order: def.order, index: def.index, group, precomputed }
  })
  _byOrder = new Map()
  _bySymbol = new Map()
  for (const entry of _table) {
    let symbol = entry.group.symbol
    if (_bySymbol.has(symbol)) {
      // GAP StructureDescription collision (e.g. two groups described as
      // "(C4 x C2) : C2"): disambiguate with the SmallGroup(n,i) identifier
      symbol = `SmallGroup(${entry.order},${entry.index + 1})`
      entry.group.symbol = symbol
      entry.group.name = symbol
    }
    if (!_byOrder.has(entry.order)) _byOrder.set(entry.order, [])
    _byOrder.get(entry.order)!.push(entry)
    _bySymbol.set(symbol, entry)
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export function getAllSmallGroups(): SmallGroupEntry[] {
  ensureTable()
  return _table!
}

export function getSmallGroup(order: number, index: number = 0): SmallGroupEntry | null {
  ensureTable()
  return _byOrder!.get(order)?.[index] ?? null
}

export function getSmallGroupBySymbol(symbol: string): SmallGroupEntry | null {
  ensureTable()
  // 兼容旧 Z 记号（统一 C 之前创建的会话/查询）
  const normalized = symbol.replace(/Z_/g, 'C_')
  return _bySymbol!.get(normalized) ?? null
}

export function getPrecomputed(group: Group): PrecomputedData | null {
  ensureTable()
  return _bySymbol!.get(group.symbol)?.precomputed ?? null
}
