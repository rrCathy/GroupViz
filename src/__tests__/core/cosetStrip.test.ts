import { describe, it, expect } from 'vitest'
import {
  listCosetStripSubgroups,
  findCosetStripSubgroup,
  cosetDataForSubgroup,
  type CosetStripSubgroupOption,
} from '../../core/algebra/cosetStrip'
import { createSymmetricGroup } from '../../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../../core/groups/AlternatingGroup'

function keyOf(opt: CosetStripSubgroupOption): string {
  return opt.elementIds.slice().sort().join(',')
}

describe('listCosetStripSubgroups', () => {
  it('A₄：合并共轭后得 3 个轨道（V₄ 正规、C₃×4、C₂×3），按 index 升序 V₄ 居首', () => {
    const a4 = createAlternatingGroup(4)
    const opts = listCosetStripSubgroups(a4)
    expect(opts).toHaveLength(3)

    // V₄：|H|=4、[G:H]=3、正规（单点轨道）、结构 C₂×C₂
    expect(opts[0].order).toBe(4)
    expect(opts[0].index).toBe(3)
    expect(opts[0].isNormal).toBe(true)
    expect(opts[0].orbitSize).toBe(1)
    expect(opts[0].structure).toBe('C_{2}\\times C_{2}')
    // V₄ 恒含单位元
    expect(opts[0].elementIds).toContain(a4.identity.id)

    // C₃ 轨道：4 个共轭 3 循环子群
    expect(opts[1].order).toBe(3)
    expect(opts[1].index).toBe(4)
    expect(opts[1].orbitSize).toBe(4)
    expect(opts[1].isNormal).toBe(false)
    expect(opts[1].structure).toBe('C_{3}')

    // C₂ 轨道：3 个共轭双对换子群
    expect(opts[2].order).toBe(2)
    expect(opts[2].index).toBe(6)
    expect(opts[2].orbitSize).toBe(3)
    expect(opts[2].structure).toBe('C_{2}')

    // 键互异、元素 id 已升序
    const keys = new Set(opts.map(keyOf))
    expect(keys.size).toBe(3)
    for (const o of opts) {
      expect(o.elementIds).toEqual([...o.elementIds].sort())
    }
  })

  it('S₃：C₃（index 2 正规）在前，C₂ 轨道（3 个共轭）在后', () => {
    const s3 = createSymmetricGroup(3)
    const opts = listCosetStripSubgroups(s3)
    expect(opts).toHaveLength(2)

    expect(opts[0].order).toBe(3)
    expect(opts[0].index).toBe(2)
    expect(opts[0].isNormal).toBe(true)
    expect(opts[0].orbitSize).toBe(1)

    expect(opts[1].order).toBe(2)
    expect(opts[1].index).toBe(3)
    expect(opts[1].orbitSize).toBe(3)
    expect(opts[1].isNormal).toBe(false)
  })

  it('平凡群 / 无真子群时返回空列表', () => {
    const c2 = createSymmetricGroup(2)
    expect(listCosetStripSubgroups(c2)).toEqual([])
  })

  it('群阶 >60 本地守卫：S₅ 返回空（与 findAllSubgroups 同策略）', () => {
    const s5 = createSymmetricGroup(5)
    expect(listCosetStripSubgroups(s5)).toEqual([])
  })
})

describe('findCosetStripSubgroup', () => {
  it('按元素 id 数组精确恢复候选', () => {
    const a4 = createAlternatingGroup(4)
    const opts = listCosetStripSubgroups(a4)
    const v4 = opts[0]
    const found = findCosetStripSubgroup(a4, v4.elementIds)
    expect(found).not.toBeNull()
    expect(found!.key).toBe(v4.key)
    expect(found!.order).toBe(4)
  })

  it('非法 / 空 / 非子群元素集合 → null', () => {
    const a4 = createAlternatingGroup(4)
    expect(findCosetStripSubgroup(a4, [])).toBeNull()
    expect(findCosetStripSubgroup(a4, ['not-a-real-id'])).toBeNull()
    // 两个不同 C₂ 元素不能张成真子群键（各属不同子群）→ 命中不了候选
    const c2s = listCosetStripSubgroups(a4)[2].elementIds
    const other = a4.elements.find(e => !c2s.includes(e.id))!
    expect(findCosetStripSubgroup(a4, [c2s[0], other.id])).toBeNull()
  })

  it('换群后失效：把 A₄ 的候选键拿去 S₃ 查 → null', () => {
    const a4 = createAlternatingGroup(4)
    const s3 = createSymmetricGroup(3)
    const v4 = listCosetStripSubgroups(a4)[0]
    expect(findCosetStripSubgroup(s3, v4.elementIds)).toBeNull()
  })
})

describe('cosetDataForSubgroup', () => {
  it('A₄ / V₄ → 3 条左陪集，每条 4 元素，恒等陪集 = V₄', () => {
    const a4 = createAlternatingGroup(4)
    const v4 = listCosetStripSubgroups(a4)[0]
    const data = cosetDataForSubgroup(a4, v4.elementIds)
    expect(data).not.toBeNull()
    expect(data!.leftCosets).toHaveLength(3)
    expect(data!.rightCosets).toHaveLength(3)
    for (const coset of data!.leftCosets) expect(coset).toHaveLength(4)
    expect(data!.isNormal).toBe(true)

    const eCoset = data!.leftCosets.find(c => c.some(e => e.id === a4.identity.id))!
    expect(eCoset.map(e => e.id).sort()).toEqual(v4.elementIds)
  })

  it('空输入 → null', () => {
    const a4 = createAlternatingGroup(4)
    expect(cosetDataForSubgroup(a4, [])).toBeNull()
    expect(cosetDataForSubgroup(a4, ['nope'])).toBeNull()
  })
})
