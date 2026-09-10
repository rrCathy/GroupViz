import { describe, it, expect } from 'vitest'
import {
  isSubgroupElementSet,
  subgroupFromElementIds,
  computeCosetElementMap,
  computeCosetColors,
  computeCosetHighlightSet,
  buildCosetViewData,
} from '../core/algebra/cosetView'
import { elementOrder } from '../core/algebra/elementOrder'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'

const c6 = createCyclicGroup(6)
const s3 = createSymmetricGroup(3)

describe('isSubgroupElementSet', () => {
  it('{e, g³} ⊂ C₆ 是子群（含单位元 + 乘法封闭）', () => {
    expect(isSubgroupElementSet(c6, ['e0', 'e3'])).toBe(true)
  })

  it('{e, g} ⊄ C₆（g·g = g² 不在集合内）', () => {
    expect(isSubgroupElementSet(c6, ['e0', 'e1'])).toBe(false)
  })

  it('不含单位元 → false', () => {
    expect(isSubgroupElementSet(c6, ['e2', 'e4'])).toBe(false)
  })

  it('空 / 空群 → false', () => {
    expect(isSubgroupElementSet(c6, [])).toBe(false)
    expect(isSubgroupElementSet(null, ['e0'])).toBe(false)
  })

  it('接受 label 记号', () => {
    expect(isSubgroupElementSet(c6, ['0', '3'])).toBe(true)
  })
})

describe('subgroupFromElementIds', () => {
  it('装配 Subgroup：阶 / 指数 / 极小生成集', () => {
    const sg = subgroupFromElementIds(c6, ['e0', 'e3'])
    expect(sg).not.toBeNull()
    expect(sg!.order).toBe(2)
    expect(sg!.index).toBe(3)
    expect(sg!.generators.length).toBeGreaterThan(0)
    expect(sg!.elements.map(e => e.id).sort()).toEqual(['e0', 'e3'])
  })

  it('label 与 id 混用等价', () => {
    const byId = subgroupFromElementIds(c6, ['e0', 'e3'])!
    const byLabel = subgroupFromElementIds(c6, ['0', '3'])!
    expect(byLabel.elements.map(e => e.id)).toEqual(byId.elements.map(e => e.id))
  })

  it('非子群 / 空集 / 无群 → null（默认强校验）', () => {
    expect(subgroupFromElementIds(c6, ['e0', 'e1'])).toBeNull()
    expect(subgroupFromElementIds(c6, [])).toBeNull()
    expect(subgroupFromElementIds(null, ['e0'])).toBeNull()
  })

  it('validate:false 时跳过闭包校验（供主应用热路径对齐历史行为）', () => {
    const sg = subgroupFromElementIds(c6, ['e0', 'e1'], { validate: false, computeGenerators: false })
    expect(sg).not.toBeNull()
    expect(sg!.order).toBe(2)
    expect(sg!.generators).toEqual([])
  })

  it('isNormal 透传', () => {
    expect(subgroupFromElementIds(c6, ['e0', 'e3'], { isNormal: true })!.isNormal).toBe(true)
  })
})

describe('computeCoset* 三件套', () => {
  const sg = subgroupFromElementIds(c6, ['e0', 'e3'])!
  const cosets = { subgroup: sg, leftCosets: [[c6.elements[0], c6.elements[3]], [c6.elements[1], c6.elements[4]], [c6.elements[2], c6.elements[5]]], rightCosets: [[c6.elements[0], c6.elements[3]], [c6.elements[1], c6.elements[4]], [c6.elements[2], c6.elements[5]]], isNormal: true }

  it('elementMap 覆盖全群且下标合法', () => {
    const map = computeCosetElementMap(cosets, 'left')
    expect(map.size).toBe(6)
    for (const idx of map.values()) expect(idx).toBeGreaterThanOrEqual(0)
    expect(map.get('e3')).toBe(0)
  })

  it('colors 每陪集一色', () => {
    expect(computeCosetColors(cosets, 'left')).toHaveLength(3)
    expect(computeCosetColors(cosets, 'right')).toHaveLength(3)
  })

  it('highlightSet：highlightAll 取全部；否则取含选中元素的陪集', () => {
    const map = computeCosetElementMap(cosets, 'left')
    expect([...computeCosetHighlightSet(cosets, 'left', true, [], map)].sort()).toEqual([0, 1, 2])
    expect([...computeCosetHighlightSet(cosets, 'left', false, new Set(['e4']), map)]).toEqual([1])
    expect([...computeCosetHighlightSet(cosets, 'left', false, new Set(['nope']), map)]).toEqual([])
  })

  it('null 陪集数据 → 空结果而非抛错', () => {
    expect(computeCosetElementMap(null, 'left').size).toBe(0)
    expect(computeCosetColors(null, 'left')).toEqual([])
    expect(computeCosetHighlightSet(null, 'left', true, [], new Map()).size).toBe(0)
  })
})

describe('buildCosetViewData（一键装配）', () => {
  it('C₆ / H=⟨g³⟩：3 条陪集，三件套齐备', () => {
    const data = buildCosetViewData(c6, ['e0', 'e3'])!
    expect(data).not.toBeNull()
    expect(data.side).toBe('left')
    expect(data.subgroupElementIds).toEqual(['e0', 'e3'])
    expect(data.cosets.leftCosets).toHaveLength(3)
    expect(data.cosetElementMap.size).toBe(6)
    expect(data.cosetColors).toHaveLength(3)
    expect(data.cosetHighlightSet.size).toBe(0)
  })

  it('selected 传 label 也能高亮到正确陪集', () => {
    const data = buildCosetViewData(c6, ['e0', 'e3'], { selected: ['4'] })!
    expect([...data.cosetHighlightSet]).toEqual([1])
  })

  it('highlightAll 全亮', () => {
    const data = buildCosetViewData(c6, ['e0', 'e3'], { highlightAll: true })!
    expect([...data.cosetHighlightSet].sort()).toEqual([0, 1, 2])
  })

  it('side:right 时用右陪集族', () => {
    const data = buildCosetViewData(c6, ['e0', 'e3'], { side: 'right' })!
    expect(data.side).toBe('right')
    expect(data.cosetColors).toHaveLength(data.cosets.rightCosets.length)
  })

  it('H 非法（非子群 / 空 / 无群）→ null，调用方可显示空态', () => {
    expect(buildCosetViewData(c6, ['e0', 'e1'])).toBeNull()
    expect(buildCosetViewData(c6, [])).toBeNull()
    expect(buildCosetViewData(null, ['e0'])).toBeNull()
  })

  it('S₃ / H=⟨阶 2 元素⟩：指数 3', () => {
    const x = s3.elements.find(e => e.id !== s3.identity.id && elementOrder(s3, e) === 2)!
    const h = [s3.identity.id, x.id]
    expect(h).toHaveLength(2)
    expect(isSubgroupElementSet(s3, h)).toBe(true)
    const data = buildCosetViewData(s3, h)!
    expect(data.cosets.leftCosets).toHaveLength(3)
    expect(data.cosetElementMap.size).toBe(6)
  })
})
