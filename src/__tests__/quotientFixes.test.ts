import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import type { GroupElement } from '../core/types'
import { createGroupFromSymbol } from '../utils/groupFactory'
import { computeQuotientGroup, findAllSubgroups } from '../core/algebra/subgroups'
import { ringOrder, splitDihedralStructure } from '../core/algebra/ringOrder'
import { findMinimalGenerators, closeUnderMultiply } from '../core/algebra/subgroups/shared'
import { getAvailableShapesForView, getAvailableShapes3D } from '../core/types'
import { getCayleyShapeConfig } from '../context/cayleyActions'
import { computeInsetMetrics } from '../core/viewBox'

/**
 * 2026-09-20 商群四项缺陷的回归锁（用户报）：
 *  1. 不能创建商群（子群列表按钮静默失败）—— 上下文层，见 RightPanel 真机验证；
 *  2. 元素标签过长 → 改 gN 陪集记号；
 *  3. 凯莱图节点簇拥 / 没走同构群形状 / 形状可选太少 → 结构与形状；
 *  4. 复合节点（陪集成员小节点）→ 改为普通节点 + 独立 N 凯莱图面板（组件测试）。
 */
const s4 = createSymmetricGroup(4)!
const v4 = findAllSubgroups(s4).find(sg => sg.isNormal && sg.order === 4)!
const a4 = findAllSubgroups(s4).find(sg => sg.isNormal && sg.order === 12)!

describe('商群元素标签（gN 陪集记号）', () => {
  it('S₄/V₄ 的 6 个元素标签 = 代表元 + N，不再罗列成员', () => {
    const q = computeQuotientGroup(s4, v4)!
    expect(q.order).toBe(6)
    const labels = q.elements.map(e => e.label)
    // 每个标签都以 N 结尾，且不含逗号 / \dots（旧实现是 "e, (12)(34), …"）
    for (const l of labels) {
      expect(l.endsWith('N')).toBe(true)
      expect(l).not.toContain(',')
      expect(l).not.toContain('\\dots')
    }
    // 标签两两不同（TableView 的 label→下标映射依赖唯一性）
    expect(new Set(labels).size).toBe(labels.length)
    // 恒等陪集（= N 本身）的代表元是 e
    expect(q.identity.label).toBe('eN')
    // 派生的成员信息仍然完整保留（画布内嵌面板要用）
    expect(q.identity.cosetMemberLabels?.length).toBe(4)
  })

  it('S₄/A₄（商群 ≅ C₂）标签同样短', () => {
    const q = computeQuotientGroup(s4, a4)!
    expect(q.order).toBe(2)
    expect(q.elements.map(e => e.label).every(l => l.length <= 4 && l.endsWith('N'))).toBe(true)
  })
})

describe('商群环序（qcoset-N 数字序）', () => {
  it('≥10 个陪集时按数字排序，不受字典序影响', () => {
    const keys = ['qcoset-2', 'qcoset-10', 'qcoset-1', 'qcoset-11', 'qcoset-9']
    expect(ringOrder(keys)).toEqual(['qcoset-1', 'qcoset-2', 'qcoset-9', 'qcoset-10', 'qcoset-11'])
  })

  it('真实商群（S₄/A₄ 的环序）与 id 数字序一致', () => {
    const q = computeQuotientGroup(s4, a4)!
    expect(ringOrder(q.elements.map(e => e.id))).toEqual(q.elements.map(e => e.id))
  })
})

describe('商群可用形状', () => {
  it('二面体结构的商群（S₄/V₄ ≅ S₃ ≅ D₃）提供 dualRing', () => {
    const q = computeQuotientGroup(s4, v4)!
    expect(splitDihedralStructure(q)).not.toBeNull()
    expect(getAvailableShapesForView(q, 'cayley')).toEqual(['circular', 'dualRing', 'cone'])
  })

  it('循环商群（C₁₂/{e} ≅ C₁₂）给 spiral / coil', () => {
    const c12 = createGroupFromSymbol('C_{12}')!
    const trivial = findAllSubgroups(c12).find(sg => sg.order === 1)!
    const q = computeQuotientGroup(c12, trivial)!
    expect(q.order).toBe(12)
    expect(getAvailableShapesForView(q, 'cayley')).toEqual(['circular', 'spiral', 'coil', 'cone'])
  })

  it('平凡子群的商群（≅ G 本身）仍给 cone 兜底，且 3D 不再是空集', () => {
    const c12 = createGroupFromSymbol('C_{12}')!
    const trivial = findAllSubgroups(c12).find(sg => sg.order === 1)!
    const q = computeQuotientGroup(c12, trivial)!
    expect(getAvailableShapes3D(q)).toEqual(['cone', 'circular'])
  })
})

describe('商群圆形布局走同构群结构', () => {
  it('非二面体商群（S₄/A₄ ≅ C₂）保持单环，且生成元 BFS 幂序（不落字典序）', () => {
    const q = computeQuotientGroup(s4, a4)!
    expect(splitDihedralStructure(q)).toBeNull()
    // C₂：identity 在首位（幂序 / 字典序在这里一致，作为兜底口径的锚点）
    expect(ringOrder(q.elements.map(e => e.id))[0]).toBe(q.identity.id)
  })
})

