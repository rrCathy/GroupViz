import * as THREE from 'three'

/**
 * Dirac 开口皮带几何（纯函数，唯一真源；three 仅用纯数学）。
 *
 * v7（2026-10-17，用户第四轮反馈：长度 / 尖端 / 复位机制 / 两端平直区；v7.1 修锯齿，
 * v8 复原改 Egan 编舞）：
 * - **两端固定**（参考 Greg Egan 的 Dirac 皮带戏法 applet 与数学笔记）：皮带任意时刻
 *   就是 SO(3) 里的一条路径（各截面的累计旋转）；两整扭是一条**两次穿过旋转球直径**
 *   的闭路径 ⇒ 可缩成一点。收缩过程皮带材料被搬运/剪切，**不是**「物体边转边解」。
 *   ⇒ 复原演练的中心线**恒为直线**（v6 的物体端绕锚公转已删除），两端截面全程冻结。
 * - **复原 = Egan 编舞移植（v8→v9，用户 2026-10-17「皮带要拉伸穿过一端」+「不要管四面体…当
 *   正四面体不存在（反正四面体可以缩小）」+ 逐帧核对 DiracAnimation.gif / Dirac.js 源码）**：
 *   两端（锚点与四面体）位置与朝向全程固定；皮带**中段沿轴向越过尖端鼓出大环**
 *   （λ=0.5 环鼻到 −û·2.1，四面体在环嘴内——场景侧演练期间把四面体缩到 0.12 倍，
 *   见 SymmetryViewScene；v8 曾用 ±0.42 支链分裂+环鼻 8.2 来避开全尺寸四面体——那两项
 *   本身是自交与尖点的来源，v9 移除），同时中段截面的旋转轴从 D（锚→尖端）摆到
 *   −D（对跖点）——两整扭在摆动完成时恰好消掉。
 *   **λ=0 与常态逐位一致、λ=1 = 残留态、端截面钉死——均已逐项验证（见时间轴注释）**。
 *   皮带材料被拉伸（Egan：材料经受拉伸与剪切，stretching and shearing；弧长重采样
 *   保证拉伸后每单位弧长站密度均匀）。
 *   中心线公式与编舞细节见 centerAt 注释（v9：三项取自 Dirac.js 逐项对齐）。
 * - **两端平直区（率 0）**：固定端夹持区 30%（v6 起），活动端尖端最后 12% 扭转率
 *   也是 0（用户 2026-10-17 点0「尖端不要扭转」——箭头/梯形尖端处静态可读）。
 *   注意语义：平直区是**扭转率 0**（截面平行），不是累计回零——尖端粘在物体上，
 *   必须携带全部 τ（v7.1：初版误把累计在尖端降回 0，扭转全挤进两条窄坡道成锯齿）。
 * - **梯形尖端**：带宽末 22% 由满宽线性收到 `BELT_TIP_WIDTH_RATIO`（不再是尖点），
 *   端面是一小段平行边（用户「弄成一个梯形」）。
 * - 锚距 7.5 → **11.25**（+50%，用户「还是太短」）；默认相机 [0,5.2,18] → [0,7.5,26]。
 * - 站点法向 n = T×W（厚板几何 + 固定端三棒架 + 尖端箭头都用它）。
 *
 * 历史（保留要点）：
 * - v3 皮带与旋转轴同轴：锚点 = û·L，锚端 = 扭转固定参考端（截面朝向恒为 W₀）。
 * - v5 尖端停在几何表面（`beltExitRadius`），不再插进几何体内。
 * - v6 厚板渲染 / 三垂直棒固定端 / 锚端帧冻结（复原演练中两端都不动）。
 */

/** 锚距：锚点 = 当前旋转轴方向 û 上距物体中心这么远（皮带与轴同轴）。
 *  11.25（v7：7.5 × 1.5，用户 2026-10-17「再加长 50%」）——可见段 ≈ 11.25 − 出口半径
 *  （≈2.31 面方向）≈ 8.9 ≈ 四面体直径的 1.9 倍。默认相机 [0,7.5,26]（半高 ≈12.1）。 */
