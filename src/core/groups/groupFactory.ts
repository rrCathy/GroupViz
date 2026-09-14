import type { Group } from '../types'
import { createSymmetricGroup } from './SymmetricGroup'
import { createCyclicGroup } from './CyclicGroup'
import { createDihedralGroup } from './DihedralGroup'
import { createAlternatingGroup } from './AlternatingGroup'
import { createKleinFour, createQuaternion } from './SpecialGroup'
import { createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3, createZ6xZ2, getSmallGroupBySymbol } from './SmallGroups'
import { createDirectProduct } from './DirectProduct'
import { createSemidirectProduct } from './SemidirectProduct'
import type { Automorphism } from '../algebra/automorphisms'
import { createGL2 } from './GeneralLinearGroup'
import { createTableGroup } from './SmallGroups/tableGroup'
import { SMALL_GROUP_DATA } from './smallGroupData'

/**
 * 循环群记号构造上限（C_{n} / Z_{n} 两种写法共用）。
 * 与群族面板的 Cₙ(2–120) 对齐。纯循环群的乘法是闭式 `(i+j) mod n`，
 * 不需要 GAP 小群表，任意阶都算得动；原上限 30 会让 C₃₁ 以上的记号构造
 * 直接返回 null（见 feedback 观察项 7：博客要展示 coil 需 C₃₆ 起）。
 */
export const CYCLIC_GROUP_MAX_ORDER = 120

function parseTexSubscript(symbol: string, prefix: string): number | null {
  const re = new RegExp(`^${prefix}_\\{(\\d+)\\}$`, '')
  const m = symbol.match(re)
  if (!m) return null
  return parseInt(m[1], 10)
}

function parseTexSuperscript(symbol: string): { base: string; exponent: number } | null {
  const m = symbol.match(/^(.+)\^\{(\d+)\}$/)
  if (!m) return null
  const exponent = parseInt(m[2], 10)
  if (exponent < 1) return null
  return { base: m[1], exponent }
}

function gcdInt(a: number, b: number): number {
  while (b) { const t = a % b; a = b; b = t }
  return a
}

function modPow(base: number, exp: number, mod: number): number {
  let result = 1
  let b = base % mod
  let e = exp
  while (e > 0) {
    if (e & 1) result = (result * b) % mod
    b = (b * b) % mod
    e >>= 1
  }
  return result
}

/** C_n 上的自同构 a ↦ a^k（k 与 n 互素） */
function cyclicAuto(N: Group, k: number, n: number): Automorphism {
  const kk = ((k % n) + n) % n
  return {
    id: `a->a^${kk}`,
    map: new Map(N.elements.map(el => [el.id, `e${(el.value[0] * kk) % n}`])),
    label: `a\\mapsto a^{${kk}}`,
    apply: (el) => N.elements[(el.value[0] * kk) % n],
  }
}

/**
 * 通用 `C_{n}:C_{m}` 半直积兜底（registry 未收录时）。
 *
 * φ 取 C_n 上乘法阶最大、且满足 k^m ≡ 1 (mod n) 的非平凡自同构 a ↦ a^k
 * —— k^m ≡ 1 保证作用经 C_m 下降（φ 良定义），取最大阶让作用尽量不平凡。
 * 这是群论里 `:` 记号的标准含义（split extension）。不存在这样的 k
 * （如 Aut(C_n) 平凡、或阶不整除 m）时返回 null，交由调用方走其他分支。
 *
 * 注意顺序：调用点必须在 registry 查询**之后**，已收录的记号（C_{7}:C_{3}、
 * C_{8}:C_{2} …带预计算子群数据的 14 个）保持原有构造路径不变。
 */
function buildCyclicSplitExtension(n: number, m: number): Group | null {
  if (n < 2 || m < 2) return null
  let bestK = 0
  let bestOrder = 0
  for (let k = 2; k < n; k++) {
    if (gcdInt(k, n) !== 1) continue
    if (modPow(k, m, n) !== 1) continue
    let ord = 1
    let cur = k % n
    while (cur !== 1) { cur = (cur * k) % n; ord++ }
    if (ord > bestOrder) { bestOrder = ord; bestK = k }
  }
  if (bestK === 0) return null

  const N = createCyclicGroup(n)
  const H = createCyclicGroup(m)
  const phi = new Map<string, Automorphism>()
  // e_j = a^j ⟹ φ(e_j) = φ(a)^j = (a ↦ a^k)^j = a ↦ a^{k^j}
  for (let j = 0; j < m; j++) {
    phi.set(H.elements[j].id, cyclicAuto(N, modPow(bestK, j, n), n))
  }
  try {
    return createSemidirectProduct(N, H, phi)
  } catch {
    return null
  }
}

