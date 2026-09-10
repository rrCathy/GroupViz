/**
 * 「元素 → 旋转」映射的法则型性质测试。
 *
 * 与 `elementRotation.test.ts` 的分工：
 *   - `elementRotation.test.ts`  —— 回归锁：钉住具体期望值（哪些轴、多少度）
 *   - 本文件                     —— 结构法则：不依赖任何已知答案表，只要求映射
 *                                  满足群作用本身（同态 / 逆元 / 阶 / 单射 …）
 *
 * 后者才是 2026-09-10 rotation-axis bug 的通用防线：那个实现「不崩溃、角度对、
 * 阶也对」，只有「同态」和「单射」这两条结构法则能判它错。
 */

import { describe, it, expect } from 'vitest'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour } from '../core/groups/SpecialGroup'
import { createGroupFromSymbol } from '../core/groups/groupFactory'
import {
  axisKeyOf,
  axisStatsByCycleType,
  checkRotationLaws,
  cycleTypeOf,
  distinctRotationCount,
  formatViolations,
  rotationOf,
  rotationsOf,
} from './helpers/rotationLaws'
import type { RotationFn } from './helpers/rotationLaws'
import type { Group } from '../core/types'

const CYCLIC_ORDERS = [2, 3, 4, 5, 6, 7, 8, 12]
const DIHEDRAL_ORDERS = [3, 4, 5, 6, 8]

/** 对称性视图实际会渲染的群（`getSymmetryType` 给出非 unsupported 的结果）。 */
const ZOO: Group[] = [
  ...CYCLIC_ORDERS.map(createCyclicGroup),
  ...DIHEDRAL_ORDERS.map(createDihedralGroup),
  createSymmetricGroup(3),
  createKleinFour(),
  createAlternatingGroup(4),
  createSymmetricGroup(4),
  createAlternatingGroup(5),
]

function expectLaws(group: Group, rotationFn?: RotationFn) {
  const violations = checkRotationLaws(group, rotationFn ? { rotationFn } : {})
  expect(violations, `\n${formatViolations(group, violations)}`).toEqual([])
}

