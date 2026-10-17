import { useMemo, useState, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import { resolveElementWarn } from '../../utils/elementRef'
import type { SceneTheme } from './SceneThemeRoot'
import { computeElementRotation, type RotationInfo } from '../../core/elementRotation'
import { sl23Spin, sl23MatrixLabel, sl23Matrix, sl23QuatFromMatrix } from '../../core/groups/sl23'
import type { Group, GroupElement } from '../../core/types'
import { getSymmetryType } from '../../core/symmetryType'
import type { SymmetryType } from '../../core/symmetryType'
import {
  BELT_ANCHOR_DIST, BELT_SEGMENTS, BELT_RESTORE_AMOUNT, BELT_THICKNESS,
  beltExitRadius, beltStations, beltRestoreFlipDir, beltTetraShrink,
} from './beltGeometry'
import { SymmetryOrbitControls } from './SymmetryOrbitControls'

/** 复原演练时长（秒，rotateSpeed=1）：物体端绕锚点公转一圈、解开两整扭 */
const BELT_RESTORE_SECS = 2.5

/** 皮带账本状态（useAnimatedRotation 私有，BeltStrap 只读消费） */
interface BeltLedgerState {
  /** 当前扭转（弧度，帧间插值中） */
  beltTau: number
  /** 目标累计扭转（落定值） */
  beltTarget: number
  /** 扭转轴（单位向量；当前演示元素的旋转轴，与物体同轴） */
  beltAxis: THREE.Vector3
  /** 复原演练中 */
  beltRestoring: boolean
  /** 复原演练进度 0..1 */
  beltRestoreT: number
}

interface SymmetryData {
  vertices: THREE.Vector3[]
  edges: [number, number][]
  directed?: boolean
}

function getCyclicFigure(n: number, radius: number): SymmetryData {
  const vertices: THREE.Vector3[] = []
  const edges: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    vertices.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
    edges.push([i, (i + 1) % n])
  }
  return { vertices, edges, directed: true }
}

function getDihedralFigure(n: number, radius: number): SymmetryData {
  const vertices: THREE.Vector3[] = []
  const edges: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    vertices.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
    edges.push([i, (i + 1) % n])
  }
  return { vertices, edges }
}

function getTetrahedron(radius: number): SymmetryData {
  const s = radius / Math.sqrt(3)
  const vertices = [
    new THREE.Vector3(1, 1, 1).multiplyScalar(s),
    new THREE.Vector3(1, -1, -1).multiplyScalar(s),
    new THREE.Vector3(-1, 1, -1).multiplyScalar(s),
    new THREE.Vector3(-1, -1, 1).multiplyScalar(s),
  ]
  const edges: [number, number][] = []
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) edges.push([i, j])
  return { vertices, edges }
}

function getCube(radius: number): SymmetryData {
  const s = radius / Math.sqrt(3)
  const signs = [-1, 1]
  const vertices: THREE.Vector3[] = []
  for (const x of signs) for (const y of signs) for (const z of signs)
    vertices.push(new THREE.Vector3(x * s, y * s, z * s))
  const edges: [number, number][] = []
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      const dx = Math.abs(vertices[i].x - vertices[j].x)
      const dy = Math.abs(vertices[i].y - vertices[j].y)
      const dz = Math.abs(vertices[i].z - vertices[j].z)
      if ([dx, dy, dz].filter(v => v > 0.001).length === 1) edges.push([i, j])
    }
  }
  return { vertices, edges }
}

function getIcosahedron(radius: number): SymmetryData {
  const φ = (1 + Math.sqrt(5)) / 2
  const raw = [[0,1,φ],[0,-1,φ],[0,1,-φ],[0,-1,-φ],[1,φ,0],[-1,φ,0],[1,-φ,0],[-1,-φ,0],[φ,0,1],[φ,0,-1],[-φ,0,1],[-φ,0,-1]]
  const maxCoord = Math.sqrt(1 + φ * φ)
  const s = radius / maxCoord
  const vertices = raw.map(([x,y,z]) => new THREE.Vector3(x*s,y*s,z*s))
  const edges: [number,number][] = []
  const targetDistSq = 4 * s * s, tol = 0.01 * targetDistSq
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      if (Math.abs(vertices[i].distanceToSquared(vertices[j]) - targetDistSq) < tol) edges.push([i, j])
  return { vertices, edges }
}

const TRIANGULAR_FACE_CACHE = new Map<string, [number, number, number][]>()

function getRectangle(radius: number): SymmetryData {
  const hw = radius * 1.0, hh = radius * 0.55
  const vertices = [new THREE.Vector3(-hw,0,-hh),new THREE.Vector3(hw,0,-hh),new THREE.Vector3(hw,0,hh),new THREE.Vector3(-hw,0,hh)]
  const edges: [number,number][] = [[0,1],[1,2],[2,3],[3,0]]
  return { vertices, edges }
}

function getOctahedron(radius: number): SymmetryData {
  const vertices = [new THREE.Vector3(radius,0,0),new THREE.Vector3(-radius,0,0),new THREE.Vector3(0,radius,0),new THREE.Vector3(0,-radius,0),new THREE.Vector3(0,0,radius),new THREE.Vector3(0,0,-radius)]
  const edges: [number,number][] = []
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++)
      if (Math.abs(vertices[i].distanceToSquared(vertices[j]) - 4*radius*radius) > 0.01) edges.push([i, j])
  return { vertices, edges }
}

function getDodecahedron(radius: number): SymmetryData {
  const φ = (1+Math.sqrt(5))/2, a=1, b=1/φ, c=φ
  const raw: [number,number,number][] = []
  for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) raw.push([x*a,y*a,z*a])
  for (const s1 of [-1,1]) for (const s2 of [-1,1]) raw.push([0,s1*c,s2*b])
  for (const s1 of [-1,1]) for (const s2 of [-1,1]) raw.push([s2*b,0,s1*c])
  for (const s1 of [-1,1]) for (const s2 of [-1,1]) raw.push([s1*c,s2*b,0])
  const maxCoord = Math.sqrt(a*a+a*a+a*a), ss = radius/maxCoord
  const vertices = raw.map(([x,y,z])=>new THREE.Vector3(x*ss,y*ss,z*ss))
  const edgeDist = (2*b)*ss, tol = edgeDist*0.05
  const edges: [number,number][] = []
  for (let i = 0; i < 20; i++)
    for (let j = i + 1; j < 20; j++)
      if (Math.abs(vertices[i].distanceTo(vertices[j]) - edgeDist) < tol) edges.push([i, j])
  return { vertices, edges }
}

function getVertexColor(index: number, total: number): string {
  const hue = (index / total) * 360
  return `hsl(${hue}, 70%, 60%)`
}

function computeTriangularFaces(data: SymmetryData): [number, number, number][] {
  const key = `${data.vertices.length}:${data.edges.map(e => e.join('-')).join('|')}`
  const cached = TRIANGULAR_FACE_CACHE.get(key)
  if (cached) return cached
  const adj = new Map<number, number[]>()
  for (let i = 0; i < data.vertices.length; i++) adj.set(i, [])
  for (const [a, b] of data.edges) { adj.get(a)!.push(b); adj.get(b)!.push(a) }
  const faceSet = new Set<string>()
  const faces: [number, number, number][] = []
  for (let vi = 0; vi < data.vertices.length; vi++) {
    const neighbors = adj.get(vi)!
    if (neighbors.length < 2) continue
    const vPos = data.vertices[vi], vDir2 = vPos.clone().normalize()
    const refDir = new THREE.Vector3().subVectors(data.vertices[neighbors[0]], vPos).normalize()
    const sorted = neighbors.map(ni => ({
      ni,
      angle: Math.atan2(
        new THREE.Vector3().crossVectors(refDir, new THREE.Vector3().subVectors(data.vertices[ni], vPos).normalize()).dot(vDir2),
        refDir.dot(new THREE.Vector3().subVectors(data.vertices[ni], vPos).normalize())
      )
    }))
    sorted.sort((a, b) => a.angle - b.angle)
    for (let si = 0; si < sorted.length; si++) {
      const a = sorted[si].ni, b2 = sorted[(si + 1) % sorted.length].ni
      if (adj.get(a)?.includes(b2)) {
        const fKey = [vi, a, b2].sort().join(',')
        if (!faceSet.has(fKey)) {
          faceSet.add(fKey)
          faces.push([vi, a, b2])
        }
      }
    }
  }
  TRIANGULAR_FACE_CACHE.set(key, faces)
  return faces
}

