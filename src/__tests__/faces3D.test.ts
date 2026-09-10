import { describe, it, expect } from 'vitest'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createZ2xZ2xZ2 } from '../core/groups/SmallGroups'
import { compute3DPositions } from '../core/algebra/layout3D'
import { computeCayleyActionEdges } from '../core/algebra/forceLayout'
import { buildUndirectedEdgeKeys, listFaceSubgroups, subgroupFaces } from '../core/algebra/faces3D'
import type { CayleyAction } from '../core/types'
import type { Group } from '../core/types'
import { closeUnderMultiply } from '../core/algebra/subgroups/shared'

/** 默认作用集 = 生成元元素（与 normalizeCayleyActions 无参行为一致） */
const GEN_COLORS = ['#ff6b6b', '#4ecdc4', '#66aaff']
function defaultActions(group: Group): CayleyAction[] {
  return group.generators.map((g, i) => ({
    elementId: g.apply(group.identity).id,
    enabled: true,
    color: GEN_COLORS[i % GEN_COLORS.length],
  }))
}

function edgeKeysFor(group: Group, actions: CayleyAction[]) {
  const edges = computeCayleyActionEdges(group, actions, 'right')
  return buildUndirectedEdgeKeys(edges.map(e => [e.fromIdx, e.toIdx] as [number, number]))
}

describe('faces3D 子群陪集面检测', () => {
  it('A4 截角四面体布局：选 C3=⟨(234)⟩ → 恰好 4 个三角面（含 e 的陪集 = 子群本身）', () => {
    const group = createAlternatingGroup(4)
    const actions = defaultActions(group)
    const positions = compute3DPositions(group, 'truncatedTetrahedron')
    const edgeKeys = edgeKeysFor(group, actions)
    // 默认生成元 b=(234)（id 1,3,4,2）生成的 C3 子群
    const b = actions[1] // 第二个生成元
    const bEl = group.elements.find(e => e.id === b.elementId)!
    const H = closeUnderMultiply(group, [bEl])
    const faces = subgroupFaces(group, H.map(e => e.id).sort(), positions, edgeKeys)!
    expect(faces).toHaveLength(4)
    for (const f of faces) {
      expect(f.size).toBe(3)
      expect(f.hullElementIds).toHaveLength(3)
    }
    // 含单位元的陪集（= H 自身）必须是一个面：{e, (234), (243)}
    const e = group.identity.id
    const hKeys = faces.map(f => f.key)
    expect(hKeys).toContain([e, '1,3,4,2', '1,4,2,3'].sort().join(','))
  })

  it('A4：候选子群列表只暴露几何上有面的 H（截角三角 → 唯一可用项为那个 C3）', () => {
    const group = createAlternatingGroup(4)
    const actions = defaultActions(group)
    const positions = compute3DPositions(group, 'truncatedTetrahedron')
    const edgeKeys = edgeKeysFor(group, actions)
    const cands = listFaceSubgroups(group, positions, edgeKeys)!
    expect(cands).toHaveLength(1)
    expect(cands[0].order).toBe(3)
    expect(cands[0].faces).toHaveLength(4)
  })

  it('D5 棱柱双环布局：C5=⟨r⟩ 的 2 个陪集 → 顶/底两个五边形面', () => {
    const group = createDihedralGroup(5)
    const actions = defaultActions(group)
    const positions = compute3DPositions(group, 'dihedral')
    const edgeKeys = edgeKeysFor(group, actions)
    const cands = listFaceSubgroups(group, positions, edgeKeys)!
    const c5 = cands.find(c => c.order === 5)
    expect(c5).toBeDefined()
    expect(c5!.faces).toHaveLength(2)
    for (const f of c5!.faces) {
      expect(f.size).toBe(5)
      expect(f.hullElementIds).toHaveLength(5)
    }
    // 反射 C2 子群：|S|=2 → 不构成面，整体不在候选
    expect(cands.some(c => c.order === 2)).toBe(false)
  })

  it('C2³ 立方体布局：V4=⟨a,b⟩ 的两个陪集 = 相对的两个方形面', () => {
    const group = createZ2xZ2xZ2()
    const actions = defaultActions(group)
    const positions = compute3DPositions(group, 'cube')
    const edgeKeys = edgeKeysFor(group, actions)
    const cands = listFaceSubgroups(group, positions, edgeKeys)!
    expect(cands.length).toBeGreaterThanOrEqual(1)
    // 每个 V4（阶 4）子群在立方体中贡献 2 个方形面
    const v4s = cands.filter(c => c.order === 4)
    expect(v4s.length).toBeGreaterThanOrEqual(1)
    for (const v4 of v4s) {
      expect(v4.faces).toHaveLength(2)
      for (const f of v4.faces) {
        expect(f.size).toBe(4)
        expect(f.hullElementIds).toHaveLength(4)
      }
    }
  })
})
