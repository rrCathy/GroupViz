import type { Group, GroupElement, Generator } from '../types'
import { COLOR_PALETTE } from '../types'

// ─── Compact symbol builder (TeX format): C_{3}\\times C_{3} → C_{3}^{2} ───

function parseSymbolFactors(symbol: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const part of symbol.split(' \\times ')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    // Split part into base + optional superscript power: C_{3}^{2} → base=C_{3}, power=2
    const supMatch = trimmed.match(/^(.+)\^\{(\d+)\}$/)
    if (supMatch) {
      const base = supMatch[1]
      const exp = parseInt(supMatch[2], 10)
      counts.set(base, (counts.get(base) || 0) + exp)
    } else {
      counts.set(trimmed, (counts.get(trimmed) || 0) + 1)
    }
  }
  return counts
}

function buildCompactSymbol(counts: Map<string, number>): string {
  const parts: string[] = []
  for (const [base, count] of counts) {
    if (count === 1) {
      parts.push(base)
    } else {
      parts.push(`${base}^{${count}}`)
    }
  }
  return parts.join(' \\times ')
}

export function createDirectProduct(groupA: Group, groupB: Group): Group {
  const elements: GroupElement[] = []
  const pairMap = new Map<string, [GroupElement, GroupElement]>()

  for (const a of groupA.elements) {
    for (const b of groupB.elements) {
      const el: GroupElement = {
        id: `${a.id}|${b.id}`,
        label: `(${a.label},${b.label})`,
        value: [...a.value, ...b.value]
      }
      elements.push(el)
      pairMap.set(el.id, [a, b])
    }
  }

  const elMap = new Map<string, GroupElement>()
  for (const el of elements) {
    elMap.set(el.id, el)
  }

  function getPair(el: GroupElement): [GroupElement, GroupElement] {
    return pairMap.get(el.id)!
  }

  const identity: GroupElement = elMap.get(`${groupA.identity.id}|${groupB.identity.id}`)!

  const multiplyCache = new Map<string, GroupElement>()

  function multiply(x: GroupElement, y: GroupElement): GroupElement {
    const cacheKey = `${x.id}|${y.id}`
    const cached = multiplyCache.get(cacheKey)
    if (cached) return cached

    const [aEl, bEl] = getPair(x)
    const [cEl, dEl] = getPair(y)
    const aProd = groupA.multiply(aEl, cEl)
    const bProd = groupB.multiply(bEl, dEl)
    const result = elMap.get(`${aProd.id}|${bProd.id}`)!
    multiplyCache.set(cacheKey, result)
    return result
  }

  const inverseCache = new Map<string, GroupElement>()

  function inverse(element: GroupElement): GroupElement {
    const cached = inverseCache.get(element.id)
    if (cached) return cached

    const [aEl, bEl] = getPair(element)
    const aInv = groupA.inverse(aEl)
    const bInv = groupB.inverse(bEl)
    const result = elMap.get(`${aInv.id}|${bInv.id}`)!
    inverseCache.set(element.id, result)
    return result
  }

  const generators: Generator[] = []
  let colorIdx = 0

  for (const genA of groupA.generators) {
    const color = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length]
    colorIdx++

    const targetElA = genA.apply(groupA.identity)
    const invTargetElA = genA.inverse.apply(groupA.identity)
    const isSelfInvA = targetElA.id === invTargetElA.id

    const liftedGen: Generator = {
      name: genA.name,
      symbol: genA.symbol,
      color,
      apply(el: GroupElement): GroupElement {
        const [aEl, bEl] = getPair(el)
        const newA = genA.apply(aEl)
        return elMap.get(`${newA.id}|${bEl.id}`)!
      },
      inverse: undefined as unknown as Generator
    }

    if (isSelfInvA) {
      liftedGen.inverse = liftedGen
      generators.push(liftedGen)
    } else {
      const invGenA: Generator = {
        name: `${genA.name}^{-1}`,
        symbol: `${genA.symbol}^{-1}`,
        color,
        apply(el: GroupElement): GroupElement {
          const [aEl, bEl] = getPair(el)
          const newA = genA.inverse.apply(aEl)
          return elMap.get(`${newA.id}|${bEl.id}`)!
        },
        inverse: liftedGen
      }
      liftedGen.inverse = invGenA
      generators.push(liftedGen)
    }
  }

  for (const genB of groupB.generators) {
    const color = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length]
    colorIdx++

    const targetElB = genB.apply(groupB.identity)
    const invTargetElB = genB.inverse.apply(groupB.identity)
    const isSelfInvB = targetElB.id === invTargetElB.id

    const liftedGen: Generator = {
      name: genB.name,
      symbol: genB.symbol,
      color,
      apply(el: GroupElement): GroupElement {
        const [aEl, bEl] = getPair(el)
        const newB = genB.apply(bEl)
        return elMap.get(`${aEl.id}|${newB.id}`)!
      },
      inverse: undefined as unknown as Generator
    }

    if (isSelfInvB) {
      liftedGen.inverse = liftedGen
      generators.push(liftedGen)
    } else {
      const invGenB: Generator = {
        name: `${genB.name}^{-1}`,
        symbol: `${genB.symbol}^{-1}`,
        color,
        apply(el: GroupElement): GroupElement {
          const [aEl, bEl] = getPair(el)
          const newB = genB.inverse.apply(bEl)
          return elMap.get(`${aEl.id}|${newB.id}`)!
        },
        inverse: liftedGen
      }
      liftedGen.inverse = invGenB
      generators.push(liftedGen)
    }
  }

  const symbol = buildCompactSymbol(parseSymbolFactors(`${groupA.symbol} \\times ${groupB.symbol}`))

  return {
    name: symbol,
    symbol,
    order: groupA.order * groupB.order,
    elements,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian: groupA.isAbelian && groupB.isAbelian,
    exponent: groupA.exponent !== undefined && groupB.exponent !== undefined
      ? lcm(groupA.exponent, groupB.exponent)
      : undefined
  }
}

function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b] }
  return a
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b)
}
