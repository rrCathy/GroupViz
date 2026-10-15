import * as THREE from 'three'

/**
 * Dirac 开口皮带几何（纯函数，唯一真源；three 仅用纯数学）。
 *
 * v2（2026-10-15，响应用户四条反馈中的 2/3/4）：
 * - **扭转轴 = 当前演示元素的旋转轴**（与正四面体同轴）——旧实现钉在世界竖轴，
 *   物体绕水平轴明显横转时皮带却绕竖轴扭，「完全不搭」。绕轴旋转同时作用于
 *   中心线（竖轴扭 = 经典理发店柱；水平轴扭 = 带体绕轴缠绕）与带面朝向。
 * - **物体端削尖**：带宽在末段线性收锥到 0，尖端正落在旋转轴（物体中心）上。
 * - **720° 复原演练**（`restoreT` > 0）：物体端脱离中心、绕**世界锚点**公转一圈
 *   （「绕过那个固定点」），带体弓形外鼓，扭转按 720° 递减——展示两整扭如何在
 *   三维空间里被解开，而不是旧实现的 `mod 720°` 直接跳平。
 *
 * 锚点 (0, anchorY, 0) 为世界固定端（扭转为 0）；物体端在中心（携带全扭转）。
 */

/** 默认锚点高度（世界竖轴） */
export const BELT_ANCHOR_Y = 6.3
/** 段数（stations = segments + 1） */
export const BELT_SEGMENTS = 64
/** 锚点端满宽 */
export const BELT_WIDTH = 0.55
/** 扭转沿带分布轮廓：s < WIND_START 不扭，之后 smoothstep 到物体端满扭 */
const WIND_START = 0.45
/** 削尖：末段 TAPER_FRAC 内宽度线性收锥到 0 */
const TAPER_FRAC = 0.35
/** 一整扭 = 2π；复原演练一次解开两整扭（720°） */
export const BELT_FULL_TURN = Math.PI * 2
/** 复原演练解开量（弧度） */
export const BELT_RESTORE_AMOUNT = BELT_FULL_TURN * 2

export interface BeltStation {
  /** 带中心线 */
  cx: number; cy: number; cz: number
  /** 两侧边缘点（已含扭转后的带面朝向） */
  e1: [number, number, number]
  e2: [number, number, number]
  /** 条纹色号（沿带每 8 站交替明暗，让扭转圈数可读） */
  stripe: 0 | 1
}

