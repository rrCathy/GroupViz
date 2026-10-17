import { test, expect } from '@playwright/test'
import { enterWorkspace, waitForBridge } from './helpers'
import { createTableGroup } from '../src/core/groups/SmallGroups/tableGroup'
import { sl23Quat, sl23Spin } from '../src/core/groups/sl23'

/**
 * SL(2,3) 对称性视图（2T + Dirac 开口皮带 v7）真机验证：
 *  ① 相机可越过南北极（四元数轨道替换 OrbitControls 的 phi∈[0,π] 硬钳）；
 *  ② 皮带扭转轴与物体同轴（水平轴元素的皮带绕水平轴缠，截图人工核对）；
 *  ③ 720° 复原演练（Egan 皮带戏法：**两端固定**，扭转搬运成折角并滑出两端）；
 *  ④ 厚皮带 + 梯形尖端 + 尖端箭头 + 固定端三棒架 + 说明框（截图人工核对）。
 *
 * 主画布对称性视图（3D）无元素可点，演示元素经导出桥注入（与叠加模式 e2e 同一通道）；
 * 叠加开关 / 复位 / 皮带复位按钮走真实 UI 点击。
 */

const g = createTableGroup(24, 3)

/** 同源 oracle：元素旋转四元数 = 整数四元数 (b/2, c/2, d/2, a/2) */
function rotQuat(el: { value: number[] }): [number, number, number, number] {
  const [a, b, c, d] = sl23Quat(el.value[0])
  return [b / 2, c / 2, d / 2, a / 2]
}

/** −I = 唯一 2 阶元；绕 Y 轴 180° 的 4 阶元；绕 X 轴 180° 的 4 阶元 */
const negI = g.elements.find((e, i) => i !== 0 && g.multiply(e, e).id === g.identity.id)!
const j4 = g.elements.find(e => {
  const s = sl23Spin(e.value[0])
  return Math.abs(s.angleRad - Math.PI) < 1e-9 && Math.abs(s.axis![1] - 1) < 1e-9
})!
const i4 = g.elements.find(e => {
  const s = sl23Spin(e.value[0])
  return Math.abs(s.angleRad - Math.PI) < 1e-9 && Math.abs(s.axis![0] - 1) < 1e-9
})!

type BridgeApi = {
  createGroupFromSymbol(symbol: string): { symbol: string } | null
  _setGroup(g: unknown): void
  _setView(v: string): void
  _setSymmetryShowAction(show: boolean): void
  _setSymmetryElement(id: string | null): void
  setSymmetryCompose(compose: boolean): void
  getSymmetryPose(): [number, number, number, number] | null
  getSymmetryBelt(): number | null
  getSymmetryCamera(): { position: [number, number, number]; direction: [number, number, number] } | null
}

async function loadSl23Symmetry(page: import('@playwright/test').Page): Promise<void> {
  await enterWorkspace(page)
  await waitForBridge(page)
  // 先换群（换群触发 context 重置 microtask），等 symbol 落地再开演示
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
  })
  // 视图切换会重挂载 Canvas（轨道控制器监听器随之重挂）⇒ 等它真就绪再拖，
  // 否则前几步 pointermove 丢失（实测只转到赤道 y=0 就停）
  await expect(page.locator('.canvas-viewport canvas').first()).toBeVisible()
  await page.waitForTimeout(500)
}

