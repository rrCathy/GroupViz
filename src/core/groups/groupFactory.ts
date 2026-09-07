import type { Group } from '../types'
import { createSymmetricGroup } from './SymmetricGroup'
import { createCyclicGroup } from './CyclicGroup'
import { createDihedralGroup } from './DihedralGroup'
import { createAlternatingGroup } from './AlternatingGroup'
import { createKleinFour, createQuaternion } from './SpecialGroup'
import { createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3, createZ6xZ2, getSmallGroupBySymbol } from './SmallGroups'
import { createDirectProduct } from './DirectProduct'
import { createGL2 } from './GeneralLinearGroup'
import { createTableGroup } from './SmallGroups/tableGroup'
import { SMALL_GROUP_DATA } from './smallGroupData'

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
  if (cN !== null && cN >= 1 && cN <= 30) {
    return createCyclicGroup(cN)
  }
  // Plain-digit fallback: C3, C5, etc.
  const cMatch = /^C(\d+)$/.exec(symbol)
  if (cMatch) {
    const n = parseInt(cMatch[1], 10)
    if (n >= 1 && n <= 30) return createCyclicGroup(n)
  }

  // Z_{n} alias for cyclic groups: Z_{3}, Z_{n}, etc.
  const zN = parseTexSubscript(symbol, 'Z')
  if (zN !== null && zN >= 1 && zN <= 30) {
    return createCyclicGroup(zN)
  }
  const zMatch = /^Z(\d+)$/.exec(symbol)
  if (zMatch) {
    const n = parseInt(zMatch[1], 10)
    if (n >= 1 && n <= 30) return createCyclicGroup(n)
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
  return getSmallGroupBySymbol(symbol)?.group ?? null
}
