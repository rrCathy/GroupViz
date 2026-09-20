import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { computeQuotientGroup, findAllSubgroups } from '../core/algebra/subgroups'

import { getDefaultShape2D, getDefaultLayout3D, getAvailableShapes3D } from '../core/types'
import { initializeNodePositions } from '../context/positionUtils'
import { quotientInsetGeometry } from '../core/viewBox'
import { getInitialCayleyActions } from '../context/cayleyActions'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'

describe('Quotient Group S4/V4 Full Flow', () => {
  it('should initialize node positions with default shape and compute edges', () => {
    const s4 = createSymmetricGroup(4)
    const subgroups = findAllSubgroups(s4!)
    const normal4 = subgroups.find(sg => sg.isNormal && sg.order === 4)
    expect(normal4).toBeDefined()

    const qg = computeQuotientGroup(s4!, normal4!)
    expect(qg).toBeDefined()

    const defaultShape = getDefaultShape2D(qg!)
    expect(defaultShape).toBe('circular')

    // 商群 3D 默认仍是 cone（顶部兜底），但不再「一个形状都没有」
    const default3D = getDefaultLayout3D(qg!)
    expect(default3D).toBe('cone')
    expect(getAvailableShapes3D(qg!)).toEqual(['cone', 'circular'])

    // Simulate setCurrentGroup initializing node positions with default shape
    const positions = initializeNodePositions(qg!, 'cayley', defaultShape)
    expect(positions.size).toBe(6)

    // S₄/V₄ ≅ S₃ ≅ D₃：circular 走**双环**（旋转外环 + 反射内环），与它同构的
    // D₃ 形状一致。旧实现是「6 点同一圆上」——符号 S₄/N 不带 D 前缀，
    // 二面体分支进不去，只能按 id 字典序排在单环上，生成元边乱穿。
    // 圆心：商群要给右侧「N 的凯莱图」面板让位，主体在左侧带内居中
    const geom = quotientInsetGeometry({ width: 2000, height: 2000 })
    const centerX = geom.drawWidth / 2
    const centerY = 2000 / 2
    const radiusOf = (id: string) => {
      const pos = positions.get(id)!
      return Math.hypot(pos.x - centerX, pos.y - centerY)
    }
    const byRadius = [...positions.keys()].sort((a, b) => radiusOf(b) - radiusOf(a))
    const outerIds = byRadius.slice(0, 3)
    const innerIds = byRadius.slice(3)
    const outerR = radiusOf(outerIds[0])
    const innerR = radiusOf(innerIds[0])
    // 3 + 3 两层，内环半径 = 外环 × 0.55（registry Dₙ 的 double ring 同一比例）
    expect(outerR - innerR).toBeGreaterThan(50)
    expect(innerR / outerR).toBeCloseTo(0.55, 2)
    for (const id of outerIds) expect(radiusOf(id)).toBeCloseTo(outerR, 1)
    for (const id of innerIds) expect(radiusOf(id)).toBeCloseTo(innerR, 1)

    // 环序：外环 = 含 e 的 3 阶循环子群（旋转），内环 = 3 个对合（反射）
    const orderOf = (id: string) => {
      const el = qg!.elements.find(e => e.id === id)!
      let cur = qg!.identity
      let ord = 0
      do {
        cur = qg!.multiply(cur, el)
        ord++
      } while (cur.id !== qg!.identity.id && ord <= qg!.order)
      return ord
    }
    expect(outerIds.filter(id => orderOf(id) === 3).length).toBe(2)
    expect(outerIds.filter(id => orderOf(id) === 1).length).toBe(1)
    innerIds.forEach(id => expect(orderOf(id)).toBe(2))

    // Verify edges exist with correct actions
    const actions = getInitialCayleyActions(qg!)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.every(a => qg!.elements.some(e => e.id === a.elementId))).toBe(true)

    const edges = computeCayleyActionEdges(qg!, actions, 'right')
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every(e => qg!.elements.some(el => el.id === e.fromId) && qg!.elements.some(el => el.id === e.toId))).toBe(true)
  })
})
