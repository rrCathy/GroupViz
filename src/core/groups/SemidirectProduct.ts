import type { Group, GroupElement, Generator } from '../types'
import { COLOR_PALETTE } from '../types'
import type { Automorphism } from '../algebra/automorphisms'
import { detectIsomorphicGroup } from '../algebra/subgroups'

export function createSemidirectProduct(
  N: Group,
  H: Group,
  phiMap: Map<string, Automorphism>,
): Group {
  // --- Validate φ is a homomorphism H → Aut(N) ---
  // For each pair h1,h2 in H: φ(h1·h2) = φ(h1) ∘ φ(h2)  (composition in Aut(N))
  // Skip full validation if order too large — trust caller

  // --- φ lookup with identity fallback (guards against incomplete phiMap) ---
  let identityAuto: Automorphism | null = null
  for (const auto of phiMap.values()) {
    let isId = true
    for (const [k, v] of auto.map) {
      if (k !== v) { isId = false; break }
    }
    if (isId) { identityAuto = auto; break }
  }
  if (!identityAuto) {
    const idMap = new Map(N.elements.map(e => [e.id, e.id]))
    identityAuto = {
      id: 'id',
      map: idMap,
      label: '\\mathrm{id}',
      apply: (el: GroupElement) => el,
    }
  }
  const getPhi = (h: GroupElement): Automorphism => phiMap.get(h.id) ?? identityAuto!

  if (H.order <= 30) {
    for (const h1 of H.elements) {
      for (const h2 of H.elements) {
        const h12 = H.multiply(h1, h2)
        const phiH1 = getPhi(h1)
        const phiH2 = getPhi(h2)
        const phiH12 = getPhi(h12)

        // Verify: φ(h1·h2)(n) = φ(h1)(φ(h2)(n)) for all n
        for (const n of N.elements) {
          const lhs = phiH12.apply(n)
          const rhs = phiH1.apply(phiH2.apply(n))
          if (lhs.id !== rhs.id) {
            throw new Error(
              `φ is not a homomorphism: φ(${h1.label}·${h2.label})(n)=${lhs.label} ` +
              `≠ φ(${h1.label})(φ(${h2.label})(n))=${rhs.label} for n=${n.label}`
            )
          }
        }
      }
    }
  }

  // --- Build elements ---
  const elements: GroupElement[] = []
  const pairMap = new Map<string, [GroupElement, GroupElement]>()

  for (const n of N.elements) {
    for (const h of H.elements) {
      const el: GroupElement = {
        id: `${n.id}|${h.id}`,
        label: `(${n.label},${h.label})`,
        value: [...n.value, ...h.value],
      }
      elements.push(el)
      pairMap.set(el.id, [n, h])
    }
  }

  const elMap = new Map<string, GroupElement>()
  for (const el of elements) {
    elMap.set(el.id, el)
  }

  const nById = new Map(N.elements.map(e => [e.id, e]))

  function getPair(el: GroupElement): [GroupElement, GroupElement] {
    return pairMap.get(el.id)!
  }

  const identity: GroupElement = elMap.get(`${N.identity.id}|${H.identity.id}`)!

  // --- Multiply cache ---
  const multiplyCache = new Map<string, GroupElement>()

  function multiply(x: GroupElement, y: GroupElement): GroupElement {
    const cacheKey = `${x.id}|${y.id}`
    const cached = multiplyCache.get(cacheKey)
    if (cached) return cached

    const [n1, h1] = getPair(x)
    const [n2, h2] = getPair(y)

    // (n₁, h₁)(n₂, h₂) = (n₁ · φ(h₁)(n₂), h₁ · h₂)
    const phiH1 = getPhi(h1)
    const phiN2 = phiH1.apply(n2)
    const nProd = N.multiply(n1, nById.get(phiN2.id)!)

    const hProd = H.multiply(h1, h2)

    const result = elMap.get(`${nProd.id}|${hProd.id}`)!
    multiplyCache.set(cacheKey, result)
    return result
  }

  // --- Inverse cache ---
  const inverseCache = new Map<string, GroupElement>()

  function inverse(element: GroupElement): GroupElement {
    const cached = inverseCache.get(element.id)
    if (cached) return cached

    const [n, h] = getPair(element)

    // (n, h)⁻¹ = (φ(h⁻¹)(n⁻¹), h⁻¹)
    const hInv = H.inverse(h)
    const nInv = N.inverse(n)
    const phiHInv = getPhi(hInv)
    const phiResult = phiHInv.apply(nInv)

    const result = elMap.get(`${phiResult.id}|${hInv.id}`)!
    inverseCache.set(element.id, result)
    return result
  }

  // --- Generators ---
  const generators: Generator[] = []
  let colorIdx = 0

  // Lift N-generators
  for (const genN of N.generators) {
    const color = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length]
    colorIdx++

    const targetElN = genN.apply(N.identity)
    const invTargetElN = genN.inverse.apply(N.identity)
    const isSelfInvN = targetElN.id === invTargetElN.id

    const liftedGen: Generator = {
      name: genN.name,
      symbol: genN.symbol,
      color,
      apply(el: GroupElement): GroupElement {
        const [nEl, hEl] = getPair(el)
        const newN = genN.apply(nEl)
        return elMap.get(`${newN.id}|${hEl.id}`)!
      },
      inverse: undefined as unknown as Generator,
    }

    if (isSelfInvN) {
      liftedGen.inverse = liftedGen
      generators.push(liftedGen)
    } else {
      const invGenN: Generator = {
        name: `${genN.name}^{-1}`,
        symbol: `${genN.symbol}^{-1}`,
        color,
        apply(el: GroupElement): GroupElement {
          const [nEl, hEl] = getPair(el)
          const newN = genN.inverse.apply(nEl)
          return elMap.get(`${newN.id}|${hEl.id}`)!
        },
        inverse: liftedGen,
      }
      liftedGen.inverse = invGenN
      generators.push(liftedGen)
    }
  }

  // Lift H-generators
  for (const genH of H.generators) {
    const color = COLOR_PALETTE[colorIdx % COLOR_PALETTE.length]
    colorIdx++

    const targetElH = genH.apply(H.identity)
    const invTargetElH = genH.inverse.apply(H.identity)
    const isSelfInvH = targetElH.id === invTargetElH.id

    const liftedGen: Generator = {
      name: genH.name,
      symbol: genH.symbol,
      color,
      apply(el: GroupElement): GroupElement {
        const [nEl, hEl] = getPair(el)
        const newH = genH.apply(hEl)
        return elMap.get(`${nEl.id}|${newH.id}`)!
      },
      inverse: undefined as unknown as Generator,
    }

    if (isSelfInvH) {
      liftedGen.inverse = liftedGen
      generators.push(liftedGen)
    } else {
      const invGenH: Generator = {
        name: `${genH.name}^{-1}`,
        symbol: `${genH.symbol}^{-1}`,
        color,
        apply(el: GroupElement): GroupElement {
          const [nEl, hEl] = getPair(el)
          const newH = genH.inverse.apply(hEl)
          return elMap.get(`${nEl.id}|${newH.id}`)!
        },
        inverse: liftedGen,
      }
      liftedGen.inverse = invGenH
      generators.push(liftedGen)
    }
  }

  // --- Symbol ---
  const symbol = `${N.symbol} \\rtimes_{\\phi} ${H.symbol}`

  // --- Abelian check (sample first ~20 pairs) ---
  let isAbelian = true
  const checkCount = Math.min(elements.length, 20)
  for (let i = 0; i < checkCount && isAbelian; i++) {
    for (let j = i + 1; j < checkCount && isAbelian; j++) {
      const ab = multiply(elements[i], elements[j])
      const ba = multiply(elements[j], elements[i])
      if (ab.id !== ba.id) isAbelian = false
    }
  }

  const group: Group = {
    name: symbol,
    symbol,
    order: N.order * H.order,
    elements,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian,
    exponent: N.exponent !== undefined && H.exponent !== undefined
      ? lcm(N.exponent, H.exponent)
      : undefined,
    _semidirectProduct: { normal: N, acting: H, phiMap },
  }

  try {
    const isoSymbol = detectIsomorphicGroup(group)
    if (isoSymbol) {
      group.isoSymbol = isoSymbol
    }
  } catch {
    // Ignore detection failures
  }

  return group
}

function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b] }
  return a
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b)
}
