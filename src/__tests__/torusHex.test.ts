import { describe, it, expect } from 'vitest'
import { compute3DPositions, LAYOUT_3D_RADIUS } from '../core/algebra/layout3D'
import {
  torusHexGeometry, torusHexLayout3D, torusHexMinDelta,
  torusHexPlanarCoords, torusHexHexagons, TORUS_HEX_STAR_GENERATORS, TORUS_HEX_RING_AXIS,
} from '../core/algebra/layouts3D/torusHexLayout3D'
import { getSmallGroup } from '../core/groups/SmallGroups'
import { createGroupFromSymbol } from '../core/groups/groupFactory'
import { getAvailableShapes3D } from '../core/algebra/groupProps'
import { getSpecialCayleyActions, addAllCayleyActionsHelper } from '../context/cayleyActions'
import { computeCayleyActionEdges } from '../core/algebra/forceLayout'
import type { Group } from '../core/types'

/** 应用里选出来的 S₄ = 一行记法置换群（id 形如 '2,1,3,4'）；注册表里的 S₄ 是 g0..g23 表群 */
function s4(): Group {
  const group = createGroupFromSymbol('S_{4}')
  expect(group).toBeTruthy()
  expect(group!.symbol).toBe('S_{4}')
  expect(group!.elements[0].id).toBe('1,2,3,4')
  return group!
}