describe('商群生成元按结构挑（第二轮反馈 2026-09-20）', () => {
  it('S₄/V₄ ≅ S₃ 的生成元阶 = [3, 2]（先旋转后反射），不再是父群生成元的陪集', () => {
    // 旧实现继承父群生成元：S₄ 的 (12)、(1234) 在商群里都是对合 ⇒ 凯莱图
    // 画成六边形，永远摆不出同构群 S₃ 的标准双三角。
    const q = computeQuotientGroup(s4, v4)!
    const orderOf = (el: GroupElement) => {
      let cur = q.identity
      let ord = 0
      do {
        cur = q.multiply(cur, el)
        ord++
      } while (cur.id !== q.identity.id && ord <= q.order)
      return ord
    }
    const orders = q.generators.map(g => orderOf(g.apply(q.identity)))
    expect(orders).toEqual([3, 2])
    // 生成元确实生成整个商群
    const closure = closeUnderMultiply(q, q.generators.map(g => g.apply(q.identity)))
    expect(closure.length).toBe(q.order)
    // 两类边颜色可区分（继承撞色时用调色板补位）
    expect(new Set(q.generators.map(g => g.color)).size).toBe(q.generators.length)
  })

  it('N 的内部凯莱边 = N 自己的最小生成元（不是随手挑的 2/3 阶元）', () => {
    const q = computeQuotientGroup(s4, v4)!
    const nmin = findMinimalGenerators(v4.elements, s4).map(e => e.id)
    const edges = q.identity.cosetInternalEdges ?? []
    // V₄ ≅ C₂×C₂：2 个最小生成元 ⇒ 每个给 2 条无向对 = 4 条边（旧实现 3 个候选给 6 条）
    expect(edges.length).toBe(4)
    expect(edges.every(e => { const a = e.actionElementId; return a !== undefined && nmin.includes(a) })).toBe(true)
  })
})

describe('app 层形状配置与 core 口径一致性（防平行短路回归）', () => {
  it('对任意群，getCayleyShapeConfig 的可选形状 = core 的两个函数逐值一致', () => {
    // 2026-09-20 修「商群形状可选太少」时发现：getCayleyShapeConfig 里有一份
    // 与 core 平行的商群短路（availableShapes2D: ['circular'] / 3D: []），
    // 把 core 的结果整个盖掉 —— 只改 core 根本看不到效果。
    // 这条锁按「app 层 = core」断言，任何一侧再长出平行分支都会立刻转红。
    const groups = [
      ...['C_{6}', 'D_{4}'].map(sym => {
        const g = createGroupFromSymbol(sym)
        expect(g, `${sym} 应可由记号构造`).not.toBeNull()
        return g!
      }),
      s4,
      computeQuotientGroup(s4, v4)!,
      computeQuotientGroup(s4, a4)!,
    ]
    for (const g of groups) {
      const cfg = getCayleyShapeConfig(g)
      expect(cfg.availableShapes2D).toEqual([...getAvailableShapesForView(g, 'cayley')])
      expect(cfg.availableShapes3D).toEqual([...getAvailableShapes3D(g)])
    }
  })

  it('商群 S₄/V₄ ≅ D₃：2D 三形状、3D 两形状', () => {
    const cfg = getCayleyShapeConfig(computeQuotientGroup(s4, v4)!)
    expect(cfg.availableShapes2D).toEqual(['circular', 'dualRing', 'cone'])
    expect(cfg.availableShapes3D).toEqual(['cone', 'circular'])
    expect(cfg.defaultShape2D).toBe('circular')
    expect(cfg.defaultShape3D).toBe('cone')
  })
})

describe('商群悬浮窗换算：preserveAspectRatio 等比缩放（2026-09-21 用户报「窗口好像限高」）', () => {
  // 夹具 = 真机实测（/?test=1 商群卡：svg 元素 1532×428，viewBox 860×520，
  // 浏览器 meet 缩放 0.8231）。旧实现用 vbW/rectW = 0.5614，窗体被算小到 46%。
  const rect = { left: 20, top: 100, width: 1532, height: 428 }
  const vb = { width: 860, height: 520 }
  const ctm = { a: 0.8231, d: 0.8231, e: 446.1, f: 334.9 }

  it('k 取 CTM 实际缩放的倒数（min(a,d)），不是 viewBox宽/元素宽', () => {
    const m = computeInsetMetrics(rect, vb, ctm)
    expect(m.k).toBeCloseTo(1 / 0.8231, 3)
    // 旧口径（错误）：只按宽度比 —— 显式锁住「不得回归」
    expect(m.k).not.toBeCloseTo(vb.width / rect.width, 2)
  })

  it('origin 补偿内容居中留白：元素左上角落在负的用户坐标', () => {
    const m = computeInsetMetrics(rect, vb, ctm)
    expect(m.originX).toBeCloseTo((rect.left - ctm.e) / ctm.a, 3)
    expect(m.originX).toBeLessThan(0)
    expect(m.originY).toBeCloseTo((rect.top - ctm.f) / ctm.d, 3)
  })

  it('无 CTM（未挂载 / SSR）退化：用 min(rectW/vbW, rectH/vbH)，不回退到宽度比', () => {
    const m = computeInsetMetrics(rect, vb, null)
    expect(m.k).toBeCloseTo(1 / Math.min(rect.width / vb.width, rect.height / vb.height), 6)
    expect(m.originX).toBe(0)
    expect(m.originY).toBe(0)
  })

  it('容器与 viewBox 同宽高比时与朴素宽度比一致（等价性锚点）', () => {
    const r = { left: 0, top: 0, width: 1000, height: 604.65 }  // 860:520 等比放大 ≈1000×604.65
    const m = computeInsetMetrics(r, vb, null)
    expect(m.k).toBeCloseTo(vb.width / r.width, 2)
  })

  it('窗体屏上尺寸回到设计值：360 设计 px × k × 浏览器缩放 ≈ 360 屏幕 px', () => {
    const m = computeInsetMetrics(rect, vb, ctm)
    expect(360 * m.k * ctm.a).toBeCloseTo(360, 0)
    expect(300 * m.k * ctm.a).toBeCloseTo(300, 0)
  })
})
