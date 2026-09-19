import { describe, it, expect } from 'vitest'
import {
  listCosetStripSubgroups,
  findCosetStripSubgroup,
  cosetDataForSubgroup,
  type CosetStripSubgroupOption,
} from '../../core/algebra/cosetStrip'
import { createSymmetricGroup } from '../../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../../core/groups/AlternatingGroup'
import { createCyclicGroup } from '../../core/groups/CyclicGroup'
import { createDirectProduct } from '../../core/groups/DirectProduct'
import { cosetStripLayout } from '../../core/algebra/layouts/specialLayouts'
import { computeCosetColors, computeCosetElementMap } from '../../core/algebra/cosetView'

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

  it('S₅(120) 在枚举线内，能列出陪集条带子群（旧 guard 60 误杀）', () => {
    const s5 = createSymmetricGroup(5)
    expect(listCosetStripSubgroups(s5).length).toBeGreaterThan(0)
  })

  it('群阶超过枚举线（144）返回空：与 findAllSubgroups 同策略', () => {
    // C₁₃×C₁₃ = 169 阶 > ENUMERATION_LIMIT，guard 生效不真跑枚举
    const big = createDirectProduct(createCyclicGroup(13), createCyclicGroup(13))
    expect(listCosetStripSubgroups(big)).toEqual([])
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

// ─── 布局不溢出回归（2026-09-17）─────────────────────────────────────────
// 旧实现两处硬伤：① nodeStep 有绝对下限 68 ⇒ 条带总高 = |H|×68 远超画布
// （S₅ 的 A₅：60×68+12 = 4092 vs 可用高 562，条带被画到画布外）；
// ② 列宽不足时要求纵向也够松才分行，否则退回 totalStrips 列细条
// （S₅ 的 C₂：60 条带各 ~6px 宽，节点横跨相邻条带）。
const VB = { width: 900, height: 620 }
const NODE_R = 28

function layoutFor(group: ReturnType<typeof createSymmetricGroup>, elementIds: string[]) {
  const data = cosetDataForSubgroup(group, elementIds)!
  const map = computeCosetElementMap(data, 'left')
  const colors = computeCosetColors(data, 'left')
  return cosetStripLayout(group, VB.width, VB.height, undefined, map, new Set(map.values()).size, colors, undefined)
}

function outsideStrips(lay: ReturnType<typeof cosetStripLayout>) {
  return lay.strips.filter(s => s.x < -0.5 || s.y < -0.5 || s.x + s.w > VB.width + 0.5 || s.y + s.h > VB.height + 0.5)
}

function outsideNodes(lay: ReturnType<typeof cosetStripLayout>) {
  return [...lay.positions.entries()].filter(([, p]) =>
    p.x - NODE_R < -0.5 || p.x + NODE_R > VB.width + 0.5 || p.y - NODE_R < -0.5 || p.y + NODE_R > VB.height + 0.5)
}

describe('cosetStripLayout 大 |H| / 多条带不溢出', () => {
  it('S₅ 的 A₅（|H|=60，2 条带）：条带与节点全在画布内（旧实现 h=4080、y=-1743）', () => {
    const s5 = createSymmetricGroup(5)
    const a5 = listCosetStripSubgroups(s5).find(o => o.order === 60)!
    const lay = layoutFor(s5, a5.elementIds)
    expect(outsideStrips(lay)).toEqual([])
    expect(outsideNodes(lay)).toEqual([])
    // |H|=60 单列 68px 间距需 4080px ⇒ 必须靠分列 + 压缩
    expect(lay.strips[0].h).toBeLessThanOrEqual(VB.height)
  })

  it('S₄ 的 A₄（|H|=12，2 条带）：条带不越出（旧实现 h=816）', () => {
    const s4 = createSymmetricGroup(4)
    const a4sub = listCosetStripSubgroups(s4).find(o => o.order === 12)!
    const lay = layoutFor(s4, a4sub.elementIds)
    expect(outsideStrips(lay)).toEqual([])
    expect(outsideNodes(lay)).toEqual([])
  })

  it('S₅ 的 C₂（60 条带）：分行 + 条带宽至少容得下一个节点（旧实现 6px 细条）', () => {
    const s5 = createSymmetricGroup(5)
    const c2 = listCosetStripSubgroups(s5).find(o => o.order === 2)!
    const lay = layoutFor(s5, c2.elementIds)
    expect(lay.strips).toHaveLength(60)
    expect(outsideStrips(lay)).toEqual([])
    expect(outsideNodes(lay)).toEqual([])
    for (const s of lay.strips) expect(s.w).toBeGreaterThanOrEqual(56)
  })

  it('带 topPadding（子群凯莱图占位）时同样不出界', () => {
    const s5 = createSymmetricGroup(5)
    const a5 = listCosetStripSubgroups(s5).find(o => o.order === 60)!
    const lay = cosetStripLayout(s5, VB.width, VB.height, a5.elementIds, undefined, undefined, undefined, 256)
    expect(outsideStrips(lay)).toEqual([])
    expect(outsideNodes(lay)).toEqual([])
  })

  it('小群保持单列观感（向后兼容）：S₄ 的 C₂ 每列一节点、纵向间距取理想值 80', () => {
    const s4 = createSymmetricGroup(4)
    const c2 = listCosetStripSubgroups(s4).find(o => o.order === 2)!
    const lay = layoutFor(s4, c2.elementIds)
    expect(lay.strips).toHaveLength(12)
    expect(outsideStrips(lay)).toEqual([])
    // 单列：同一陪集内的节点 x 相同、相邻 y 差 = IDEAL_NODE_STEP(80)
    const strip = lay.strips[0]
    const ys = strip.elementIds.map(id => lay.positions.get(id)!.y).sort((a, b) => a - b)
    const xs = strip.elementIds.map(id => lay.positions.get(id)!.x)
    expect(ys[1] - ys[0]).toBeCloseTo(80, 6)
    expect(xs[0]).toBeCloseTo(xs[1], 6)
  })
})
