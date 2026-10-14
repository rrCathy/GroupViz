import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nContext'
import Workspace from '../Workspace'
import { STORAGE_KEY } from '../utils/sessionKey'
import { STORAGE_FORMAT_VERSION } from '../utils/persistence'

// ── 主画布 2D 凯莱图「边样式：弯曲 / 笔直」（ViewPanel 控件，纯视觉偏好）──
// 覆盖三件事：默认弯曲观感不变；笔直模式下单条边真直（含选中重绘层）；平行边
// （a/a⁻¹ 对）在两种模式下都分列两侧、不得叠成同一条曲线。

function seedSession(symbol: string, view = 'cayley') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    __gvVersion: STORAGE_FORMAT_VERSION,
    data: { symbol, view },
  }))
}

function renderWorkspace() {
  return render(
    <I18nProvider>
      <Workspace />
    </I18nProvider>,
  )
}

type Geom = { s: [number, number]; c: [number, number]; e: [number, number] }

const parseEdge = (d: string): Geom => {
  const m = d.match(/M ([\d.eE+-]+) ([\d.eE+-]+) Q ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+) ([\d.eE+-]+)/)!
  return { s: [+m[1], +m[2]], c: [+m[3], +m[4]], e: [+m[5], +m[6]] }
}

/** 主画布边 path（`M … Q …`）；自环被 dist 守卫裁剪、marker 内部 path 无 Q，都会被排除 */
const edgeGeoms = (container: HTMLElement): Geom[] =>
  Array.from(container.querySelectorAll('svg.view-svg path'))
    .map(p => p.getAttribute('d') ?? '')
    .filter(d => d.includes(' Q '))
    .map(parseEdge)

/** 规范法向：同一对节点的两条反向边必须共享同一基准（各自法向会互相抵消，掩盖重叠） */
const canonicalNormal = (g: Geom): [number, number] => {
  const [ax, ay] = g.s
  const [bx, by] = g.e
  const [fx, fy] = (ax < bx || (ax === bx && ay < by)) ? [bx - ax, by - ay] : [ax - bx, ay - by]
  const dist = Math.hypot(fx, fy)
  return [-fy / dist, fx / dist]
}

/** 控制点相对弦中点的偏移，沿规范法向投影（带符号；真直 = 0，分列两侧 = 一正一负） */
const perpOffset = (g: Geom): number => {
  const [nx, ny] = canonicalNormal(g)
  const midX = (g.s[0] + g.e[0]) / 2
  const midY = (g.s[1] + g.e[1]) / 2
  return (g.c[0] - midX) * nx + (g.c[1] - midY) * ny
}

/** 控制点落弦中点（真直判据：x/y 两分量都为 0） */
const ctrlOnMid = (g: Geom): boolean => {
  const midX = (g.s[0] + g.e[0]) / 2
  const midY = (g.s[1] + g.e[1]) / 2
  return Math.abs(g.c[0] - midX) < 0.5 && Math.abs(g.c[1] - midY) < 0.5
}

const findButton = (container: HTMLElement, text: string): HTMLButtonElement => {
  const btn = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
    .find(b => (b.textContent ?? '').trim() === text)
  expect(btn, `button "${text}"`).toBeDefined()
  return btn!
}

const clickEdgeStyle = (container: HTMLElement, text: '笔直' | '弯曲') =>
  fireEvent.click(findButton(container, text))

/** 等 cayley 视图首帧边渲染（actions 初始化走 queueMicrotask） */
const waitEdges = async (container: HTMLElement) => {
  await waitFor(() => expect(edgeGeoms(container).length).toBeGreaterThan(0))
}

/** 在「边作用元素」列表里勾选指定标签的项（列表项渲染元素 label，C₄ 的 label 就是 0/1/2/3） */
const toggleActionByLabel = (container: HTMLElement, label: string) => {
  const item = Array.from(container.querySelectorAll<HTMLElement>('.view-context-settings .cayley-action-item'))
    .find(it => (it.querySelector('.action-label')?.textContent ?? '').trim().includes(label))
  expect(item, `action item "${label}"`).toBeDefined()
  fireEvent.click(item!.querySelector<HTMLInputElement>('input[type="checkbox"]')!)
}

/** 「全选」= 全部列出但仅生成元默认启用；再点开 a²（自逆单条边）与 a³=a⁻¹（与 e1 组成平行对） */
const setupC4AllActions = (container: HTMLElement) => {
  fireEvent.click(findButton(container, '全选'))
  toggleActionByLabel(container, '2')
  toggleActionByLabel(container, '3')
}