export const BELT_ANCHOR_DIST = 11.25
/** 段数（stations = segments + 1）。288（v8.1：复原环把材料拉长 ~2.5×，均匀弧长
 *  重采样后环区每单位弧长的站密度仍要够——192 段在环区等效 0.12/单位，转弯处
 *  出棱；288 → 0.08。常态下弧长重采样退化为均匀，288 比 192 更平滑无副作用） */
export const BELT_SEGMENTS = 288
/** 锚点端满宽 */
export const BELT_WIDTH = 0.72
/** 皮带厚度（v6：厚板渲染，不再是零厚度带面）——0.12 = 带宽的 1/6 */
export const BELT_THICKNESS = 0.12
/** 一整扭 = 2π（一个折角的扭转量；复原演练摆动参数） */
export const BELT_FULL_TURN = Math.PI * 2
/** 复原演练一次解开的扭转量 = 两整扭（720°） */
export const BELT_RESTORE_AMOUNT = BELT_FULL_TURN * 2
/** 收窄段占全长比例：末段由满宽线性收到 TIP_WIDTH_RATIO（梯形） */
const TAPER_FRAC = 0.22
/** 活动端（尖端）保留宽度比例——用户 2026-10-17：弄成梯形，不要尖点 */
export const BELT_TIP_WIDTH_RATIO = 0.62
/** 固定端平直夹持区占比：扭转从这段之后才开始累（销钉/三棒架所在的「夹持位」）。
 *  0.3：v6 从 0.06 提高——用户「扭转几乎扭到固定的一端了，这样看不清」。 */
export const BELT_PIN_MARGIN = 0.3
/** 活动端平直区占比（v7）：最后 12% 扭转率为 0——箭头与梯形尖端处静态可读 */
export const BELT_TIP_MARGIN = 0.12

/** 复原演练中四面体的缩小下限（倍率）。用户 2026-10-17「不要管四面体…当正四面体不存在
 *  （反正正四面体可以缩小）」：v9 编舞按 Egan 原样移植（环境里没有障碍物），四面体由
 *  场景侧在演练期间缩小避让、结束后原样长回。0.12 使整个四面体（外接半经 4→0.48）
 *  能塞进环嘴且不碰任何支链；太小的值会缩到几乎不可见。 */
export const BELT_RESTORE_SHRINK_MIN = 0.12

/** 四面体在演练中的缩放脉冲（1=原大，BELT_RESTORE_SHRINK_MIN=完全缩小）：
 *  环鼻沿轴越过四面体原大表面的时刻由 X 项几何决定 ≈ λ=0.25（（0.5+par)·bell = bell+attachR
 *  的解）；**缩小必须在 λ=0.25 前完成**（在 λ=0.25 达到下限，之后保持），回长窗口开关在收尾
 *  段（λ≥0.78 开始，λ=1 原大）——环鼻在 λ≈0.75 重新接近表面，与窗口平滑衔接。
 *  两端 sin² 包络 ⇒ 速度连续、无突跳，且 restoreT=0/1 处与原大逐位一致。 */
export function beltTetraShrink(restoreT: number): number {
  const t = clamp01(restoreT)
  const tiny = (u: number): number => Math.sin(Math.min(1, Math.max(0, u)) * Math.PI / 2) ** 2
  const e = Math.min(tiny(t / 0.25), t < 0.78 ? 1 : tiny((1 - t) / 0.22))
  return 1 - (1 - BELT_RESTORE_SHRINK_MIN) * e
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))

/**
 * 扭转分布剖面（**累计比例**：剖面值 = 该站截面累计扭转占 τ 的比例）：
 *   [0, 0.30] 固定端夹持区 → 0；[0.30, 0.88] 平滑升到 1；[0.88, 1] 活动端平直区
 *   **保持 1**（扭转率 0——截面互相平行，箭头/梯形尖端处静态可读）。
 * 语义（v7.1 修正）：「尖端不要扭转」（用户 2026-10-17 点0）指尖端区**不再继续扭**
 * （率 0），不是累计回零——尖端粘在物体上，必须携带全部 τ。v7 初版误用
 * min(up, down) 让累计在尖端降回 0：全部扭转被挤进两条 10% 的窄坡道（720° 时
 * 相邻站 ~113°）渲染成锯齿、且尖端与物体错扭（用户截图「扭转错啦」抓回）。
 * 单坡道后 720° 相邻站峰值 ~10°（192 段）。
 */