export function createGroupFromSymbol(symbol: string): Group | null {
  if (!symbol) return null

  // Exact matches for known TeX-format symbols
  switch (symbol) {
    case 'Z_{4}\\times Z_{2}': return createZ4xZ2()
    case 'Z_{2}^{3}':             return createZ2xZ2xZ2()
    case 'Z_{3}\\times Z_{3}':
    case 'Z_{3}^{2}':             return createZ3xZ3()
    case 'Z_{6}\\times Z_{2}':   return createZ6xZ2()
    case 'V_{4}':                return createKleinFour()
    case 'Q_{8}':                return createQuaternion()
    // Legacy Unicode symbols (backward compat for saved sessions)
    case 'Z₄×Z₂': return createZ4xZ2()
    case 'Z₂³':   return createZ2xZ2xZ2()
    case 'Z₃×Z₃': case 'Z₃²': return createZ3xZ3()
    case 'Z₆×Z₂': return createZ6xZ2()
    case 'V₄':    return createKleinFour()
    case 'Q₈':    return createQuaternion()
    // General linear groups GL(2,p)
    case 'GL(2, 2)': case 'GL(2,2)': return createGL2(2)
    case 'GL(2, 3)': case 'GL(2,3)': return createGL2(3)
  }

  // Direct product: parse A \times B
  const timesIdx = symbol.indexOf('\\times')
  if (timesIdx > 0 && timesIdx < symbol.length - 1) {
    const leftSymbol = symbol.substring(0, timesIdx)
    const rightSymbol = symbol.substring(timesIdx + 7) // skip '\\times'
    const leftGroup = createGroupFromSymbol(leftSymbol)
    const rightGroup = createGroupFromSymbol(rightSymbol)
    if (leftGroup && rightGroup) {
      return createDirectProduct(leftGroup, rightGroup)
    }
  }
  // Legacy Unicode × separator
  const uniTimesIdx = symbol.indexOf('×')
  if (uniTimesIdx > 0 && uniTimesIdx < symbol.length - 1) {
    const leftSymbol = symbol.substring(0, uniTimesIdx)
    const rightSymbol = symbol.substring(uniTimesIdx + 1)
    const leftGroup = createGroupFromSymbol(leftSymbol)
    const rightGroup = createGroupFromSymbol(rightSymbol)
    if (leftGroup && rightGroup) {
      return createDirectProduct(leftGroup, rightGroup)
    }
  }

  // Superscript power notation: C_{2}^{2}, Z_{2}^{3}, etc.
  const supPower = parseTexSuperscript(symbol)
  if (supPower && supPower.exponent === 1) {
    return createGroupFromSymbol(supPower.base)
  }
  if (supPower) {
    const baseGroup = createGroupFromSymbol(supPower.base)
    if (baseGroup) {
      let result = baseGroup
      for (let i = 1; i < supPower.exponent; i++) {
        result = createDirectProduct(result, baseGroup)
      }
      return result
    }
  }

  // Cyclic groups: C_{n}
  const cN = parseTexSubscript(symbol, 'C')
  if (cN !== null && cN >= 1 && cN <= CYCLIC_GROUP_MAX_ORDER) {
    return createCyclicGroup(cN)
  }
  // Plain-digit fallback: C3, C5, etc.
  const cMatch = /^C(\d+)$/.exec(symbol)
  if (cMatch) {
    const n = parseInt(cMatch[1], 10)
    if (n >= 1 && n <= CYCLIC_GROUP_MAX_ORDER) return createCyclicGroup(n)
  }

  // Z_{n} alias for cyclic groups: Z_{3}, Z_{n}, etc.
  const zN = parseTexSubscript(symbol, 'Z')
  if (zN !== null && zN >= 1 && zN <= CYCLIC_GROUP_MAX_ORDER) {
    return createCyclicGroup(zN)
  }
  const zMatch = /^Z(\d+)$/.exec(symbol)
  if (zMatch) {
    const n = parseInt(zMatch[1], 10)
    if (n >= 1 && n <= CYCLIC_GROUP_MAX_ORDER) return createCyclicGroup(n)
  }

  // Dihedral groups: D_{n}
  const dN = parseTexSubscript(symbol, 'D')
  if (dN !== null && dN >= 3 && dN <= 15) {
    return createDihedralGroup(dN)
  }
  const dMatch = /^D(\d+)$/.exec(symbol)
  if (dMatch) {
    const n = parseInt(dMatch[1], 10)
    if (n >= 3 && n <= 15) return createDihedralGroup(n)
  }

  // 命名半直积的无下标写法：QD16（规范符号是 'QD_{16}'）。registry 命中失败
  // 时返回 null——不猜测结构，交由调用方处理。
  const qdMatch = /^QD(\d+)$/.exec(symbol)
  if (qdMatch) {
    return getSmallGroupBySymbol(`QD_{${qdMatch[1]}}`)?.group ?? null
  }

  // Symmetric groups: S_{n}
  const sN = parseTexSubscript(symbol, 'S')
  if (sN !== null && sN >= 2 && sN <= 6) {
    return createSymmetricGroup(sN)
  }
  const sMatch = /^S(\d+)$/.exec(symbol)
  if (sMatch) {
    const n = parseInt(sMatch[1], 10)
    if (n >= 2 && n <= 6) return createSymmetricGroup(n)
  }

  // Alternating groups: A_{n}
  const aN = parseTexSubscript(symbol, 'A')
  if (aN !== null && aN >= 3 && aN <= 6) {
    return createAlternatingGroup(aN)
  }
  const aMatch = /^A(\d+)$/.exec(symbol)
  if (aMatch) {
    const n = parseInt(aMatch[1], 10)
    if (n >= 3 && n <= 6) return createAlternatingGroup(n)
  }

  // SmallGroup(n,i) identifier (GAP convention, i is 1-based).
  // 走 getSmallGroupBySymbol 只能命中 symbol 冲突改名的少数群（registry map
  // 只在冲突时才存 'SmallGroup(n,i)' 键 → 93 群里仅 16,13 / 20,3 两个）；
  // 其余群 map 键是 TeX 结构符号，查不到。也不能改走 getSmallGroup(n,i-1)：
  // registry 的 order≤15 手写条目序 ≠ GAP 序（order 12 尤甚——GAP(12,1)=C₃:C₄
  // 而 registry index0 是 C₁₂）。GAP 数据表本身按 (n,i) 序存，故 miss 后直查
  // SMALL_GROUP_DATA 并用 createTableGroup 重建，保证 SmallGroup(n,i) = GAP(n,i) 精确。
  const sgMatch = /^SmallGroup\((\d+),(\d+)\)$/.exec(symbol)
  if (sgMatch) {
    const n = parseInt(sgMatch[1], 10)
    const i = parseInt(sgMatch[2], 10)
    // 冲突改名群（registry symbol 即 'SmallGroup(n,i)'）：优先返回注册表条目
    // （保留改名 symbol + precomputed 子群数据）；其余群注册表查不到走数据表重建。
    const renamed = getSmallGroupBySymbol(`SmallGroup(${n},${i})`)
    if (renamed) return renamed.group
    if (n >= 1 && i >= 1 && SMALL_GROUP_DATA.some(r => r.n === n && r.i === i)) {
      return createTableGroup(n, i)
    }
    return null
  }

  // Fallback: look up the SmallGroups registry by symbol (orders 16-31, Dic3, ...)
  const registered = getSmallGroupBySymbol(symbol)?.group
  if (registered) return registered

  // 通用 C_{n}:C_{m} 半直积兜底。放在 registry 之后：已收录的 14 个 ':' 记号
  // （C_{7}:C_{3}、C_{8}:C_{2} … 带预计算子群数据与标准化生成对）保持原路径；
  // 只有未收录的写法（如 C_{4}:C_{2}，即 D₄ 的常见记号）才走这里现场构造。
  const colonMatch = /^C_\{(\d+)\}:C_\{(\d+)\}$/.exec(symbol)
  if (colonMatch) {
    return buildCyclicSplitExtension(parseInt(colonMatch[1], 10), parseInt(colonMatch[2], 10))
  }
  return null
}
