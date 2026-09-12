import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createS3 } from '../core/groups/SymmetricGroup'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import { resolveCayleyPath } from '../core/algebra/cayleyPath'
import { relaxEdgeLengths, isIdentityScale } from '../core/algebra/edgeLengthRelax'
import { relaxEdgeLengths3D } from '../core/algebra/edgeLengthRelax3D'
import type { Vec3 } from '../core/algebra/layouts3D/shared'
import { createCayleyForceSim } from '../core/algebra/cayleyForce'
import type { CayleyAction, NodePosition } from '../core/types'

function makeAction(elementId: string, lengthScale?: number): CayleyAction {
  return { elementId, enabled: true, color: '#ff0000', lengthScale }
}

function circlePositions(count: number, cx = 200, cy = 200, r = 120): Map<string, NodePosition> {
  const m = new Map<string, NodePosition>()
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count - Math.PI / 2
    m.set(`e${i}`, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return m
}

function meanEdgeLength(positions: Map<string, NodePosition>, edges: { fromId: string; toId: string }[]): number {
  let sum = 0
  let n = 0
  for (const e of edges) {
    const a = positions.get(e.fromId)
    const b = positions.get(e.toId)
    if (!a || !b) continue
    sum += Math.hypot(b.x - a.x, b.y - a.y)
    n++
  }
  return n > 0 ? sum / n : 0
}

function ring3D(count: number, r = 5): Map<string, Vec3> {
  const m = new Map<string, Vec3>()
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count
    m.set(`e${i}`, [r * Math.cos(a), 0, r * Math.sin(a)])
  }
  return m
}

function meanEdgeLength3D(positions: Map<string, Vec3>, edges: { fromId: string; toId: string }[]): number {
  let sum = 0
  let n = 0
  for (const e of edges) {
    const a = positions.get(e.fromId)
    const b = positions.get(e.toId)
    if (!a || !b) continue
    sum += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    n++
  }
  return n > 0 ? sum / n : 0
}

describe('resolveCayleyPath', () => {
  it('returns null for null group or null input', () => {
    const C6 = createCyclicGroup(6)
    expect(resolveCayleyPath(null, [makeAction('e1')], 'right', { word: ['e1'] })).toBeNull()
    expect(resolveCayleyPath(C6, [makeAction('e1')], 'right', null)).toBeNull()
  })

  it('word mode walks from identity via successive right multiplications', () => {
    const C6 = createCyclicGroup(6)
    const p = resolveCayleyPath(C6, [makeAction('e1')], 'right', { word: ['e1', 'e1', 'e1'] })!
    expect(p.nodeIds).toEqual(['e0', 'e1', 'e2', 'e3'])
    expect(p.edges.length).toBe(3)
    expect(p.edges.every(e => e.actionElementId === 'e1')).toBe(true)
    expect(p.unresolved).toEqual([])
  })

  it('word mode honours a custom start', () => {
    const C6 = createCyclicGroup(6)
    const p = resolveCayleyPath(C6, [makeAction('e1')], 'right', { word: ['e1', 'e1'], start: 'e3' })!
    expect(p.nodeIds).toEqual(['e3', 'e4', 'e5'])
  })

  it('elements mode highlights vertices and matches connecting action', () => {
    const C6 = createCyclicGroup(6)
    const actions = [makeAction('e1'), makeAction('e2')]
    const p = resolveCayleyPath(C6, actions, 'right', { elements: ['e0', 'e2', 'e4'] })!
    expect(p.nodeIds).toEqual(['e0', 'e2', 'e4'])
    // e0 -> e2 由 e2 作用边承载；e2 -> e4 由 e2 承载
    expect(p.edges.map(e => e.actionElementId)).toEqual(['e2', 'e2'])
  })

  it('records unconnected adjacent pairs with an empty action id (nodes only)', () => {
    const C6 = createCyclicGroup(6)
    const p = resolveCayleyPath(C6, [makeAction('e1')], 'right', { elements: ['e0', 'e3'] })!
    expect(p.nodeIds).toEqual(['e0', 'e3'])
    expect(p.edges[0].actionElementId).toBe('')
  })

  it('respects edge direction: a reverse-only pair is not treated as connected', () => {
    const C4 = createCyclicGroup(4)
    // C₄ 中 e3 --e1--> e0 存在，但 e0 --e1--> e3 不存在
    const forwardImpossible = resolveCayleyPath(C4, [makeAction('e1')], 'right', { elements: ['e0', 'e3'] })!
    expect(forwardImpossible.edges[0].actionElementId).toBe('')
    const real = resolveCayleyPath(C4, [makeAction('e1')], 'right', { elements: ['e3', 'e0'] })!
    expect(real.edges[0].actionElementId).toBe('e1')
  })

  it('collects unresolved refs without throwing', () => {
    const C6 = createCyclicGroup(6)
    const p = resolveCayleyPath(C6, [makeAction('e1')], 'right', { elements: ['e0', 'nope'] })!
    expect(p.nodeIds).toEqual(['e0'])
    expect(p.unresolved).toEqual(['nope'])
  })

  it('closed word appends the start when the walk does not return on its own', () => {
    const S3 = createS3()
    const a = S3.generators[0].apply(S3.identity)!
    const p = resolveCayleyPath(S3, [makeAction(a.id)], 'right', { word: [a.id], closed: true })!
    expect(p.nodeIds[0]).toBe(p.nodeIds[p.nodeIds.length - 1])
  })

  it('left multiply differs from right for a non-abelian group', () => {
    const S3 = createS3()
    const a = S3.generators[0].apply(S3.identity)!
    const b = S3.generators[1].apply(S3.identity)!
    const right = resolveCayleyPath(S3, [makeAction(a.id), makeAction(b.id)], 'right', { word: [a.id, b.id] })!
    const left = resolveCayleyPath(S3, [makeAction(a.id), makeAction(b.id)], 'left', { word: [a.id, b.id] })!
    expect(right.nodeIds).not.toEqual(left.nodeIds)
  })
})

