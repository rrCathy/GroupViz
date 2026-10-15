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
 *  取 3.4：默认相机（位置 [0,3,10]、fov 50）下锚点固定件完整入画（4.4 时顶端
 *  小球贴边裁切），且 720° 复原演练的公转轨道（半径 = 锚距，顶点 2×锚距）
 *  ~85% 在画面内（v2 的 6.3 让整个编舞发生在画面外，中段皮带完全不可见）。 */
export const BELT_ANCHOR_DIST = 3.4
/** 段数（stations = segments + 1） */
export const BELT_SEGMENTS = 64
/** 锚点端满宽（v4 加宽：0.55 与细轴标记重叠难分辨——用户 2026-10-15） */
export const BELT_WIDTH = 0.72
/** 一整扭 = 2π（复原演练的公转角度） */
export const BELT_FULL_TURN = Math.PI * 2
/** 复原演练一次解开的扭转量 = 两整扭（720°） */
export const BELT_RESTORE_AMOUNT = BELT_FULL_TURN * 2
/** 削尖：末段 TAPER_FRAC 内宽度线性收锥到 0 */
const TAPER_FRAC = 0.35
/** 固定端平直夹持区占比：扭转从这段之后才开始累（用户：扭转应分布在
 *  「几何体外」到「固定端前一些距离」之间——锚端留一小段不扭的夹持位） */
export const BELT_PIN_MARGIN = 0.06

/**
 * 扭转分布剖面：s ≤ 固定端夹持区 → 0；之后线性升到入体点（皮带进入
 * 四面体表面处，sEnter = 1 − bodyRadius/anchorDist）达 1；入体后恒 1
 * （物体端截面必须携带全扭转 τ——皮带粘在物体上）。
 */
export function beltTwistProfile(s: number, bodyRadius: number, anchorDist: number): number {
  const sEnter = bodyRadius > 0 ? Math.max(0.15, 1 - bodyRadius / anchorDist) : 1
  const denom = sEnter - BELT_PIN_MARGIN
  if (denom <= 1e-6) return s >= sEnter ? 1 : 0
  return Math.min(1, Math.max(0, (s - BELT_PIN_MARGIN) / denom))
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
  /** 所附几何（四面体）的外接圆半径：扭转分布收进「几何体外 → 固定端前」的
   *  可见段（入体点之后不再累扭）；0/缺省 = 不做入体收口（纯线性到尖端） */
  bodyRadius?: number
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

  // 复原演练的弓形参数（restoreT = 0 时不构造，常态路径零开销）
  const endPos = new THREE.Vector3()
  const ctrl = new THREE.Vector3()
  if (restoreT > 0) {
    const orbitAxis = new THREE.Vector3(...(input.restoreOrbitAxis ?? [0, 0, 1]))
    if (orbitAxis.lengthSq() < 1e-12) orbitAxis.set(0, 0, 1)
    orbitAxis.normalize()
    const bowDir = new THREE.Vector3(...(input.restoreBow ?? [0, 0, 1]))
    // 物体端绕锚点公转一整圈（起点/终点都在物体中心）
    endPos.copy(A).negate().applyQuaternion(_q.setFromAxisAngle(orbitAxis, BELT_FULL_TURN * restoreT)).add(A)
    const bowMag = anchorDist * 0.38 * Math.sin(Math.PI * restoreT)
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
  const bodyRadius = input.bodyRadius ?? 0
  let wPrev = 0
  for (let i = 0; i <= segments; i++) {
    const s = i / segments
    if (restoreT > 0) {
      quadBezier(A, ctrl, endPos, s, c)
      quadBezierTangent(A, ctrl, endPos, s, Ti)
      if (Ti.lengthSq() < 1e-12) Ti.copy(T)
      Ti.normalize()
    } else {
      c.copy(A).addScaledVector(T, anchorDist * s)
      Ti.copy(T)
    }
    // 扭转分布：固定端夹持区 0 → 线性升 → 入体点即满扭（增量 = 剖面差分）
    const w = beltTwistProfile(s, bodyRadius, anchorDist)
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