function getCubeFaceCenters(data: SymmetryData): THREE.Vector3[] {
  const s = data.vertices[0].length() / Math.sqrt(3)
  return [
    new THREE.Vector3(s, 0, 0), new THREE.Vector3(-s, 0, 0),
    new THREE.Vector3(0, s, 0), new THREE.Vector3(0, -s, 0),
    new THREE.Vector3(0, 0, s), new THREE.Vector3(0, 0, -s),
  ]
}

function computeFaceCenters(data: SymmetryData, triangularFaces: [number, number, number][]): THREE.Vector3[] {
  const centers: THREE.Vector3[] = []
  if (triangularFaces.length > 0 && data.vertices.length <= 12) {
    for (const [vi, vj, vk] of triangularFaces) {
      centers.push(data.vertices[vi].clone().add(data.vertices[vj]).add(data.vertices[vk]).multiplyScalar(1 / 3))
    }
    return centers
  }
  if (data.vertices.length === 8) {
    return getCubeFaceCenters(data)
  }
  if (data.vertices.length >= 20) {
    const adj = new Map<number, Set<number>>()
    for (let i = 0; i < data.vertices.length; i++) adj.set(i, new Set())
    for (const [a, b] of data.edges) { adj.get(a)!.add(b); adj.get(b)!.add(a) }
    const found = new Set<string>()
    for (let v0 = 0; v0 < data.vertices.length; v0++) {
      const neis = [...adj.get(v0)!]
      for (let i = 0; i < neis.length; i++) {
        for (let j = i + 1; j < neis.length; j++) {
          const v1 = neis[i], v2 = neis[j]
          if (!adj.get(v1)!.has(v2)) continue
          const seeds = adj.get(v2)!.size === 3
            ? [...adj.get(v2)!].filter(x => x !== v0 && x !== v1)
            : [v2]
          for (const v3 of seeds) {
            const finalCands = [...adj.get(v3)!].filter(x => x !== v2 && adj.get(v0)!.has(x))
            for (const v4 of finalCands) {
              const pathVerts = [v0, v1, v2, v3, v4]
              const sorted = [...pathVerts].sort((a, b) => a - b)
              const key = sorted.join(',')
              if (found.has(key)) continue
              found.add(key)
              const c = new THREE.Vector3()
              for (const vi of pathVerts) c.add(data.vertices[vi])
              centers.push(c.multiplyScalar(1 / 5))
            }
          }
        }
      }
    }
    return centers
  }
  return []
}

/** 轴与转角完全由 core 的置换反解给出（几何体与 core 点模型同源），
 *  react 侧不再二次选轴——单一真源，避免两层各算一遍导致语义漂移。
 *  2T（SL(2,3)）分支额外携带 beltTwist/fullTurn（见 core/elementRotation）。 */
function computeGeometricRotation(group: Group, element: GroupElement): RotationInfo | null {
  return computeElementRotation(group, element)
}

export interface SymmetryViewSceneProps {
  /** 展示群（null 由调用方自行占位，本组件要求非空） */
  group: Group
  /** 对称类型；缺省按 getSymmetryType(group) 推导（unsupported 群渲染提示 overlay） */
  symmetryType?: SymmetryType
  /** 深色场景配色（背景 + 顶部标注文字）；主画布传主主题，ViewWindow 传窗口主题（解耦） */
  dark?: boolean
  /** 对偶多面体（cube↔octahedron / icosahedron↔dodecahedron）：受控形态（false=主形 / true=对偶形）。
   *  切换入口由宿主提供（ViewWindow ⚙ 面板 / 主画布 ViewPanel 的 Shape 选项），场景内不再悬浮切换按钮 */
  variant?: boolean
  /** 元素作用演示开关；缺省 false */
  showAction?: boolean
  /** 演示元素 id（受控，toggle 语义：点活跃元素回到恒等姿态）；缺省 null */
  actionElementId?: string | null
  /** 动画倍速 0.2–5；缺省 1 */
  rotateSpeed?: number
  /** @deprecated no-op（2026-10-15 起图内不放任何文字——用户要求，标题/副标题已删）。
   *  字段保留仅为包消费者兼容 */
  showFigureTitle?: boolean
  /** 锁定相机交互（拖拽旋转/平移/缩放）；演示动画期间本就禁用 */
  locked?: boolean
  /** 演示状态提示回调（主画布接 hint bar，ViewWindow 显示为内容区底部唯一浮条）；缺省无 */
  onHint?: (msg: string) => void
  /** 演示开启但当前元素无可旋转作用（恒等/未选）时，是否上抛 clickHint 引导；
   *  主画布缺省 true（提示去其它视图点元素）；ViewWindow 传 false（引导文案写在参数面板，浮条只显示真实状态） */
  hintOnIdle?: boolean
  /** 重放信号：宿主自增该值即对当前演示元素重播一次动画
   *  （非叠加：回恒等再旋转；叠加：把元素旋转左乘到当前姿态上，重复作用再合成）；
   *  解决同元素动画播完一次后无入口重看的缺口；缺省 0 */
  replaySignal?: number
  /** 显式主题（`'dark' | 'light'`）；与 `dark` 二选一，本项优先。
   *  推荐新代码用 `theme` —— 与其余 Scene 命名统一（`dark` 作为兼容别名保留） */
  theme?: SceneTheme
  /** 演示动画期间是否禁用相机旋转 / 平移；缺省 `false`。
   *  **注意行为变更**：旧实现恒等于 `true`（`enableRotate = !showAction && !locked`），
   *  导致"演示元素未命中 / 恒等元素时动画不跑，视角却已被锁死"。需要旧行为的宿主显式传 `true`。 */
  lockCameraOnAction?: boolean
  /** 演示动画播放结束（姿态落定）回调；用于宿主编排「看完自动切下一个」等自定义流程 */
  onAnimationEnd?: () => void
  /** 叠加模式演示：元素旋转左乘当前姿态持续合成（无回恒等阶段）；清除演示不动姿态。缺省 false */
  compose?: boolean
  /** 复位信号：宿主自增该值即动画回恒等（叠加模式手动复位，phase 'homing'）；缺省 0 */
  resetSignal?: number
  /** 姿态落定回调：动画播完或手动复位完成时上报四元数 [x,y,z,w]。 */
  onPoseChange?: (q: [number, number, number, number]) => void
  /** 皮带扭转落定回调（弧度）：2T（SL(2,3)）对称性视图专用——每次演示落定/手动复位时
   *  上报**累计** τ = Σ(2ψ)（物体旋转角）。q 与 −q 物体旋转相同、τ 不同，
   *  皮带即 SU(2) 记忆（双覆盖在画面上的可见载体）。非 2T 群不触发。 */
  onBeltChange?: (tau: number) => void
  /** 720° 复原演练信号：宿主自增即播放「皮带绕过锚点解开两整扭」动画
   *  （仅 2T 且累计扭转 ≥ 720° 时有效；其余为 no-op）。
   *  **演练期间画面中心自动切换到皮带固定端**（锚点），结束后切回（v6） */
  beltRestoreSignal?: number
  /** 画面中心（轨道目标点）：'solid' = 几何体中心（缺省）；'beltAnchor' = 皮带固定端
   *  （锚点 = 旋转轴 û·BELT_ANCHOR_DIST，随演示元素换轴）。仅 2T（SL(2,3)）有意义，
   *  其余群忽略。720° 复原演练期间强制 beltAnchor（演练结束自动还原） */
  centerOn?: 'solid' | 'beltAnchor'
}

/** 对称性视图纯渲染核（props 化、主题解耦）：Canvas + 场景 + 顶部标注 + 演示动画。
 *  主画布经 SymmetryView 适配器接入全局 context；ViewWindow（FGVE 引擎）受控直接使用。 */