export function beltTwistProfile(s: number): number {
  const u = clamp01((s - BELT_PIN_MARGIN) / (1 - BELT_TIP_MARGIN - BELT_PIN_MARGIN))
  return u * u * (3 - 2 * u)
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
  /** 带面法向（单位，= 切线 × 宽向；厚度几何、箭头、三棒架都用它） */
  n: [number, number, number]
}

export interface BeltGeometryInput {
  /** 累计扭转（弧度，正标量；Σ 2ψ。常态下整条按 beltTwistProfile 分布） */
  tau: number
  /** 当前旋转轴（世界系；当前演示元素的旋转轴）。null/零向量 → 竖直 (0,1,0) */
  axis: [number, number, number] | null
  anchorDist?: number
  segments?: number
  /** 尖端停靠半径：几何表面沿轴的出口距离（beltExitRadius 算）——皮带尖端
   *  停在物体表面而不是中心。0/缺省 = 尖端在物体中心（legacy） */
  attachRadius?: number
  /** 复原演练进度 0..1（两端固定；中段沿轴鼓环越过物体端，Egan 编舞） */
  restoreT?: number
  /** 复原演练：中段旋转轴从 û 摆到 −û 时经过的垂直方向（世界系，⊥û）。
   *  缺省 (0,0,1)——调用方按相机右方投影给出（默认视角下摆动正面可见） */
  restoreFlipDir?: [number, number, number]
}

/** 宽度轮廓：锚点端满宽 → 末段线性收窄 → 活动端保留 TIP_WIDTH_RATIO（梯形） */
export const beltTaper = (s: number): number => {
  const u = clamp01((s - (1 - TAPER_FRAC)) / TAPER_FRAC)
  return 1 - (1 - BELT_TIP_WIDTH_RATIO) * u
}

/* ------------------------------------------------------------------ *
 * 复原演练（v9：Egan 编舞逐项对齐——皮带中段拉伸成环、越过物体端）
 *
 *   截面旋转  Q(s,λ) = Rot(A, σ·π·mag) · Rot(û, −π) · Rot(û, τres·w(s))
 *     μ(s)   = tent(w(s))：2w（w≤0.5）/ 2−2w（w≥0.5）——「半」的划分沿**我们的
 *              剖面**的两个直径穿越（w=0.5 处路径过球心）
 *     σ(s)   = −1（w<0.5）/ +1（w≥0.5）——两段符号相反（对跖「断点」，旋转恒等）
 *     M(λ)   = normalize(D·cos(πλ) + H·sin(πλ))——中段旋转轴从 D（锚→尖端）摆到
 *              −D（对跖点），H = restoreFlipDir（相机右方，摆动正面可见）
 *     V      = μ·M + (1−μ)·S（S = û = 锚端轴）；mag = |V|；A = V/mag
 *     Rot(û,−π)：Egan 参考系换算（他的「平带」= 边界点 −π，我们的 = 恒等）
 *
 * - **λ=0 与常态逐位一致（已逐项验证）**：四个 w 区间的 Q(s,0) 都 ≡ Rot(û, 4π·w)·Rres
 *   （差值全是 ±2π/±4π ≡ 恒等）；**λ=1 = Rres**（两整扭恰好消掉）；端截面全程钉死：
 *   s=0（w=0 ⇒ μ=0 ⇒ V=S）与 s=1（w=1 ⇒ μ=0 ⇒ V=S）的 Q 与 λ 无关。
 * - **中心线 = 鼓环**（v9 与 Dirac.js 逐项对齐：三项公式与**包络结构**均取自他的
 *   centerline；sdev 摆项 / z 项无 par 削减——X 项折返时靠它们托底不出尖点，见
 *   centerAt 注释；λ=0.5 环鼻到 −û·2.1）。四面体避让交给场景侧的**缩小脉冲**
 *   （用户「反正正四面体可以缩小」，SymmetryViewScene）。
 * ------------------------------------------------------------------ */

