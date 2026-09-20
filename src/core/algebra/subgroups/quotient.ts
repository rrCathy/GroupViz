import type { Group, GroupElement } from '../../types'
import { COLOR_PALETTE } from '../../types'
import { type Subgroup, findMinimalGenerators } from './shared'
import { computeCayleyActionEdges, type ForceLayoutEdge } from '../cayleyEdges'
import { forceLayout } from '../cycleLayouts'

export interface CosetInfo {
  subgroup: Subgroup
  leftCosets: GroupElement[][]
  rightCosets: GroupElement[][]
  isNormal: boolean
}

export function computeCosets(group: Group, subgroup: Subgroup): CosetInfo {
  const leftCosets: GroupElement[][] = []
  const rightCosets: GroupElement[][] = []
  const usedLeft = new Set<string>()
  const usedRight = new Set<string>()

  for (const g of group.elements) {
    const cosetLeft = group.elements.filter(h => {
      const exists = subgroup.elements.some(sh => {
        return group.multiply(g, sh).id === h.id
      })
      return exists
    })
    const key = cosetLeft.map(e => e.id).sort().join(',')
    if (!usedLeft.has(key)) {
      usedLeft.add(key)
      leftCosets.push(cosetLeft)
    }
  }

  for (const g of group.elements) {
    const cosetRight = group.elements.filter(h => {
      const exists = subgroup.elements.some(sh => {
        return group.multiply(sh, g).id === h.id
      })
      return exists
    })
    const key = cosetRight.map(e => e.id).sort().join(',')
    if (!usedRight.has(key)) {
      usedRight.add(key)
      rightCosets.push(cosetRight)
    }
  }

  const leftKeys = new Set(leftCosets.map(lc => lc.map(e => e.id).sort().join(',')))
  const rightKeys = new Set(rightCosets.map(rc => rc.map(e => e.id).sort().join(',')))
  const isNormal = leftKeys.size === rightKeys.size && [...leftKeys].every(k => rightKeys.has(k))

  return { subgroup, leftCosets, rightCosets, isNormal }
}

