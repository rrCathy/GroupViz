import { useMemo, useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import { resolveElementWarn } from '../../utils/elementRef'
import type { SceneTheme } from './SceneThemeRoot'
import { computeElementRotation, type RotationInfo } from '../../core/elementRotation'
import type { Group, GroupElement } from '../../core/types'
import { getSymmetryType } from '../../core/symmetryType'
import type { SymmetryType } from '../../core/symmetryType'

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
  /** 顶部群名 + 几何描述标注；缺省 true（小窗可关） */
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
  showFigureTitle = true,
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

  if (symmetryType === 'unsupported') return <UnsupportedOverlay group={group} />

  const bgColor = isDark ? '#0a0a1a' : '#f4f4f7'

  return (
    <div style={{ width: '100%', height: '100%', background: bgColor }}>
      <Canvas camera={{ position: [0, 3, 10], fov: 50, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
        <color attach="background" args={[bgColor]} />
        <SymmetryScene
          group={group}
          symmetryType={symmetryType}
          data={data}
          variant={variant}
          showAction={showAction}
          actionElementId={actionElementId}
          rotateSpeed={rotateSpeed}
          showFigureTitle={showFigureTitle}
          dark={isDark}
          locked={locked}
          onHint={onHint}
          hintOnIdle={hintOnIdle}
          replaySignal={replaySignal}
          compose={compose}
          resetSignal={resetSignal}
          onPoseChange={onPoseChange}
          onBeltChange={onBeltChange}
          lockCameraOnAction={lockCameraOnAction}
          onAnimationEnd={onAnimationEnd}
        />
      </Canvas>
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
   *  θ_el = 2ψ（弧度，正标量；非 2T 群不传 ⇒ 皮带恒 0 且不上报）。
   *  非叠加：reset 段先把皮带 unwind 回 0、rotating 段再扭到 θ_el；
   *  叠加：从当前累计直接累加（与四元数左乘同节奏）；homing：动画回 0。
   *  落定/复位完成时经 `onChange` 上报**累计** τ。 */
  belt?: { twist: number; onChange?: (tau: number) => void },
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
  }, [belt])

  useEffect(() => { stateRef.current.speed = speed }, [speed])

  useEffect(() => {
    const st = stateRef.current
    const twist = beltRef.current?.twist ?? 0
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
  animState: { current: { currentQuat: THREE.Quaternion } }
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
        <cylinderGeometry args={[0.12, 0.12, len, 8]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={1.0} roughness={0.1} />
      </mesh>
      <mesh position={to} quaternion={quat}>
        <coneGeometry args={[0.28, 0.7, 8, 1]} />
        <meshStandardMaterial color="#ff3333" emissive="#ff0000" emissiveIntensity={1.0} roughness={0.1} />
      </mesh>
      {intersections.map((intr, i) => (
        <mesh key={i} position={intr.pos}>
          <sphereGeometry args={[intr.kind === 'vertex' ? 0.24 : intr.kind === 'face-center' ? 0.22 : 0.16, 12, 12]} />
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
 * Dirac 开口皮带（2T 对称性视图专用）：世界锚点 (0, BELT_ANCHOR_Y, 0)
 * 为固定端（扭转为 0），物体端在中心 (0,0,0) 携带全扭转 θ。N=64 段
 * ribbon，截面绕竖轴转 θ·s（s∈[0,1] 沿带参数）；双色条纹（沿带每 8 站
 * 交替明暗）让扭转圈数可读；锚点小横杆固定件。
 *
 * θ = animState.current.beltTau（账本在 useAnimatedRotation：每元素贡献
 * 2ψ，compose 累计、homing 回 0）。**渲染取 mod 720°（两整扭拓扑复原）**：
 * 0° 平带 / 360° 一整扭 / 720° ≡ 0°。混合轴链为已知近似（用户模型口径，
 * 见 ~/.commandcode/plans/sl23-belt-symmetry.md §3）。
 * ------------------------------------------------------------------ */
const BELT_ANCHOR_Y = 6.3
const BELT_SEGMENTS = 64
const BELT_WIDTH = 0.55
const BELT_TWO_TURNS = Math.PI * 4

function BeltStrap({ animState }: {
  animState: { current: { beltTau: number } }
}) {
  const [group] = useState(() => new THREE.Group())
  const ribbonRef = useRef<THREE.Mesh | null>(null)

  // 静态件：锚点小横杆固定件（横杆 + 两端小球）
  useEffect(() => {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 1.5, 10),
      new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.4 }),
    )
    bar.rotation.z = Math.PI / 2
    bar.position.set(0, BELT_ANCHOR_Y, 0)
    group.add(bar)
    for (const x of [-0.75, 0.75]) {
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 12, 12),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.3 }),
      )
      cap.position.set(x, BELT_ANCHOR_Y, 0)
      group.add(cap)
    }
  }, [group])

  // ribbon 几何一次性建好（位置逐帧更新；颜色建时写死）
  useEffect(() => {
    const stations = BELT_SEGMENTS + 1
    const pos = new Float32Array(stations * 2 * 3)
    const col = new Float32Array(stations * 2 * 3)
    const idx: number[] = []
    for (let i = 0; i < BELT_SEGMENTS; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1
      idx.push(a, b, c, b, d, c)
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
    geom.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geom.setIndex(idx)
    const c1 = new THREE.Color('#e2e8f0'), c2 = new THREE.Color('#7c8ba1')
    for (let i = 0; i < stations; i++) {
      const c = Math.floor(i / 8) % 2 === 0 ? c1 : c2
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6)
    }
    const mesh = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({
      vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.05,
    }))
    ribbonRef.current = mesh
    group.add(mesh)
    return () => {
      geom.dispose()
      ;(mesh.material as THREE.Material).dispose()
      group.remove(mesh)
      ribbonRef.current = null
    }
  }, [group])

  useFrame(() => {
    const mesh = ribbonRef.current
    if (!mesh) return
    const attr = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const tau = animState.current.beltTau
    const theta = ((tau % BELT_TWO_TURNS) + BELT_TWO_TURNS) % BELT_TWO_TURNS
    const half = BELT_WIDTH / 2
    for (let i = 0; i <= BELT_SEGMENTS; i++) {
      const s = i / BELT_SEGMENTS
      const y = BELT_ANCHOR_Y * (1 - s)
      const a = theta * s
      const ca = Math.cos(a), sa = Math.sin(a)
      // 截面（沿 X 的 ±half 带）绕竖轴转 a：(x,z) → (x·cos a + z·sin a, −x·sin a + z·cos a)
      arr[i * 6 + 0] =  half * ca; arr[i * 6 + 1] = y; arr[i * 6 + 2] = -half * sa
      arr[i * 6 + 3] = -half * ca; arr[i * 6 + 4] = y; arr[i * 6 + 5] =  half * sa
    }
    attr.needsUpdate = true
    mesh.geometry.computeVertexNormals()
  })

  return <primitive object={group} />
}