describe('元素 → 旋转映射：法则型性质测试', () => {
  describe('全群 11 条法则（单位轴 / 轴不动 / 固有旋转 / 迹-角一致 / 同态 / 逆元 / 阶 / 单射）', () => {
    for (const group of ZOO) {
      it(`${group.symbol}（|G| = ${group.order}）`, () => expectLaws(group))
    }
  })

  describe('数学常数 oracle（独立于映射的结构常量）', () => {
    it('Cₙ：所有非单位元共用 1 根轴，像的势恰为 n（单射）', () => {
      for (const n of CYCLIC_ORDERS) {
        const group = createCyclicGroup(n)
        const axes = new Set(
          rotationsOf(group)
            .filter(r => Math.abs(r.angleRad) > 1e-9)
            .map(r => axisKeyOf(r.axis)),
        )
        expect(axes.size, `C_${n} 非单位元的轴数`).toBe(1)
        expect(distinctRotationCount(group), `C_${n} 的像的势`).toBe(n)
      }
    })

    it('Dₙ：n 个旋转共用 Y 轴，n 个反射各占一根 XZ 平面内的轴（均为 180°）', () => {
      for (const n of DIHEDRAL_ORDERS) {
        const group = createDihedralGroup(n)
        const refAxes = new Set<string>()
        let rotations = 0
        let reflections = 0
        for (const el of group.elements) {
          const sampled = rotationOf(group, el)
          expect(sampled).not.toBeNull()
          if (el.value[1] === 0) {
            rotations++
          } else {
            reflections++
            expect(Math.abs(sampled!.angleRad), `D_${n} 反射 ${el.label}`).toBeCloseTo(Math.PI, 9)
            refAxes.add(axisKeyOf(sampled!.axis))
          }
        }
        expect(rotations, `D_${n} 旋转元素数`).toBe(n)
        expect(reflections, `D_${n} 反射元素数`).toBe(n)
        expect(refAxes.size, `D_${n} 反射轴数`).toBe(n)
      }
    })

    it('S₃ ≅ D₃：2 个三循环同轴反向 120°，3 个对换各占一轴 180°', () => {
      const group = createSymmetricGroup(3)
      const byCycleType = axisStatsByCycleType(group)
      expect(byCycleType.get('3')!.count).toBe(2)
      expect(byCycleType.get('3')!.axes.size).toBe(1)
      expect(byCycleType.get('2')!.count).toBe(3)
      expect(byCycleType.get('2')!.axes.size).toBe(3)
      const threeCycles = rotationsOf(group).filter(r => cycleTypeOf(r.el.value) === '3')
      expect(Math.sign(threeCycles[0].angleRad)).toBe(-Math.sign(threeCycles[1].angleRad))
      expect(Math.abs(threeCycles[0].angleRad)).toBeCloseTo((2 * Math.PI) / 3, 9)
    })

    it('V₄：三个非单位元 ↦ 三根互相垂直的 180° 轴（矩形的对称群）', () => {
      const group = createKleinFour()
      const nonIdentity = rotationsOf(group).filter(r => Math.abs(r.angleRad) > 1e-9)
      expect(nonIdentity).toHaveLength(3)
      for (const r of nonIdentity) {
        expect(r.angleRad).toBeCloseTo(Math.PI, 9)
      }
      const axes = nonIdentity.map(r => r.axis)
      for (let i = 0; i < axes.length; i++) {
        for (let j = i + 1; j < axes.length; j++) {
          const dot = axes[i][0] * axes[j][0] + axes[i][1] * axes[j][1] + axes[i][2] * axes[j][2]
          expect(Math.abs(dot), `V₄ 第 ${i} / ${j} 根轴不正交`).toBeCloseTo(0, 6)
        }
      }
      expect(new Set(nonIdentity.map(r => axisKeyOf(r.axis))).size).toBe(3)
    })

    it('A₄ / S₄ / A₅：每循环型的轴数等于几何轴数常数', () => {
      const a4 = axisStatsByCycleType(createAlternatingGroup(4))
      expect(a4.get('3')!.axes.size).toBe(4)
      expect(a4.get('2-2')!.axes.size).toBe(3)

      const s4 = axisStatsByCycleType(createSymmetricGroup(4))
      expect(s4.get('4')!.axes.size).toBe(3)
      expect(s4.get('3')!.axes.size).toBe(4)
      expect(s4.get('2-2')!.axes.size).toBe(3)
      expect(s4.get('2')!.axes.size).toBe(6)

      const a5 = axisStatsByCycleType(createAlternatingGroup(5))
      expect(a5.get('5')!.axes.size).toBe(6)
      expect(a5.get('3')!.axes.size).toBe(10)
      expect(a5.get('2-2')!.axes.size).toBe(15)
    })

    it('Dₙ：反射轴必须落在所画正 n 边形的镜线上（顶点位于 −90°，镜线 = −π/2 + kπ/n）', () => {
      // 几何约定来源：SymmetryViewScene.getDihedralFigure —— 顶点角 = 2πi/n − π/2。
      // n 为偶数时「镜线集合」与 kπ/n 恰好重合，所以这个缺陷只在奇数 n 下可见。
      for (const n of DIHEDRAL_ORDERS) {
        const group = createDihedralGroup(n)
        const actual = new Set(
          rotationsOf(group)
            .filter(r => r.el.value[1] === 1)
            .map(r => axisKeyOf(r.axis)),
        )
        const expected = new Set(
          Array.from({ length: n }, (_, k) => {
            const angle = -Math.PI / 2 + (k * Math.PI) / n
            return axisKeyOf([Math.cos(angle), 0, Math.sin(angle)])
          }),
        )
        expect(actual, `D_${n} 反射轴集合`).toEqual(expected)
      }
    })

    it('A₅：轴数与正二十面体的旋转轴计数一致（6 五阶 + 10 三阶 + 15 二阶）', () => {
      const a5 = axisStatsByCycleType(createAlternatingGroup(5))
      const all = new Set<string>()
      for (const { axes } of a5.values()) for (const key of axes) all.add(key)
      expect(all.size).toBe(31)
    })
  })

  describe('对称性视图可达的组合群：C 前缀陷阱', () => {
    // getSymmetryType 把 C_{2}^{2} / C_{2}\times C_{2} 判为 'rectangle'（矩形对称群），
    // 但它们的符号以 'C' 开头，会先撞进 computeElementRotation 的循环群分支。
    for (const symbol of ['C_{2}^{2}', 'C_{2}\\times C_{2}']) {
      it(`${symbol}（4 阶、非循环）满足全部法则`, () => {
        const group = createGroupFromSymbol(symbol)
        expect(group, `${symbol} 未能构造`).not.toBeNull()
        expectLaws(group!)
      })
    }
  })

  describe('负向对照：harness 必须能抓住已发布的那个 bug', () => {
    /**
     * 复刻修复前的实现：`Math.abs(hash(element.id)) % 4` 从 4 根候选轴里挑一根。
     * A₄ 的元素 id 全是 '1,2,3,4' 的排列——同一字符集、等长。而 `h = 31h + c`
     * 且 `31 ≡ -1 (mod 4)`，逗号固定在奇数位贡献 −44、数字 1..4 固定在偶数位
     * 贡献 +202，故所有 id 的余数恒等于 70 mod 4 = 2 → 全部落在第 3 根轴上。
     */
    const legacyHashRotation: RotationFn = (_group, el) => {
      const candidateAxes: [number, number, number][] = [
        [0, 1, 0],
        [1, 0, 0],
        [0, 0, 1],
        [1, 1, 1],
      ]
      const ct = cycleTypeOf(el.value)
      const angleRad = ct === '3' ? (2 * Math.PI) / 3 : ct === '2-2' ? Math.PI : 0
      let h = 0
      for (let i = 0; i < el.id.length; i++) h = ((h << 5) - h + el.id.charCodeAt(i)) | 0
      const axis = candidateAxes[Math.abs(h) % candidateAxes.length]
      return { axis: [axis[0], axis[1], axis[2]], angleRad, label: '' }
    }

    it('旧 hash 实现被 L7 群同态 / L8 逆元 / L11 单射 同时检出', () => {
      const a4 = createAlternatingGroup(4)
      const violations = checkRotationLaws(a4, { rotationFn: legacyHashRotation })
      const fired = new Set(violations.map(x => x.law))
      expect(fired.has('L7 群同态'), `\n${formatViolations(a4, violations)}`).toBe(true)
      expect(fired.has('L8 逆元')).toBe(true)
      expect(fired.has('L11 单射')).toBe(true)
    })

    it('旧 hash 实现却能通过「阶」与「旋转阶=元素阶」——说明只靠 L9/L10 抓不到它', () => {
      const a4 = createAlternatingGroup(4)
      const fired = new Set(checkRotationLaws(a4, { rotationFn: legacyHashRotation }).map(x => x.law))
      expect(fired.has('L9 阶')).toBe(false)
      expect(fired.has('L10 旋转阶=元素阶')).toBe(false)
    })

    it('现行实现（置换几何反解）在同一 harness 下 A₄ / S₄ / A₅ 全部通过', () => {
      expectLaws(createAlternatingGroup(4))
      expectLaws(createSymmetricGroup(4))
      expectLaws(createAlternatingGroup(5))
    })
  })
})
