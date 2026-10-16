import * as THREE from 'three'

/**
 * Dirac 开口皮带几何（纯函数，唯一真源；three 仅用纯数学）。
 *
 * v3（2026-10-15 晚，响应用户第二轮四条反馈）：
 * - **皮带与旋转轴同轴**：「旋转轴要经过皮带」——锚点 = 轴向 û 上距物体中心
 *   `BELT_ANCHOR_DIST` 处，皮带直躺在旋转轴上。锚点端是**扭转的固定参考端**
 *   （该端截面朝向恒为 W₀、扭转恒 0），但位置不钉死：换元素即随新轴重新对准
 *   （静息/零轴 → 竖直悬挂）。物体端截面随物体一起转动。
 * - **扭转 = 带面绕皮带自身中心线的翻转**（莫比乌斯式，v2 的螺旋甩线废弃）：
 *   中心线恒为直线（锚点→物体中心），宽度向量沿带递增旋转 φ(s) = −τ·s。
 *   物体绕 û 转 θ ⇒ 物体端截面随物体转，相对带轴 T = −û 恰扭转 −θ ⇒ τ = θ。
 *   带面几何对 4π 周期（τ=720° 与 τ=0 逐位同形——两整扭拓扑复原的几何表现）。
 * - **帧构造**：平行输运（切线最短弧旋转）+ 增量扭转。直线态输运为恒等 ⇒
 *   W(s) = R(T, −τ·s)·W₀（经典理发店柱）；复原曲线态沿 Bezier 平行输运，
 *   无参考轴翻转问题。
 * - **720° 复原演练**（restoreT > 0）：物体端脱离中心、绕锚点公转一圈（「绕过
 *   那个固定点」），带体弓形外鼓，扭转按 720° 递减；restoreT=0/1 与缠态/平直态
 *   两端连续。调用方传**未扣减**的累计 τ，扣减只在本模块做一次（v2 曾双重扣减）。
 * - **削尖**：带宽末段线性收锥到 0，尖端正落在旋转轴上。
 */

/** 锚距：锚点 = 当前旋转轴方向 û 上距物体中心这么远（皮带与轴同轴）。
 *  6.0：场景四面体外接半径是 4（直径 8）——可见段 = 6.0 − 轴出口半径 ≈ 3.7，
 *  与四面体直径相比不再是「一截」（v5 的 4.6 ⇒ 可见 2.3 = 直径的 29%，用户
 *  2026-10-16「皮带太短了」）。默认相机已退到 [0,4.5,15]（半高 ≈7.3）容纳之。
 *  复原公转轨道半径 = 带长，顶点略出画顶，可用滚轮缩放观看。 */
export const BELT_ANCHOR_DIST = 6.0
/** 段数（stations = segments + 1） */
export const BELT_SEGMENTS = 64
/** 锚点端满宽 */
export const BELT_WIDTH = 0.72
/** 一整扭 = 2π（复原演练的公转角度） */
export const BELT_FULL_TURN = Math.PI * 2
/** 复原演练一次解开的扭转量 = 两整扭（720°） */
export const BELT_RESTORE_AMOUNT = BELT_FULL_TURN * 2
/** 削尖：末段 TAPER_FRAC 内宽度线性收锥到 0（尖端整个可见，长锥显得刻意） */
const TAPER_FRAC = 0.22
/** 固定端平直夹持区占比：扭转从这段之后才开始累（销钉所在的「夹持位」） */
export const BELT_PIN_MARGIN = 0.06

/**
 * 扭转分布剖面：s ≤ 固定端夹持区 → 0；之后线性升到尖端（皮带整体在几何体外，
 *  扭转布满整条可见段）达 1。物体端截面必须携带全扭转 τ（皮带粘在物体上）。
 */
export function beltTwistProfile(s: number): number {
  return Math.min(1, Math.max(0, (s - BELT_PIN_MARGIN) / (1 - BELT_PIN_MARGIN)))
}

/**
 * 旋转轴 û 从几何中心到**表面**的出口距离（4 面平面求交，取沿 +û 最近的正交点）。
 * 皮带尖端应停在表面而不是中心——v4 尖端在中心，大半长度插在四面体内部，
 * 外面只露一截（用户 2026-10-16「皮带太短」）。vertices = 四面体 4 顶点。
 */
export function beltExitRadius(axis: [number, number, number], vertices: Array<[number, number, number]>): number {
  const u = new THREE.Vector3(...axis)
  if (u.lengthSq() < 1e-12) u.set(0, 1, 0)
  u.normalize()
  const fallback = vertices.length > 0
    ? Math.max(...vertices.map(v => new THREE.Vector3(...v).length()))
    : 0
  if (vertices.length !== 4) return fallback
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const n = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3()
  let best = Infinity
  for (const [i, j, k] of [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]] as [number, number, number][]) {
    a.set(...vertices[i]!); b.set(...vertices[j]!); c.set(...vertices[k]!)
    ab.copy(b).sub(a); ac.copy(c).sub(a)
    n.copy(ab).cross(ac) // 法向朝内/朝外无所谓：t = d/(n·û) 两侧同号相消
    if (n.lengthSq() < 1e-12) continue
    n.normalize()
    const nu = n.dot(u)
    if (Math.abs(nu) < 1e-9) continue
    const t = n.dot(a) / nu
    if (t > 1e-6 && t < best) best = t
  }
  return Number.isFinite(best) ? best : fallback
}

