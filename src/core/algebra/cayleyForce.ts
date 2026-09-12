import type { CayleyAction, Group, MultiplyType, NodePosition } from '../types'
import { computeCayleyActionEdges } from './cayleyEdges'

/**
 * 动态力导向 2D 凯莱图 —— 增量式力模拟器（VCL）。
 *
 * 目标手感：**Obsidian 交互式图谱**——静图"活"起来、可拖拽、邻居弹性跟随、
 * 快拖只带动局部、松手轻微回稳、整体形状不坍缩不走样。
 *
 * 力模型与积分格式对齐 d3-force（Obsidian 图谱早期就是 d3 驱动）：
 *  - **力 × alpha 进速度**（`vx += fx × alpha`），位置直接积分速度，速度每帧衰减。
 *    热度低 → 力小 → 位移小：这才是"拖一个节点不牵动全图"的正确机制。
 *    （旧实现把 alpha 乘在**位移**上、力照常全额进速度——速度场跨帧持续累积，
 *    拖动时全图照样被拽动，且松手瞬间释放累积速度造成弹跳。）
 *  - **alphaTarget 架构**：热度向目标松弛而非一次性 bump 后纯衰减——拖拽期间
 *    恒定微热（长按时邻域持续松弛，Obsidian 同款），松手目标归零自然冷却。
 *  - **per-edge 静止长度**（关键！）：每条弹簧的静止长度 = 它在初始静态布局中的
 *    实际长度，**初始零预张力**。dual ring / 直积 / 网格等装饰性静态布局里
 *    "同一生成元的边长差异极大"（r 生成元在 D₇ 里同时连外环边 196、内环边 92），
 *    用 per-gen 平均会让所有边都偏离静止长度 50+ px，激活瞬间往"等边化"平衡
 *    态狂拽而坍缩走样（maxDrift 150+）。per-edge rest 让初始所有弹簧都接近
 *    平衡态，激活与拖拽都"守住"原始装饰性形状。
 *  - **激活 = 一次性 settle 到平衡态**（Obsidian 行为）：装饰性静态布局
 *    （dual ring / cylinder / torus）本身不是力平衡态——若让力系统一直开着，
 *    会把图谱慢慢拉到"边长均匀、节点均匀"的全局平衡而走样。**正确做法**：
 *    启动 alpha=0（不动），需要激活时跑 N 步 alpha=1 的 settle（≈ 200ms
 *    一次性动画感），把图谱投影到**最近的力平衡态**——per-edge rest 让平衡态
 *    ≈ 原始静态布局的均匀化版本（不"塌成圆"），之后冻结。**拖拽时**才临时
 *    解锁邻域（alphaTarget=DRAG_ALPHA），松手再冻结。这就是 Obsidian 真行为。
 *  - **塑性弹簧（探索新形状的核心）**：纯弹性弹簧 rest 恒等于初始边长 ⇒ 形状
 *    记忆锁死，用户拖不出新形状。拖拽期间（alphaTarget > 0）每帧让 rest 向
 *    当前实际长度迁移 PLASTIC_RATE —— 拖到哪、形状"记"到哪，松手后停在新形状，
 *    用户可一步步把图谱"捏"成新构型。settle 与松手冷却期间不塑性（alphaTarget=0）
 *    ⇒ 图谱静止时永不自行漂移。`resetRests()` 清除塑性记忆（Re-settle = 回到给定形状）。
 *  - **均衡态标定**：
 *    向心重力按 n² 归一（环状布局的向心收缩恒 ≈ 2.7% 半径、与群阶无关——
 *    旧实现的固定重力常数在大群上把整张图压塌：40 阶环可收缩 170px+）；
 *    斥力在 2.5–3.5×理想间距间 smoothstep 淡出（硬截断在边界注入能量 → 纠缠抖动）。
 *
 * 力模型：
 *  斥力 f = repK / d²（3.5×理想间距外为 0）
 *  弹簧 f = (d − rest) × kSpring（rest = 该边初始长度 × linkScale × 逐生成元 lengthScale）
 *  向心 f = gravK × d（gravK = 0.3 × gravity / n²）
 */