describe('relaxEdgeLengths', () => {
  it('isIdentityScale detects all-1 (and empty) maps', () => {
    expect(isIdentityScale(new Map())).toBe(true)
    expect(isIdentityScale(new Map([['a', 1], ['b', 1]]))).toBe(true)
    expect(isIdentityScale(new Map([['a', 1.2]]))).toBe(false)
  })

  it('returns the base layout unchanged when every scale is 1 (attach-safe)', () => {
    const C6 = createCyclicGroup(6)
    const base = circlePositions(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const out = relaxEdgeLengths(base, edges, { lengthScales: new Map([['e1', 1]]) })
    expect(out).toBe(base)
  })

  it('scaling a generator up lengthens its edges', () => {
    const C6 = createCyclicGroup(6)
    const base = circlePositions(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const before = meanEdgeLength(base, edges)
    const out = relaxEdgeLengths(base, edges, { lengthScales: new Map([['e1', 2]]) })
    const after = meanEdgeLength(out, edges)
    expect(after).toBeGreaterThan(before * 1.05)
  })

  it('scaling a generator down shortens its edges', () => {
    const C6 = createCyclicGroup(6)
    const base = circlePositions(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const before = meanEdgeLength(base, edges)
    const out = relaxEdgeLengths(base, edges, { lengthScales: new Map([['e1', 0.4]]) })
    const after = meanEdgeLength(out, edges)
    expect(after).toBeLessThan(before * 0.95)
  })

  it('does not mutate the base map', () => {
    const C6 = createCyclicGroup(6)
    const base = circlePositions(6)
    const snapshot = new Map([...base].map(([k, v]) => [k, { ...v }]))
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    relaxEdgeLengths(base, edges, { lengthScales: new Map([['e1', 1.8]]) })
    for (const [k, v] of snapshot) {
      expect(base.get(k)).toEqual(v)
    }
  })
})

describe('relaxEdgeLengths3D', () => {
  it('returns the base layout unchanged when every scale is 1 (attach-safe)', () => {
    const C6 = createCyclicGroup(6)
    const base = ring3D(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const out = relaxEdgeLengths3D(base, edges, { lengthScales: new Map([['e1', 1]]) })
    expect(out).toBe(base)
    expect(out).toBe(relaxEdgeLengths3D(base, edges, { lengthScales: new Map() }))
  })

  it('scaling a generator up lengthens its edges', () => {
    const C6 = createCyclicGroup(6)
    const base = ring3D(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const before = meanEdgeLength3D(base, edges)
    const out = relaxEdgeLengths3D(base, edges, { lengthScales: new Map([['e1', 2]]) })
    const after = meanEdgeLength3D(out, edges)
    expect(after).toBeGreaterThan(before * 1.05)
  })

  it('scaling a generator down shortens its edges', () => {
    const C6 = createCyclicGroup(6)
    const base = ring3D(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const before = meanEdgeLength3D(base, edges)
    const out = relaxEdgeLengths3D(base, edges, { lengthScales: new Map([['e1', 0.4]]) })
    const after = meanEdgeLength3D(out, edges)
    expect(after).toBeLessThan(before * 0.95)
  })

  it('measures edge length in 3D (z separation counts, not projected away)', () => {
    const C2 = createCyclicGroup(2)
    const base = new Map<string, Vec3>([['e0', [0, 0, 0]], ['e1', [0, 0, 5]]])
    const edges = computeCayleyActionEdges(C2, [makeAction('e1')], 'right')
    expect(meanEdgeLength3D(base, edges)).toBeCloseTo(5, 5)
    const out = relaxEdgeLengths3D(base, edges, { lengthScales: new Map([['e1', 1.6]]) })
    expect(meanEdgeLength3D(out, edges)).toBeGreaterThan(5 * 1.05)
  })

  it('keeps small-scale layouts bounded (repulsion self-scales to layout size)', () => {
    const C6 = createCyclicGroup(6)
    const base = ring3D(6, 1)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const out = relaxEdgeLengths3D(base, edges, { lengthScales: new Map([['e1', 2]]) })
    const after = meanEdgeLength3D(out, edges)
    // 基础边长 1：确实被拉长，但不会因固定斥力常数在小尺度上炸开
    expect(after).toBeGreaterThan(1.05)
    expect(after).toBeLessThan(4)
  })

  it('does not mutate the base map', () => {
    const C6 = createCyclicGroup(6)
    const base = ring3D(6)
    const snapshot = new Map([...base].map(([k, v]) => [k, [...v] as Vec3]))
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    relaxEdgeLengths3D(base, edges, { lengthScales: new Map([['e1', 1.8]]) })
    for (const [k, v] of snapshot) {
      expect(base.get(k)).toEqual(v)
    }
  })
})

describe('createCayleyForceSim', () => {
  it('converges (settles) within a bounded number of steps', () => {
    const C6 = createCyclicGroup(6)
    const sim = createCayleyForceSim(C6, [makeAction('e1')], 'right', { width: 400, height: 400 })
    let moving = true
    let steps = 0
    while (moving && steps < 3000) {
      moving = sim.step()
      steps++
    }
    expect(sim.settled).toBe(true)
    expect(steps).toBeLessThan(1000)
  })

  it('keeps every node inside the padded viewport', () => {
    const C8 = createCyclicGroup(8)
    const sim = createCayleyForceSim(C8, [makeAction('e1')], 'right', { width: 400, height: 300 })
    for (let i = 0; i < 400; i++) sim.step()
    const pad = Math.min(400, 300) * 0.06
    for (const p of sim.positions.values()) {
      expect(p.x).toBeGreaterThanOrEqual(pad - 1e-6)
      expect(p.x).toBeLessThanOrEqual(400 - pad + 1e-6)
      expect(p.y).toBeGreaterThanOrEqual(pad - 1e-6)
      expect(p.y).toBeLessThanOrEqual(300 - pad + 1e-6)
    }
  })

  it('linkScale enlarges the equilibrium edge lengths', () => {
    const C6 = createCyclicGroup(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const small = createCayleyForceSim(C6, [makeAction('e1')], 'right', { width: 500, height: 500, linkScale: 0.5 })
    const large = createCayleyForceSim(C6, [makeAction('e1')], 'right', { width: 500, height: 500, linkScale: 2 })
    // 默认 alpha=0 启动 → 用 settle() 一次性投影到力平衡态再测边长
    small.settle()
    large.settle()
    expect(meanEdgeLength(large.positions, edges)).toBeGreaterThan(meanEdgeLength(small.positions, edges))
  })

  it('per-generator lengthScale changes that generator equilibrium length', () => {
    const C6 = createCyclicGroup(6)
    const edgesShort = computeCayleyActionEdges(C6, [makeAction('e1', 0.5)], 'right')
    const strict = createCayleyForceSim(C6, [makeAction('e1', 0.5)], 'right', { width: 500, height: 500 })
    const loose = createCayleyForceSim(C6, [makeAction('e1', 2)], 'right', { width: 500, height: 500 })
    strict.settle()
    loose.settle()
    expect(meanEdgeLength(loose.positions, edgesShort)).toBeGreaterThan(meanEdgeLength(strict.positions, edgesShort))
  })

  it('a pinned node keeps its coordinate across steps', () => {
    const C6 = createCyclicGroup(6)
    const sim = createCayleyForceSim(C6, [makeAction('e1')], 'right', { width: 400, height: 400 })
    sim.pin('e0', 123, 77)
    expect(sim.isPinned('e0')).toBe(true)
    for (let i = 0; i < 50; i++) sim.step()
    expect(sim.positions.get('e0')).toEqual({ x: 123, y: 77 })
    sim.unpin('e0')
    expect(sim.isPinned('e0')).toBe(false)
    for (let i = 0; i < 200; i++) sim.step()
    expect(sim.positions.get('e0')).not.toEqual({ x: 123, y: 77 })
  })

  it('setOptions updates force knobs in place (positions preserved, no rebuild)', () => {
    const C6 = createCyclicGroup(6)
    const sim = createCayleyForceSim(C6, [makeAction('e1')], 'right', {
      width: 400, height: 400, initialPositions: circlePositions(6),
    })
    for (let i = 0; i < 600; i++) sim.step()
    const settled = new Map([...sim.positions].map(([id, p]) => [id, { ...p }]))
    sim.setOptions({ linkScale: 2, repulsion: 1.5, stiffness: 1.4 })
    let maxJump = 0
    for (const [id, p] of sim.positions) {
      const q = settled.get(id)!
      maxJump = Math.max(maxJump, Math.hypot(p.x - q.x, p.y - q.y))
    }
    // 位置保留（同帧无跳变）；只轻微升温让循环继续平滑过渡
    expect(maxJump).toBeLessThan(1)
    expect(sim.alpha).toBeGreaterThan(0.1)
    expect(sim.settled).toBe(false)
  })

  it('quick drag is local: neighbours follow elastically, far nodes barely move', () => {
    const C6 = createCyclicGroup(6)
    const sim = createCayleyForceSim(C6, [makeAction('e1')], 'right', {
      width: 400, height: 400, initialPositions: circlePositions(6),
    })
    for (let i = 0; i < 600; i++) sim.step()
    const settled = new Map([...sim.positions].map(([id, p]) => [id, { ...p }]))

    // 快拖（~30 帧 ≈ 0.5s）：把 e0 沿径向向外拖 80px
    const p0 = settled.get('e0')!
    const dxc = p0.x - 200
    const dyc = p0.y - 200
    const dl = Math.hypot(dxc, dyc)
    sim.pin('e0', 200 + (dxc / dl) * (dl + 80), 200 + (dyc / dl) * (dl + 80))
    for (let i = 0; i < 30; i++) sim.step()

    const move = (id: string) => {
      const q = settled.get(id)!
      const p = sim.positions.get(id)!
      return Math.hypot(p.x - q.x, p.y - q.y)
    }
    // 局部性沿弹簧链单调衰减：直接邻居 > 二跳 > 对面（力 × alpha 的正确传力次序）
    const m1 = Math.max(move('e1'), move('e5'))
    const m2 = Math.max(move('e2'), move('e4'))
    const m3 = move('e3')
    expect(m1).toBeGreaterThan(m2 * 0.5)
    expect(m2).toBeGreaterThan(m3 * 0.5)
    // 快拖的局部性：对面节点几乎不动
    expect(m3).toBeLessThan(20)
  })

  it('release after a quick drag: stays near the drop point, structure stays sane', () => {
    const C6 = createCyclicGroup(6)
    const edges = computeCayleyActionEdges(C6, [makeAction('e1')], 'right')
    const sim = createCayleyForceSim(C6, [makeAction('e1')], 'right', {
      width: 400, height: 400, initialPositions: circlePositions(6),
    })
    for (let i = 0; i < 600; i++) sim.step()
    const settled = new Map([...sim.positions].map(([id, p]) => [id, { ...p }]))
    const baseMean = meanEdgeLength(sim.positions, edges)

    // 快拖 12 帧（邻域弹性跟随但远端未动）→ 松手
    const p0 = settled.get('e0')!
    const dxc = p0.x - 200
    const dyc = p0.y - 200
    const dl = Math.hypot(dxc, dyc)
    const dropX = 200 + (dxc / dl) * (dl + 60)
    const dropY = 200 + (dyc / dl) * (dl + 60)
    sim.pin('e0', dropX, dropY)
    for (let i = 0; i < 12; i++) sim.step()
    sim.unpin('e0')
    for (let i = 0; i < 600; i++) sim.step()

    // Obsidian 语义（软体、无形状记忆）：拖到哪基本停哪（无剧烈回弹）
    const e0 = sim.positions.get('e0')!
    expect(Math.hypot(e0.x - dropX, e0.y - dropY)).toBeLessThan(30)

    // 但整体结构完好：平均边长仍在 rest 量级（不坍缩、不拉散）
    const afterMean = meanEdgeLength(sim.positions, edges)
    expect(afterMean).toBeGreaterThan(baseMean * 0.7)
    expect(afterMean).toBeLessThan(baseMean * 1.4)

    // 远端（对面 e3）不被牵走
    const q3 = settled.get('e3')!
    const p3 = sim.positions.get('e3')!
    expect(Math.hypot(p3.x - q3.x, p3.y - q3.y)).toBeLessThan(25)
  })

  it('long hold does not collapse or tangle the graph (sane equilibrium)', () => {
    const C12 = createCyclicGroup(12)
    const sim = createCayleyForceSim(C12, [makeAction('e1')], 'right', {
      width: 500, height: 500, initialPositions: circlePositions(12, 250, 250, 150),
    })
    for (let i = 0; i < 600; i++) sim.step()
    const baseMean = meanEdgeLength(sim.positions, computeCayleyActionEdges(C12, [makeAction('e1')], 'right'))

    // 病理场景：把 e0 拖到圆心并长按 5 秒（300 帧）——最坏的"牵动"输入
    sim.pin('e0', 250, 250)
    for (let i = 0; i < 300; i++) sim.step()

    // 弹簧不塌：平均边长仍在 rest 量级（重力归一后不会被压成发团）
    const heldMean = meanEdgeLength(sim.positions, computeCayleyActionEdges(C12, [makeAction('e1')], 'right'))
    expect(heldMean).toBeGreaterThan(baseMean * 0.55)

    // 无堆叠：任意两节点间距 ≥ minSep 的 0.8（"纠缠"观感的硬底线）
    const ids = [...sim.positions.keys()]
    let minDist = Infinity
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = sim.positions.get(ids[i])!
        const b = sim.positions.get(ids[j])!
        minDist = Math.min(minDist, Math.hypot(b.x - a.x, b.y - a.y))
      }
    }
    expect(minDist).toBeGreaterThan(30)

    // 松手后整图弹性恢复（形状记忆来自弹簧零张力均衡态）
    sim.unpin('e0')
    for (let i = 0; i < 600; i++) sim.step()
    const afterMean = meanEdgeLength(sim.positions, computeCayleyActionEdges(C12, [makeAction('e1')], 'right'))
    expect(afterMean).toBeGreaterThan(baseMean * 0.8)
    expect(afterMean).toBeLessThan(baseMean * 1.25)
  })

  it('activating from a static shape barely moves it (calibrated equilibrium)', () => {
    const C12 = createCyclicGroup(12)
    const sim = createCayleyForceSim(C12, [makeAction('e1')], 'right', {
      width: 500, height: 500, initialPositions: circlePositions(12, 250, 250, 150),
    })
    for (let i = 0; i < 600; i++) sim.step()
    // 激活 = 温和升温到近平衡态：每个节点位移 < 12% 半径（重力归一 + 零张力弹簧）
    let maxDisp = 0
    for (let i = 0; i < 12; i++) {
      const q = circlePositions(12, 250, 250, 150).get(`e${i}`)!
      const p = sim.positions.get(`e${i}`)!
      maxDisp = Math.max(maxDisp, Math.hypot(p.x - q.x, p.y - q.y))
    }
    expect(maxDisp).toBeLessThan(18)
  })

  it('separation constraint pushes a free node away from a pinned one (no stacking)', () => {
    const C6 = createCyclicGroup(6)
    // 正常环形初始布局（minSep 基于其平均边长）；把一个节点拖到另一个节点上，
    // 硬约束应把自由的那个推开（低热度下纯力场推不开 → 视觉"纠缠"）
    const sim = createCayleyForceSim(C6, [makeAction('e1')], 'right', {
      width: 400, height: 400, initialPositions: circlePositions(6),
    })
    for (let i = 0; i < 120; i++) sim.step()
    const target = sim.positions.get('e1')!
    sim.pin('e0', target.x, target.y)
    for (let i = 0; i < 240; i++) sim.step()
    const a = sim.positions.get('e0')!
    const b = sim.positions.get('e1')!
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(30)
  })

  it('pin mutates the shared position object in place (renderer must snapshot the drag start)', () => {
    const C6 = createCyclicGroup(6)
    const sim = createCayleyForceSim(C6, [makeAction('e1')], 'right', { width: 400, height: 400 })
    const ref = sim.positions.get('e0')!
    sim.pin('e0', 10, 20)
    // 同一对象被原地改写：拖拽处理器若直接持有它当起点，每次 mousemove 都会"基于上一次结果"
    // 叠加（位移被放大、节点越拖越跑）——CayleyView 因此必须快照 { x, y }
    expect(sim.positions.get('e0')).toBe(ref)
    expect(ref).toEqual({ x: 10, y: 20 })
  })

  it('reheat raises alpha so the loop resumes', () => {
    const C6 = createCyclicGroup(6)
    const sim = createCayleyForceSim(C6, [makeAction('e1')], 'right', { width: 400, height: 400 })
    for (let i = 0; i < 400; i++) sim.step()
    expect(sim.settled).toBe(true)
    sim.reheat()
    expect(sim.settled).toBe(false)
    expect(sim.step()).toBe(true)
  })

  it('plasticity: a dragged shape is remembered — the user can sculpt new shapes', () => {
    const C8 = createCyclicGroup(8)
    const sim = createCayleyForceSim(C8, [makeAction('e1')], 'right', {
      width: 500, height: 500, initialPositions: circlePositions(8, 250, 250, 150),
    })
    sim.settle()
    const settled = new Map([...sim.positions].map(([id, p]) => [id, { ...p }]))
    const p0 = settled.get('e0')!
    const r0 = Math.hypot(p0.x - 250, p0.y - 250)

    // 拖 e0 向外 80px 并保持 60 帧（塑性把新边长"记"进弹簧 rest），松手冷却
    const dxc = p0.x - 250
    const dyc = p0.y - 250
    const dl = Math.hypot(dxc, dyc)
    const dropX = 250 + (dxc / dl) * (dl + 80)
    const dropY = 250 + (dyc / dl) * (dl + 80)
    sim.pin('e0', dropX, dropY)
    for (let i = 0; i < 60; i++) sim.step()
    sim.unpin('e0')
    for (let i = 0; i < 300; i++) sim.step()

    // 塑性记忆：e0 停在拖放点附近（纯弹性会弹回环形布局）
    const e0 = sim.positions.get('e0')!
    expect(Math.hypot(e0.x - dropX, e0.y - dropY)).toBeLessThan(30)

    // 再 settle（在塑性后的 rest 上投影）也拉不回去 —— 新形状被记住
    sim.settle()
    const e0b = sim.positions.get('e0')!
    expect(Math.hypot(e0b.x - 250, e0b.y - 250)).toBeGreaterThan(r0 + 40)
  })

  it('settle is idempotent (no plasticity during settle: a static graph never drifts)', () => {
    const C8 = createCyclicGroup(8)
    const sim = createCayleyForceSim(C8, [makeAction('e1')], 'right', {
      width: 500, height: 500, initialPositions: circlePositions(8, 250, 250, 150),
    })
    sim.settle()
    const first = new Map([...sim.positions].map(([id, p]) => [id, { ...p }]))
    sim.settle()
    sim.settle()
    let maxDrift = 0
    for (const [id, p] of sim.positions) {
      const q = first.get(id)!
      maxDrift = Math.max(maxDrift, Math.hypot(p.x - q.x, p.y - q.y))
    }
    expect(maxDrift).toBeLessThan(2)
  })

  it('resetShape returns exactly to the given shape (Re-settle semantics)', () => {
    const C8 = createCyclicGroup(8)
    const init = circlePositions(8, 250, 250, 150)
    const sim = createCayleyForceSim(C8, [makeAction('e1')], 'right', {
      width: 500, height: 500, initialPositions: init,
    })
    sim.settle()
    // given = 初始静态布局（resetShape 恢复的基准是 initialPositions，
    // 而非 settle 投影后的位置 —— 两者相差 settle 的均匀化漂移 ~4px）
    const given = init
    const p0 = given.get('e0')!
    const dxc = p0.x - 250
    const dyc = p0.y - 250
    const dl = Math.hypot(dxc, dyc)
    sim.pin('e0', 250 + (dxc / dl) * (dl + 80), 250 + (dyc / dl) * (dl + 80))
    for (let i = 0; i < 60; i++) sim.step()
    sim.unpin('e0')
    for (let i = 0; i < 120; i++) sim.step()

    // Re-settle：硬重置（位置 + rest 恢复初始）→ 精确回到给定形状
    sim.resetShape()
    let maxDrift = 0
    for (const [id, p] of sim.positions) {
      const q = given.get(id)!
      maxDrift = Math.max(maxDrift, Math.hypot(p.x - q.x, p.y - q.y))
    }
    expect(maxDrift).toBeLessThan(1)
  })
})
