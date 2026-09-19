import { describe, it, expect } from 'vitest'
import { createGroupFromSymbol } from '../core/groups/groupFactory'
import { createAutomorphismGroup } from '../core/algebra/automorphisms'
import { cayleyCircleLayout } from '../core/algebra/forceLayout'
import { ringOrder } from '../core/algebra/ringOrder'

// 自同构群 2D 凯莱图的结构感知摆位（用户报「随机摆放」修复）。
// Aut 群符号是 \operatorname{Aut}(...)，不带 D/C 前缀，此前圆形布局落 id
// 字典序兜底（auto-10 < auto-2，边乱穿）。现在：二面体结构走「旋转外环 +
// 反射内环」（与 registry Dₙ 的 circular 逐角度一致），其余走生成元 BFS 幂序。
// 断言口径 = 生成元边沿环的步长集合（少值 = 规则形状；对照值 = 同构群基准实测）。

/** 位置 → 按角度排的环序（探针同款口径） */
function ringSeq(pos: Map<string, { x: number; y: number }>): string[] {
  return [...pos.entries()]
    .map(([id, p]) => ({ id, a: Math.atan2(p.y, p.x) }))
    .sort((u, v) => u.a - v.a)
    .map(o => o.id)
}

/** 每个生成元的边沿环步长集合（单一/双值 = 生成元边规则） */
function genStepSets(group: NonNullable<ReturnType<typeof createAutomorphismGroup>>, pos: Map<string, { x: number; y: number }>): number[][] {
  const seq = ringSeq(pos)
  const idx = new Map(seq.map((id, i) => [id, i]))
  const n = group.order
  return group.generators.map(g => {
    const genEl = g.apply(group.identity)
    const steps = new Set<number>()
    for (const el of group.elements) {
      const d = (idx.get(group.multiply(el, genEl).id)! - idx.get(el.id)! + n) % n
      steps.add(d)
    }
    return [...steps].sort((a, b) => a - b)
  })
}

describe('自同构群圆形凯莱图：走同构群的形状', () => {
  it('Aut(D₄) ≅ D₄：旋转外环 + 反射内环双环，生成元边步长与 registry D₄ 基准一致（[2,6]/[1,7]）', () => {
    const G = createGroupFromSymbol('D_{4}')!
    const A = createAutomorphismGroup(G)!
    expect(A.isoSymbol).toBe('D_{4}')
    const pos = cayleyCircleLayout(A, 0, 0, 100)
    // 双环：节点到中心距离只有两档（外环 R、内环 0.55R）
    const radii = [...new Set([...pos.values()].map(p => Math.round(Math.hypot(p.x, p.y))))].sort((a, b) => a - b)
    expect(radii).toEqual([55, 100])
    expect(genStepSets(A, pos)).toEqual([[2, 6], [1, 7]])
  })

  it('Aut(S₃) ≅ D₃：双环，生成元边步长与 registry D₃ 基准一致（[2,4]/[1,5]）', () => {
    const G = createGroupFromSymbol('S_{3}')!
    const A = createAutomorphismGroup(G)!
    const pos = cayleyCircleLayout(A, 0, 0, 100)
    const radii = [...new Set([...pos.values()].map(p => Math.round(Math.hypot(p.x, p.y))))].sort((a, b) => a - b)
    expect(radii).toEqual([55, 100])
    expect(genStepSets(A, pos)).toEqual([[2, 4], [1, 5]])
  })

  it('Aut(C₄×C₂) ≅ D₄：另一条 D₄ 同构路径同样双环（修前是 [1,3,5,7] 穿心对角线）', () => {
    const G = createGroupFromSymbol('C_{4}\\times C_{2}')!
    const A = createAutomorphismGroup(G)!
    expect(A.isoSymbol).toBe('D_{4}')
    const pos = cayleyCircleLayout(A, 0, 0, 100)
    expect(genStepSets(A, pos)).toEqual([[2, 6], [1, 7]])
  })

  it('Aut(C₈) ≅ V₄：m=2 不摆 2+2 双环，走幂序正方形（与 V₄ 基准等价）', () => {
    const G = createGroupFromSymbol('C_{8}')!
    const A = createAutomorphismGroup(G)!
    expect(A.order).toBe(4)
    const pos = cayleyCircleLayout(A, 0, 0, 100)
    // 单环：全部节点同一半径
    const radii = [...pos.values()].map(p => Math.round(Math.hypot(p.x, p.y)))
    expect(new Set(radii).size).toBe(1)
    expect(genStepSets(A, pos)).toEqual([[1, 3], [2]])
  })

  it('ringOrder 对 auto-N 按数字排序（修掉 auto-10 < auto-2 的字典序错乱）', () => {
    const keys = Array.from({ length: 12 }, (_, i) => `auto-${i}`)
    expect(ringOrder(keys)).toEqual(Array.from({ length: 12 }, (_, i) => `auto-${i}`))
  })
})