export function SymmetryViewScene({
  group,
  symmetryType: symmetryTypeProp,
  dark = false,
  variant = false,
  showAction = false,
  actionElementId = null,
  rotateSpeed = 1,
  locked = false,
  onHint,
  hintOnIdle = true,
  replaySignal = 0,
  theme,
  lockCameraOnAction = false,
  onAnimationEnd,
  compose = false,
  resetSignal = 0,
  onPoseChange,
  onBeltChange,
  beltRestoreSignal = 0,
  centerOn = 'solid',
}: SymmetryViewSceneProps) {
  const symmetryType = symmetryTypeProp ?? getSymmetryType(group)
  const isDark = theme ? theme === 'dark' : dark

  // hooks 前置（不随 unsupported 分支提前返回，保证切换群时 hooks 顺序稳定）
  const data = useMemo((): SymmetryData => {
    const radius = 4
    switch (symmetryType) {
      case 'cyclic': return getCyclicFigure(group.order, radius)
      case 'dihedral': { const n = group.order / 2; return getDihedralFigure(Math.round(n), radius) }
      // 2T（SL(2,3)）= A₄ 的二重覆盖：同一套四面体几何，差异在旋转语义（sl23Spin）与皮带
      case 'tetrahedron':
      case 'binaryTetrahedron': return getTetrahedron(radius)
      case 'cube': return variant ? getOctahedron(radius) : getCube(radius)
      case 'icosahedron': return variant ? getDodecahedron(radius) : getIcosahedron(radius)
      case 'rectangle': return getRectangle(radius)
      default: return getCyclicFigure(1, radius)
    }
  }, [group, symmetryType, variant])

  // 2T 说明框数据（可收起）：当前演示元素的矩阵 + 反解出的四元数坐标 + 旋转（点5）。
  const beltInfo = useMemo(() => {
    if (symmetryType !== 'binaryTetrahedron' || !showAction || !actionElementId) return null
    const el = resolveElementWarn(group, actionElementId, 'SymmetryViewScene.beltInfo')
    if (!el || el.value.length !== 1) return null
    const k = el.value[0]!
    const spin = sl23Spin(k)
    const matrixLabel = sl23MatrixLabel(k)
    // 反解坐标（与说明框公式同源）：直接用矩阵反解，证明算式真的能算
    const quat = sl23QuatFromMatrix(sl23Matrix(k))
    if (!quat) return null
    return { el, spin, matrixLabel, quat }
  }, [symmetryType, showAction, actionElementId, group])

  if (symmetryType === 'unsupported') return <UnsupportedOverlay group={group} />

  const bgColor = isDark ? '#0a0a1a' : '#f4f4f7'

  return (
    <div style={{ width: '100%', height: '100%', background: bgColor, position: 'relative', overflow: 'hidden' }}>
      {/* 相机退远到 [0,9.2,31.8]（半径 33）：真机量得主画布视口 680×666（宽高比 ≈1.02）。
          竖半高 ≈15.4 > 锚距 11.25 + 三棒架 1.2（半径 30 时竖轴元素的三棒架上半根贴上沿被裁）；
          水平半宽 ≈15.7 同样够 */}
      <Canvas camera={{ position: [0, 9.2, 31.8], fov: 50, near: 0.1, far: 150 }} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
        <color attach="background" args={[bgColor]} />
        <SymmetryScene
          group={group}
          symmetryType={symmetryType}
          data={data}
          showAction={showAction}
          actionElementId={actionElementId}
          rotateSpeed={rotateSpeed}
          locked={locked}
          onHint={onHint}
          hintOnIdle={hintOnIdle}
          replaySignal={replaySignal}
          compose={compose}
          resetSignal={resetSignal}
          onPoseChange={onPoseChange}
          onBeltChange={onBeltChange}
          beltRestoreSignal={beltRestoreSignal}
          lockCameraOnAction={lockCameraOnAction}
          onAnimationEnd={onAnimationEnd}
          centerOn={centerOn}
        />
      </Canvas>
      {/* 2T 说明框（可收起）：SL(2,3) 的矩阵元素如何对应/计算出物体的旋转 */}
      {symmetryType === 'binaryTetrahedron' && <BeltInfoBox info={beltInfo} isDark={isDark} />}
    </div>
  )
}

/**
 * 2T 说明框（v7，用户 2026-10-17 重写：「说半天也没说出矩阵 abcd 怎么转换成旋转多少度」）。
 * 现在给的是**可执行的算式**，两步：
 *   ① 反解四元数（mod 3 闭式公式；24 元素坐标互异 ⇒ 唯一）
 *   ② cos ψ = a₀/2（半角余弦 = 标量部分）⇒ 旋转角 2ψ（附 a₀ → 角度对照表）
 * 展开时把当前演示元素的实际数字代进去（M → q 的四个坐标 → 角度/轴/皮带）。
 * 公式与 `sl23QuatFromMatrix` / `sl23SpinFromMatrix` 逐字同源（24 元素单测对照）。
 * **默认收起**（v7.1）：主画布只有 ~440px 宽，322px 的框会把皮带压在底下——
 * 标题栏一行常驻可见，点开即读，读完备上，不挡图。
 */
function BeltInfoBox({ info, isDark }: {
  info: {
    el: GroupElement
    spin: ReturnType<typeof sl23Spin>
    matrixLabel: string
    quat: [number, number, number, number]
  } | null
  isDark: boolean
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const boxBg = isDark ? 'rgba(10,12,24,0.9)' : 'rgba(255,255,255,0.94)'
  const boxBorder = isDark ? '1px solid rgba(120,150,200,0.35)' : '1px solid rgba(30,50,90,0.25)'
  const textColor = isDark ? '#c9d4e4' : '#2a3442'
  const dimColor = isDark ? '#8b98ad' : '#5b6779'
  const deg = (rad: number) => Math.round((rad * 180) / Math.PI)

  // 当前元素：M → q 坐标 → 角度/轴/皮带（代入实际数字）
  let currentMatrixTex: string | null = null
  let currentQTex: string | null = null
  let currentLine: string | null = null
  if (info) {
    const { spin, matrixLabel, quat } = info
    currentMatrixTex = matrixLabel
    currentQTex = `q = \\tfrac{${quat[0]} + ${quat[1]}i + ${quat[2]}j + ${quat[3]}k}{2}`
    const axisTxt = spin.axis ? `(${spin.axis.map(v => v.toFixed(2)).join(', ')})` : '(0, 1, 0)'
    const rotTxt = spin.fullTurn
      ? t('symmetry.beltInfo.fullTurn')
      : t('symmetry.beltInfo.result', { axis: axisTxt, deg: String(deg(spin.angleRad)) })
    currentLine = `${rotTxt} · ${t('symmetry.beltInfo.tau', { deg: String(deg(spin.beltTwist)) })}`
  }

  return (
    <div
      data-testid="sym-belt-info"
      style={{
        position: 'absolute', top: 8, left: 8, maxWidth: 322,
        background: boxBg, border: boxBorder, borderRadius: 8,
        color: textColor, fontSize: 11, lineHeight: 1.55,
        boxShadow: '0 2px 10px rgba(0,0,0,0.25)', zIndex: 10,
        backdropFilter: 'blur(2px)',
      }}
    >
      <button
        data-testid="sym-belt-info-toggle"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: 'transparent', border: 'none', color: textColor,
          fontSize: 11, fontWeight: 600, padding: '6px 8px', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ color: dimColor }}>{open ? '▾' : '▸'}</span>
        {t('symmetry.beltInfo.title')}
      </button>
      {open && (
        <div style={{ padding: '0 8px 8px 8px' }}>
          <div style={{ marginBottom: 2 }}>{t('symmetry.beltInfo.intro')}</div>
          <div style={{ textAlign: 'center', margin: '2px 0' }}>
            <span dangerouslySetInnerHTML={{ __html: renderTex('M = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix},\\ \\det M = 1 \\pmod 3') }} />
          </div>
          {/* ① 反解四元数（闭式） */}
          <div style={{ marginBottom: 2, marginTop: 2 }}>{t('symmetry.beltInfo.s1')}</div>
          <div style={{ textAlign: 'center', margin: '2px 0', fontSize: 10 }}>
            <span dangerouslySetInnerHTML={{ __html: renderTex('a_0 \\equiv a{+}d,\\;\\; b_0 \\equiv 2(c{-}b),\\;\\; c_0 \\equiv d{-}a{-}b{-}c,\\;\\; d_0 \\equiv b{+}c{-}a{+}d') }} />
          </div>
          {/* ② 半角余弦 → 旋转角 */}
          <div style={{ marginBottom: 2, marginTop: 2 }}>{t('symmetry.beltInfo.s2')}</div>
          <div style={{ textAlign: 'center', margin: '2px 0' }}>
            <span dangerouslySetInnerHTML={{ __html: renderTex('\\cos\\psi = \\frac{a_0}{2}\\;\\Rightarrow\\; \\text{rot} = 2\\psi\\ \\text{about}\\ \\hat u \\parallel (b_0,c_0,d_0)') }} />
          </div>
          <div style={{ color: dimColor }}>{t('symmetry.beltInfo.angles')}</div>
          {currentMatrixTex && currentQTex && currentLine ? (
            <div style={{ borderTop: boxBorder, paddingTop: 4, marginTop: 4 }}>
              <div style={{ color: dimColor, marginBottom: 2 }}>{t('symmetry.beltInfo.current')}</div>
              <div style={{ textAlign: 'center', margin: '2px 0' }}>
                <span dangerouslySetInnerHTML={{ __html: renderTex(texify(currentMatrixTex)) }} />
                <span style={{ margin: '0 6px', color: dimColor }}>→</span>
                <span dangerouslySetInnerHTML={{ __html: renderTex(currentQTex) }} />
              </div>
              <div style={{ color: textColor }}>{currentLine}</div>
            </div>
          ) : (
            <div style={{ color: dimColor, marginTop: 2 }}>{t('symmetry.beltInfo.pick')}</div>
          )}
        </div>
      )}
    </div>
  )
}