describe('torusHex — S₄ 星形对换凯莱图的环面全六边形镶嵌', () => {
  it('把 24 个元素放到环面曲面上（椭圆截面：((√(x²+y²)−R)/a)² + (z/b)² = 1）', () => {
    const group = s4()
    const geom = torusHexGeometry(group, LAYOUT_3D_RADIUS)
    expect(geom).toBeTruthy()
    const pos = compute3DPositions(group, 'torusHex')
    expect(pos).toHaveLength(24)
    for (const [x, y, z] of pos) {
      const radial = Math.hypot(x, y)
      const d = ((radial - geom!.bigR) / geom!.tubeRadial) ** 2 + (z / geom!.tubeAxial) ** 2
      expect(Math.abs(d - 1)).toBeLessThan(1e-6)
    }
    // 24 个点互不重合
    expect(new Set(pos.map(p => p.map(v => v.toFixed(6)).join(','))).size).toBe(24)
    // 管截面径向压扁（密度均匀化）：a < b 且内/外半径比 ≥ 0.4（正圆截面时只有 0.2）
    expect(geom!.tubeRadial).toBeLessThan(geom!.tubeAxial)
    const innerOuter = (geom!.bigR - geom!.tubeRadial) / (geom!.bigR + geom!.tubeRadial)
    expect(innerOuter).toBeGreaterThan(0.4)
  })

  it('平面坐标落位是 24 个互不相同的环面点（(α,β) 两两不同）', () => {
    const planar = torusHexPlanarCoords(s4())
    expect(planar).toBeTruthy()
    expect(planar!.size).toBe(24)
    const keys = new Set<string>()
    for (const p of planar!.values()) {
      // 同一环面点的两个代表元相差一个周期格向量
      let canonical = `${p[0]},${p[1]}`
      let best = Infinity
      for (const ref of planar!.values()) {
        const d = torusHexMinDelta(ref, p)
        const l = Math.hypot(d[0], d[1])
        if (l < best) { best = l; canonical = `${ref[0]},${ref[1]}` }
      }
      keys.add(canonical)
    }
    expect(keys.size).toBe(24)
  })

  it('12 个六边形面：每个 6 顶点、每顶点属 3 面、每边属 2 面、χ = 24 − 36 + 12 = 0', () => {
    const group = s4()
    const hexagons = torusHexHexagons(group)
    expect(hexagons).toBeTruthy()
    expect(hexagons!).toHaveLength(12)
    for (const hex of hexagons!) expect(hex).toHaveLength(6)
    const idx = new Map(group.elements.map((e, i) => [e.id, i]))
    const vertexCount = new Map<number, number>()
    const edgeCount = new Map<string, number>()
    for (const hex of hexagons!) {
      for (let t = 0; t < 6; t++) {
        const a = idx.get(hex[t])!
        const b = idx.get(hex[(t + 1) % 6])!
        vertexCount.set(a, (vertexCount.get(a) ?? 0) + 1)
        const key = a < b ? `${a}|${b}` : `${b}|${a}`
        edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1)
      }
    }
    expect(vertexCount.size).toBe(24)
    for (const n of vertexCount.values()) expect(n).toBe(3)
    // 36 条边，每条恰属 2 个面 ⇒ χ = 24 − 36 + 12 = 0
    expect(edgeCount.size).toBe(36)
    for (const n of edgeCount.values()) expect(n).toBe(2)
  })

  it('每个六边形的边严格交替两个星形对换（这正是"全六边形"的来源）', () => {
    const group = s4()
    const hexagons = torusHexHexagons(group)!
    const byId = new Map(group.elements.map(e => [e.id, e]))
    for (const hex of hexagons) {
      const gens: number[] = []
      for (let t = 0; t < 6; t++) {
        const from = byId.get(hex[t])!
        const toId = hex[(t + 1) % 6]
        const gi = TORUS_HEX_STAR_GENERATORS.findIndex(g => group.multiply(from, byId.get(g)!).id === toId)
        gens.push(gi)
      }
      expect(gens).not.toContain(-1)
      expect(new Set(gens).size).toBe(2)
      for (let t = 0; t < 6; t++) expect(gens[t]).toBe(gens[t % 2])
    }
  })

  it('形状的规范作用边 = 三个星形对换，且这些边正好落成镶嵌的 36 条边', () => {
    const group = s4()
    // app 层口径（getSpecialCayleyActions / addAllCayleyActionsHelper）必须与 core 常数一致
    const special = getSpecialCayleyActions(group, 'torusHex')
    expect(special?.map(a => a.elementId)).toEqual([...TORUS_HEX_STAR_GENERATORS])
    const all = addAllCayleyActionsHelper(group, '3d', 'torusHex', [])
    const enabled = all.filter(a => a.enabled).map(a => a.elementId).sort()
    expect(enabled).toEqual([...TORUS_HEX_STAR_GENERATORS].sort())

    const planar = torusHexPlanarCoords(group)!
    const edges = computeCayleyActionEdges(group, special!, 'right', Number.POSITIVE_INFINITY)
    expect(edges).toHaveLength(36) // 24 × 3 / 2（三个生成元都是对合）
    for (const e of edges) {
      const d = torusHexMinDelta(planar.get(e.fromId)!, planar.get(e.toId)!)
      expect(Math.abs(Math.hypot(d[0], d[1]) - 1)).toBeLessThan(1e-4)
    }
  })

  it('左乘边集 = 右乘边集在元素取逆下的像（形状按默认右乘对齐；左乘是同构但另一套边）', () => {
    const group = s4()
    const special = getSpecialCayleyActions(group, 'torusHex')!
    const right = computeCayleyActionEdges(group, special, 'right', Number.POSITIVE_INFINITY)
    const left = computeCayleyActionEdges(group, special, 'left', Number.POSITIVE_INFINITY)
    expect(new Set(right.map(e => [e.fromId, e.toId].sort().join('~'))).size).toBe(36)
    // 三个生成元都是对合 ⇒ s⁻¹ = s；左乘图 = 右乘图逐点取逆
    const invOfR = new Set(right.map(e => {
      const a = group.inverse(group.elements.find(x => x.id === e.fromId)!).id
      const b = group.inverse(group.elements.find(x => x.id === e.toId)!).id
      return [a, b].sort().join('~')
    }))
    expect(new Set(left.map(e => [e.fromId, e.toId].sort().join('~')))).toEqual(invOfR)
  })

  it('S4 的可用 3D 形状包含 torusHex（且不改默认形状）', () => {
    const group = s4()
    expect(getAvailableShapes3D(group)).toContain('torusHex')
    expect(compute3DPositions(group, 'torusHex')).toHaveLength(24)
  })

  it('非 S₄ 结构（阶不是 24 / id 不是一行置换）回退为球面且不抛错', () => {
    const c6 = getSmallGroup(6, 1)!.group
    expect(torusHexLayout3D(c6, 5)).toBeNull()
    const pos = compute3DPositions(c6, 'torusHex')
    expect(pos).toHaveLength(6)
    for (const p of pos) expect(Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[2])).toBe(true)

    // 注册表的 S₄（表群，id 为 g0..g23，无置换信息）——与截角立方体等既有形状同口径：
    // 落不到具名坐标，回退球面（不是错误）
    const table = getSmallGroup(24, 11)
    expect(table?.group.symbol).toBe('S_{4}')
    expect(torusHexPlanarCoords(table!.group)).toBeNull()
    expect(compute3DPositions(table!.group, 'torusHex')).toHaveLength(24)
  })

  it('周期格最短位移：单位步长集合恰为六边形的 6 个方向', () => {
    const planar = torusHexPlanarCoords(s4())!
    const dirs = new Set<number>()
    for (const p of planar.values()) {
      for (const q of planar.values()) {
        const d = torusHexMinDelta(p, q)
        const len = Math.hypot(d[0], d[1])
        if (Math.abs(len - 1) < 1e-6) dirs.add(Math.round((Math.atan2(d[1], d[0]) * 180) / Math.PI))
      }
    }
    expect([...dirs].sort((a, b) => a - b)).toEqual([-150, -90, -30, 30, 90, 150])
  })
})