const _q = new THREE.Quaternion()
const _qA = new THREE.Quaternion()
const _qB = new THREE.Quaternion()
const _qRes = new THREE.Quaternion()
const _n = new THREE.Vector3()
const _w = new THREE.Vector3()
const _u = new THREE.Vector3()
const _m = new THREE.Vector3()
const _v = new THREE.Vector3()
const _c = new THREE.Vector3()

/**
 * 计算皮带的全部站点（中心线 + 两边缘点 + 带面法向）。
 *
 * 常态：中心线 = 锚点 A = û·L → 尖端 û·attachRadius 的直线；截面旋转 Rot(û, τ·w)。
 * 复原（v8）：中心线鼓环套过物体端（Egan 编舞，见上方时间轴注释）；截面旋转
 * 走 M-轴对跖摆动。W₀ 由「与切线最不平行的坐标轴」叉乘决定（锚端截面朝向恒定）；
 * 法向用**局部切线**（复原中中心线弯曲，全局轴不再⊥带面）。
 */
export function beltStations(input: BeltGeometryInput): BeltStation[] {
  const anchorDist = input.anchorDist ?? BELT_ANCHOR_DIST
  const segments = input.segments ?? BELT_SEGMENTS
  const tau = Math.max(0, input.tau)
  // 单整扭拓扑上不可消：不足 720° 时演练请求一律 no-op（UI 已门控，这里兜底）
  const restoreT = tau >= BELT_RESTORE_AMOUNT - 1e-9 ? clamp01(input.restoreT ?? 0) : 0

  // 轴与锚点：皮带与旋转轴同轴（锚点在 +û 方向距中心 anchorDist 处）
  const axis = _u.set(0, 1, 0)
  if (input.axis) {
    const [ax, ay, az] = input.axis
    if (ax * ax + ay * ay + az * az > 1e-12) axis.set(ax, ay, az).normalize()
  }
  const T = axis.clone().negate() // 锚点→物体方向（Egan 的 +X）
  const A = axis.clone().multiplyScalar(anchorDist)
  const attachR = Math.min(input.attachRadius ?? 0, anchorDist - 0.05)
  const beltLen = anchorDist - attachR

  // 参考宽向 W₀：与切线 T 垂直；ref 取与 T 最不平行的坐标轴（确定性）
  const ref = new THREE.Vector3(0, 0, 1)
  if (Math.abs(T.z) >= 0.9) ref.set(1, 0, 0)
  const W0 = new THREE.Vector3().crossVectors(ref, T)
  if (W0.lengthSq() < 1e-9) W0.set(1, 0, 0)
  W0.normalize()

  // 常驻扭转（不随 λ 变；λ=1 时整条只剩它）
  const tauRes = Math.max(0, tau - Math.min(tau, BELT_RESTORE_AMOUNT))

  // 摆动侧 H：flipDir ⊥ û 归一化（退化时取任意垂直向量）
  const H = new THREE.Vector3(...(input.restoreFlipDir ?? [0, 0, 1]))
  H.addScaledVector(axis, -H.dot(axis))
  if (H.lengthSq() < 1e-8) {
    H.set(0, 0, 1).addScaledVector(axis, -axis.z)
    if (H.lengthSq() < 1e-8) H.set(1, 0, 0).addScaledVector(axis, -axis.x)
  }
  H.normalize()
  // 深度方向 G（⊥ û 与 H；环顶点向观察者拱起用）
  const G = new THREE.Vector3().crossVectors(axis, H).normalize()

  const par = Math.sin(Math.PI * restoreT) ** 2
  const sway = Math.sin(2 * Math.PI * restoreT)
  const theta = Math.PI * restoreT
  const cosT = Math.cos(theta), sinT = Math.sin(theta)

  // ── 中心线/宽向的解析求值（s 的函数；弧长重采样在任意 s 取值） ──
  // v9：**Egan 编舞逐项对齐**（用户 2026-10-17「不要管四面体…当正四面体不存在」，
  // 四面体改由场景侧在演练期间缩小避让——见 SymmetryViewScene）。中心线三项直接
  // 取自 Dirac.js（×beltLen/1.35 缩放）：
  //   along = base + bell·par·omu·(1−cos 2π·omu)      （他的 X 项，系数 1.0）
  //   sideF = −bell·0.296·sin(2πλ)·sin(π·omu)          （他的 sdev 摆项，sdev=0.4·sin2πλ；**无 par 包络**）
  //         + bell·0.18·par·sin(2π·omu)                （环缘侧向分裂：Egan 薄带 0.10 环缘掠过
  //                                                      扣端被不透明扣盒遮住；我们厚板 0.72 必须
  //                                                      让两支链绕尖端两侧过——0.18 是 v8 破坏性
  //                                                      0.42 的 43%，探针定值）
  //   sideG = −bell·0.237·par·(omu+omp)·sin(2π·omu)    （他的 z 项 0.8·0.4=0.32；omp 因子
  //                                                      由 par 压平：λ=0/1 必须逐位回到直带）
  // 注意：**sdev 没有 par 包络、z 项带 (omu+omp) 结构是有意的**——v8.6 三项全乘 par，
  // 早/晚段摆动不够托底，X 项导数穿越零时三维速度≈0 → 材料线回折成尖点（探针实测
  // λ≈0.16 处 81°/站 + 0.18~0.22 接触、λ≈0.76 处 52°/站）。Egan 版在 X 折返点
  // |dC/ds| ≥ 0.5·bell（y 生命线），尖点不复存在；λ=0/1 逐位平直由 par、sin(2πλ)
  // 双包络保证（λ=0：par=0∧sdev=0；λ=1 同）。
  const centerAt = (s: number, out: THREE.Vector3): void => {
    const omu = 1 - s
    let along = beltLen * s
    let sideF = 0
    let sideG = 0
    if (restoreT > 0) {
      const omp = 1 - par
      along += beltLen * par * omu * (1 - Math.cos(2 * Math.PI * omu))
      sideF = beltLen * par * 0.35 * Math.sin(2 * Math.PI * omu)
        - beltLen * 0.296 * sway * Math.sin(Math.PI * omu)
      sideG = -beltLen * 0.237 * par * (omu + 2 * omp) * Math.sin(2 * Math.PI * omu)
    }
    out.copy(A).addScaledVector(T, along).addScaledVector(H, sideF).addScaledVector(G, sideG)
  }
  const widthAt = (s: number, out: THREE.Quaternion): void => {
    const w = beltTwistProfile(s)
    if (restoreT <= 0) {
      out.setFromAxisAngle(axis, tau * w) // 常态：全扭转按剖面分布
      return
    }
    // Egan 编舞（见时间轴注释）：μ=tent(w)、σ 反号、M 轴对跖摆动
    const mu = w <= 0.5 ? 2 * w : 2 - 2 * w
    const sigma = w <= 0.5 ? -1 : 1
    _m.copy(T).multiplyScalar(cosT).addScaledVector(H, sinT) // M(λ)（单位）
    _v.copy(_m).multiplyScalar(mu).addScaledVector(axis, 1 - mu)
    const mag = _v.length()
    if (mag > 1e-9) _v.divideScalar(mag)
    else _v.copy(axis)
    _qA.setFromAxisAngle(_v, sigma * Math.PI * mag)
    _qB.setFromAxisAngle(axis, -Math.PI) // Egan 参考系换算（常数）
    _qRes.setFromAxisAngle(axis, tauRes * w)
    out.copy(_qA).multiply(_qB).multiply(_qRes)
  }

  // ── 弧长重采样（v8.1「形变粗糙」修复）：环把材料拉长 ~2.5×，按基线参数均匀
  // 取站会让环区四边形比直段长 2.5 倍（扭转/纹理/棱面全被拉花）。先稠密采样
  // 中心线累积弧长，再让站点按**等弧长**分布——材料应变沿带连续。
  const n1 = segments + 1
  const cxs = new Float64Array(n1), cys = new Float64Array(n1), czs = new Float64Array(n1)
  const wxs = new Float64Array(n1), wys = new Float64Array(n1), wzs = new Float64Array(n1)
  const sOf: Float64Array = (() => {
    if (restoreT <= 0) {
      const u = new Float64Array(n1)
      for (let i = 0; i <= segments; i++) u[i] = i / segments
      return u // 常态：中心线为直线，均匀 = 等弧长
    }
    const DENS = 1024
    const arc = new Float64Array(DENS + 1)
    const p0 = new THREE.Vector3()
    const p1 = new THREE.Vector3()
    centerAt(0, p0)
    let acc = 0
    for (let j = 1; j <= DENS; j++) {
      centerAt(j / DENS, p1)
      acc += p1.distanceTo(p0)
      arc[j] = acc
      p0.copy(p1)
    }
    const total = arc[DENS]!
    const u = new Float64Array(n1)
    for (let i = 0; i <= segments; i++) {
      const target = (i / segments) * total
      let lo = 0, hi = DENS
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (arc[mid]! <= target) lo = mid
        else hi = mid
      }
      const segLen = arc[lo + 1]! - arc[lo]!
      const frac = segLen > 0 ? (target - arc[lo]!) / segLen : 0
      u[i] = (lo + clamp01(frac)) / DENS
    }
    return u
  })()

  for (let i = 0; i <= segments; i++) {
    const s = sOf[i]!
    centerAt(s, _c)
    widthAt(s, _q)
    _w.copy(W0).applyQuaternion(_q)
    cxs[i] = _c.x; cys[i] = _c.y; czs[i] = _c.z
    wxs[i] = _w.x; wys[i] = _w.y; wzs[i] = _w.z
  }

  // ── pass 2：局部切线 → 法向 → 站点 ──
  const stations: BeltStation[] = []
  const tx = new THREE.Vector3()
  for (let i = 0; i <= segments; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(segments, i + 1)
    tx.set(cxs[i1] - cxs[i0], cys[i1] - cys[i0], czs[i1] - czs[i0]).normalize()
    _w.set(wxs[i], wys[i], wzs[i])
    _n.crossVectors(tx, _w).normalize()
    const halfW = (BELT_WIDTH * beltTaper(sOf[i]!)) / 2 // 梯形收窄跟材料坐标（弧长重采样后 ≠ i/segments）
    const cx = cxs[i], cy = cys[i], cz = czs[i]
    stations.push({
      cx, cy, cz,
      e1: [cx + _w.x * halfW, cy + _w.y * halfW, cz + _w.z * halfW],
      e2: [cx - _w.x * halfW, cy - _w.y * halfW, cz - _w.z * halfW],
      n: [_n.x, _n.y, _n.z],
    })
  }
  return stations
}