type AnimPhase = 'rest' | 'reset' | 'rotating' | 'homing'
const IDENTITY_QUAT = new THREE.Quaternion()

function useAnimatedRotation(
  targetQuat: THREE.Quaternion | null,
  speed: number,
  onPhaseChange: (phase: AnimPhase) => void,
  replaySignal?: number,
  onAnimationEnd?: () => void,
  compose?: boolean,
  resetSignal?: number,
  onPoseChange?: (q: [number, number, number, number]) => void,
  /** 2T 皮带账本（Dirac 开口皮带的扭转记忆）：`twist` = 当前演示元素的扭转贡献
   *  θ_el = 2ψ（弧度，正标量；非 2T 群不传 ⇒ 皮带恒 0 且不上报）；`axis` = 该元素
   *  的旋转轴——**皮带与旋转轴同轴**（锚点在轴向上，随新轴重新对准，2026-10-15 v3）。
   *  非叠加：reset 段先把皮带 unwind 回 0、rotating 段再扭到 θ_el；
   *  叠加：从当前累计直接累加（与四元数左乘同节奏）；homing：动画回 0。
   *  落定/复位完成时经 `onChange` 上报**累计** τ；`onRestoreChange` 上报
   *  720° 复原演练的起止（宿主用于提示文案/按钮态）。 */
  belt?: {
    twist: number
    axis: [number, number, number] | null
    onChange?: (tau: number) => void
    onRestoreChange?: (restoring: boolean) => void
  },
  /** 720° 复原演练信号：宿主自增即播放「绕过锚点解开两整扭」（仅 τ ≥ 720° 有效） */
  beltRestoreSignal?: number,
) {
  const stateRef = useRef({
    target: null as THREE.Quaternion | null,
    base: null as THREE.Quaternion | null,
    from: new THREE.Quaternion(),
    t: 2,
    speed: 1,
    phase: 'rest' as AnimPhase,
    settled: false,
    currentQuat: new THREE.Quaternion(),
    beltTau: 0,
    beltTarget: 0,
    beltFrom: 0,
    beltAxis: new THREE.Vector3(0, 1, 0),
    beltRestoring: false,
    beltRestoreT: 0,
  })

  // 结束回调放 ref：避免宿主每帧传新闭包导致 useFrame 里读到过期函数。
  // 用 effect 同步而非渲染期赋值 —— 渲染期写 ref 会触发 react-hooks/refs。
  const endRef = useRef(onAnimationEnd)
  useEffect(() => { endRef.current = onAnimationEnd }, [onAnimationEnd])
  const poseRefCb = useRef(onPoseChange)
  useEffect(() => { poseRefCb.current = onPoseChange }, [onPoseChange])
  // compose 读 ref：开关切换不重触发动画（只有 targetQuat / 信号变化才触发）
  const composeRef = useRef(compose)
  useEffect(() => { composeRef.current = compose }, [compose])
  // 皮带参数读 ref：理由同上（宿主每帧传新对象不重触发动画）
  const beltRef = useRef(belt)
  useEffect(() => { beltRef.current = belt }, [belt])
  // 离开 2T（换群 / 切视图）：账本清零，避免残留扭转在切回时复现
  useEffect(() => {
    if (belt) return
    const st = stateRef.current
    st.beltTau = 0; st.beltTarget = 0; st.beltFrom = 0
    st.beltRestoring = false; st.beltRestoreT = 0
  }, [belt])

  useEffect(() => { stateRef.current.speed = speed }, [speed])

  // 720° 复原演练：皮带绕过锚点公转一圈，解开两整扭（τ < 720° 时信号无效——
  // 单整扭拓扑上不可消，正是皮带戏法的核心）
  useEffect(() => {
    const st = stateRef.current
    if (!beltRestoreSignal || !beltRef.current) return
    if (st.beltRestoring) return
    if (st.beltTarget < BELT_RESTORE_AMOUNT - 1e-6) return
    st.beltRestoring = true
    st.beltRestoreT = 0
    beltRef.current.onRestoreChange?.(true)
  }, [beltRestoreSignal])

  useEffect(() => {
    const st = stateRef.current
    const twist = beltRef.current?.twist ?? 0
    // 换演示元素：皮带重新对准其旋转轴（同轴缠绕）；轴为空（取消选中）→ 回竖直；
    // 取消进行中的复原演练
    const axis = beltRef.current?.axis
    if (axis) st.beltAxis.set(axis[0], axis[1], axis[2]).normalize()
    else st.beltAxis.set(0, 1, 0)
    st.beltRestoring = false
    st.beltRestoreT = 0
    if (targetQuat) {
      st.base = targetQuat.clone()
      if (composeRef.current) {
        // 叠加模式：目标 = 元素旋转左乘当前姿态，从当前姿态直接 slerp（无回恒等阶段）
        st.from.copy(st.currentQuat)
        st.target = targetQuat.clone().multiply(st.currentQuat)
        st.t = 0.5
        st.phase = 'rotating'
        st.settled = false
        // 皮带：从当前累计继续累加（同一段旋转里同步插值）
        st.beltFrom = st.beltTau
        st.beltTarget = st.beltTau + twist
        onPhaseChange('rotating')
      } else {
        st.target = targetQuat.clone()
        st.from.identity()
        st.t = 0
        st.phase = 'reset'
        st.settled = false
        // 皮带：reset 段先 unwind 回 0，rotating 段再扭到本元素贡献 θ_el
        st.beltFrom = st.beltTau
        st.beltTarget = twist
        onPhaseChange('reset')
      }
    } else {
      st.target = null
      st.base = null
      st.t = 2
      st.settled = false
      st.phase = 'rest'
      // 叠加模式清除演示不动姿态：保持当前姿态，仅停止动画（皮带同步保持）
      if (!composeRef.current) {
        st.from.identity()
        st.currentQuat.identity()
        st.beltTau = 0
        st.beltTarget = 0
      }
      onPhaseChange('rest')
    }
  }, [targetQuat, onPhaseChange])

  // 显式重放：replaySignal 递增即对当前演示元素再应用一次。
  // 非叠加：回恒等再旋转（不改变目标）；叠加：把元素旋转左乘到当前姿态上（重复作用再合成）。
  useEffect(() => {
    const st = stateRef.current
    if (!replaySignal || !st.base) return
    const axis = beltRef.current?.axis
    if (axis) st.beltAxis.set(axis[0], axis[1], axis[2]).normalize()
    st.beltRestoring = false
    st.beltRestoreT = 0
    if (composeRef.current) {
      st.from.copy(st.currentQuat)
      st.target = st.base.clone().multiply(st.currentQuat)
      st.t = 0.5
      st.phase = 'rotating'
      st.settled = false
      // 重复作用再合成：皮带同步再累加一份 θ_el
      st.beltFrom = st.beltTau
      st.beltTarget = st.beltTau + (beltRef.current?.twist ?? 0)
      onPhaseChange('rotating')
    } else {
      st.t = 0
      st.phase = 'reset'
      st.settled = false
      // 回恒等重播：皮带从当前累计 unwind 回 0 再重扭（与四元数重置同节奏）
      st.beltFrom = st.beltTau
      onPhaseChange('reset')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaySignal])

  // 叠加模式手动复位：从当前姿态动画回恒等（新 phase 'homing'）
  useEffect(() => {
    const st = stateRef.current
    if (!resetSignal || !composeRef.current) return
    // 恒等判定用 angleTo（四元数范数恒为 1，lengthSq 检测的是零四元数）。
    // **2T 注意**：−I 提升与恒等是同一 SO(3) 旋转（angleTo = 0）但皮带仍拧着
    // （beltTau = 2π）——no-op 守卫必须同时看皮带，否则「物体已回家」时
    // 复位信号永远空转，皮带与提升都不复原。
    if ((st.currentQuat.angleTo(IDENTITY_QUAT) < 1e-6 && st.beltTau < 1e-9) || st.phase === 'homing') return
    st.from.copy(st.currentQuat)
    st.t = 0
    st.phase = 'homing'
    st.settled = false
    // 皮带同步 unwind 回 0（物体回家、皮带复原）
    st.beltFrom = st.beltTau
    st.beltTarget = 0
    onPhaseChange('homing')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  useFrame((_, dt) => {
    const st = stateRef.current
    // 复原演练推进（与四元数动画并行）：绕锚点公转一圈，τ 按 720° 递减，落定上报
    if (st.beltRestoring) {
      st.beltRestoreT += (dt * st.speed) / BELT_RESTORE_SECS
      if (st.beltRestoreT >= 1) {
        st.beltRestoreT = 0
        st.beltRestoring = false
        st.beltTau = Math.max(0, st.beltTarget - BELT_RESTORE_AMOUNT)
        st.beltTarget = st.beltTau
        beltRef.current?.onChange?.(st.beltTau)
        beltRef.current?.onRestoreChange?.(false)
      }
    }
    if (st.phase === 'homing') {
      if (st.t > 1.5) { st.phase = 'rest'; return }
      st.t += dt * st.speed
      if (st.t >= 0.5) {
        st.t = 2; st.settled = true; st.phase = 'rest'; onPhaseChange('rest')
        st.currentQuat.identity()
        st.beltTau = 0
        poseRefCb.current?.([0, 0, 0, 1])
        beltRef.current?.onChange?.(0)
      } else {
        st.currentQuat.slerpQuaternions(st.from, IDENTITY_QUAT, st.t / 0.5)
        st.beltTau = st.beltFrom * (1 - st.t / 0.5)
      }
      return
    }
    if (!st.target || st.t > 1.5) return
    st.t += dt * st.speed
    if (st.phase === 'reset') {
      if (st.t >= 0.5) { st.phase = 'rotating'; st.t = 0.5; onPhaseChange('rotating') }
      else {
        st.currentQuat.identity()
        st.beltTau = st.beltFrom * (1 - st.t / 0.5)
        return
      }
    }
    if (st.t >= 1) {
      st.t = 2; st.settled = true; st.phase = 'rest'; onPhaseChange('rest')
      st.currentQuat.copy(st.target)
      st.beltTau = st.beltTarget
      // 姿态落定 → 上报四元数；并通知宿主「这次演示播完了」（重放会再次触发）
      poseRefCb.current?.([st.currentQuat.x, st.currentQuat.y, st.currentQuat.z, st.currentQuat.w])
      beltRef.current?.onChange?.(st.beltTarget)
      endRef.current?.()
    } else {
      const k = (st.t - 0.5) / 0.5
      st.currentQuat.slerpQuaternions(st.from, st.target, k)
      // 皮带与四元数同段插值：非叠加从 0（已 unwind）扭到 θ_el；叠加从 beltFrom 累加到 beltTarget
      const beltStart = composeRef.current ? st.beltFrom : 0
      st.beltTau = beltStart + (st.beltTarget - beltStart) * k
    }
  })

  return stateRef
}

function AnimatedGeo({ data, symmetryType, isDirected, animState }: {
  data: SymmetryData
  symmetryType: SymmetryType
  isDirected: boolean
  animState: { current: { currentQuat: THREE.Quaternion; beltRestoring?: boolean; beltRestoreT?: number } }
}) {
  const [group] = useState(() => new THREE.Group())

  useEffect(() => {
    while (group.children.length > 0) group.remove(group.children[0])

    data.vertices.forEach((v, i) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 16),
        new THREE.MeshStandardMaterial({ color: getVertexColor(i, data.vertices.length), roughness: 0.3, metalness: 0.1, emissive: getVertexColor(i, data.vertices.length), emissiveIntensity: 0.3 })
      )
      mesh.position.copy(v)
      group.add(mesh)
    })

    data.edges.forEach(([a, b]) => {
      const from = data.vertices[a], to = data.vertices[b]
      const pts = [from.clone(), to.clone()]
      const geom = new THREE.BufferGeometry().setFromPoints(pts)
      const color = isDirected ? '#ff6b6b' : '#66aaff'
      group.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color })))
      if (isDirected) {
        const dir = new THREE.Vector3().subVectors(to, from).normalize()
        const p = new THREE.Vector3(-dir.z, 0, dir.x)
        const tip = to.clone().addScaledVector(dir, -0.35)
        const w1 = tip.clone().addScaledVector(dir, -0.12).addScaledVector(p, 0.1)
        const w2 = tip.clone().addScaledVector(dir, -0.12).addScaledVector(p, -0.1)
        const ag = new THREE.BufferGeometry().setFromPoints([w1, tip, w2])
        group.add(new THREE.Line(ag, new THREE.LineBasicMaterial({ color })))
      }
    })

    // 半透明面：tetrahedron / 2T / cube / icosahedron（2T 的面要让皮带下段透出）
    if (symmetryType === 'tetrahedron' || symmetryType === 'binaryTetrahedron' || symmetryType === 'cube' || symmetryType === 'icosahedron') {
      const fc = symmetryType === 'cube' ? '#ff9944' : symmetryType === 'icosahedron' ? '#cc66ff' : '#44cc88'
      const faces = computeTriangularFaces(data)
      if (faces.length > 0) {
        const pos: number[] = [], idx: number[] = []
        for (const [vi, a, b2] of faces) {
          const i2 = pos.length / 3
          const va = data.vertices[vi], vb = data.vertices[a], vc = data.vertices[b2]
          pos.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z)
          idx.push(i2, i2 + 1, i2 + 2)
        }
        const fg = new THREE.BufferGeometry()
        fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
        fg.setIndex(idx)
        fg.computeVertexNormals()
        group.add(new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: fc, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })))
      }
    }
  }, [data, symmetryType, isDirected, group])

  useFrame(() => {
    group.quaternion.copy(animState.current.currentQuat)
    // 复原演练中的**全息缩小脉冲**（v9）：Egan 编舞按「环境里没有障碍物」原样移植，
    // 四面体改由这里缩放避让——k(λ) = beltTetraShrink（1→0.12→1，两端逐位原大）。
    // 仅 2T 的演练会打开该字段；其余类型恒原大。缩完立刻解锁（值不同才写，减少逐帧开销）。
    const st = animState.current
    const scale = st.beltRestoring ? beltTetraShrink(st.beltRestoreT ?? 0) : 1
    const s = group.scale.x
    if (Math.abs(s - scale) > 1e-4) group.scale.setScalar(scale)
  })

  return <primitive object={group} />
}

