import { test, expect } from '@playwright/test'
import * as THREE from 'three'
import { enterWorkspace, waitForBridge } from './helpers'
import { createAlternatingGroup } from '../src/core/groups/AlternatingGroup'
import { computeElementRotation } from '../src/core/elementRotation'

/**
 * 对称性视图叠加模式（compose）：元素旋转左乘当前姿态持续合成，
 * 复位姿态按钮走 homing 动画回恒等。真机路径：
 * A₄ → 对称视图 → 叠加开关 → 连续应用两个元素 → 桥读姿态 = 乘积 → 复位 → 恒等。
 *
 * 主画布对称性视图（3D）无元素可点，演示元素经导出桥注入（与批量导出脚本同一通道）；
 * 叠加开关 / 复位按钮走真实 UI 点击（ViewPanel 对称区，data-testid）。
 */

const a4 = createAlternatingGroup(4)
const [elA, elB] = [a4.elements[1]!, a4.elements[2]!]

/** 与场景同源的元素旋转四元数（computeElementRotation → setFromAxisAngle） */
function rotQuat(el: typeof a4.elements[number]): [number, number, number, number] {
  const r = computeElementRotation(a4, el)!
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...r.axis), r.angleRad)
  return [q.x, q.y, q.z, q.w]
}

/** 目标姿态 = 元素旋转 × 当前姿态（左乘，与场景 compose 分支一致） */
function composeOnto(pose: [number, number, number, number], el: typeof a4.elements[number]): [number, number, number, number] {
  const q = new THREE.Quaternion(...rotQuat(el)).multiply(new THREE.Quaternion(...pose))
  return [q.x, q.y, q.z, q.w]
}

type BridgeApi = {
  createGroupFromSymbol(symbol: string): { symbol: string } | null
  _setGroup(g: unknown): void
  _setView(v: string): void
  _setSymmetryShowAction(show: boolean): void
  _setSymmetryElement(id: string | null): void
  setSymmetryCompose(compose: boolean): void
  getSymmetryPose(): [number, number, number, number] | null
}

async function loadComposeA4(page: import('@playwright/test').Page): Promise<void> {
  await enterWorkspace(page)
  await waitForBridge(page)
  // 先换群（换群会触发 context 的演示状态重置 microtask），等其落地再开叠加，
  // 避免同一 tick 内 setShowAction(true) 被换群重置竞态覆盖
  await page.evaluate(() => {
    const api = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__
    const g = api.createGroupFromSymbol('A_{4}')
    if (!g) throw new Error('createGroupFromSymbol("A_{4}") returned null')
    api._setGroup(g)
  })
  await page.waitForFunction(() => {
    const b = (window as unknown as { __groupVizExport__: { _getGroup?: () => { symbol?: string } | null } }).__groupVizExport__
    return b?._getGroup?.()?.symbol === 'A_{4}'
  }, null, { timeout: 15_000 })
  await page.evaluate(() => {
    const api = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__
    api._setView('symmetry')
    api._setSymmetryShowAction(true)
    api.setSymmetryCompose(true)
  })
}

test.describe('symmetry compose（叠加模式）', () => {
  test('叠加两个元素 → 桥读姿态 = 乘积 → 复位回恒等', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))

    await loadComposeA4(page)

    // 叠加开关可见（A₄ = tetrahedron 类型才有入口）
    const composeToggle = page.getByTestId('symmetry-compose-toggle')
    await expect(composeToggle).toBeVisible()
    await expect(composeToggle.locator('input')).toBeChecked()

    // 应用元素 a → 姿态落定 = Q_a（从恒等出发）
    await page.evaluate(([aId]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(aId)
    }, [elA.id])
    const expectedA = rotQuat(elA)
    await page.waitForFunction(
      (exp) => {
        const p = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryPose()
        if (!p) return false
        return [0, 1, 2, 3].every(i => Math.abs(p[i] - exp[i]) < 1e-4)
      },
      expectedA,
      { timeout: 10_000 },
    )

    // 应用元素 b → 姿态 = Q_b·Q_a（左乘合成）
    await page.evaluate(([bId]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(bId)
    }, [elB.id])
    const expectedBA = composeOnto(rotQuat(elA), elB)
    await page.waitForFunction(
      (exp) => {
        const p = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryPose()
        if (!p) return false
        return [0, 1, 2, 3].every(i => Math.abs(p[i] - exp[i]) < 1e-4)
      },
      expectedBA,
      { timeout: 10_000 },
    )

    // 复位姿态按钮（UI 点击）→ homing 动画回恒等
    await page.getByTestId('symmetry-reset-pose').click()
    await page.waitForFunction(
      () => {
        const p = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryPose()
        if (!p) return false
        return Math.abs(p[3] - 1) < 1e-4 && [0, 1, 2].every(i => Math.abs(p[i]) < 1e-4)
      },
      null,
      { timeout: 10_000 },
    )

    await page.screenshot({ path: 'test-results/symmetry-compose-reset.png', fullPage: false })
    expect(errors).toEqual([])
  })

  test('叠加模式下复位按钮把姿态送回恒等且演示元素保留', async ({ page }) => {
    await loadComposeA4(page)
    await page.evaluate(([aId]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(aId)
    }, [elA.id])
    await page.waitForFunction(
      (exp) => {
        const p = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryPose()
        if (!p) return false
        return [0, 1, 2, 3].every(i => Math.abs(p[i] - exp[i]) < 1e-4)
      },
      rotQuat(elA),
      { timeout: 10_000 },
    )
    await page.getByTestId('symmetry-reset-pose').click()
    await page.waitForFunction(
      () => {
        const p = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryPose()
        if (!p) return false
        return Math.abs(p[3] - 1) < 1e-4 && [0, 1, 2].every(i => Math.abs(p[i]) < 1e-4)
      },
      null,
      { timeout: 10_000 },
    )
    // 复位后换元素再应用 → 从恒等出发重新合成（姿态 = 该元素自身旋转）
    await page.evaluate(([bId]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(bId)
    }, [elB.id])
    await page.waitForFunction(
      (exp) => {
        const p = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryPose()
        if (!p) return false
        return [0, 1, 2, 3].every(i => Math.abs(p[i] - exp[i]) < 1e-4)
      },
      rotQuat(elB),
      { timeout: 10_000 },
    )
  })
})
