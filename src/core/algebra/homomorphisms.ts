import type { Group, GroupElement, Generator, HomomorphismMap, HomomorphismResult, HomomorphismProperties } from '../types'

export function verifyHomomorphism(
  source: Group,
  target: Group,
  mapping: HomomorphismMap
): HomomorphismResult {
  const identityTarget = target.identity.id

  for (const a of source.elements) {
    for (const b of source.elements) {
      const faId = mapping.get(a.id)
      const fbId = mapping.get(b.id)
      if (faId === undefined || fbId === undefined) continue

      const ab = source.multiply(a, b)
      const fabId = mapping.get(ab.id)
      if (fabId === undefined) continue

      const fa = target.elements.find(e => e.id === faId)
      const fb = target.elements.find(e => e.id === fbId)
      if (!fa || !fb) continue

      const fafb = target.multiply(fa, fb)

      if (fabId !== fafb.id) {
        return {
          isHomomorphism: false,
          kernel: [],
          image: [],
          violation: {
            a: a.id,
            b: b.id,
            lhs: fabId,
            rhs: fafb.id,
          },
        }
      }
    }
  }

  const kernel = computeKernelFromMapping(source, mapping, identityTarget)
  const image = computeImageFromMapping(mapping)

  return {
    isHomomorphism: true,
    kernel,
    image,
  }
}

export function computeKernelFromMapping(
  source: Group,
  mapping: HomomorphismMap,
  targetIdentityId: string
): string[] {
  const kernel: string[] = []
  for (const el of source.elements) {
    const mappedId = mapping.get(el.id)
    if (mappedId === targetIdentityId) {
      kernel.push(el.id)
    }
  }
  return kernel
}

export function computeImageFromMapping(mapping: HomomorphismMap): string[] {
  const imageSet = new Set<string>()
  mapping.forEach((targetId) => {
    imageSet.add(targetId)
  })
  return Array.from(imageSet)
}

export function getHomomorphismProperties(
  source: Group,
  target: Group,
  result: HomomorphismResult
): HomomorphismProperties {
  const kernelOrder = result.kernel.length
  const imageOrder = result.image.length
  return {
    isInjective: kernelOrder === 1,
    isSurjective: imageOrder === target.order,
    isIsomorphism: kernelOrder === 1 && imageOrder === target.order && source.order === target.order,
    kernelOrder,
    imageOrder,
  }
}

export function isElementIdentity(
  group: Group,
  elementId: string
): boolean {
  return elementId === group.identity.id
}

export function trivialMapping(source: Group, target: Group): HomomorphismMap {
  const map = new Map<string, string>()
  const targetId = target.identity.id
  for (const el of source.elements) {
    map.set(el.id, targetId)
  }
  return map
}

export function naturalProjectionMapping(source: Group, target: Group): HomomorphismMap | null {
  const symSrc = source.symbol
  const symTgt = target.symbol

  const srcMatch = symSrc.match(/^[CZ]_?\{?(\d+)\}?$/)
  const tgtMatch = symTgt.match(/^[CZ]_?\{?(\d+)\}?$/)

  if (!srcMatch || !tgtMatch) return null

  const nSrc = parseInt(srcMatch[1], 10)
  const nTgt = parseInt(tgtMatch[1], 10)

  if (nSrc % nTgt !== 0) return null

  const map = new Map<string, string>()
  for (const el of source.elements) {
    const val = el.value[0]
    if (typeof val !== 'number') return null
    const projected = val % nTgt
    const targetEl = target.elements.find(e => e.value[0] === projected)
    if (!targetEl) return null
    map.set(el.id, targetEl.id)
  }
  return map
}

function cyclicFromSymbol(name: string): number | null {
  const m = name.match(/^[CZ]_?\{?(\d+)\}?$/)
  return m ? parseInt(m[1], 10) : null
}