test.describe('symmetry SL(2,3)（2T + Dirac 皮带 v3：同轴 + 莫比乌斯式扭转 + 正反双色）', () => {
  test('① 相机可越过南北极（竖直拖拽穿过下极点，direction.y 由负转正）', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))

    await loadSl23Symmetry(page)
    // 初始：相机在目标上方（direction = 目标→相机 方向，y > 0）
    const before = await page.evaluate(() =>
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryCamera())
    expect(before).not.toBeNull()
    expect(before!.direction[1]).toBeGreaterThan(0)

    const canvas = page.locator('.canvas-viewport canvas').first()
    const box = (await canvas.boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    // 抓取语义（与旧 OrbitControls 一致）：拖**上** = 相机向下降。分多步大幅上拖，
    // 越过下极点后相机位于目标下方（position.y < 0、direction.y < 0）
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(cx, cy - (300 * i) / 12)
      await page.waitForTimeout(30)
    }
    await page.mouse.up()
    await page.waitForTimeout(200)

    const after = await page.evaluate(() =>
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryCamera())
    // 越过极点：相机位置到目标下方（y < 0），direction.y 由正转负
    expect(after!.position[1]).toBeLessThan(0)
    expect(after!.direction[1]).toBeLessThan(-0.3)

    expect(errors).toEqual([])
  })

  test('② 水平轴元素：皮带沿旋转轴直躺 + 绕自身轴扭转（截图人工核对）', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))

    await loadSl23Symmetry(page)
    // 应用绕 X 轴 180° 的 4 阶元 i：皮带应沿 X 轴直躺（锚点挪到 +X 侧），
    // 带面绕自身中心线翻转 180°（正反双色在半带处翻面）
    await page.evaluate(([id]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(id)
    }, [i4.id])
    await page.waitForFunction(
      (exp) => {
        const p = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryPose()
        if (!p) return false
        return [0, 1, 2, 3].every(i => Math.abs(p[i] - exp[i]) < 1e-4)
      },
      rotQuat(i4),
      { timeout: 10_000 },
    )
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'browser-sl23-belt-horizontal.png', fullPage: false })

    expect(errors).toEqual([])
  })

  test('③ −I 皮带戏法：物体外观恒等（姿态 (0,0,0,−1)）+ 皮带拧满一圈', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))

    await loadSl23Symmetry(page)

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
    await page.waitForFunction(
      () => {
        const tau = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryBelt()
        return tau !== null && Math.abs(tau - 2 * Math.PI) < 1e-3
      },
      null,
      { timeout: 10_000 },
    )
    await page.screenshot({ path: 'browser-sl23-belt-fullturn.png', fullPage: false })

    expect(errors).toEqual([])
  })

  test('③b 720° 复原演练：累到两整扭 → 按钮亮 → 演示绕过锚点 → τ 回 0', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', err => errors.push(String(err)))

    await loadSl23Symmetry(page)
    await page.evaluate(() => {
      const api = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__
      api.setSymmetryCompose(true)
    })

    // 叠加开关可见且已勾（2T 开放）
    const composeToggle = page.getByTestId('symmetry-compose-toggle')
    await expect(composeToggle).toBeVisible()
    await expect(composeToggle.locator('input')).toBeChecked()

    // 累到 720°：−I(2π) + 绕 X 轴 4 阶元(π) + 绕 Y 轴 4 阶元(π)（三个不同元素——
    // 同一元素连设两次不重触发 compose，重复作用得走 ⟳ Replay 通道）
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
    await page.evaluate(([id]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(id)
    }, [i4.id])
    await page.waitForFunction(
      () => {
        const tau = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryBelt()
        return tau !== null && Math.abs(tau - 3 * Math.PI) < 1e-3
      },
      null,
      { timeout: 10_000 },
    )
    await page.evaluate(([id]) => {
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__._setSymmetryElement(id)
    }, [j4.id])
    await page.waitForFunction(
      () => {
        const tau = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryBelt()
        return tau !== null && Math.abs(tau - 4 * Math.PI) < 1e-3
      },
      null,
      { timeout: 10_000 },
    )

    // 「演示皮带复位」按钮此时才可用（拧满两圈）
    const restoreBtn = page.getByTestId('symmetry-belt-restore')
    await expect(restoreBtn).toBeEnabled()
    const camBefore = await page.evaluate(() =>
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryCamera())
    await restoreBtn.click()
    // v7：两端固定（Egan 皮带戏法）——整个场景静止，相机不该被任何「自动切中心」带偏
    // （v6 的演练期强制锚点中心已删除，见 CHANGELOG）。900ms 时抓中途截图人工核对：
    // 应该看到**两个折角**（扭转集中处），两端平直、四面体与锚点纹丝不动。
    await page.waitForTimeout(900)
    const camMid = await page.evaluate(() =>
      (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryCamera())
    for (let i = 0; i < 3; i++) expect(Math.abs(camMid!.position[i] - camBefore!.position[i])).toBeLessThan(0.01)
    await page.screenshot({ path: 'browser-sl23-belt-restore-mid.png', fullPage: false })
    // 演练完成：τ 一次性解开两整扭回 0
    await page.waitForFunction(
      () => {
        const tau = (window as unknown as { __groupVizExport__: BridgeApi }).__groupVizExport__.getSymmetryBelt()
        return tau !== null && Math.abs(tau) < 1e-3
      },
      null,
      { timeout: 15_000 },
    )
    await page.screenshot({ path: 'browser-sl23-belt-restore-done.png', fullPage: false })

    expect(errors).toEqual([])
  })

  test('③c 单整扭时复位按钮禁用（拓扑上不可消）', async ({ page }) => {
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
    // τ = 360°（单整扭）：按钮禁用
    await expect(page.getByTestId('symmetry-belt-restore')).toBeDisabled()
  })
})