export function computeQuotientGroup(group: Group, normalSubgroup: Subgroup): Group | null {
  if (!normalSubgroup.isNormal) return null

  const cosets = computeCosets(group, normalSubgroup)
  let leftCosets = cosets.leftCosets

  // Sort cosets deterministically: identity coset first, then by smallest element ID.
  // This ensures qcoset-N IDs remain stable after page refresh / localStorage restore.
  const normalKey = normalSubgroup.elements.map(e => e.id).sort().join(',')
  leftCosets = [...leftCosets].sort((a, b) => {
    const aKey = a.map(e => e.id).sort().join(',')
    const bKey = b.map(e => e.id).sort().join(',')
    if (aKey === normalKey) return -1
    if (bKey === normalKey) return 1
    // Compare by smallest element ID for deterministic ordering
    const aMin = a.map(e => e.id).sort()[0]
    const bMin = b.map(e => e.id).sort()[0]
    return aMin < bMin ? -1 : aMin > bMin ? 1 : 0
  })

  const elements: GroupElement[] = leftCosets.map((coset, i) => {
    const rep = coset[0]
    const memberLabels = coset.map(e => e.label)
    // 商群元素 = 陪集 gN，标签用「代表元 + N」的陪集记号（gH 型）。
    // 旧实现把成员 label 拼成一串（≤4 个逗号连接、>4 个 "x, \dots"），
    // S₄/A₄ 这类会得到 "e, (12)(34), \dots" 的巨长标签，凯莱图 / 乘法表 /
    // 元素属性面板里全部放不下；派生的成员信息仍保留在 cosetMemberLabels。
    const label = `${rep.label}N`
    return {
      id: `qcoset-${i}`,
      label,
      value: [i],
      cosetMemberLabels: memberLabels,
    }
  })

  const cosetMap = new Map<string, number>()
  leftCosets.forEach((coset, idx) => {
    const key = coset.map(e => e.id).sort().join(',')
    cosetMap.set(key, idx)
  })

  const identityIdx = cosetMap.get(normalSubgroup.elements.map(e => e.id).sort().join(',')) ?? 0

  const nSubgroup = leftCosets[identityIdx]
  // N 的凯莱图只画 **N 自己的最小生成元** 作为边（用户 2026-09-20：「只需要展示
  // 它自己的生成元作为边就够了」）。旧实现随手挑 N 里前 3 个 2/3 阶元 —— 那不是
  // 生成集，画出来的「内部凯莱图」既不标准也不必要地密。
  const nGeneratorEls = findMinimalGenerators(nSubgroup, group)

  if (nGeneratorEls.length > 0) {
    const palette = ['#ff6b6b','#4ecdc4','#ffd93d']
    const actions: import('../../types').CayleyAction[] = nGeneratorEls.map((el, i) => ({
      elementId: el.id,
      enabled: true,
      color: palette[i % palette.length],
    }))
    const parentEdges = computeCayleyActionEdges(group, actions, 'right')

    const nIdSet = new Set(nSubgroup.map(e => e.id))
    const nIdToIdx = new Map<string, number>()
    nSubgroup.forEach((e, i) => nIdToIdx.set(e.id, i))

    const parentElMap = new Map<string, GroupElement>()
    for (const el of group.elements) parentElMap.set(el.id, el)

    const internalEdges: import('../../types').InternalEdgeData[] = []
    for (const edge of parentEdges) {
      if (nIdSet.has(edge.fromId) && nIdSet.has(edge.toId)) {
        const actionEl = parentElMap.get(edge.actionElementId)
        internalEdges.push({
          fromInnerIdx: nIdToIdx.get(edge.fromId)!,
          toInnerIdx: nIdToIdx.get(edge.toId)!,
          color: edge.color,
          isBidirectional: edge.isBidirectional,
          actionElementId: edge.actionElementId,
          actionLabel: actionEl?.label || edge.actionElementId,
        })
      }
    }

    if (internalEdges.length > 0) {
      // Compute a normalized force-directed layout for the internal Cayley
      // graph of the normal subgroup. All cosets are isomorphic to N, so the
      // same layout is reused for every compound node and scaled at render time.
      const layoutEdges: ForceLayoutEdge[] = internalEdges.map(e => ({
        source: nSubgroup[e.fromInnerIdx].id,
        target: nSubgroup[e.toInnerIdx].id,
      }))
      const positions = forceLayout(nSubgroup, layoutEdges, 100, 100, { cycleSubgroups: [] })
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      positions.forEach(p => {
        minX = Math.min(minX, p.x)
        maxX = Math.max(maxX, p.x)
        minY = Math.min(minY, p.y)
        maxY = Math.max(maxY, p.y)
      })
      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2
      const range = Math.max(maxX - minX, maxY - minY, 1e-6)
      const internalLayout = nSubgroup.map(e => {
        const p = positions.get(e.id)
        if (!p) return { x: 0, y: 0 }
        return {
          x: (p.x - centerX) / range * 2,
          y: (p.y - centerY) / range * 2,
        }
      })

      for (const el of elements) {
        el.cosetInternalEdges = internalEdges
        el.cosetInternalLayout = internalLayout
      }
    }
  }

  const multiply = (a: GroupElement, b: GroupElement): GroupElement => {
    const aIdx = parseInt(a.id.split('-')[1], 10)
    const bIdx = parseInt(b.id.split('-')[1], 10)
    if (!isFinite(aIdx) || aIdx < 0 || aIdx >= leftCosets.length) return elements[0]
    if (!isFinite(bIdx) || bIdx < 0 || bIdx >= leftCosets.length) return elements[0]
    const aRep = leftCosets[aIdx][0]
    const bRep = leftCosets[bIdx][0]
    const product = group.multiply(aRep, bRep)
    // Find which coset contains the product element
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e => e.id === product.id)) return elements[i]
    }
    // Fallback: match by value
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e =>
        e.value.length === product.value.length && e.value.every((v, j) => v === product.value[j])
      )) return elements[i]
    }
    return elements[0]
  }

  const inverse = (el: GroupElement): GroupElement => {
    const idx = parseInt(el.id.split('-')[1], 10)
    if (!isFinite(idx) || idx < 0 || idx >= leftCosets.length) return elements[0]
    const rep = leftCosets[idx][0]
    const inv = group.inverse(rep)
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e => e.id === inv.id)) return elements[i]
    }
    // Fallback: match by value
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e =>
        e.value.length === inv.value.length && e.value.every((v, j) => v === inv.value[j])
      )) return elements[i]
    }
    return elements[0]
  }

  const order = leftCosets.length
  // A quotient of an abelian group is abelian, but a NON-abelian group can also
  // have an abelian quotient (e.g. (S3 x C5) / (A3 x {e}) ~= C10), so verify
  // commutativity on the quotient elements directly (order <= 60 locally).
  let isAbelian = true
  outer: for (let i = 0; i < order; i++) {
    for (let j = i + 1; j < order; j++) {
      if (multiply(elements[i], elements[j]).id !== multiply(elements[j], elements[i]).id) {
        isAbelian = false
        break outer
      }
    }
  }

  // 生成元按**商群自己的结构**挑（findMinimalGenerators：阶从大到小 + 贪心扩张，
  // 直到生成整个商群），不再继承父群生成元的陪集。
  // 为什么必须换：父群生成元映射到商群里可能全是低阶元 —— S₄ 的默认生成元
  // (12)、(1234) 在 S₄/V₄ ≅ S₃ 里**都是对合**，画出来是六边形；而 S₃ 的标准
  // 形状（双三角）需要先选 3 阶旋转元。同构群的形状 = 同构群的生成元集。
  const genEls = order > 1
    ? findMinimalGenerators(elements, {
        multiply,
        elements,
        identity: elements[identityIdx],
      } as unknown as Group).filter(el => el.id !== elements[identityIdx].id)
    : []

  // 尽量沿用父群生成元的配色：若所选陪集里含父群某生成元，就继承它的颜色；
  // 继承不到（或撞色）的用调色板里还没被用的颜色补位 —— 两个生成元同色会
  // 让凯莱图上的两类边无法区分。
  const parentColorByCoset = new Map<number, string>()
  for (const pg of group.generators) {
    const genEl = pg.apply(group.identity)
    for (let i = 0; i < leftCosets.length; i++) {
      if (leftCosets[i].some(e => e.id === genEl.id)) {
        if (!parentColorByCoset.has(i)) parentColorByCoset.set(i, pg.color)
        break
      }
    }
  }

  const genColors: string[] = []
  const usedColors = new Set<string>()
  for (const el of genEls) {
    const idx = parseInt(el.id.split('-')[1], 10)
    const inherited = parentColorByCoset.get(idx)
    const color = inherited && !usedColors.has(inherited) ? inherited : ''
    genColors.push(color)
    if (color) usedColors.add(color)
  }
  let fallbackIdx = 0
  for (let i = 0; i < genColors.length; i++) {
    if (genColors[i]) continue
    while (usedColors.has(COLOR_PALETTE[fallbackIdx % COLOR_PALETTE.length]) && fallbackIdx < COLOR_PALETTE.length) fallbackIdx++
    genColors[i] = COLOR_PALETTE[fallbackIdx % COLOR_PALETTE.length]
    usedColors.add(genColors[i])
    fallbackIdx++
  }

  const generators: import('../../types').Generator[] = genEls.map((el, i) => {
    const idx = parseInt(el.id.split('-')[1], 10)
    return {
      name: `g${idx}`,
      symbol: `\\bar{g}_{${idx}}`,
      color: genColors[i],
      apply: (el2: GroupElement) => multiply(el2, elements[idx]),
      inverse: {} as import('../../types').Generator,
    }
  })

  const invIndex = new Map<number, number>()
  for (let i = 0; i < elements.length; i++) {
    const inv = inverse(elements[i])
    invIndex.set(i, parseInt(inv.id.split('-')[1], 10))
  }

  for (const gen of generators) {
    const genIdx = parseInt(gen.apply(elements[identityIdx]).id.split('-')[1], 10)
    const targetInvIdx = invIndex.get(genIdx) ?? genIdx
    const existingInv = generators.find(g => {
      const gIdx = parseInt(g.apply(elements[identityIdx]).id.split('-')[1], 10)
      return gIdx === targetInvIdx
    })
    if (existingInv) {
      gen.inverse = existingInv
      if (gen === existingInv) existingInv.inverse = existingInv
    } else {
      // Create an inverse generator reference but do not add it to the public
      // generator set so the quotient Cayley graph only shows the chosen
      // generating directions.
      gen.inverse = {
        name: `g${targetInvIdx}`,
        symbol: `\\bar{g}_{${targetInvIdx}}`,
        color: gen.color,
        apply: (el: GroupElement) => multiply(el, elements[targetInvIdx]),
        inverse: gen,
      }
    }
  }

  const quotientSymbol = `${group.symbol}/N`
  const quotientName = `Quotient Group ${group.symbol}/N`

  return {
    name: quotientName,
    symbol: quotientSymbol,
    order,
    elements,
    generators,
    multiply,
    inverse,
    identity: elements[identityIdx],
    isAbelian,
    normalSubgroupElementIds: normalSubgroup.elements.map(e => e.id),
  }
}