export interface CayleyForceOptions {
  width: number
  height: number
  /** 斥力倍率；缺省 1（越大节点越散） */
  repulsion?: number
  /** 全局边长倍率；缺省 1（再乘各生成元 lengthScale） */
  linkScale?: number
  /** 向心力倍率；缺省 1（已按群阶归一，对环状布局收缩恒 ≈2.7% 半径） */
  gravity?: number
  /** 速度保留率 0.5–0.95；缺省 0.75（越小越黏、越稳） */
  damping?: number
  /** 连线刚度倍率 0.4–3；缺省 1（越大越"硬"：拖拽时局部形状越不易走样）。
   *  拖拽期间自动 ×2.5（松手恢复） */
  stiffness?: number
  /** 节点最小间距（世界单位）；缺省 idealDist × 0.85（≈ 节点直径量级）。
   *  低热度下纯力场推不开重叠节点，会留下"纠缠"观感，故用硬约束兜底 */
  minSeparation?: number
  /** 初始位置（通常取所选形状的静态布局，实现"从静图平滑激活"） */
  initialPositions?: Map<string, NodePosition>
  /** 初始热度 0–1；缺省 0（启动即冻结——Obsidian 风格；用 settle() 一次性投影到平衡态） */
  initialAlpha?: number
}

export interface CayleyForceSim {
  /** 实时位置（每 step 就地更新；调用方自行复制以触发重渲染） */
  readonly positions: Map<string, NodePosition>
  /** 推进一帧；返回是否仍在运动（false = 已静止，可停 rAF） */
  step(): boolean
  /** 钉住某节点（拖拽中）；随后每帧以该坐标为准 */
  pin(id: string, x: number, y: number): void
  unpin(id: string): void
  isPinned(id: string): boolean
  /** 重新升温（重播 / 参数重置时调用；拖拽期间不要调用） */
  reheat(alpha?: number): void
  /**
   * **一次性投影到力平衡态**（Obsidian 风格激活）：
   * 启动 alpha=settleAlpha 跑 N 步，让图谱从装饰性静态布局松弛到最近的
   * 力平衡态，然后 alpha=0 冻结。per-edge rest 让平衡态 ≈ 原始布局的均匀化
   * 版本（不塌成圆）。后续只有拖拽时 alphaTarget=DRAG_ALPHA 才临时解锁。
   * settle 期间不塑性（alphaTarget=0）——反复 settle 幂等，不改变形状定义。
   * 仅适合小扰动投影（激活 ~4px）；大形变回归请用 resetShape()。
   */
  settle(steps?: number, settleAlpha?: number): void
  /** **硬重置回给定形状**：位置与弹簧静止长度都恢复到初始（清除全部塑性痕迹）。
   *  比「resetRests + settle 投影」可靠——投影靠弹簧张力慢慢漂回，大形变时
   *  斥力/重力的均衡 ≠ 初始布局，收敛不到位甚至震荡（实测二次 settle 更差）。
   *  无 initialPositions 时退化为仅重置 rest（无"给定形状"可回） */
  resetShape(): void
  /** **就地更新力参数**（保留位置与速度）：滑杆调节走这里 → 形状平滑过渡，
   *  而不是重建模拟器 + 全局重新收敛（那会让"稍微调一下形状就大变样"） */
  setOptions(opts: Partial<CayleyForceOptions>): void
  /** 当前热度 0–1 */
  readonly alpha: number
  readonly settled: boolean
}

interface SimNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  fixed: boolean
}

const SETTLE_ALPHA = 0.005
/** 热度向 alphaTarget 的每帧松弛比例（d3-force 风格）。
 *  alpha += (target − alpha) × ALPHA_DECAY；ALPHA_DECAY = 0.04 ⇒ 每帧保留 96%（≈1.7s 衰到静止）
 *  —— 写大值（0.96 等）会把"保留率"和"松弛比例"搞混，导致一帧内 alpha 衰到 0 */
const ALPHA_DECAY = 0.04
/** 拖拽热度（同时是拖拽期间的 alphaTarget）：邻居有可感的弹性跟随，
 *  2 跳以外在典型拖拽时长（<0.5s）内基本不动——Obsidian 式局部性。
 *  （长按住时邻域持续松弛、远端逐层跟进，但速度受 maxSpeed 钳制，不炸不抖） */
const DRAG_ALPHA = 0.2
/** 拖拽期间弹簧刚度临时增强：局部形状更"硬"，邻域不易被拖走样；松手恢复 */
const DRAG_STIFF_BOOST = 2.5
/** **塑性速率**：塑性窗口内每帧弹簧静止长度向当前实际长度迁移的比例。
 *  这是"探索新形状"的核心机制——纯弹性弹簧（rest 恒等于初始边长）有形状记忆，
 *  用户拖不动画 invariant 布局；塑性让拖过的边 rest 跟上位移（拖到哪记到哪），
 *  松手后图谱停在**新形状**而不是弹回初始布局，用户可一步步把图"捏"成新构型 */