/**
 * 环面 = S¹×S¹：两个因子各有一种旋转（大圆/纬向、管子/经向）。
 * 「管子」相位进布局（`tubePhase`，弧度）；「大圆」不进布局 —— 它在三维里等价于整块内容
 * 绕 `TORUS_HEX_RING_AXIS` 刚体旋转，由场景转一个 group 完成，这里钉住这条等价性。
 */
describe('torusHex — 环面自转的两个因子', () => {
  it('管子相位缺省 0 = 与不带相位逐位相同（attach-safe）', () => {
    const group = s4()
    const plain = compute3DPositions(group, 'torusHex')
    const zero = compute3DPositions(group, 'torusHex', { tubePhase: 0 })
    for (let i = 0; i < plain.length; i++) expect(zero[i]).toEqual(plain[i])

    const layoutPlain = torusHexLayout3D(group, LAYOUT_3D_RADIUS)
    const layoutZero = torusHexLayout3D(group, LAYOUT_3D_RADIUS, 0)
    for (let i = 0; i < layoutPlain!.length; i++) expect(layoutZero![i]).toEqual(layoutPlain![i])
    // 相位为 0 时周期 2π 也逐位相同
    const full = torusHexLayout3D(group, LAYOUT_3D_RADIUS, 2 * Math.PI)!
    for (let i = 0; i < full.length; i++) {
      const d = Math.hypot(full[i][0] - layoutPlain![i][0], full[i][1] - layoutPlain![i][1], full[i][2] - layoutPlain![i][2])
      expect(d).toBeLessThan(1e-9)
    }
  })

  it('管子相位：图沿每根管的截面绕行 —— 位置真的变了、24 点仍在环面上、互不重合', () => {
    const group = s4()
    const geom = torusHexGeometry(group, LAYOUT_3D_RADIUS)!
    const base = compute3DPositions(group, 'torusHex')
    let movedAtSomePhase = 0
    for (const phase of [0.3, Math.PI / 2, Math.PI, 4.2, 2 * Math.PI - 0.3]) {
      const pos = compute3DPositions(group, 'torusHex', { tubePhase: phase })
      expect(pos).toHaveLength(24)
      for (const [x, y, z] of pos) {
        // 仍在同一条环面上（椭圆截面隐式方程）
        const radial = Math.hypot(x, y)
        const d = ((radial - geom.bigR) / geom.tubeRadial) ** 2 + (z / geom.tubeAxial) ** 2
        expect(Math.abs(d - 1)).toBeLessThan(1e-6)
      }
      expect(new Set(pos.map(p => p.map(v => v.toFixed(6)).join(','))).size).toBe(24)
      const maxMove = Math.max(...base.map((p, i) =>
        Math.hypot(p[0] - pos[i][0], p[1] - pos[i][1], p[2] - pos[i][2])))
      if (maxMove > 0.5) movedAtSomePhase++
    }
    // 每一步都真的动了（相位 2π−0.3 也动，只是接近复原）
    expect(movedAtSomePhase).toBe(5)
  })

  it('大圆/纬向自转 = 参数 α 平移 = 绕 TORUS_HEX_RING_AXIS 刚体旋转（场景转 group 的依据）', () => {
    const geom = torusHexGeometry(s4(), LAYOUT_3D_RADIUS)!
    expect([...TORUS_HEX_RING_AXIS]).toEqual([0, 0, 1])
    const A = 0.7
    const [ax, ay] = TORUS_HEX_RING_AXIS
    expect(Math.hypot(ax, ay)).toBeLessThan(1e-12) // 轴 = z ⇒ 旋转只动 (x,y)、z 不变
    for (const alpha of [0, 0.13, 0.5, 0.87]) {
      for (const beta of [0, 0.25, 0.6]) {
        const p = geom.surfacePointAB(alpha, beta)
        const q = geom.surfacePointAB(alpha + A / (2 * Math.PI), beta)
        expect(q[0]).toBeCloseTo(p[0] * Math.cos(A) - p[1] * Math.sin(A), 9)
        expect(q[1]).toBeCloseTo(p[0] * Math.sin(A) + p[1] * Math.cos(A), 9)
        expect(q[2]).toBeCloseTo(p[2], 9)
      }
    }
  })

  it('两个因子可同时作用：布局给的管子相位 + 场景的绕轴刚体旋转 A = 参数 (α+A/2π, β+B/2π)', () => {
    const group = s4()
    const geom = torusHexGeometry(group, LAYOUT_3D_RADIUS)!
    const A = 0.9
    const B = 1.3
    const pos = compute3DPositions(group, 'torusHex', { tubePhase: B })
    group.elements.forEach((el, i) => {
      const [x, y] = geom.planar.get(el.id)!
      // 场景对大圆因子做的事：整块内容绕 z 轴刚体旋转 A
      const p = pos[i]
      const rotated: [number, number, number] = [
        p[0] * Math.cos(A) - p[1] * Math.sin(A),
        p[0] * Math.sin(A) + p[1] * Math.cos(A),
        p[2],
      ]
      // 独立对照（测试自带一份 (α,β) 反解）：同一节点两个参数各自平移后的曲面点
      const [alpha, beta] = alphaBetaOf(x, y)
      const exp = geom.surfacePointAB(alpha + A / (2 * Math.PI), beta + B / (2 * Math.PI))
      expect(rotated[0]).toBeCloseTo(exp[0], 6)
      expect(rotated[1]).toBeCloseTo(exp[1], 6)
      expect(rotated[2]).toBeCloseTo(exp[2], 6)
    })
  })
})

/**
 * 测试用 (α,β) 反解（独立重写一遍同一条线性映射当 oracle；core 内部的 toAlphaBeta 不导出）。
 * 周期格 b₁ = (3√3, 3)、b₂ = (0, 6)（见 core/torusHexLayout3D 头部：S₄ 的必然斜粘合）。
 */
function alphaBetaOf(x: number, y: number): [number, number] {
  const det = 3 * Math.sqrt(3) * 6
  const mod1 = (v: number) => ((v % 1) + 1) % 1
  return [mod1((x * 6 - y * 0) / det), mod1((3 * Math.sqrt(3) * y - 3 * x) / det)]
}