export interface BeltGeometryInput {
  /** 累计扭转（弧度，正标量；Σ 2ψ） */
  tau: number
  /** 扭转轴（单位向量；当前演示元素的旋转轴，与物体同轴） */
  axis: [number, number, number]
  anchorY?: number
  segments?: number
  /** 复原演练进度 0..1；> 0 时带体弓形外鼓、扭转按 720° 递减、物体端绕锚点公转 */
  restoreT?: number
  /** 复原演练：公转轴（水平单位向量；调用方按当前相机可视方向给出） */
  restoreOrbitAxis?: [number, number, number]
  /** 复原演练：弓起方向（水平单位向量；通常朝相机） */
  restoreBow?: [number, number, number]
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 扭转分布轮廓：锚点端 0 → 物体端 1 */
export const beltWindProfile = (s: number): number => smoothstep(WIND_START, 1, s)

/** 宽度轮廓：锚点端满宽 → 物体端削尖为 0 */
export const beltTaper = (s: number): number => Math.min(1, Math.max(0, (1 - s) / TAPER_FRAC))

const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _t = new THREE.Vector3()
const _n = new THREE.Vector3()
const _b = new THREE.Vector3()

/** 绕 axis（过原点）旋转 pt（就地修改并返回） */
function rotateAroundAxis(axis: THREE.Vector3, angle: number, pt: THREE.Vector3): THREE.Vector3 {
  if (angle === 0) return pt
  _q.setFromAxisAngle(axis, angle)
  return pt.applyQuaternion(_q)
}

/** 二次 Bezier（A → ctrl → E）*/
function quadBezier(a: THREE.Vector3, ctrl: THREE.Vector3, e: THREE.Vector3, s: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - s
  return out.set(
    u * u * a.x + 2 * u * s * ctrl.x + s * s * e.x,
    u * u * a.y + 2 * u * s * ctrl.y + s * s * e.y,
    u * u * a.z + 2 * u * s * ctrl.z + s * s * e.z,
  )
}

/**
 * 计算皮带的全部站点（中心线 + 两边缘 + 条纹号）。
 *
 * 常态（restoreT = 0）：站点静止位形（锚点→中心的竖线）按 `axis` 绕原点旋转
 * `tau·windProfile(s)`——中心线与带面朝向一起被「缠」到旋转轴上。
 * 复原演练（restoreT > 0）：中心线 = 缠态与「弓形 Bezier（物体端绕锚点公转）」的
 * 混合，扭转量 = max(0, tau − 720°·restoreT)；带面朝向从「缠态携带帧」混合到
 * 「沿切线扭转帧」，t→1 时收敛为平直无扭（两端连续，无跳变）。
 */
export function beltStations(input: BeltGeometryInput): BeltStation[] {
  const anchorY = input.anchorY ?? BELT_ANCHOR_Y
  const segments = input.segments ?? BELT_SEGMENTS
  const tau = input.tau
  // axis 是普通三元组（不是 Vector3）——必须 set 而非 copy
  const axis = _v.set(input.axis[0], input.axis[1], input.axis[2])
  if (axis.lengthSq() < 1e-12) axis.set(0, 1, 0)
  axis.normalize()
  const restoreT = Math.min(1, Math.max(0, input.restoreT ?? 0))
  const tauEff = Math.max(0, tau - BELT_RESTORE_AMOUNT * restoreT)

  // 复原演练的弓形参数（restoreT = 0 时不算，保持常态路径零开销）
  // 注意：A/O/endPos/ctrl 用独立向量，不能占用模块 scratch（循环内 scratch 会被反复覆写）
  const A = new THREE.Vector3(0, anchorY, 0)
  const O = new THREE.Vector3(0, 0, 0)
  const orbitAxis = new THREE.Vector3(...(input.restoreOrbitAxis ?? [0, 0, 1]))
  const bowDir = new THREE.Vector3(...(input.restoreBow ?? [0, 0, 1]))
  const endPos = new THREE.Vector3()
  const ctrl = new THREE.Vector3()
  if (restoreT > 0) {
    // 物体端绕锚点公转一整圈（2π·restoreT），起点/终点都在中心
    endPos.copy(O).sub(A).applyQuaternion(_q.setFromAxisAngle(orbitAxis, BELT_FULL_TURN * restoreT)).add(A)
    const bowMag = anchorY * 0.38 * Math.sin(Math.PI * restoreT)
    ctrl.copy(A).add(endPos).multiplyScalar(0.5).addScaledVector(bowDir, bowMag)
  }

  // 静止位形的带宽方向（与竖带垂直 ⇒ 带面朝 ±Z，默认相机正面可见）
  const restDir = new THREE.Vector3(1, 0, 0)
  const carried = new THREE.Vector3()
  const center = new THREE.Vector3()
  const woundCenter = new THREE.Vector3()
  const bezCenter = new THREE.Vector3()
  const tangent = new THREE.Vector3()
  const frameDir = new THREE.Vector3()
  const e1 = new THREE.Vector3()
  const e2 = new THREE.Vector3()

  const stations: BeltStation[] = []
  for (let i = 0; i <= segments; i++) {
    const s = i / segments
    const w = beltWindProfile(s)
    const ang = tau * w
    // 静止位形：锚点(s=0) → 中心(s=1)
    const restY = anchorY * (1 - s)
    woundCenter.set(0, restY, 0)
    rotateAroundAxis(axis, ang, woundCenter)
    carried.copy(restDir)
    rotateAroundAxis(axis, ang, carried)

    if (restoreT > 0) {
      quadBezier(A, ctrl, endPos, s, bezCenter)
      // 中心线混合：缠态 → 弓形（t=0 即缠态，连续）
      center.copy(woundCenter).lerp(bezCenter, restoreT)
      // 切线 = +B'(s)：Bezier 参数化方向即「锚点(s=0) → 物体端(s=1)」的行进方向，
      // 两种 restoreT 下都一致（t=1 时 endPos=中心，B'(0) 天然向下；曾误加 negate
      // 把 t=1 的切线翻朝上，导致尖端帧翻转、无法与平直带重合）
      tangent.copy(ctrl).sub(A).multiplyScalar(2 * (1 - s)).addScaledVector(_v2.copy(endPos).sub(ctrl), 2 * s)
      if (tangent.lengthSq() < 1e-12) tangent.set(0, -1, 0)
      tangent.normalize()
      // 沿切线扭转帧：宽度基向 W = normalize(cross(ref, T))——ref 取与切线最不平行的
      // 坐标轴；竖切线(ref=(0,0,1)) 时 W=(1,0,0)，与静止位形带宽方向一致（phi=0 复位）。
      // N = cross(W, T)：与缠态携带帧（R(axis,ang)·restDir）同手性——竖轴上
      // (cos φ, 0, −sin φ) 两者逐位一致，演练过程中扭转-handedness 不翻面。
      const ref = Math.abs(tangent.z) < 0.9 ? _n.set(0, 0, 1) : _n.set(1, 0, 0)
      _b.crossVectors(ref, tangent)
      if (_b.lengthSq() < 1e-12) _b.set(1, 0, 0)
      _b.normalize()
      _t.crossVectors(_b, tangent).normalize()
      const phi = tauEff * w
      frameDir.copy(_b).multiplyScalar(Math.cos(phi)).addScaledVector(_t, Math.sin(phi))
      // 与缠态携带帧混合（restoreT=0 时即携带帧）
      frameDir.lerp(carried, 1 - restoreT)
      if (frameDir.lengthSq() < 1e-12) frameDir.copy(carried)
      frameDir.normalize()
    } else {
      center.copy(woundCenter)
      frameDir.copy(carried)
    }

    const halfW = (BELT_WIDTH * beltTaper(s)) / 2
    e1.copy(center).addScaledVector(frameDir, halfW)
    e2.copy(center).addScaledVector(frameDir, -halfW)
    stations.push({
      cx: center.x, cy: center.y, cz: center.z,
      e1: [e1.x, e1.y, e1.z],
      e2: [e2.x, e2.y, e2.z],
      stripe: (Math.floor(s * 8) % 2) as 0 | 1,
    })
  }
  return stations
}

/** 由当前相机推复原演练的可视方向：公转轴 + 弓起方向（都水平化）。
 *  公转平面 = 竖直 × 相机右方 ⇒ 默认视角下正面可见；弓起朝相机。 */
export function beltRestoreDirections(camera: THREE.Camera): { orbitAxis: [number, number, number]; bow: [number, number, number] } {
  const right = _v.setFromMatrixColumn(camera.matrix, 0).clone()
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