export interface BeltStation {
  /** 带中心线 */
  cx: number; cy: number; cz: number
  /** 两侧边缘点（已含扭转后的带面朝向；正反面 = 两侧三角面片） */
  e1: [number, number, number]
  e2: [number, number, number]
}

export interface BeltGeometryInput {
  /** 累计扭转（弧度，正标量；Σ 2ψ。复原演练的 720° 递减在本模块内做） */
  tau: number
  /** 当前旋转轴（世界系；当前演示元素的旋转轴）。null/零向量 → 竖直 (0,1,0) */
  axis: [number, number, number] | null
  anchorDist?: number
  segments?: number
  /** 尖端停靠半径：几何表面沿轴的出口距离（beltExitRadius 算）——皮带尖端
   *  停在物体表面而不是中心（v4 尖端在中心 ⇒ 大半长度插在体内，2026-10-16 修）。
   *  0/缺省 = 尖端在物体中心（legacy） */
  attachRadius?: number
  /** 复原演练进度 0..1；> 0 时物体端绕锚点公转、带体弓形外鼓、扭转按 720° 递减 */
  restoreT?: number
  /** 复原演练：公转轴（世界系；调用方按当前相机可视方向给出） */
  restoreOrbitAxis?: [number, number, number]
  /** 复原演练：弓起方向（世界系；通常朝相机） */
  restoreBow?: [number, number, number]
}

/** 宽度轮廓：锚点端满宽 → 物体端削尖为 0 */
export const beltTaper = (s: number): number => Math.min(1, Math.max(0, (1 - s) / TAPER_FRAC))

const _q = new THREE.Quaternion()

/** 二次 Bezier（A → ctrl → E）*/
function quadBezier(a: THREE.Vector3, ctrl: THREE.Vector3, e: THREE.Vector3, s: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - s
  return out.set(
    u * u * a.x + 2 * u * s * ctrl.x + s * s * e.x,
    u * u * a.y + 2 * u * s * ctrl.y + s * s * e.y,
    u * u * a.z + 2 * u * s * ctrl.z + s * s * e.z,
  )
}

/** 二次 Bezier 切线 +B'(s) = 2(1−s)(C−A) + 2s(E−C)：锚点(s=0)→物体端(s=1) 行进方向 */
function quadBezierTangent(a: THREE.Vector3, ctrl: THREE.Vector3, e: THREE.Vector3, s: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - s
  return out.set(
    2 * u * (ctrl.x - a.x) + 2 * s * (e.x - ctrl.x),
    2 * u * (ctrl.y - a.y) + 2 * s * (e.y - ctrl.y),
    2 * u * (ctrl.z - a.z) + 2 * s * (e.z - ctrl.z),
  )
}

/**
 * 计算皮带的全部站点（中心线 + 两边缘点）。
 *
 * 常态（restoreT = 0）：中心线 = 锚点 A = û·L 到物体中心的直线段；宽向量绕
 * 带轴 T = −û 递增扭转 φ(s) = −τ·s（带面绕自身中心线翻转，中心线不动）。
 * 复原演练（restoreT > 0）：中心线 = 弓形 Bezier（物体端绕锚点公转一圈），
 * 扭转量 = max(0, τ − 720°·restoreT)，帧沿曲线平行输运 + 同一扭转规律。
 */
