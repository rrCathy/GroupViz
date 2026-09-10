import { useMemo, useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import { resolveElementWarn } from '../../utils/elementRef'
import type { SceneTheme } from './SceneThemeRoot'
import { computeElementRotation } from '../../core/elementRotation'
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
 *  react 侧不再二次选轴——单一真源，避免两层各算一遍导致语义漂移。 */
function computeGeometricRotation(group: Group, element: GroupElement): { axis: [number,number,number]; angleRad: number; label: string } | null {
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
  /** 重放信号：宿主自增该值即对当前演示元素重播一次动画（姿态不改变目标，
   *  解决同元素动画播完一次后无入口重看的缺口）；缺省 0 */
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
}: SymmetryViewSceneProps) {
  const symmetryType = symmetryTypeProp ?? getSymmetryType(group)
  const isDark = theme ? theme === 'dark' : dark

  // hooks 前置（不随 unsupported 分支提前返回，保证切换群时 hooks 顺序稳定）
  const data = useMemo((): SymmetryData => {
    const radius = 4
    switch (symmetryType) {
      case 'cyclic': return getCyclicFigure(group.order, radius)
      case 'dihedral': { const n = group.order / 2; return getDihedralFigure(Math.round(n), radius) }
      case 'tetrahedron': return getTetrahedron(radius)
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
          lockCameraOnAction={lockCameraOnAction}
          onAnimationEnd={onAnimationEnd}
        />
      </Canvas>
    </div>
  )
}


function useAnimatedRotation(
  targetQuat: THREE.Quaternion | null,
  speed: number,
  onPhaseChange: (phase: 'rest' | 'reset' | 'rotating') => void,
  replaySignal?: number,
  onAnimationEnd?: () => void,
) {
  const stateRef = useRef({
    target: null as THREE.Quaternion | null,
    t: 2,
    speed: 1,
    phase: 'rest' as 'rest' | 'reset' | 'rotating',
    settled: false,
    currentQuat: new THREE.Quaternion(),
  })

  // 结束回调放 ref：避免宿主每帧传新闭包导致 useFrame 里读到过期函数。
  // 用 effect 同步而非渲染期赋值 —— 渲染期写 ref 会触发 react-hooks/refs。
  const endRef = useRef(onAnimationEnd)
  useEffect(() => { endRef.current = onAnimationEnd }, [onAnimationEnd])

  useEffect(() => { stateRef.current.speed = speed }, [speed])

  useEffect(() => {
    if (targetQuat) {
      stateRef.current.target = targetQuat.clone()
      stateRef.current.t = 0
      stateRef.current.phase = 'reset'
      stateRef.current.settled = false
      onPhaseChange('reset')
    } else {
      stateRef.current.target = null
      stateRef.current.t = 2
      stateRef.current.settled = false
      stateRef.current.phase = 'rest'
      stateRef.current.currentQuat.identity()
      onPhaseChange('rest')
    }
  }, [targetQuat, onPhaseChange])

  // 显式重放：replaySignal 递增即对当前姿态再播一次（不改变目标），
  // 解决"动画只在元素切换时播一次、同元素无法重看"的交互缺口。
  useEffect(() => {
    const st = stateRef.current
    if (!replaySignal || !st.target) return
    st.t = 0
    st.phase = 'reset'
    st.settled = false
    onPhaseChange('reset')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaySignal])

  useFrame((_, dt) => {
    const st = stateRef.current
    if (!st.target || st.t > 1.5) return
    st.t += dt * st.speed
    if (st.phase === 'reset') {
      if (st.t >= 0.5) { st.phase = 'rotating'; st.t = 0.5; onPhaseChange('rotating') }
      else { st.currentQuat.identity(); return }
    }
    if (st.t >= 1) {
      st.t = 2; st.settled = true; st.phase = 'rest'; onPhaseChange('rest')
      st.currentQuat.copy(st.target)
      // 姿态落定 → 通知宿主「这次演示播完了」（重放会再次触发）
      endRef.current?.()
    } else {
      st.currentQuat.slerpQuaternions(new THREE.Quaternion(), st.target, (st.t - 0.5) / 0.5)
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

    if (['tetrahedron', 'cube', 'icosahedron'].includes(symmetryType)) {
      const fc = symmetryType === 'cube' ? '#ff9944' : symmetryType === 'tetrahedron' ? '#44cc88' : '#cc66ff'
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

function SymmetryScene({
  group, symmetryType, data, variant,
  showAction, actionElementId, rotateSpeed,
  showFigureTitle, dark, locked, onHint, hintOnIdle, replaySignal,
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
  lockCameraOnAction: boolean
  onAnimationEnd?: () => void
}) {
  const { t } = useTranslation()
  const [animPhase, setAnimPhase] = useState<'rest' | 'reset' | 'rotating'>('rest')

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

  const animRef = useAnimatedRotation(targetQuat, rotateSpeed, setAnimPhase, replaySignal, onAnimationEnd)

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
    onHint?.(`<span class="hint-highlight">${statusText.label}</span>: ${statusText.action}${statusText.suffix}`)
  }, [showAction, statusText, onHint, hintOnIdle, t])

  const hasData = !!data
  const isDirected = data?.directed === true
  const topY = useMemo(() => data ? data.vertices.reduce((max, v) => Math.max(max, v.y), -Infinity) : 0, [data])
  const dataRadius = useMemo(() => data ? data.vertices[0].length() : 4, [data])

  const showAxis = animInfo && Math.abs(animInfo.angleRad) > 1e-10
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
