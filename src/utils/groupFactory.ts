import type { Group } from '../core/types'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3, createZ6xZ2 } from '../core/groups/SmallGroups'
import { createDirectProduct } from '../core/groups/DirectProduct'

function parseTexSubscript(symbol: string, prefix: string): number | null {
  const re = new RegExp(`^${prefix}_\\{(\\d+)\\}`, '')
  const m = symbol.match(re)
  if (!m) return null
  return parseInt(m[1], 10)
}

function parseTexSuperscript(symbol: string): { base: string; exponent: number } | null {
  const m = symbol.match(/^(.+)\^\{(\d+)\}$/)
  if (!m) return null
  const exponent = parseInt(m[2], 10)
  if (exponent < 2) return null
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
  if (dN !== null && dN >= 3 && dN <= 12) {
    return createDihedralGroup(dN)
  }
  const dMatch = /^D(\d+)$/.exec(symbol)
  if (dMatch) {
    const n = parseInt(dMatch[1], 10)
    if (n >= 3 && n <= 12) return createDihedralGroup(n)
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

  return null
}