const PLASTIC_RATE = 0.15
/** 塑性窗口的冷却关闭阈值：松手后热度降到此值以下才停止塑性（冷却早中期
 *  继续塑性 = 邻域回缩过程中 rest 同步定影，不产生系统性弹回） */
const PLASTIC_END_ALPHA = 0.03
/** 参数变化（setOptions）的升温：足够走完一次平滑过渡，又远低于重排烈度 */
const SET_OPTIONS_ALPHA = 0.35
/** 斥力淡出区间（单位：理想间距） */
const REP_FADE_START = 2.5
const REP_FADE_END = 3.5

export function createCayleyForceSim(
  group: Group,
  actions: CayleyAction[],
  multiplyType: MultiplyType,
  options: CayleyForceOptions,
): CayleyForceSim {
  const { width, height } = options
  const centerX = width / 2
  const centerY = height / 2
  const pad = Math.min(width, height) * 0.06

  const elements = group.elements
  const n = elements.length
  const idx = new Map<string, number>()
  elements.forEach((el, i) => idx.set(el.id, i))

  const initialRadius = Math.min(width * 0.42, Math.max(60, 40 + n * 6))
  const nodes: SimNode[] = elements.map((el, i) => {
    const saved = options.initialPositions?.get(el.id)
    const angle = (i * 2 * Math.PI) / Math.max(1, n) - Math.PI / 2
    return {
      id: el.id,
      x: saved ? saved.x : centerX + initialRadius * Math.cos(angle),
      y: saved ? saved.y : centerY + initialRadius * Math.sin(angle),
      vx: 0,
      vy: 0,
      fixed: false,
    }
  })

  const positions = new Map<string, NodePosition>()
  for (const nd of nodes) positions.set(nd.id, { x: nd.x, y: nd.y })

  // 边（含逐生成元静止长度；rest = restBase × linkScale，linkScale 可被 setOptions 就地改）
  const scaleOf = new Map(actions.map(a => [a.elementId, a.lengthScale ?? 1]))
  const rawEdges = computeCayleyActionEdges(group, actions, multiplyType)
  const springEdges: { a: number; b: number; rest: number; restBase: number }[] = []
  for (const e of rawEdges) {
    if (e.isSelfLoop || e.fromId === e.toId) continue
    const ia = idx.get(e.fromId)
    const ib = idx.get(e.toId)
    if (ia === undefined || ib === undefined) continue
    springEdges.push({ a: ia, b: ib, rest: 0, restBase: 0 }) // rest/restBase 稍后统一填
  }

  // 基础边长：初始位置下各边平均长度（退化时用面积估计）。
  // 初始静图即弹簧零张力点 —— 这是"激活后形状不走样"的第一根锚
  let baseLen: number
  if (springEdges.length > 0) {
    let sum = 0
    let cnt = 0
    for (const se of springEdges) {
      const d = Math.hypot(nodes[se.b].x - nodes[se.a].x, nodes[se.b].y - nodes[se.a].y)
      if (d > 1e-3) {
        sum += d
        cnt++
      }
    }
    baseLen = cnt > 0 ? sum / cnt : Math.sqrt((width * height) / Math.max(1, n))
  } else {
    baseLen = Math.sqrt((width * height) / Math.max(1, n))
  }

  // per-edge 静止长度：每条边独立 restBase = 它在初始静态布局中的实际长度 × 逐生成元 lengthScale。
  // 关键：dual ring / 直积 / 网格等装饰性静态布局里**同一生成元的边长差异极大**
  // （r 生成元在 D₇ dual ring 里同时连外环边 ≈196 与内环边 ≈92），
  // 用 per-gen 平均会让所有边都偏离静止长度 50+ px，激活瞬间往"等边化"平衡
  // 态狂拽而坍缩走样（maxDrift 150+）。per-edge 让初始所有弹簧都≈零预张力，
  // 装饰性形状得以保住，激活与拖拽都不会"走样"。
  // 退化兜底：边的初始长度近零（异常情况）时回退到 baseLen。
  {
    let k = 0
    for (const e of rawEdges) {
      if (e.isSelfLoop || e.fromId === e.toId) continue
      if (!idx.has(e.fromId) || !idx.has(e.toId)) continue
      const d = Math.hypot(nodes[springEdges[k].b].x - nodes[springEdges[k].a].x,
                           nodes[springEdges[k].b].y - nodes[springEdges[k].a].y)
      const perAction = scaleOf.get(e.actionElementId) ?? 1
      springEdges[k].restBase = (d > 1e-3 ? d : baseLen) * perAction
      k++
    }
  }
  // 初始静止长度快照（resetShape 用）：塑性会改写 restBase（拖拽探索新形状），
  // 「Re-settle = 回到给定形状」需要这份原始记录
  const initialRestBase: number[] = springEdges.map(se => se.restBase)

  const avgDegree = n > 0 ? (springEdges.length * 2) / n : 1
  const idealDist = baseLen * 1.0 / Math.sqrt(Math.max(1, avgDegree))
  const minSep = options.minSeparation ?? idealDist * 0.85

  // 可调参数（setOptions 就地更新 → applyParams 重算派生量，不重建模拟器）
  const params = {
    repulsion: options.repulsion ?? 1,
    linkScale: options.linkScale ?? 1,
    gravity: options.gravity ?? 1,
    damping: options.damping ?? 0.75,
    stiffness: options.stiffness ?? 1,
  }
  let kSpringBase = 0
  let repK = 0
  let gravK = 0
  let damping = params.damping
  function applyParams(): void {
    kSpringBase = 0.28 * params.stiffness
    repK = idealDist * idealDist * 0.55 * params.repulsion
    // 向心重力按 n² 归一：环状布局的向心收缩 δ/R = gravK·n² / (4·k·sin²(π/n)) ≈
    // gravK·n² / 11 —— 取 gravK = 0.3/n² 使收缩恒 ≈ 2.7% 半径，与群阶无关。
    // （固定常数在大群上会压塌整张图：弹簧抵抗力 ∝ 1/n²，重力 ∝ R ∝ n）
    gravK = params.gravity * (0.3 / Math.max(1, n * n))
    damping = params.damping
    for (const se of springEdges) se.rest = se.restBase * params.linkScale
  }
  applyParams()

  let alpha = options.initialAlpha ?? 0
  /** 拖拽期间 >0（DRAG_ALPHA），松手归零：热度向目标松弛而非纯衰减 */
  let alphaTarget = 0
  /** 拖拽中的弹簧刚度增强（pin 时 ×DRAG_STIFF_BOOST，unpin 恢复） */
  let stiffBoost = 1
  /** **塑性窗口**：pin 开启；unpin 后保持（冷却期继续塑性定影），
   *  热度冷却到 PLASTIC_END_ALPHA 以下自动关闭；settle/setOptions 强制关闭
   *  （这两个流程的收敛目标就是当前 rest，绝不能在收敛中改写 rest） */
  let plastic = false

  function stepOnce(): boolean {
    const a = alpha
    const kSpring = kSpringBase * stiffBoost

    // 斥力（× alpha；O(n²)，n ≤ 120 的 2D 窗口足够）
    for (let i = 0; i < n; i++) {
      const ni = nodes[i]
      for (let j = i + 1; j < n; j++) {
        const nj = nodes[j]
        let dx = ni.x - nj.x
        let dy = ni.y - nj.y
        let d2 = dx * dx + dy * dy
        if (d2 < 1e-6) {
          // 重合点：注入确定性伪随机方向，避免斥力失效
          const ang = (((i * 127 + j * 311) % 1000) / 1000) * Math.PI * 2
          dx = Math.cos(ang) * 1e-3
          dy = Math.sin(ang) * 1e-3
          d2 = 1e-6
        }
        const d = Math.sqrt(d2)
        // 平滑淡出：2.5–3.5×理想间距间 smoothstep → 0。
        // 硬截断会在节点跨越边界时注入能量（力突然消失/出现）→ 远端漂移与纠缠
        const x = d / idealDist
        if (x >= REP_FADE_END) continue
        let fade = 1
        if (x > REP_FADE_START) {
          const t = (x - REP_FADE_START) / (REP_FADE_END - REP_FADE_START)
          fade = 1 - t * t * (3 - 2 * t)
        }
        const f = (repK / d2) * fade * a
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        ni.vx += fx
        ni.vy += fy
        nj.vx -= fx
        nj.vy -= fy
      }
    }

    // 弹簧（× alpha）
    for (const se of springEdges) {
      const a1 = nodes[se.a]
      const b1 = nodes[se.b]
      const dx = b1.x - a1.x
      const dy = b1.y - a1.y
      const d = Math.hypot(dx, dy) || 1e-3
      const f = (d - se.rest) * kSpring * a
      const ux = dx / d
      const uy = dy / d
      a1.vx += ux * f
      a1.vy += uy * f
      b1.vx -= ux * f
      b1.vy -= uy * f
    }

    // 塑性（仅塑性窗口内）：弹簧静止长度向当前实际长度迁移。
    // 拖过的边 rest 跟上位移 → 形状被"记住"，松手后停在新形状而不弹回初始布局
    // （探索新形状的核心机制）。restBase 记录几何形状（linkScale 作为全局倍率
    // 仍作用于塑性后的形状）；settle/参数收敛期间窗口关闭 ⇒ rest 不被改写
    if (plastic) {
      const invLink = 1 / (params.linkScale || 1)
      for (const se of springEdges) {
        const a1 = nodes[se.a]
        const b1 = nodes[se.b]
        const d = Math.hypot(b1.x - a1.x, b1.y - a1.y)
        se.restBase += (d * invLink - se.restBase) * PLASTIC_RATE
        se.rest = se.restBase * params.linkScale
      }
    }

    // 向心重力（× alpha；线性于到中心距离）
    for (let i = 0; i < n; i++) {
      const nd = nodes[i]
      nd.vx -= (nd.x - centerX) * gravK * a
      nd.vy -= (nd.y - centerY) * gravK * a
    }

    // 积分（d3 格式：速度衰减 → 限速 → 位置直接积分速度）。
    // 钉住节点位置由 pin 直接给定、速度清零
    const maxSpeed = 2 + a * 6
    for (let i = 0; i < n; i++) {
      const nd = nodes[i]
      if (nd.fixed) {
        nd.vx = 0
        nd.vy = 0
        continue
      }
      nd.vx *= damping
      nd.vy *= damping
      const speed = Math.hypot(nd.vx, nd.vy)
      if (speed > maxSpeed) {
        nd.vx = (nd.vx / speed) * maxSpeed
        nd.vy = (nd.vy / speed) * maxSpeed
      }
      nd.x += nd.vx
      nd.y += nd.vy
    }

    // 最小间距约束：过近的节点沿连线直接推开（低热度下纯力场推不开 → 视觉上"纠缠"）。
    // 被钉住的节点不动、由对方让位；两边都可动时各让一半
    for (let i = 0; i < n; i++) {
      const ni = nodes[i]
      for (let j = i + 1; j < n; j++) {
        const nj = nodes[j]
        if (ni.fixed && nj.fixed) continue
        let dx = nj.x - ni.x
        let dy = nj.y - ni.y
        let d = Math.hypot(dx, dy)
        if (d >= minSep) continue
        if (d < 1e-4) {
          // 完全重合：确定性方向兜底
          const ang = (((i * 127 + j * 311) % 1000) / 1000) * Math.PI * 2
          dx = Math.cos(ang)
          dy = Math.sin(ang)
          d = 1
        }
        const push = minSep - d
        const ux = dx / d
        const uy = dy / d
        if (ni.fixed) {
          nj.x += ux * push
          nj.y += uy * push
        } else if (nj.fixed) {
          ni.x -= ux * push
          ni.y -= uy * push
        } else {
          ni.x -= (ux * push) / 2
          ni.y -= (uy * push) / 2
          nj.x += (ux * push) / 2
          nj.y += (uy * push) / 2
        }
      }
    }

    // 边界钳制 + 同步到 positions（每帧统一一次；钉住的节点同样受画布边界约束）
    for (let i = 0; i < n; i++) {
      const nd = nodes[i]
      if (nd.x < pad) nd.x = pad
      else if (nd.x > width - pad) nd.x = width - pad
      if (nd.y < pad) nd.y = pad
      else if (nd.y > height - pad) nd.y = height - pad
      const p = positions.get(nd.id)!
      p.x = nd.x
      p.y = nd.y
    }

    // 热度向 alphaTarget 松弛：拖拽中恒热（长按持续松弛），松手自然冷却
    alpha += (alphaTarget - alpha) * ALPHA_DECAY
    // 塑性窗口自动关闭：松手后热度冷却到近静止 → 形状定影完成，图谱完全冻结
    if (plastic && alphaTarget === 0 && alpha <= PLASTIC_END_ALPHA) plastic = false
    return alpha > SETTLE_ALPHA
  }

  return {
    positions,
    step: stepOnce,
    pin(id, x, y) {
      const i = idx.get(id)
      if (i === undefined) return
      const nd = nodes[i]
      nd.fixed = true
      nd.x = x
      nd.y = y
      nd.vx = 0
      nd.vy = 0
      const p = positions.get(id)!
      p.x = x
      p.y = y
      // 拖拽热度：瞬时升到 DRAG_ALPHA（不要等松弛——否则拖拽开始时 alpha≈0、邻域不动），
      // 持续按住期间恒热；松手目标归零自然冷却
      alphaTarget = DRAG_ALPHA
      alpha = DRAG_ALPHA
      stiffBoost = DRAG_STIFF_BOOST
      // 开启塑性窗口：拖拽 + 随后的冷却期都迁移 rest（拖到哪记到哪）
      plastic = true
    },
    unpin(id) {
      const i = idx.get(id)
      if (i === undefined) return
      nodes[i].fixed = false
      // 松手：目标热度归零 → 从当前热度自然冷却，弹性回稳（轻微回弹，不重排）。
      // 塑性窗口保持开启，直到热度冷却到 PLASTIC_END_ALPHA 以下（stepOnce 自动关）——
      // 邻域回缩过程中 rest 同步定影，避免"冷却期的移动不被记忆 → 系统性弹回"
      alphaTarget = 0
      stiffBoost = 1
    },
    isPinned(id) {
      const i = idx.get(id)
      return i !== undefined && nodes[i].fixed
    },
    reheat(a = 0.8) {
      alpha = Math.max(alpha, a)
    },
    /**
     * **一次性投影到力平衡态**（Obsidian 风格激活）：
     * 启动 alpha=settleAlpha 跑 N 步，让图谱从装饰性静态布局松弛到最近的力平衡态，
     * 然后 alpha=0 冻结。per-edge rest 让平衡态 ≈ 原始布局的均匀化版本
     * （不塌成圆）。后续只有拖拽时 alphaTarget=DRAG_ALPHA 才临时解锁。
     */
    settle(steps = 200, settleAlpha = 0.3) {
      plastic = false
      alpha = settleAlpha
      alphaTarget = 0
      // 跑到热度自然冷却完（alpha ≤ SETTLE_ALPHA）为止 —— 步数下限只用于兜底。
      // 60 步只够小扰动（激活投影 ~4px）；大回归（resetRests 拉回 70px+）需要
      // 完整冷却期（0.3 → 0.005 约 85 帧）才能收敛到位
      for (let i = 0; i < steps; i++) {
        if (alpha <= SETTLE_ALPHA) break
        stepOnce()
      }
      // 归零速度（一次性投影结束），冻结位置
      for (const nd of nodes) { nd.vx = 0; nd.vy = 0 }
      alpha = 0
    },
    /** 硬重置回给定形状：位置 + rest 全部恢复初始（清除塑性记忆），即刻冻结 */
    resetShape() {
      if (options.initialPositions) {
        for (const nd of nodes) {
          const saved = options.initialPositions.get(nd.id)
          if (saved) {
            nd.x = saved.x
            nd.y = saved.y
            nd.vx = 0
            nd.vy = 0
          }
        }
        for (const nd of nodes) {
          const p = positions.get(nd.id)!
          p.x = nd.x
          p.y = nd.y
        }
      }
      springEdges.forEach((se, i) => { se.restBase = initialRestBase[i] })
      applyParams()
      plastic = false
      alphaTarget = 0
      alpha = 0
    },
    setOptions(opts) {
      if (opts.repulsion !== undefined) params.repulsion = opts.repulsion
      if (opts.linkScale !== undefined) params.linkScale = opts.linkScale
      if (opts.gravity !== undefined) params.gravity = opts.gravity
      if (opts.damping !== undefined) params.damping = opts.damping
      if (opts.stiffness !== undefined) params.stiffness = opts.stiffness
      applyParams()
      // 参数收敛期间关闭塑性窗口（收敛目标就是当前 rest，改写 rest 会破坏滑杆语义：
      // 调大 linkScale 再调回时图谱必须能回缩）
      plastic = false
      // 温和升温：参数变化平滑过渡到新均衡（位置/速度都保留 → 不会"稍微调一下形状就大变样"）
      alpha = Math.max(alpha, SET_OPTIONS_ALPHA)
    },
    get alpha() {
      return alpha
    },
    get settled() {
      return alpha <= SETTLE_ALPHA
    },
  }
}