export function autoBuildMapping(source: Group, target: Group): { type: string; map: HomomorphismMap } | null {
  const srcN = cyclicFromSymbol(source.symbol)
  const tgtN = cyclicFromSymbol(target.symbol)

  if (srcN !== null && tgtN !== null && srcN >= tgtN && srcN % tgtN === 0) {
    const map = naturalProjectionMapping(source, target)
    if (map) return { type: 'projection', map }
  }

  return null
}

export function subgroupInclusionMapping(
  source: Group,
  target: Group,
  sourceElementIds: string[]
): HomomorphismMap | null {
  const map = new Map<string, string>()
  for (const el of source.elements) {
    if (sourceElementIds.includes(el.id)) {
      const targetEl = target.elements.find(e => e.label === el.label || e.id === el.id)
      if (targetEl) {
        map.set(el.id, targetEl.id)
      } else {
        return null
      }
    } else {
      map.set(el.id, target.identity.id)
    }
  }
  return map
}

export function directProductProjectionMapping(
  source: Group,
  target: Group,
  factorIndex: 0 | 1
): HomomorphismMap | null {
  if (!source.elements[0]?.id.includes('|')) return null

  const map = new Map<string, string>()
  for (const el of source.elements) {
    const parts = el.id.split('|')
    if (parts.length < 2) return null
    const projectedId = parts[factorIndex]

    const targetEl = target.elements.find(e => e.id === projectedId)
    if (!targetEl) return null
    map.set(el.id, targetEl.id)
  }
  return map
}

export function getGeneratorElement(group: Group, gen: Generator): GroupElement | null {
  const applied = gen.apply(group.identity)
  return group.elements.find(e => e.id === applied.id) || null
}

export function getGeneratorElements(group: Group): { gen: Generator; el: GroupElement }[] {
  const result: { gen: Generator; el: GroupElement }[] = []
  for (const gen of group.generators) {
    const el = getGeneratorElement(group, gen)
    if (el) result.push({ gen, el })
  }
  return result
}

export function extendFromGenerators(
  source: Group,
  target: Group,
  generatorMapping: Map<string, string>
): HomomorphismMap | null {
  const fullMap = new Map<string, string>()
  const visited = new Set<string>()

  fullMap.set(source.identity.id, target.identity.id)
  visited.add(source.identity.id)

  const genElements = getGeneratorElements(source)

  for (const { el } of genElements) {
    const tgtId = generatorMapping.get(el.id)
    if (tgtId === undefined) return null
  }

  const targetElementById = new Map(target.elements.map(e => [e.id, e]))

  const queue: GroupElement[] = [source.identity]

  while (queue.length > 0) {
    const a = queue.shift()!
    const faId = fullMap.get(a.id)!
    const fa = targetElementById.get(faId)
    if (!fa) return null

    for (const { gen, el: genEl } of genElements) {
      const b = gen.apply(a)
      if (visited.has(b.id)) continue

      const fgenId = generatorMapping.get(genEl.id)!
      const fgen = targetElementById.get(fgenId)
      if (!fgen) return null

      const fb = target.multiply(fa, fgen)
      fullMap.set(b.id, fb.id)
      visited.add(b.id)
      queue.push(b)
    }
  }

  if (visited.size < source.order) return null

  return fullMap
}

export function extractGeneratorMapping(
  source: Group,
  fullMapping: HomomorphismMap
): Map<string, string> {
  const genMap = new Map<string, string>()
  for (const { el } of getGeneratorElements(source)) {
    const mapped = fullMapping.get(el.id)
    if (mapped !== undefined) {
      genMap.set(el.id, mapped)
    }
  }
  return genMap
}

export function formatKernelLabel(
  source: Group,
  kernelIds: string[]
): string {
  if (kernelIds.length === 1) return '\\{e\\}'
  const elements = kernelIds
    .map(id => source.elements.find(e => e.id === id))
    .filter((e): e is GroupElement => e !== undefined)
  const labels = elements.map(e => e.label).join(', ')
  if (kernelIds.length <= 4) return `\\{${labels}\\}`
  return `\\{${elements.slice(0, 3).map(e => e.label).join(', ')}, \\dots\\}`
}