export function beltStations(input: BeltGeometryInput): BeltStation[] {
  const anchorDist = input.anchorDist ?? BELT_ANCHOR_DIST
  const segments = input.segments ?? BELT_SEGMENTS
  const restoreT = Math.min(1, Math.max(0, input.restoreT ?? 0))
  // 有效扭转：复原演练按 720° 递减（调用方传未扣减的累计 τ，扣减只在这里做一次）
  const tauEff = Math.max(0, input.tau - BELT_RESTORE_AMOUNT * restoreT)

  // 轴与锚点：皮带与旋转轴同轴（锚点在 +û 方向距中心 anchorDist 处）
  const axis = new THREE.Vector3(0, 1, 0)
  if (input.axis) {
    const [ax, ay, az] = input.axis
    if (ax * ax + ay * ay + az * az > 1e-12) axis.set(ax, ay, az).normalize()
  }
  const T = axis.clone().negate() // 锚点→物体方向
  const A = axis.clone().multiplyScalar(anchorDist)
  // 尖端停靠点 = 轴上几何表面（û·attachRadius）——皮带端点贴在物体表面，
  // 不再插进几何体内（v4 尖端在中心 ⇒ 可见段只剩一截，2026-10-16 修）
  const attachR = Math.min(input.attachRadius ?? 0, anchorDist - 0.05)
  const attach = axis.clone().multiplyScalar(attachR)
  const beltLen = anchorDist - attachR

  // 复原演练的弓形参数（restoreT = 0 时不构造，常态路径零开销）
  const endPos = new THREE.Vector3()
  const ctrl = new THREE.Vector3()
  if (restoreT > 0) {
    const orbitAxis = new THREE.Vector3(...(input.restoreOrbitAxis ?? [0, 0, 1]))
    if (orbitAxis.lengthSq() < 1e-12) orbitAxis.set(0, 0, 1)
    orbitAxis.normalize()
    const bowDir = new THREE.Vector3(...(input.restoreBow ?? [0, 0, 1]))
    // 物体端（= 尖端停靠点）绕锚点公转一整圈（起点/终点都在停靠点）
    endPos.copy(attach).sub(A).applyQuaternion(_q.setFromAxisAngle(orbitAxis, BELT_FULL_TURN * restoreT)).add(A)
    const bowMag = beltLen * 0.38 * Math.sin(Math.PI * restoreT)
    ctrl.copy(A).add(endPos).multiplyScalar(0.5).addScaledVector(bowDir, bowMag)
  }

  // 锚点端参考宽向 W₀：与 s=0 处切线垂直，带面法向 T×W₀ ≈ +Z（默认相机正面可见）。
  // 该方向只由初始切线决定（确定性）⇒ 锚点端截面朝向恒定——「固定端」的几何语义。
  // 复原演练时初始切线 = Bezier B'(0)（≠ 直线方向），宽向随之对齐，垂直性全程成立。
  const T0 = new THREE.Vector3()
  if (restoreT > 0) {
    quadBezierTangent(A, ctrl, endPos, 0, T0)
    if (T0.lengthSq() < 1e-12) T0.copy(T)
    T0.normalize()
  } else {
    T0.copy(T)
  }
  const ref = new THREE.Vector3(0, 0, 1)
  if (Math.abs(T0.z) >= 0.9) ref.set(1, 0, 0)
  const W = new THREE.Vector3().crossVectors(ref, T0)
  if (W.lengthSq() < 1e-9) W.set(1, 0, 0)
  W.normalize()

  const stations: BeltStation[] = []
  const c = new THREE.Vector3()
  const Ti = new THREE.Vector3()
  const Tprev = new THREE.Vector3()
  let wPrev = 0
  for (let i = 0; i <= segments; i++) {
    const s = i / segments
    if (restoreT > 0) {
      quadBezier(A, ctrl, endPos, s, c)
      quadBezierTangent(A, ctrl, endPos, s, Ti)
      if (Ti.lengthSq() < 1e-12) Ti.copy(T)
      Ti.normalize()
    } else {
      c.copy(A).addScaledVector(T, beltLen * s)
      Ti.copy(T)
    }
    // 扭转分布：固定端夹持区 0 → 线性升 → 尖端满扭（增量 = 剖面差分）
    const w = beltTwistProfile(s)
    if (i > 0) {
      // 平行输运：宽向量按切线最短弧转到新切线（直线态 = 恒等，无翻转问题）
      _q.setFromUnitVectors(Tprev, Ti)
      W.applyQuaternion(_q)
      // 增量扭转：物体端截面随物体转动 ⇒ 绕带轴 T 的累计扭转 −τ_eff·w(s)
      _q.setFromAxisAngle(Ti, -tauEff * (w - wPrev))
      W.applyQuaternion(_q)
    }
    wPrev = w
    Tprev.copy(Ti)
    const halfW = (BELT_WIDTH * beltTaper(s)) / 2
    stations.push({
      cx: c.x, cy: c.y, cz: c.z,
      e1: [c.x + W.x * halfW, c.y + W.y * halfW, c.z + W.z * halfW],
      e2: [c.x - W.x * halfW, c.y - W.y * halfW, c.z - W.z * halfW],
    })
  }
  return stations
}

/** 由当前相机推复原演练的可视方向：公转轴 + 弓起方向（都水平化）。
 *  公转平面 = 竖直 × 相机右方 ⇒ 默认视角下正面可见；弓起朝相机。 */
export function beltRestoreDirections(camera: THREE.Camera): { orbitAxis: [number, number, number]; bow: [number, number, number] } {
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
  right.y = 0
  if (right.lengthSq() < 1e-6) right.set(0, 0, 1) // 顶视退化兜底
  right.normalize()
  const orbitAxis = new THREE.Vector3().crossVectors(right, new THREE.Vector3(0, 1, 0)).normalize()
  return { orbitAxis: [orbitAxis.x, orbitAxis.y, orbitAxis.z], bow: [right.x, right.y, right.z] }
}

/** 是否够两整扭（720°）可以演示复位——单整扭拓扑上不可消（皮带戏法核心）。
 *  ViewPanel / ViewParamsPanel 的按钮门控共用此口径。 */
export function canDemoBeltRestore(tau: number): boolean {
  return tau >= BELT_RESTORE_AMOUNT - 1e-6
}

/** 调试/测试辅助：站点序列 → 平面数组（断言用） */
export function beltStationsFlat(stations: BeltStation[]): number[] {
  const out: number[] = []
  for (const st of stations) out.push(st.cx, st.cy, st.cz, st.e1[0], st.e1[1], st.e1[2], st.e2[0], st.e2[1], st.e2[2])
  return out
}