function SymmetryScene({
  group, symmetryType, data, variant,
  showAction, actionElementId, rotateSpeed,
  showFigureTitle, dark, locked, onHint, hintOnIdle, replaySignal,
  compose, resetSignal, onPoseChange, onBeltChange,
  lockCameraOnAction, onAnimationEnd,
}: {
  group: Group
  symmetryType: SymmetryType
  data: SymmetryData | null
  variant: boolean
  showAction: boolean
  actionElementId: string | null
  rotateSpeed: number
  showFigureTitle: boolean
  dark: boolean
  locked: boolean
  onHint?: (msg: string) => void
  hintOnIdle: boolean
  replaySignal: number
  compose: boolean
  resetSignal: number
  onPoseChange?: (q: [number, number, number, number]) => void
  onBeltChange?: (tau: number) => void
  lockCameraOnAction: boolean
  onAnimationEnd?: () => void
}) {
  const { t } = useTranslation()
  const [animPhase, setAnimPhase] = useState<AnimPhase>('rest')

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
  const beltParam = useMemo(
    () => (symmetryType === 'binaryTetrahedron'
      ? { twist: animInfo?.beltTwist ?? 0, onChange: onBeltChange }
      : undefined),
    [symmetryType, animInfo, onBeltChange],
  )

  const animRef = useAnimatedRotation(targetQuat, rotateSpeed, setAnimPhase, replaySignal, onAnimationEnd, compose, resetSignal, onPoseChange, beltParam)

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
  }, [showAction, statusText, onHint, hintOnIdle, t, symmetryType, animRef])

  const hasData = !!data
  const isDirected = data?.directed === true
  const topY = useMemo(() => data ? data.vertices.reduce((max, v) => Math.max(max, v.y), -Infinity) : 0, [data])
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

      {showFigureTitle && (
        <Html position={[0, topY + 1.5, 0]} center zIndexRange={[2, 0]} wrapperClass="gv-html-overlay">
          <div style={{ color: dark ? '#fff' : '#1a1a2e', fontSize: '20px', fontWeight: 'bold', textShadow: dark ? '0 0 10px rgba(0,0,0,0.8)' : 'none', whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: renderTex(texify(group.name)) }} />
        </Html>
      )}

      {showFigureTitle && (
        <Html position={[0, topY + 2.2, 0]} center zIndexRange={[2, 0]} wrapperClass="gv-html-overlay">
          <div style={{ color: dark ? '#aaa' : '#555566', fontSize: '13px', textShadow: dark ? '0 0 8px rgba(0,0,0,0.8)' : 'none', whiteSpace: 'nowrap', userSelect: 'none', pointerEvents: 'none' }}
            dangerouslySetInnerHTML={{ __html: renderTex(
              // 副标题只描述几何形态（群名已在上方标题行，不再重复符号前缀）
              symmetryType === 'cyclic' ? t('symmetry.geo.cyclicText', { n: group.order }) :
              symmetryType === 'dihedral' ? t('symmetry.geo.dihedralText', { n: group.order / 2 }) :
              symmetryType === 'cube' ? (variant ? t('symmetry.geo.octahedron') : t('symmetry.geo.cube')) :
              symmetryType === 'icosahedron' ? (variant ? t('symmetry.geo.dodecahedron') : t('symmetry.geo.icosahedron')) :
              t('symmetry.geo.' + symmetryType)
            ) }} />
        </Html>
      )}

      {showAxis && (
        <AxisMarker
          from={axisNeg}
          to={axisTo}
          intersections={axisIntersections}
        />
      )}

      <AnimatedGeo data={data} symmetryType={symmetryType} isDirected={isDirected} animState={animRef} />

      {symmetryType === 'binaryTetrahedron' && <BeltStrap animState={animRef} />}

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

      <OrbitControls
        enableDamping={false}
        minDistance={2}
        maxDistance={20}
        enableRotate={!locked && !(showAction && lockCameraOnAction)}
        enablePan={!locked && !(showAction && lockCameraOnAction)}
        enableZoom={!locked}
      />
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
