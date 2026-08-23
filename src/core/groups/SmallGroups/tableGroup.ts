import { COLOR_PALETTE } from '../../types'
import type { Group, GroupElement, Generator } from '../../types'
import { unsupportedError } from '../../result'
import { SMALL_GROUP_DATA, type SmallGroupRecord } from '../smallGroupData'
import { assignWordLabels, applyDihedralNormalForm } from './wordLabels'

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

export function createTableGroup(order: number, gapIndex: number): Group {
  const rec = SMALL_GROUP_DATA.find(r => r.n === order && r.i === gapIndex)
  if (!rec) {
    throw unsupportedError(`SmallGroups: no data for SmallGroup(${order},${gapIndex})`)
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