function AxisMarker({ from, to, intersections }: {
  from: THREE.Vector3
  to: THREE.Vector3
  intersections: { pos: THREE.Vector3; kind: 'vertex' | 'edge' | 'face-center' }[]
}) {
  const mid = useMemo(() => from.clone().add(to).multiplyScalar(0.5), [from, to])
  const dir = useMemo(() => to.clone().sub(from).normalize(), [from, to])
  const len = useMemo(() => to.distanceTo(from), [from, to])
  const quat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
    return q
  }, [dir])

  return (
    <group>
      <mesh position={mid} quaternion={quat}>
        <cylinderGeometry args={[0.045, 0.045, len, 8]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={1.0} roughness={0.1} />
      </mesh>
      <mesh position={to} quaternion={quat}>
        <coneGeometry args={[0.14, 0.5, 8, 1]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={1.0} roughness={0.1} />
      </mesh>
      {intersections.map((intr, i) => (
        <mesh key={i} position={intr.pos}>
          <sphereGeometry args={[intr.kind === 'vertex' ? 0.14 : intr.kind === 'face-center' ? 0.13 : 0.09, 12, 12]} />
          <meshStandardMaterial
            color={intr.kind === 'vertex' ? '#ffd93d' : intr.kind === 'face-center' ? '#84cc16' : '#4ecdc4'}
            emissive={intr.kind === 'vertex' ? '#ffd93d' : intr.kind === 'face-center' ? '#84cc16' : '#4ecdc4'}
            emissiveIntensity={0.7}
            roughness={0.1}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ *
 * Dirac 开口皮带（2T 对称性视图专用）v6（2026-10-16，用户第三轮反馈）。
 * 几何全部走纯函数 beltGeometry.ts（唯一真源）：
 * - **皮带与旋转轴同轴**：锚点 = 轴向 û·BELT_ANCHOR_DIST 处，皮带直躺在旋转轴上
 *   （「旋转轴要经过皮带」）；锚点端是扭转的固定参考端（截面朝向恒定），位置随
 *   当前元素的新轴重新对准；物体端截面随四面体一起转动。
 * - **扭转 = 带面绕自身中心线的翻转**（莫比乌斯式）：中心线恒为直线，
 *   宽向量沿带递增转 φ(s) = −τ·s。
 * - **厚板渲染（v6 点2「稍微弄点厚度」）**：每站 4 顶点 = 两边缘 × 上下两厚度层
 *   （±n·BELT_THICKNESS/2，n = 站点法向）；单一 geometry + 三个材质组
 *   （front 浅 / back 深 / edge 边色）——正反双色承接「扭转多少读颜色翻面」，
 *   边色让厚度可读。零厚度带面（v5 及以前）侧看即「一根棒」。
 * - **固定端 = 三垂直棒正交架（v6 点6，替换琥珀销钉）**：锚点处三根互成直角的
 *   细棒沿锚端帧 (T, W₀, N) 摆——沿皮带轴的棒**只保留背离物体端的半根**
 *   （+û；朝物体端那半根会埋进皮带体内——首版即如此，真机截图发现方向棒整根
 *   不可见；竖轴静息态皮带下垂，背离半根即「上半」），另两根满棒（截面朝向
 *   参考）。侧看皮带也不再是「两个球一根棒」，3D 朝向直接可读。锚端帧全程
 *   冻结（beltGeometry v6：复原演练中也不动）。
 * - **720° 复原演练（v8 Egan 编舞）**：两端固定，皮带中段拉伸成环套过物体端解扣
 *   （截面轴对跖摆动 + 中心线鼓环，见 beltGeometry 文件头时间轴注释）；
 *   传未扣减的累计 τ，720° 扣减只在 beltGeometry 内做一次。
 * ------------------------------------------------------------------ */
const BELT_FRONT_COLOR = '#e8eef5'
const BELT_BACK_COLOR = '#4b5b74'
const BELT_EDGE_COLOR = '#93a1b5'
const BELT_FIXTURE_COLOR = '#f0a832'
const BELT_DIR_COLOR = '#ffc558'
const _Y_UP = new THREE.Vector3(0, 1, 0)
const _beltW = new THREE.Vector3()
const _beltT = new THREE.Vector3()
const _beltN = new THREE.Vector3()
const _arrowM = new THREE.Matrix4()

/** 固定端三棒架尺寸（相对带宽 0.72） */
const ROD_R = 0.038
/** 方向棒半长（只保留背离物体端的半根 = 竖轴静息态的「上半」） */
const ROD_DIR_LEN = 1.0
/** 宽向满棒总长 */
const ROD_FRAME_LEN = 1.15
/** 法向棒半长（v7：只保留**皮带正面**那半根——法向棒穿过带面，背面半根不画；
 *  与尖端箭头同侧，用户 2026-10-17「法向量那个意思」「保留正面那一半」） */
const ROD_NORMAL_HALF = 0.62
/** 尖端箭头：贴正面（+N）沿皮带方向朝外，长度 / 半宽（世界单位） */
const ARROW_LEN = 0.9
const ARROW_HALF_W = 0.19

/** 尖端箭头形状（局部 XY 平面，+X = 皮带朝外方向，+Y = 带宽方向） */
function makeArrowShape(): THREE.Shape {
  const s = new THREE.Shape()
  const tail = -ARROW_LEN / 2
  const neck = ARROW_LEN / 2 - 0.3
  const head = ARROW_LEN / 2
  s.moveTo(tail, -0.052)
  s.lineTo(neck, -0.052)
  s.lineTo(neck, -ARROW_HALF_W)
  s.lineTo(head, 0)
  s.lineTo(neck, ARROW_HALF_W)
  s.lineTo(neck, 0.052)
  s.lineTo(tail, 0.052)
  s.closePath()
  return s
}

function BeltStrap({ animState, vertices }: {
  animState: { current: BeltLedgerState }
  /** 四面体顶点（算轴出口半径 = 皮带尖端停靠点） */
  vertices: Array<[number, number, number]>
}) {
  const [group] = useState(() => new THREE.Group())
  const geomRef = useRef<THREE.BufferGeometry | null>(null)
  const fixtureRef = useRef<THREE.Group | null>(null)
  const arrowRef = useRef<THREE.Mesh | null>(null)
  const { camera } = useThree()

  // 几何与固定件一次性建好：厚板位置逐帧更新；三根细棒每帧对准锚端帧。
  useEffect(() => {
    const count = BELT_SEGMENTS + 1
    const pos = new Float32Array(count * 4 * 3)
    // 索引分四组（单 geometry + 材质数组 + addGroup）：
    // front（+n 面，浅）/ back（−n 面，深）/ 两侧边缘 / 锚端盖
    const frontIdx: number[] = []
    const backIdx: number[] = []
    const sideIdx: number[] = []
    const capIdx: number[] = []
    for (let i = 0; i < BELT_SEGMENTS; i++) {
      const a = i * 4, b = i * 4 + 1, c = i * 4 + 2, d = i * 4 + 3
      const a2 = (i + 1) * 4, b2 = (i + 1) * 4 + 1, c2 = (i + 1) * 4 + 2, d2 = (i + 1) * 4 + 3
      frontIdx.push(a, b, b2, a, b2, a2)
      backIdx.push(d, c2, c, d, d2, c2)
      // 两侧边缘（+W 边 = a/d，−W 边 = b/c）
      sideIdx.push(a, d, d2, a, d2, a2, b, c, c2, b, c2, b2)
    }
    // 锚端盖（station 0 截面四边形 a-b-c-d）
    capIdx.push(0, 3, 2, 0, 2, 1)
    const idx = [...frontIdx, ...backIdx, ...sideIdx, ...capIdx]
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    geom.setIndex(idx)
    geom.addGroup(0, frontIdx.length, 0)
    geom.addGroup(frontIdx.length, backIdx.length, 1)
    geom.addGroup(frontIdx.length + backIdx.length, sideIdx.length, 2)
    geom.addGroup(frontIdx.length + backIdx.length + sideIdx.length, capIdx.length, 2)
    geomRef.current = geom
    const mkMat = (color: string) => new THREE.MeshStandardMaterial({
      color, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05,
    })
    const front = new THREE.Mesh(geom, [
      mkMat(BELT_FRONT_COLOR),
      mkMat(BELT_BACK_COLOR),
      mkMat(BELT_EDGE_COLOR),
    ])
    // 固定件：三垂直棒正交架（v6）+ 尖端箭头（v7）。棒沿 Y 建模（每帧 quaternion 对齐）
    const fixture = new THREE.Group()
    const fixtureMat = new THREE.MeshStandardMaterial({ color: BELT_FIXTURE_COLOR, roughness: 0.35, metalness: 0.3 })
    const dirMat = new THREE.MeshStandardMaterial({ color: BELT_DIR_COLOR, roughness: 0.3, metalness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.35 })
    const rodGeom = new THREE.CylinderGeometry(ROD_R, ROD_R, 1, 10)
    const dirRod = new THREE.Mesh(rodGeom, dirMat)
    dirRod.userData.role = 'dir'
    const wRod = new THREE.Mesh(rodGeom, fixtureMat)
    wRod.userData.role = 'w'
    const nRod = new THREE.Mesh(rodGeom, fixtureMat)
    nRod.userData.role = 'n'
    // 缩放：dir 棒长 = ROD_DIR_LEN（半根），w 满根，n 只保留正面半根（v7）
    dirRod.scale.set(1, ROD_DIR_LEN, 1)
    wRod.scale.set(1, ROD_FRAME_LEN, 1)
    nRod.scale.set(1, ROD_NORMAL_HALF, 1)
    fixture.add(dirRod, wRod, nRod)
    fixtureRef.current = fixture
    // 尖端箭头（v7 点3）：正面（+N）上的扁平箭头，指向皮带朝外方向（+T）
    const arrowGeom = new THREE.ShapeGeometry(makeArrowShape())
    const arrowMat = new THREE.MeshStandardMaterial({
      color: BELT_DIR_COLOR, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.2,
      emissive: '#7a5200', emissiveIntensity: 0.45,
    })
    const arrow = new THREE.Mesh(arrowGeom, arrowMat)
    arrowRef.current = arrow
    group.add(front, fixture, arrow)
    return () => {
      geom.dispose()
      for (const m of front.material as THREE.Material[]) m.dispose()
      rodGeom.dispose()
      fixtureMat.dispose()
      dirMat.dispose()
      arrowGeom.dispose()
      arrowMat.dispose()
      group.remove(front, fixture, arrow)
      geomRef.current = null
      fixtureRef.current = null
      arrowRef.current = null
    }
  }, [group])

  useFrame(() => {
    const geom = geomRef.current
    const fixture = fixtureRef.current
    const arrow = arrowRef.current
    if (!geom || !fixture || !arrow) return
    const attr = geom.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const st = animState.current
    // 复原演练中传**未扣减**的累计 τ（720° 递减在 beltGeometry 内做一次；v2 曾双重扣减）
    const restoreT = st.beltRestoring ? st.beltRestoreT : 0
    const tau = st.beltRestoring ? st.beltTarget : st.beltTau
    const axisArr: [number, number, number] = [st.beltAxis.x, st.beltAxis.y, st.beltAxis.z]
    const flipDir = beltRestoreFlipDir(camera, axisArr)
    const stations = beltStations({
      tau,
      axis: axisArr,
      attachRadius: beltExitRadius(axisArr, vertices),
      restoreT,
      restoreFlipDir: flipDir,
    })
    // 厚板顶点：每站 4 个 = (e1±n·h, e2±n·h)，h = 半厚
    const h = BELT_THICKNESS / 2
    for (let i = 0; i < stations.length; i++) {
      const s = stations[i]!
      const [ex1, ey1, ez1] = s.e1
      const [ex2, ey2, ez2] = s.e2
      const [nx, ny, nz] = s.n
      const o = i * 12
      arr[o + 0] = ex1 + nx * h; arr[o + 1] = ey1 + ny * h; arr[o + 2] = ez1 + nz * h
      arr[o + 3] = ex2 + nx * h; arr[o + 4] = ey2 + ny * h; arr[o + 5] = ez2 + nz * h
      arr[o + 6] = ex2 - nx * h; arr[o + 7] = ey2 - ny * h; arr[o + 8] = ez2 - nz * h
      arr[o + 9] = ex1 - nx * h; arr[o + 10] = ey1 - ny * h; arr[o + 11] = ez1 - nz * h
    }
    attr.needsUpdate = true
    geom.computeVertexNormals()
    // 三棒架随锚点走（皮带随轴重新对准）：位置 = 锚点站，三棒沿锚端帧 (T, W₀, N)。
    // 锚端帧全程冻结（v7：两端都不动，见 beltGeometry）。
    const s0 = stations[0]!
    fixture.position.set(s0.cx, s0.cy, s0.cz)
    const wx = s0.e1[0] - s0.e2[0], wy = s0.e1[1] - s0.e2[1], wz = s0.e1[2] - s0.e2[2]
    const wl = Math.hypot(wx, wy, wz) || 1
    const wDir = _beltW.set(wx / wl, wy / wl, wz / wl)
    const nDir = _beltN.set(s0.n[0], s0.n[1], s0.n[2])
    // 方向棒只保留**背离物体端的半根**（+û；朝物体端那半根会埋进皮带体内看不见）——
    // 竖轴静息态（锚点上、皮带下垂）即用户说的「上半」，与 W 满棒 / N 正面半棒区分
    const tDir = _beltT.set(st.beltAxis.x, st.beltAxis.y, st.beltAxis.z).normalize()
    for (const rod of fixture.children) {
      const m = rod as THREE.Mesh
      const role = m.userData.role as string
      const dir = role === 'dir' ? tDir : role === 'w' ? wDir : nDir
      m.quaternion.setFromUnitVectors(_Y_UP, dir)
      if (role === 'dir') {
        // 方向棒：从锚点沿 +û（背离皮带）伸出的半根
        m.position.copy(tDir).multiplyScalar(ROD_DIR_LEN / 2)
      } else if (role === 'n') {
        // 法向棒：只保留**正面（+N）**半根——法向棒穿过带面，背面半根不画（v7 点4）
        m.position.copy(nDir).multiplyScalar(ROD_NORMAL_HALF / 2)
      } else {
        m.position.set(0, 0, 0)
      }
    }
    // 尖端箭头：贴正面（+N 偏移半厚 + 微抬），指向朝外（+T）。箭头的**头**落在尖端上：
    // 中心 = 尖端 − T·半长 ⇒ 覆盖皮带最后 ARROW_LEN 段（不可用 +T，会推进物体内部被面片盖住）；
    // 正面偏移 = 半厚 + 0.02（0.008 时与带面共面，被深度冲突吞掉——真机截图实测）
    // 尖端 12% 不扭（BELT_TIP_MARGIN）⇒ 箭头朝向静态可读。
    // 基矩阵列 (X=T, Y=W, Z=N) 为右手系（det = T·(W×N) = +1）
    const tip = stations[stations.length - 1]!
    const tipWx = tip.e1[0] - tip.e2[0], tipWy = tip.e1[1] - tip.e2[1], tipWz = tip.e1[2] - tip.e2[2]
    const tipWl = Math.hypot(tipWx, tipWy, tipWz) || 1
    const tipW = _beltW.set(tipWx / tipWl, tipWy / tipWl, tipWz / tipWl)
    const tipN = _beltN.set(tip.n[0], tip.n[1], tip.n[2])
    const tipT = _beltT.set(tip.cx - s0.cx, tip.cy - s0.cy, tip.cz - s0.cz).normalize() // 朝外（锚点→尖端）
    arrow.position.set(
      tip.cx - tipT.x * (ARROW_LEN / 2) + tipN.x * (BELT_THICKNESS / 2 + 0.02),
      tip.cy - tipT.y * (ARROW_LEN / 2) + tipN.y * (BELT_THICKNESS / 2 + 0.02),
      tip.cz - tipT.z * (ARROW_LEN / 2) + tipN.z * (BELT_THICKNESS / 2 + 0.02),
    )
    _arrowM.makeBasis(tipT, tipW, tipN)
    arrow.quaternion.setFromRotationMatrix(_arrowM)
  })

  return <primitive object={group} />
}

function SymmetryScene({
  group, symmetryType, data,
  showAction, actionElementId, rotateSpeed,
  locked, onHint, hintOnIdle, replaySignal,
  compose, resetSignal, onPoseChange, onBeltChange, beltRestoreSignal,
  lockCameraOnAction, onAnimationEnd, centerOn,
}: {
  group: Group
  symmetryType: SymmetryType
  data: SymmetryData | null
  showAction: boolean
  actionElementId: string | null
  rotateSpeed: number
  locked: boolean
  onHint?: (msg: string) => void
  hintOnIdle: boolean
  replaySignal: number
  compose: boolean
  resetSignal: number
  onPoseChange?: (q: [number, number, number, number]) => void
  onBeltChange?: (tau: number) => void
  beltRestoreSignal: number
  lockCameraOnAction: boolean
  onAnimationEnd?: () => void
  /** 画面中心：'solid' = 几何体中心（缺省）；'beltAnchor' = 皮带固定端（仅 2T 有意义） */
  centerOn: 'solid' | 'beltAnchor'
}) {
  const { t } = useTranslation()
  const [animPhase, setAnimPhase] = useState<AnimPhase>('rest')

  // 四面体顶点（传给 BeltStrap 算「轴出口半径」= 皮带尖端停靠点）
  const beltVertices = useMemo(
    () => (data ? data.vertices.map(v => [v.x, v.y, v.z] as [number, number, number]) : []),
    [data],
  )

  const animInfo = useMemo(() => {
    if (!showAction || !actionElementId || !data) return null
    // 引用解析接受 id / label / value —— 传 label 不再是静默失败（未命中会 warn 一次）
    const el = resolveElementWarn(group, actionElementId, 'SymmetryViewScene.actionElementId')
    if (!el) return null
    const result = computeGeometricRotation(group, el)
    if (!result || result.angleRad === 0) return null
    return result
  }, [showAction, actionElementId, group, data])

  const targetQuat = useMemo(() => {
    if (!animInfo || animInfo.angleRad === 0) return null
    const q = new THREE.Quaternion()
    q.setFromAxisAngle(new THREE.Vector3(...animInfo.axis), animInfo.angleRad)
    return q
  }, [animInfo])

  // 2T 皮带账本参数：非 2T 群不传（hook 内皮带恒 0、不上报）。
  // animInfo 变化（换演示元素）即更新 twist——与四元数同一触发节奏。
  const [beltRestoringUi, setBeltRestoringUi] = useState(false)
  const beltParam = useMemo(
    () => (symmetryType === 'binaryTetrahedron'
      ? {
          twist: animInfo?.beltTwist ?? 0,
          axis: animInfo?.axis ?? null,
          onChange: onBeltChange,
          onRestoreChange: setBeltRestoringUi,
        }
      : undefined),
    [symmetryType, animInfo, onBeltChange],
  )

  const animRef = useAnimatedRotation(
    targetQuat, rotateSpeed, setAnimPhase, replaySignal, onAnimationEnd, compose, resetSignal, onPoseChange,
    beltParam, beltRestoreSignal,
  )

  // 720° 复原演练（v8）：**两端固定**——四面体与锚点全程不动，皮带中段拉伸成环
  // 套过物体端解扣（Egan 编舞，见 beltGeometry 文件头时间轴注释 / DiracAnimation.gif）。
  // v6 的「物体端绕锚点公转」与 v7.2 的「原地翻面」都已删除（用户两轮反馈）。

  // 画面中心：'solid' = 几何体中心（原点）；'beltAnchor' = 皮带固定端
  // （锚点 = 旋转轴 û·BELT_ANCHOR_DIST，随演示元素换轴而移动）。
  // v7 起复原演练不再强制切换（两端都不动，没有需要跟随的物体——保持用户设定）。
  // 期望值每帧写给 centerRef，轨道控制器只在期望值变化时平滑动画 target
  // （用户右键平移后挂起，见 SymmetryOrbitControls）。
  const centerRef = useRef(new THREE.Vector3())
  useFrame(() => {
    const st = animRef.current
    const anchorMode = centerOn === 'beltAnchor' && symmetryType === 'binaryTetrahedron'
    if (anchorMode) {
      centerRef.current.copy(st.beltAxis).multiplyScalar(BELT_ANCHOR_DIST)
    } else {
      centerRef.current.set(0, 0, 0)
    }
  })

  // 演示状态反馈：统一经 onHint 上抛（主画布 hint bar / ViewWindow 底部浮条），宿主各自决定单处展示位置
  const activeEl = useMemo(
    () => (showAction && actionElementId
      ? resolveElementWarn(group, actionElementId, 'SymmetryViewScene.actionElementId')
      : null),
    [showAction, actionElementId, group],
  )
  const statusText = useMemo(() => {
    if (!activeEl || !animInfo) return null
    const phaseSuffix = animPhase === 'reset' ? ` — ${t('symmetry.reset')}`
      : animPhase === 'homing' ? ` — ${t('symmetry.homing')}`
        : animPhase === 'rotating' ? ` — ${t('symmetry.rotating')}`
          : ''
    return { label: activeEl.label, action: animInfo.label, suffix: phaseSuffix }
  }, [activeEl, animInfo, animPhase, t])

  useEffect(() => {
    if (!showAction) return
    // 2T 复原演练中：提示行让位给演练文案（绕过锚点解开两整扭）
    if (symmetryType === 'binaryTetrahedron' && beltRestoringUi) {
      onHint?.(t('symmetry.beltRestoring'))
      return
    }
    if (!statusText) {
      // 演示开启但当前元素无可演示的几何旋转（未选 / 恒等）→ 仅主画布需要 clickHint 引导；
      // ViewWindow 的引导文案写在 ⚙ 面板元素列表旁（hintOnIdle=false），浮条只显示真实演示状态
      if (hintOnIdle) onHint?.(t('symmetry.clickHint'))
      return
    }
    // 2T：附加**累计**皮带扭转（SU(2) 记忆——q 与 −q 物体旋转相同、靠它区分）。
    // 账本在 ref 里（hook 私有），渲染期不可读——在 effect 里读；本 effect 随
    // statusText（phase 切换）重跑，触发/落定两个时刻恰好都能拿到最新账本目标值。
    const beltSuffix = symmetryType === 'binaryTetrahedron' && animRef.current.beltTarget > 1e-9
      ? ` · 皮带累计 ${Math.round((animRef.current.beltTarget * 180) / Math.PI)}°`
      : ''
    onHint?.(`<span class="hint-highlight">${statusText.label}</span>: ${statusText.action}${statusText.suffix}${beltSuffix}`)
  }, [showAction, statusText, onHint, hintOnIdle, t, symmetryType, animRef, beltRestoringUi])

  const hasData = !!data
  const isDirected = data?.directed === true
  const dataRadius = useMemo(() => data ? data.vertices[0].length() : 4, [data])

  // fullTurn（−I）：物体转满 360° 外观恒等，其轴是 sl23Spin 人为选的 (0,1,0)，
  // 不构成真实旋转轴——隐藏轴标记（sl23.ts Sl23Spin.fullTurn 注释即此约定）
  const showAxis = animInfo && Math.abs(animInfo.angleRad) > 1e-10 && !animInfo.fullTurn
  const axisLen = dataRadius * 1.4
  const axisTo = showAxis
    ? new THREE.Vector3(...animInfo!.axis).normalize().multiplyScalar(axisLen)
    : new THREE.Vector3()
  const axisNeg = showAxis
    ? new THREE.Vector3(...animInfo!.axis).normalize().multiplyScalar(-axisLen * 0.6)
    : new THREE.Vector3()
  const axisIntersections = useMemo(() => {
    if (!showAxis || !data) return []
    const dir = new THREE.Vector3(...animInfo!.axis).normalize()
    const intersections: { pos: THREE.Vector3; kind: 'vertex' | 'edge' | 'face-center' }[] = []
    const VERTEX_THRESH = 0.25
    const EDGE_MID_THRESH = 0.25
    const FACE_CENTER_THRESH = 0.25

    for (const v of data.vertices) {
      const proj = v.dot(dir)
      const closest = dir.clone().multiplyScalar(proj)
      if (v.distanceTo(closest) < VERTEX_THRESH) {
        intersections.push({ pos: closest.clone(), kind: 'vertex' })
      }
    }

    for (const [a, b] of data.edges) {
      const mid = data.vertices[a].clone().add(data.vertices[b]).multiplyScalar(0.5)
      const proj = mid.dot(dir)
      const closest = dir.clone().multiplyScalar(proj)
      if (mid.distanceTo(closest) < EDGE_MID_THRESH) {
        intersections.push({ pos: closest.clone(), kind: 'edge' })
      }
    }

    const triangularFaces = computeTriangularFaces(data)
    const faceCenters = computeFaceCenters(data, triangularFaces)
    for (const fc of faceCenters) {
      const proj = fc.dot(dir)
      const closest = dir.clone().multiplyScalar(proj)
      if (fc.distanceTo(closest) < FACE_CENTER_THRESH) {
        intersections.push({ pos: closest.clone(), kind: 'face-center' })
      }
    }

    const merged: { pos: THREE.Vector3; kind: 'vertex' | 'edge' | 'face-center' }[] = []
    for (const intr of intersections) {
      const dup = merged.find(m => m.pos.distanceTo(intr.pos) < 0.01)
      if (!dup) merged.push(intr)
      else if (intr.kind === 'vertex' && dup.kind !== 'vertex') {
        dup.kind = 'vertex'; dup.pos.copy(intr.pos)
      } else if (intr.kind === 'face-center' && dup.kind === 'edge') {
        dup.kind = 'face-center'; dup.pos.copy(intr.pos)
      }
    }

    return merged
  }, [showAxis, animInfo, data])

  if (!hasData) return null

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <directionalLight position={[-5, -2, -3]} intensity={0.6} />
      <pointLight position={[0, 5, 0]} intensity={0.5} />

      {/* 几何体 + 轴标记：常态静止（v7 复原演练两端固定，四面体不参与任何平移） */}
      {showAxis && (
        <AxisMarker
          from={axisNeg}
          to={axisTo}
          intersections={axisIntersections}
        />
      )}

      <AnimatedGeo data={data} symmetryType={symmetryType} isDirected={isDirected} animState={animRef} />

      {symmetryType === 'binaryTetrahedron' && <BeltStrap animState={animRef} vertices={beltVertices} />}

      {symmetryType === 'dihedral' && data.vertices.length > 2 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[data.vertices[0].length() * 0.97, 64]} />
          <meshStandardMaterial color="#66aaff" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {symmetryType === 'cyclic' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[data.vertices[0].length() * 0.93, data.vertices[0].length() * 0.97, 64]} />
          <meshStandardMaterial color="#ff6b6b" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* 相机轨道：四元数版（无经纬极硬钳——OrbitControls 的 phi∈[0,π] 会停在
          南极点，用户反馈「不能越过南北极」2026-10-15；数学同 cayley3dOrbit）。
          centerRef = 期望画面中心（体心 / 皮带固定端；v7 起演练期间不再强制切换） */}
      <SymmetryOrbitControls locked={locked} rotateDisabled={showAction && lockCameraOnAction} centerRef={centerRef} />
    </>
  )
}

function UnsupportedOverlay({ group }: { group: Group }) {
  const { t } = useTranslation()
  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg-canvas)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      <p style={{ fontSize: '18px', marginBottom: '8px' }}><span dangerouslySetInnerHTML={{ __html: renderTex(texify(group.name)) }} /></p>
      <p style={{ fontSize: '14px', color: 'var(--text-subtle)' }}>{t('symmetry.unsupported')}</p>
      <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>{t('symmetry.supported')}</p>
    </div>
  )
}
