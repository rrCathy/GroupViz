import { test, expect } from '@playwright/test'
import { enterWorkspace, waitForBridge } from './helpers'
import { createTableGroup } from '../src/core/groups/SmallGroups/tableGroup'
import { sl23Quat, sl23Spin } from '../src/core/groups/sl23'

/**
 * SL(2,3) 对称性视图（2T + Dirac 开口皮带）真机验证：
 *   SL(2,3) → 对称视图 → 叠加 → 应用 −I（唯一 2 阶元）→
 *   桥读姿态 = (0,0,0,−1)（物体外观恒等，SU(2) 提升取反）+ 皮带 τ = 360°；
 *   再作用一次 → 皮带 720°（两整扭拓扑复原）；复位 → 恒等 + 皮带回 0。
 *
 * 主画布对称性视图（3D）无元素可点，演示元素经导出桥注入（与叠加模式 e2e 同一通道）；
 * 叠加开关 / 复位按钮走真实 UI 点击。
 */

const g = createTableGroup(24, 3)

/** 同源 oracle：元素旋转四元数 = 整数四元数 (b/2, c/2, d/2, a/2) */
function rotQuat(el: { value: number[] }): [number, number, number, number] {
  const [a, b, c, d] = sl23Quat(el.value[0])
  return [b / 2, c / 2, d / 2, a / 2]
}

/** −I = 唯一 2 阶元；4 阶元（物体旋转 180°） */
const negI = g.elements.find((e, i) => i !== 0 && g.multiply(e, e).id === g.identity.id)!
const j4 = g.elements.find(e => Math.abs(sl23Spin(e.value[0]).angleRad - Math.PI) < 1e-9)!

type BridgeApi = {
  createGroupFromSymbol(symbol: string): { symbol: string } | null
  _setGroup(g: unknown): void
  _setView(v: string): void
  _setSymmetryShowAction(show: boolean): void
  _setSymmetryElement(id: string | null): void
  setSymmetryCompose(compose: boolean): void
  getSymmetryPose(): [number, number, number, number] | null
  getSymmetryBelt(): number | null
}

async function loadSl23Symmetry(page: import('@playwright/test').Page): Promise<void> {
  await enterWorkspace(page)
  await waitForBridge(page)
  // 先换群（换群触发 context 重置 microtask），等 symbol 落地再开演示/叠加
  await page.evaluate(() => {
    const api = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__
    const gr = api.createGroupFromSymbol('SL(2,3)')
    if (!gr) throw new Error('createGroupFromSymbol("SL(2,3)") returned null')
    api._setGroup(gr)
  })
  await page.waitForFunction(() => {
    const b = (window as unknown as { __groupVizExport__: { _getGroup?: () => { symbol?: string } | null } }).__groupVizExport__
    return b?._getGroup?.()?.symbol === 'SL(2,3)'
  }, null, { timeout: 15_000 })
  await page.evaluate(() => {
    const api = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__
    api._setView('symmetry')
    api._setSymmetryShowAction(true)
    api.setSymmetryCompose(true)
  })
}

test.describe('symmetry SL(2,3)（2T + Dirac 皮带）', () => {
  test('−I：物体外观恒等（姿态 (0,0,0,−1)）+ 皮带拧满一圈（τ=360°）', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))

    await loadSl23Symmetry(page)

    // 叠加开关对 SL(2,3) 开放（binaryTetrahedron 与 tetrahedron 同门控）
    const composeToggle = page.getByTestId('symmetry-compose-toggle')
    await expect(composeToggle).toBeVisible()
    await expect(composeToggle.locator('input')).toBeChecked()

    // 应用 −I → 姿态落定 = Q(−I)（与恒等同一旋转，四元数取反）
    await page.evaluate(([id]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(id)
    }, [negI.id])
    const expected = rotQuat(negI)
    await page.waitForFunction(
      (exp) => {
        const p = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryPose()
        if (!p) return false
        return [0, 1, 2, 3].every(i => Math.abs(p[i] - exp[i]) < 1e-4)
      },
      expected,
      { timeout: 10_000 },
    )
    // 皮带 = 一整圈（τ = 360° ⇔ q = −1，皮带戏法核心态）
    await page.waitForFunction(
      () => {
        const tau = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryBelt()
        return tau !== null && Math.abs(tau - 2 * Math.PI) < 1e-3
      },
      null,
      { timeout: 10_000 },
    )
    // 截图：人工核对皮带扭转几何（一整圈）与四面体半透明面透出
    await page.screenshot({ path: 'browser-sl23-belt-fullturn.png', fullPage: false })

    expect(errors).toEqual([])
  })

  test('叠加 −I 两次 → 皮带 720° 复原；复位 → 恒等 + 皮带回 0', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))

    await loadSl23Symmetry(page)

    await page.evaluate(([id]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(id)
    }, [negI.id])
    await page.waitForFunction(
      () => {
        const tau = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryBelt()
        return tau !== null && Math.abs(tau - 2 * Math.PI) < 1e-3
      },
      null,
      { timeout: 10_000 },
    )

    // 4 阶元 j 也走一遍（物体旋转 180° + 皮带 180°），再叠 −I 到 720° 量级
    await page.evaluate(([id]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(id)
    }, [j4.id])
    await page.waitForFunction(
      () => {
        const tau = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryBelt()
        return tau !== null && Math.abs(tau - 3 * Math.PI) < 1e-3
      },
      null,
      { timeout: 10_000 },
    )

    // UI 点复位姿态 → homing：姿态恒等 + 皮带回 0
    await page.getByTestId('symmetry-reset-pose').click()
    await page.waitForFunction(
      () => {
        const api = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__
        const p = api.getSymmetryPose()
        const tau = api.getSymmetryBelt()
        if (!p || tau === null) return false
        return Math.abs(p[3] - 1) < 1e-4 && [0, 1, 2].every(i => Math.abs(p[i]) < 1e-4) && Math.abs(tau) < 1e-3
      },
      null,
      { timeout: 10_000 },
    )

    expect(errors).toEqual([])
  })
})