/** 复原演练的折角摆动方向：相机右方在 ⊥û 平面内的投影（默认视角下摆动正面可见）。
 *  退化（相机右方 ∥ û）时退回任意垂直方向。 */
export function beltRestoreFlipDir(camera: THREE.Camera, axis: [number, number, number]): [number, number, number] {
  const u = new THREE.Vector3(...axis)
  if (u.lengthSq() < 1e-12) u.set(0, 1, 0)
  u.normalize()
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
  right.addScaledVector(u, -right.dot(u))
  if (right.lengthSq() < 1e-6) {
    right.set(0, 0, 1).addScaledVector(u, -u.z)
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0).addScaledVector(u, -u.x)
  }
  right.normalize()
  return [right.x, right.y, right.z]
}

/** 是否够两整扭（720°）可以演示复位——单整扭拓扑上不可消（皮带戏法核心）。
 *  ViewPanel / ViewParamsPanel 的按钮门控共用此口径。 */
export function canDemoBeltRestore(tau: number): boolean {
  return tau >= BELT_RESTORE_AMOUNT - 1e-6
}

/** 调试/测试辅助：站点序列 → 平面数组（断言用；每站 12 个数 = 中心线 + e1 + e2 + 法向） */
export function beltStationsFlat(stations: BeltStation[]): number[] {
  const out: number[] = []
  for (const st of stations) out.push(
    st.cx, st.cy, st.cz,
    st.e1[0], st.e1[1], st.e1[2],
    st.e2[0], st.e2[1], st.e2[2],
    st.n[0], st.n[1], st.n[2],
  )
  return out
}
