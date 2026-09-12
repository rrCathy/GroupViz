import { describe, it, expect } from 'vitest'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { wordLengthSphereLayout3D } from '../core/algebra/layouts3D/wordLengthSphereLayout3D'
import { computeCayleyActionEdges } from '../core/algebra/cayleyEdges'
import { COLOR_PALETTE } from '../core/types'

/**
 * 字长球布局的几何回归：
 *  - S₄ 是平面图：3D 空间零边交叉（截角八面体嵌入保留）；
 *  - S₅ 是 4 维 permutohedron 骨架（非平面）：允许极少量交叉，但长边
 *    （穿过球心的弦）必须少，节点间距必须不塌。
 */

function segsCross(a: number[], b: number[], c: number[], d: number[]): boolean {
  const sub = (u: number[], v: number[]) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]]
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const u = sub(b, a)
  const v = sub(d, c)
  const w = sub(a, c)
  const uu = dot(u, u), uv = dot(u, v), vv = dot(v, v), uw = dot(u, w), vw = dot(v, w)
  const denom = uu * vv - uv * uv
  if (Math.abs(denom) < 1e-12) return false
  const t = (uv * vw - vv * uw) / denom
  const s = (uu * vw - uv * uw) / denom
  const EPS = 1e-3
  if (t < EPS || t > 1 - EPS || s < EPS || s > 1 - EPS) return false
  const p = [a[0] + t * u[0], a[1] + t * u[1], a[2] + t * u[2]]
  const q = [c[0] + s * v[0], c[1] + s * v[1], c[2] + s * v[2]]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-3
}

function countCrossings(pos: number[][], edges: { fromIdx: number; toIdx: number }[]): number {
  let n = 0
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e1 = edges[i], e2 = edges[j]
      if (e1.fromIdx === e2.fromIdx || e1.fromIdx === e2.toIdx || e1.toIdx === e2.fromIdx || e1.toIdx === e2.toIdx) continue
      if (segsCross(pos[e1.fromIdx], pos[e1.toIdx], pos[e2.fromIdx], pos[e2.toIdx])) n++
    }
  }
  return n
}

/** 默认视角（theta=0, phi=acos(3/√153)）的屏幕投影（正交近似） */
function project2D(pos: number[][]): number[][] {
  const phi = Math.acos(3 / Math.sqrt(153))
  const theta = 0
  const cam = [Math.sin(phi) * Math.sin(theta), Math.cos(phi), Math.sin(phi) * Math.cos(theta)]
  const fwd = [-cam[0], -cam[1], -cam[2]]
  const right = [fwd[1] * 0 - fwd[2] * 1, fwd[2] * 0 - fwd[0] * 0, fwd[0] * 1 - fwd[1] * 0]
  const rl = Math.hypot(right[0], right[1], right[2]) || 1
  const rn = right.map(x => x / rl)
  const up = [rn[1] * fwd[2] - rn[2] * fwd[1], rn[2] * fwd[0] - rn[0] * fwd[2], rn[0] * fwd[1] - rn[1] * fwd[0]]
  return pos.map(p => [p[0] * rn[0] + p[1] * rn[1] + p[2] * rn[2], p[0] * up[0] + p[1] * up[1] + p[2] * up[2], 0])
}

const S4 = createSymmetricGroup(4)
const S5 = createSymmetricGroup(5)

describe('wordLengthSphere 几何回归', () => {
  it('S₄：3D 空间零边交叉（平面凯莱图嵌入）', () => {
    const pos = wordLengthSphereLayout3D(S4, 5)!
    const actions = ['2,1,3,4', '1,3,2,4', '1,2,4,3'].map((id, i) => ({ elementId: id, enabled: true, color: COLOR_PALETTE[i] }))
    const edges = computeCayleyActionEdges(S4, actions, 'right')
    expect(edges).toHaveLength(36)
    expect(countCrossings(pos, edges)).toBe(0)
  })

  it('S₄：默认视角投影交叉极少（骨架平面性保留）', () => {
    const pos = wordLengthSphereLayout3D(S4, 5)!
    const actions = ['2,1,3,4', '1,3,2,4', '1,2,4,3'].map((id, i) => ({ elementId: id, enabled: true, color: COLOR_PALETTE[i] }))
    const edges = computeCayleyActionEdges(S4, actions, 'right')
    expect(countCrossings(project2D(pos), edges)).toBeLessThanOrEqual(16)
  })

  it('S₅：实心球布局的几何量级回归（边全跨层、无穿球长边、交叉有界）', () => {
    const pos = wordLengthSphereLayout3D(S5, 5)!
    const actions = ['2,1,3,4,5', '1,3,2,4,5', '1,2,4,3,5', '1,2,3,5,4'].map((id, i) => ({ elementId: id, enabled: true, color: COLOR_PALETTE[i] }))
    const edges = computeCayleyActionEdges(S5, actions, 'right', Number.POSITIVE_INFINITY)
    expect(edges).toHaveLength(240)
    const R = Math.max(...pos.map(p => Math.hypot(p[0], p[1], p[2])))
    expect(R).toBeCloseTo(5 * 3, 9) // 外接半径 = R（盘缘贴球面）

    // 3D 交叉（非平面图，量级护栏）
    expect(countCrossings(pos, edges)).toBeLessThanOrEqual(60)

    // 无穿球长边：全部边长度 ≤ 1.05R（球面版曾有 12 条 > R、最长 1.6R）
    const maxLen = Math.max(...edges.map(e =>
      Math.hypot(pos[e.fromIdx][0] - pos[e.toIdx][0], pos[e.fromIdx][1] - pos[e.toIdx][1], pos[e.fromIdx][2] - pos[e.toIdx][2]),
    ))
    expect(maxLen).toBeLessThan(1.05 * R)
  })
})