/** 平行边配对：起点 ≈ 对方终点（方向相反、同一对节点） */
const parallelPairs = (geoms: Geom[]): [Geom, Geom][] => {
  const pairs: [Geom, Geom][] = []
  for (let i = 0; i < geoms.length; i++) {
    for (let j = i + 1; j < geoms.length; j++) {
      const a = geoms[i]
      const b = geoms[j]
      if (Math.hypot(a.s[0] - b.e[0], a.s[1] - b.e[1]) < 0.5 &&
        Math.hypot(a.e[0] - b.s[0], a.e[1] - b.s[1]) < 0.5) {
        pairs.push([a, b])
      }
    }
  }
  return pairs
}

describe('main canvas · 2D Cayley edge style (curved/straight)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('C₄ 默认弯曲 → 笔直（全部落弦，含选中重绘层）→ 切回弯曲恢复', async () => {
    seedSession('C_{4}')
    const { container } = renderWorkspace()
    await waitEdges(container)

    // 默认弯曲：每条边都弓离弦（现状观感）
    for (const g of edgeGeoms(container)) {
      expect(Math.abs(perpOffset(g))).toBeGreaterThan(0.5)
    }

    // 切笔直 + 选中一个元素让高亮重绘层出现：两层控制点都必须落弦上
    clickEdgeStyle(container, '笔直')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(container.querySelector('circle[stroke="#ffd93d"]')).not.toBeNull()
    const straight = edgeGeoms(container)
    expect(straight.length).toBeGreaterThan(4)
    for (const g of straight) expect(ctrlOnMid(g)).toBe(true)

    // 切回弯曲：恢复弓弧
    clickEdgeStyle(container, '弯曲')
    for (const g of edgeGeoms(container)) {
      expect(Math.abs(perpOffset(g))).toBeGreaterThan(0.5)
    }
  })

  it('C₄ 全选（e1/e3 互逆成对）+ 笔直：平行边左右分列、单条边真直', async () => {
    seedSession('C_{4}')
    const { container } = renderWorkspace()
    await waitEdges(container)

    // 全选 + 勾 a²/a³：e1 与 e3=a⁻¹ 同时启用 → 四组环边成为平行对，另有余两条 e2 单边
    setupC4AllActions(container)
    clickEdgeStyle(container, '笔直')

    const geoms = edgeGeoms(container)
    const pairs = parallelPairs(geoms)
    expect(pairs).toHaveLength(4)
    for (const [a, b] of pairs) {
      const oa = perpOffset(a)
      const ob = perpOffset(b)
      // 一正一负：反向平行边不得叠成同一条曲线（曾各用自身法向导致 4/4 对重合）
      expect(Math.sign(oa)).toBe(-Math.sign(ob))
      // 各偏 8px（offset ±0.5 × 16）
      expect(Math.abs(Math.abs(oa) - 8)).toBeLessThan(1.5)
      expect(Math.abs(Math.abs(ob) - 8)).toBeLessThan(1.5)
    }

    // 非平行边（e2 双向边两条）不得被分摊带偏：仍真直
    const inPair = new Set<Geom>()
    pairs.forEach(([a, b]) => { inPair.add(a); inPair.add(b) })
    const singles = geoms.filter(g => !inPair.has(g))
    expect(singles).toHaveLength(2)
    for (const g of singles) expect(ctrlOnMid(g)).toBe(true)
  })

  it('C₄ 全选 + 默认弯曲：平行对同样分列两侧（现状观感不变）', async () => {
    seedSession('C_{4}')
    const { container } = renderWorkspace()
    await waitEdges(container)

    setupC4AllActions(container)
    const geoms = edgeGeoms(container)
    const pairs = parallelPairs(geoms)
    expect(pairs).toHaveLength(4)
    for (const [a, b] of pairs) {
      const oa = perpOffset(a)
      const ob = perpOffset(b)
      expect(Math.sign(oa)).toBe(-Math.sign(ob))
      expect(Math.abs(oa)).toBeGreaterThan(0.5)
      // 弯曲模式两条边对称（同一 curvature、法向相反）→ 偏移绝对值相等
      expect(Math.abs(Math.abs(oa) - Math.abs(ob))).toBeLessThan(0.5)
    }
  })
})
