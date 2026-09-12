import { useRef, useMemo, useEffect, useState, useCallback, memo, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import type { Group, GroupElement, Generator, MultiplyType, Layout3D } from '../../core/types'
import { getDefaultLayout3D } from '../../core/types'
import {
  computeCayleyActionEdges, isIdentityScale, relaxEdgeLengths3D, resolveCayleyPath,
} from '../../core/algebra/forceLayout'
import type { Vec3 } from '../../core/algebra/layouts3D/shared'
import { compute3DPositions } from '../../core/algebra/layout3D'
import { wordLengthColor } from '../../core/algebra/layouts3D/wordLengthSphereLayout3D'
import { texify, renderTex } from '../../utils/texify'
import { registerCayley3DControls, unregisterCayley3DControls } from '../../utils/cayley3dControls'
import type { Cayley3DControlAPI } from '../../utils/cayley3dControls'
import { normalizeCayleyActions } from '../../context/cayleyActions'
import type {
  CayleyActionParam, Cayley3DFaceFillParams, CayleyPathHighlight,
} from '../../core/types/viewConfig'
import { subgroupFaces, buildUndirectedEdgeKeys, FACE_COLOR_PALETTE } from '../../core/algebra/faces3D'

interface EdgeData {
  fromIdx: number
  toIdx: number
  fromId: string
  toId: string
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  gen: Generator
  isSelfLoop: boolean
  isBidirectional?: boolean
}

function getElementColor(idx: number, total: number, isAbelian: boolean): string {
  if (isAbelian) {
    const hue = (idx / total) * 360
    return `hsl(${hue}, 60%, 55%)`
  }
  const hue = (idx * 137.508) % 360
  return `hsl(${hue}, 65%, 55%)`
}

interface NodeSphereProps {
  position: THREE.Vector3
  label: string
  color: string
  isSelected: boolean
  isHovered: boolean
  subsetColor: string | null
  element: GroupElement
  nodeScale: number
  showLabel: boolean
  /** 深色主题（label 阴影深浅）。由 Scene 层从 theme prop / ThemeContext 统一解析后传入（FGVE 入包：子组件不再读 context） */
  isDark: boolean
  onSelectElement: (id: string, additive: boolean) => void
  onPointerEnter: (el: GroupElement) => void
  onPointerLeave: (el: GroupElement | null) => void
}

const NodeSphere = memo(function NodeSphere({ position, label, color, isSelected, isHovered, subsetColor, element, nodeScale, showLabel, isDark, onSelectElement, onPointerEnter, onPointerLeave }: NodeSphereProps) {
  const texLabel = useMemo(() => renderTex(texify(label)), [label])
  const primary = isSelected || isHovered
  const seg = primary ? 24 : 12

  return (
    <group position={position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelectElement(element.id, e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)
        }}
        onPointerEnter={() => onPointerEnter(element)}
        onPointerLeave={() => onPointerLeave(null)}
      >
        <sphereGeometry args={[primary ? 0.55 * nodeScale : 0.42 * nodeScale, seg, seg]} />
        <meshStandardMaterial
          color={primary ? color : subsetColor || color}
          emissive={primary ? color : subsetColor || color}
          emissiveIntensity={primary ? 0.6 : subsetColor ? 0.4 : 0.2}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {subsetColor && !isSelected && (
        <mesh>
          <sphereGeometry args={[0.55 * nodeScale, 32, 32]} />
          <meshBasicMaterial color={subsetColor} transparent opacity={0.25} />
        </mesh>
      )}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[0.62 * nodeScale, 32, 32]} />
          <meshBasicMaterial color="#ffd93d" transparent opacity={0.3} />
        </mesh>
      )}
      {showLabel && primary && (
        <Html distanceFactor={12} center style={{ pointerEvents: 'none', userSelect: 'none' }} wrapperClass="gv-html-overlay">
          <div
            style={{
              color: 'var(--node-text)', fontSize: 11, fontWeight: 'bold',
              textShadow: isDark ? '0 0 6px rgba(0,0,0,0.8)' : '0 0 4px rgba(255,255,255,0.9)', whiteSpace: 'nowrap',
              fontFamily: 'serif', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            dangerouslySetInnerHTML={{ __html: texLabel }}
          />
        </Html>
      )}
    </group>
  )
})

interface EdgeLineProps {
  start: THREE.Vector3
  end: THREE.Vector3
  color: string
  isHighlighted: boolean
  isSelfLoop: boolean
  isBidirectional?: boolean
  showArrow?: boolean
  /** 贴球面弧边（wordLengthSphere 布局）：边沿球面拱起而非直弦穿球 */
  curved?: boolean
  /** 淡化（字长球布局的环边/非树边）：减细减淡，凸显主干场线 */
  dimmed?: boolean
}

const StraightEdge = memo(function StraightEdge({ start, end, color, isHighlighted, dimmed }: { start: THREE.Vector3; end: THREE.Vector3; color: string; isHighlighted: boolean; dimmed?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  const dir = new THREE.Vector3().subVectors(end, start)
  const len = dir.length()
  dir.normalize()

  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  const thickness = isHighlighted ? 0.08 : dimmed ? 0.018 : 0.05

  useEffect(() => {
    const mesh = meshRef.current
    // 真实 R3F 下 mesh 是 THREE.Mesh（quaternion 必在）；测试 stub 的 DOM 元素无此属性，跳过
    if (!mesh?.quaternion) return
    const quat = new THREE.Quaternion()
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone())
    mesh.quaternion.copy(quat)
  }, [dir])

  // transparent 切换需要显式 needsUpdate（否则 three 不会重新编译/应用混合状态，
  // 表现为"淡化只在材质首次创建时生效、之后改路径无效"）
  useEffect(() => {
    const m = matRef.current
    if (m && typeof m.needsUpdate !== 'undefined') m.needsUpdate = true
  }, [dimmed])

  return (
    <mesh ref={meshRef} position={mid}>
      <cylinderGeometry args={[thickness, thickness, len, 4, 1]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={isHighlighted ? 0.7 : dimmed ? 0.1 : 0.25}
        roughness={0.4}
        transparent={!!dimmed}
        opacity={dimmed ? 0.2 : 1}
      />
    </mesh>
  )
})

/**
 * 贴球面弧边（wordLengthSphere 专用）：**slerp 球面航线弧**——
 * 沿两端点的径向方向做球面插值（slerp），半径随路径线性渐变。
 * 短边（同枝相邻壳层）≈ 微拱短弧；跨枝长边贴着壳层绕行而不是
 * 直弦穿球，球内边网有序。S₄ 球面嵌入下即标准大圆弧（测地线）。
 * 字长球布局的边全为无向（对换生成元），无箭头。
 * 曲线顶点为场景绝对坐标，mesh 不再附加位移。
 */
const GeodesicEdge = memo(function GeodesicEdge({ start, end, color, isHighlighted, dimmed }: { start: THREE.Vector3; end: THREE.Vector3; color: string; isHighlighted: boolean; dimmed?: boolean }) {
  const geometry = useMemo(() => {
    const a = new THREE.Vector3(...start)
    const b = new THREE.Vector3(...end)
    const ra = a.length()
    const rb = b.length()
    const ua = ra < 1e-9 ? new THREE.Vector3(0, 1, 0) : a.clone().divideScalar(ra)
    const ub = rb < 1e-9 ? new THREE.Vector3(0, 1, 0) : b.clone().divideScalar(rb)
    const omega = THREE.MathUtils.clamp(ua.dot(ub), -1, 1)
    const angle = Math.acos(omega)
    const segments = THREE.MathUtils.clamp(Math.ceil(angle / 0.25) + 2, 4, 48)
    const points: THREE.Vector3[] = []
    const sinOmega = Math.sin(angle)
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      let dir: THREE.Vector3
      if (sinOmega < 1e-9) {
        dir = ua.clone().lerp(ub, t) // 同方向（含同点）：线性兜底
      } else {
        const wa = Math.sin((1 - t) * angle) / sinOmega
        const wb = Math.sin(t * angle) / sinOmega
        dir = ua.clone().multiplyScalar(wa).addScaledVector(ub, wb)
      }
      points.push(dir.multiplyScalar(ra + (rb - ra) * t))
    }
    const curve = new THREE.CatmullRomCurve3(points)
    // 弧边管细 + 微透明：球面布局边密度高（S₅ 240 条），细管减负、透明度让交叉处不糊
    const thickness = isHighlighted ? 0.07 : dimmed ? 0.012 : 0.024
    return new THREE.TubeGeometry(curve, Math.min(64, segments * 2), thickness, 6, false)
  }, [start, end, isHighlighted, dimmed])

  useEffect(() => () => geometry.dispose(), [geometry])

  // transparent / opacity 变化后需要 needsUpdate（同 StraightEdge）
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  useEffect(() => {
    const m = matRef.current
    if (m && typeof m.needsUpdate !== 'undefined') m.needsUpdate = true
  }, [dimmed])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={isHighlighted ? 0.7 : dimmed ? 0.05 : 0.35}
        roughness={0.4}
        transparent
        opacity={isHighlighted ? 1 : dimmed ? 0.12 : 0.8}
      />
    </mesh>
  )
})

// 直线边箭头锥：仅小群渲染（避免大群 draw call 爆炸）；与 2D 约定一致，双向边不画箭头
const ArrowCone = memo(function ArrowCone({ position, direction, color, isHighlighted, dimmed }: {
  position: THREE.Vector3
  direction: THREE.Vector3
  color: string
  isHighlighted: boolean
  dimmed?: boolean
}) {
  const quat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    return q
  }, [direction])
  // transparent 切换需要 needsUpdate（同 StraightEdge）
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  useEffect(() => {
    const m = matRef.current
    if (m && typeof m.needsUpdate !== 'undefined') m.needsUpdate = true
  }, [dimmed])
  return (
    <mesh position={position} quaternion={quat}>
      <coneGeometry args={[0.11, 0.32, 8, 1]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={color}
        emissiveIntensity={isHighlighted ? 0.7 : dimmed ? 0.05 : 0.25}
        roughness={0.4}
        transparent={!!dimmed}
        opacity={dimmed ? 0.12 : 1}
      />
    </mesh>
  )
})

const EdgeLine = memo(function EdgeLine({ start, end, color, isHighlighted, isSelfLoop, isBidirectional, showArrow, curved, dimmed }: EdgeLineProps) {
  if (isSelfLoop) {
    return (
      <group position={start}>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 1.0, 0]}>
          <torusGeometry args={[0.4, 0.04, 8, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHighlighted ? 0.7 : 0.2} roughness={0.4} />
        </mesh>
        <mesh position={[0.4, 1.0, 0]}>
          <coneGeometry args={[0.08, 0.2, 6, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHighlighted ? 0.7 : 0.2} roughness={0.4} />
        </mesh>
      </group>
    )
  }

  // 贴球面弧边：字长球等球面布局专用（全为无向边，不画箭头）
  if (curved) {
    return <GeodesicEdge start={start} end={end} color={color} isHighlighted={isHighlighted} dimmed={dimmed} />
  }

  const dir = new THREE.Vector3().subVectors(end, start)
  dir.normalize()

  return (
    <group>
      <StraightEdge start={start} end={end} color={color} isHighlighted={isHighlighted} dimmed={dimmed} />
      {showArrow && !isBidirectional && (
        <ArrowCone
          position={end.clone().addScaledVector(dir, -0.66)}
          direction={dir}
          color={color}
          isHighlighted={isHighlighted}
          dimmed={dimmed}
        />
      )}
    </group>
  )
})

const NOOP_SELECT = () => {}

export interface Cayley3DSceneProps {
  /** 群；null → .view-empty 占位 */
  group: Group | null
  /** 选中元素集合（调用方自持会话态） */
  selectedElements: Set<string>
  /** 节点点击选中回调；缺省 no-op */
  onSelectElement?: (id: string, additive: boolean) => void
  /** 作用边元素集合；缺省 = 群生成元（normalizeCayleyActions 归一化） */
  actions?: CayleyActionParam[]
  /** 边的乘法方向；缺省 'right' */
  multiplyType?: MultiplyType
  /** 3D 布局形状；缺省 getDefaultLayout3D(group) */
  layout3D?: Layout3D
  /** 节点球缩放 0.5–2.0；缺省 1 */
  nodeScale?: number
  /** 自动旋转；缺省 false。prop 优先，未设置时内部 ▶ 按钮本地态兜底 */
  autoRotate?: boolean
  /** 是否显示 hover/选中 Html 标签；缺省 true */
  showLabels?: boolean
  /** 锁定相机交互（轨道拖拽/滚轮缩放/右键平移）；保留点击选中与双击复位 */
  locked?: boolean
  /** 子集高亮（元素 id → 颜色）；context subsets 的同构映射 */
  subsetHighlights?: { elementIds: string[]; color: string }[]
  /** 渲染主题（canvas 背景 / label 阴影）。缺省回落到 ThemeContext（无 Provider 时 'dark'）；
   *  主应用壳不传即保持现状（读全局主题），包消费端显式传以与容器主题解耦 */
  theme?: 'dark' | 'light'
  /** 子群陪集面填充（面 = 某真子群单个陪集在布局中占满的平面凸多边形）。
   *  作者在 ⚙ 面板选择子群 H 后，几何上成面的陪集以半透明多边形显示，可逐面指定颜色 */
  faceFill?: Cayley3DFaceFillParams
  /** 路径高亮（VCL）：元素序列 / 生成元单词，见 core.resolveCayleyPath。
   *  与 2D 同一套解析与视觉语义（线段 + 节点环 + 可选序号/逐步点亮） */
  pathHighlight?: CayleyPathHighlight | null
  /** 受控悬停元素 id（与 2D `CayleyView.hoveredElementId` 对称）：命中该元素时按悬停态渲染
   *  （放大节点 + 标签 + 路径序号徽标），供外部联动（如图例/侧栏悬停）。缺省 null = 只用内部指针悬停 */
  hoveredElementId?: string | null
}

function Cayley3DSceneBody({
  group,
  selectedElements,
  onSelectElement,
  actions: actionsProp,
  multiplyType: multiplyTypeProp,
  layout3D: layout3DProp,
  nodeScale: nodeScaleProp,
  autoRotate: autoRotateProp,
  showLabels: showLabelsProp,
  locked = false,
  subsetHighlights = [],
  theme = 'dark',
  faceFill,
  pathHighlight = null,
  hoveredElementId = null,
}: Cayley3DSceneProps & { group: Group }) {
  const { t } = useTranslation()
  const { gl, camera, scene } = useThree()

  const actions = useMemo(() => normalizeCayleyActions(group, actionsProp), [group, actionsProp])
  const multiplyType = multiplyTypeProp ?? 'right'
  const layout3D = layout3DProp ?? getDefaultLayout3D(group)
  const nodeScale = nodeScaleProp ?? 1
  const showLabels = showLabelsProp !== false
  const selectElement = onSelectElement ?? NOOP_SELECT

  const [autoRotateState, setAutoRotateState] = useState(false)
  const autoRotate = autoRotateProp ?? autoRotateState
  const [hoverElement, setHoverElement] = useState<GroupElement | null>(null)
  // 受控悬停（外部联动）优先；缺省回落内部指针悬停
  const controlledHover = useMemo(
    () => (hoveredElementId ? group.elements.find(el => el.id === hoveredElementId) ?? null : null),
    [group, hoveredElementId],
  )
  const effectiveHover = controlledHover ?? hoverElement

  // 自定义轨道状态（替代 drei OrbitControls）：theta/phi 球坐标，phi 无界（可无限翻越上下极点，无 makeSafe 钳制）
  const orbit = useRef({
    theta: 0,
    phi: Math.acos(3 / Math.sqrt(3 ** 2 + 12 ** 2)),
    radius: Math.sqrt(3 ** 2 + 12 ** 2),
    target: new THREE.Vector3(0, 0, 0),
    initialized: false,
  })
  // 最近一次鼠标拖拽向量:自动旋转时按此方向持续旋转(而非固定方向)
  const dragVec = useRef({ x: 0, y: 0 })
  const dragState = useRef({ active: false, lastX: 0, lastY: 0, x: 0, y: 0, button: 0 })
  // GIF 导出期间的角度驱动：beginRotation 记录基准角并创建独立离屏渲染器/相机，
  // frameAt 按帧索引精确求角并渲染到离屏 canvas（每帧角度 = 基准 + radPerSec × 帧延时 × 帧序号，
  // 与实时渲染耗时无关）；实时轨道/相机全程不被触碰，展示区照常旋转
  const externalRotation = useRef<{
    active: boolean
    radPerSec: number
    baseTheta: number
    basePhi: number
    radius: number
    target: THREE.Vector3
    renderer: THREE.WebGLRenderer | null
    ecam: THREE.PerspectiveCamera | null
  }>({
    active: false, radPerSec: 0, baseTheta: 0, basePhi: 0, radius: 1,
    target: new THREE.Vector3(), renderer: null, ecam: null,
  })

  // 展示区自动旋转角速度（与 ▶ 自动旋转同一公式；拖拽后按拖拽向量长度降速）：
  // GIF 导出用同一值，保证导出动图与展示区转速一致
  const displayAngVel = useCallback(() => {
    const d = dragVec.current
    const len = Math.hypot(d.x, d.y)
    return (len >= 8 ? 0.35 + Math.min(0.65, len / 360) : 1) * 2 * Math.PI
  }, [])

  // 大群限流抽稀会破坏字长球的分层球壳结构（S₅=120 阶），该布局豁免：
  // 120 节点 + ~240 边对 Three.js 无压力，全量渲染保证字长分层完整可见
  const isLargeGroup = group.order > 100 && layout3D !== 'wordLengthSphere'
  const visibleElementIds = useMemo(() => {
    if (!isLargeGroup) return new Set(group.elements.map(e => e.id))
    const ids = new Set<string>([group.identity.id])
    for (const a of actions.filter(x => x.enabled).slice(0, 4)) ids.add(a.elementId)
    for (const id of selectedElements) ids.add(id)
    for (let i = 0; i < group.elements.length; i += Math.max(1, Math.ceil(group.order / 24))) {
      ids.add(group.elements[i].id)
    }
    return ids
  }, [group, actions, selectedElements, isLargeGroup])

  const cayleyEdges = useMemo(() => {
    // 字长球布局需要完整凯莱边集（S₅ 4 生成元 × 120 元素 = 480 push / 240 边，
    // 默认大群限流 order*3=360 会中途截断丢 48 条边），该布局下解除限流
    return computeCayleyActionEdges(
      group, actions, multiplyType,
      layout3D === 'wordLengthSphere' ? Number.POSITIVE_INFINITY : undefined,
    )
  }, [group, actions, multiplyType, layout3D])

  // 逐生成元边长倍率（VCL）：仅取启用且非 1 的项 → 全 1 时完全跳过松弛计算
  const lengthScaleMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of actions) {
      if (!a.enabled) continue
      if (a.lengthScale !== undefined && a.lengthScale !== 1) m.set(a.elementId, a.lengthScale)
    }
    return m
  }, [actions])

  const positions = useMemo(() => {
    const base = compute3DPositions(group, layout3D)
    // 逐生成元边长（VCL）：在基础布局之上跑长度约束松弛；倍率全 1 时原样返回（零行为变化）
    const scaled: Vec3[] = isIdentityScale(lengthScaleMap)
      ? base
      : (() => {
          const byId = new Map<string, Vec3>()
          group.elements.forEach((el, i) => {
            const p = base[i]
            if (p) byId.set(el.id, p)
          })
          const relaxed = relaxEdgeLengths3D(byId, cayleyEdges, { lengthScales: lengthScaleMap })
          return group.elements.map((el, i) => relaxed.get(el.id) ?? base[i])
        })()
    return scaled.map(p => new THREE.Vector3(p[0], p[1], p[2]))
  }, [group, layout3D, cayleyEdges, lengthScaleMap])

  // 外接球：节点云质心为球心，最大距离为半径（含节点球/自环余量），复位与初始视角均基于它
  const bounds = useMemo(() => {
    const center = new THREE.Vector3(0, 0, 0)
    if (positions.length === 0) return { center, radius: 3 }
    for (const p of positions) center.add(p)
    center.divideScalar(positions.length)
    let r = 0
    for (const p of positions) r = Math.max(r, p.distanceTo(center))
    return { center, radius: r + 1.4 }
  }, [positions])

  // 字长球壳半径：最外层节点所在的球面（S₅ 有节点被吸附到壳上 ⇒ 恰为布局半径 R；
  // S₄ 全体贴壳）。壳只作"这是一个球"的轮廓参照，不参与布局。
  const shellRadius = useMemo(() => {
    if (layout3D !== 'wordLengthSphere' || positions.length === 0) return 0
    let r = 0
    for (const p of positions) r = Math.max(r, p.distanceTo(bounds.center))
    return r
  }, [layout3D, positions, bounds])

  // 默认视角（复位目标）：外接球直径 ≈ 视口高度 2/3（d = 1.5R/tan(fov/2)），相机远在球外（d ≈ 3.2R > R）。
  // minRadius = 球外（视角不可进入外接球）；maxRadius = 适配距离 3 倍
  const fitOrbit = useMemo(() => {
    const halfFov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360
    const dist = (bounds.radius * 1.5) / Math.tan(halfFov)
    return {
      theta: 0,
      phi: Math.acos(3 / Math.sqrt(3 ** 2 + 12 ** 2)),
      radius: dist,
      minRadius: Math.max(1.5, bounds.radius + 0.8),
      maxRadius: Math.max(30, dist * 3),
      target: bounds.center.clone(),
    }
  }, [bounds, camera])

  // latestFit 在每次渲染后同步，供复位与切群/切形状自动回正使用（避免 fitOrbit 对象身份波动触发）
  const latestFit = useRef(fitOrbit)
  useEffect(() => {
    latestFit.current = fitOrbit
  })
  const groupKey = `${group.symbol}|${group.order}`

  const resetCamera = useCallback(() => {
    const o = orbit.current
    const fit = latestFit.current
    o.theta = fit.theta
    o.phi = fit.phi
    o.radius = fit.radius
    o.target.copy(fit.target)
  }, [])

  // 切换群或切换 3D 形状时自动回到默认适配视角
  useEffect(() => {
    resetCamera()
  }, [groupKey, layout3D, resetCamera])

  useEffect(() => {
    if (locked) return
    const el = gl.domElement
    const onDown = (e: PointerEvent) => {
      dragState.current = { active: true, lastX: e.clientX, lastY: e.clientY, x: 0, y: 0, button: e.button }
      el.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      const s = dragState.current
      if (!s.active) return
      const dx = e.clientX - s.lastX
      const dy = e.clientY - s.lastY
      s.lastX = e.clientX
      s.lastY = e.clientY
      s.x += dx
      s.y += dy
      const o = orbit.current
      if (s.button === 2) {
        // 右键平移 target：沿相机局部 right/up 平面移动，尺度随 radius
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1)
        o.target.addScaledVector(right, -dx * o.radius * 0.0012).addScaledVector(up, dy * o.radius * 0.0012)
      } else {
        // 左键旋转：与 OrbitControls 同约定（拖右 theta -=；拖下 phi -=），phi 无界可翻越极点
        o.theta -= dx * 0.006
        o.phi -= dy * 0.006
      }
    }
    const onUp = (e: PointerEvent) => {
      const s = dragState.current
      s.active = false
      if (Math.hypot(s.x, s.y) >= 8) dragVec.current = { x: s.x, y: s.y }
      el.releasePointerCapture?.(e.pointerId)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const o = orbit.current
      o.radius = Math.min(fitOrbit.maxRadius, Math.max(fitOrbit.minRadius, o.radius * Math.pow(0.95, -e.deltaY / 100)))
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl, camera, fitOrbit, locked])

  // 按最后一次拖拽方向将角速度分解到 theta/phi 两个分量（与手动拖拽同约定：拖右 theta -=，拖下 phi -=），
  // 未拖拽过则默认绕竖轴（theta）旋转；拖拽含竖直分量时同步带动俯仰旋转——与 ▶ 自动旋转方向完全一致
  const applyOrbitRotation = (
    o: { theta: number; phi: number },
    angVel: number,
    delta: number,
  ) => {
    const d = dragVec.current
    const len = Math.hypot(d.x, d.y)
    if (len >= 8) {
      o.theta -= (d.x / len) * angVel * delta
      o.phi -= (d.y / len) * angVel * delta
    } else {
      o.theta -= angVel * delta
    }
  }

  // 由球坐标轨道写入相机（位置/up 极点翻转/lookAt）：帧循环与 GIF 导出 frameAt 共用，保证画面与 GIF 帧一致
  const applyCameraFromOrbit = useCallback((o: { theta: number; phi: number; radius: number; target: THREE.Vector3 }) => {
    const sinP = Math.sin(o.phi)
    camera.position.set(
      o.target.x + o.radius * sinP * Math.sin(o.theta),
      o.target.y + o.radius * Math.cos(o.phi),
      o.target.z + o.radius * sinP * Math.cos(o.theta)
    )
    // 越过上下任一极点（sinφ 变号）时翻转 up，保持画面正立连续
    camera.up.set(0, sinP >= 0 ? 1 : -1, 0)
    camera.lookAt(o.target)
  }, [camera])

  // 每帧：手动拖拽的 theta/phi 已在 pointer 处理中直接更新；此处应用自动旋转增量并同步相机。
  // 球坐标 phi 无界（可无限翻越上下极点）；GIF 导出期间角度由 frameAt 精确驱动，此处仅同步相机
  useFrame((_, delta) => {
    const o = orbit.current
    if (!o.initialized) {
      // 初始视角 = 复位适配视角（外接球居中、直径占视口高度 2/3、相机在球外）
      o.theta = fitOrbit.theta
      o.phi = fitOrbit.phi
      o.radius = fitOrbit.radius
      o.target.copy(fitOrbit.target)
      o.initialized = true
    }
    if (autoRotate) {
      // GIF 导出期间实时循环不受影响：导出相机独立离屏渲染，展示区照常按此速度旋转
      applyOrbitRotation(o, displayAngVel(), delta)
    }
    applyCameraFromOrbit(o)
  })

  useEffect(() => {
    const el = gl.domElement
    const onDoubleClick = () => resetCamera()
    el.addEventListener('dblclick', onDoubleClick)
    return () => el.removeEventListener('dblclick', onDoubleClick)
  }, [gl, resetCamera])

  // 仅主视口（.canvas-viewport 内）的 3D 实例注册到导出桥；浮动窗口实例不注册，避免覆盖
  useEffect(() => {
    if (!gl.domElement.closest('.canvas-viewport')) return
    const api: Cayley3DControlAPI = {
      isReady: () => true,
      snapshotOrbit: () => {
        const o = orbit.current
        return { theta: o.theta, phi: o.phi, radius: o.radius, target: o.target.clone() }
      },
      displayAngVel: () => displayAngVel(),
      beginRotation: (radPerSec) => {
        // 记录基准角/半径/目标，并创建独立离屏渲染器 + 相机（与实时轨道/相机完全隔离，
        // 导出期间展示区照常旋转；offline renderer 的 drawing buffer 与主视口同尺寸）
        const o = orbit.current
        const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
        renderer.setSize(gl.domElement.width, gl.domElement.height, false)
        const ecam = new THREE.PerspectiveCamera(
          (camera as THREE.PerspectiveCamera).fov,
          (camera as THREE.PerspectiveCamera).aspect,
          camera.near,
          camera.far
        )
        externalRotation.current = {
          active: true, radPerSec,
          baseTheta: o.theta, basePhi: o.phi,
          radius: o.radius, target: o.target.clone(),
          renderer, ecam,
        }
        // 预热渲染一次（编译离屏 GL 着色器并建立绘制流水线），首帧角度与 frameAt(0) 一致
        const sinP0 = Math.sin(o.phi)
        ecam.position.set(
          o.target.x + o.radius * sinP0 * Math.sin(o.theta),
          o.target.y + o.radius * Math.cos(o.phi),
          o.target.z + o.radius * sinP0 * Math.cos(o.theta)
        )
        ecam.up.set(0, sinP0 >= 0 ? 1 : -1, 0)
        ecam.lookAt(o.target)
        renderer.render(scene, ecam)
      },
      // GIF 导出的第 index 帧：按帧序号与帧延时精确计算角度（与实时渲染耗时无关，
      // 方向沿用最后一次拖拽分解），渲染到离屏 canvas 并返回供导出循环采集
      frameAt: (index, frameDelayMs) => {
        const e = externalRotation.current
        if (!e.active || !e.renderer || !e.ecam) return null
        const total = (e.radPerSec * index * frameDelayMs) / 1000
        const d = dragVec.current
        const len = Math.hypot(d.x, d.y)
        let theta: number
        let phi: number
        if (len >= 8) {
          theta = e.baseTheta - (d.x / len) * total
          phi = e.basePhi - (d.y / len) * total
        } else {
          theta = e.baseTheta - total
          phi = e.basePhi
        }
        const sinP = Math.sin(phi)
        e.ecam.position.set(
          e.target.x + e.radius * sinP * Math.sin(theta),
          e.target.y + e.radius * Math.cos(phi),
          e.target.z + e.radius * sinP * Math.cos(theta)
        )
        e.ecam.up.set(0, sinP >= 0 ? 1 : -1, 0)
        e.ecam.lookAt(e.target)
        e.renderer.render(scene, e.ecam)
        return e.renderer.domElement
      },
      endRotation: () => {
        // 实时轨道/相机全程未被触碰，无需恢复；仅释放离屏渲染器
        const e = externalRotation.current
        e.active = false
        e.renderer?.dispose()
        e.renderer = null
        e.ecam = null
      },
    }
    registerCayley3DControls(api)
    return () => unregisterCayley3DControls(api)
  }, [gl, scene, camera, displayAngVel])

  const elementLookup = useMemo(() => {
    const m = new Map<string, GroupElement>()
    for (const el of group.elements) m.set(el.id, el)
    return m
  }, [group])

  const faceOpacity = faceFill?.enabled === false ? 0 : (faceFill?.opacity ?? 0.45)
  // 子群陪集面：几何上成面的陪集 → 半透明凸多边形 mesh（fan 三角化，双面渲染）
  const faceMeshes = useMemo(() => {
    const subgroup = faceFill?.subgroup
    if (faceOpacity <= 0 || !subgroup || subgroup.length === 0) return []
    const edgeKeys = buildUndirectedEdgeKeys(cayleyEdges.map(e => [e.fromIdx, e.toIdx] as [number, number]))
    const faces = subgroupFaces(
      group,
      subgroup,
      positions.map(v => [v.x, v.y, v.z] as [number, number, number]),
      edgeKeys,
    )
    if (!faces || faces.length === 0) return []
    const idxOf = new Map(group.elements.map((e, i) => [e.id, i]))
    return faces.map((f, i) => {
      const pts = f.hullElementIds.map(id => positions[idxOf.get(id)!])
      const c = new THREE.Vector3(0, 0, 0)
      for (const p of pts) c.add(p)
      c.divideScalar(pts.length)
      const arr: number[] = []
      for (let k = 0; k < pts.length; k++) {
        const p0 = pts[k]
        const p1 = pts[(k + 1) % pts.length]
        arr.push(c.x, c.y, c.z, p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
      geo.computeVertexNormals()
      const color = faceFill?.faceColors?.[f.key] ?? FACE_COLOR_PALETTE[i % FACE_COLOR_PALETTE.length]
      return { key: f.key, geometry: geo, color }
    })
  }, [group, faceFill, cayleyEdges, positions, faceOpacity])

  useEffect(() => {
    return () => {
      for (const fm of faceMeshes) fm.geometry.dispose()
    }
  }, [faceMeshes])

  const actionLabelMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of actions) {
      const el = elementLookup.get(a.elementId)
      if (el) m.set(a.elementId, el.label)
    }
    return m
  }, [actions, elementLookup])

  const subsetOf = useMemo(() => {
    const m = new Map<string, { color: string }>()
    for (const s of subsetHighlights) {
      for (const id of s.elementIds) {
        if (!m.has(id)) m.set(id, s)
      }
    }
    return m
  }, [subsetHighlights])

  const edgeDataMap = useMemo(() => {
    const m = new Map<string, EdgeData>()
    const edgeBudget = isLargeGroup ? Math.max(60, group.order * 2) : Number.POSITIVE_INFINITY
    for (const edge of cayleyEdges) {
      if (isLargeGroup && !visibleElementIds.has(edge.fromId) && !visibleElementIds.has(edge.toId)) continue
      const key = `${Math.min(edge.fromIdx, edge.toIdx)}|${Math.max(edge.fromIdx, edge.toIdx)}|${edge.actionElementId}`
      if (!m.has(key)) {
        m.set(key, {
          fromIdx: edge.fromIdx,
          toIdx: edge.toIdx,
          fromId: edge.fromId,
          toId: edge.toId,
          fromPos: positions[edge.fromIdx],
          toPos: positions[edge.toIdx],
          gen: {
            name: edge.actionElementId,
            symbol: elementLookup.get(edge.actionElementId)?.label || '',
            color: edge.color,
            apply: () => group.elements[0],
            inverse: {} as Generator
          },
          isSelfLoop: edge.isSelfLoop,
          isBidirectional: edge.isBidirectional,
        })
      }
      if (m.size >= edgeBudget) break
    }
    return m
  }, [cayleyEdges, positions, group, isLargeGroup, visibleElementIds, elementLookup])

  // ── 路径高亮（VCL）：与 2D 同一套解析（resolveCayleyPath）；3D 线段用 drei Line（像素宽）、
  //    节点环用半透明球壳、序号徽标用 Html ──
  const resolvedPath = useMemo(() => {
    if (!group || !pathHighlight) return null
    return resolveCayleyPath(group, actions, multiplyType, pathHighlight)
  }, [group, actions, multiplyType, pathHighlight])

  // 路径上的边集合（双向键，含 actionElementId）：路径高亮时其余边淡化，
  // 让"只有路径"一眼可见（缺省行为，`pathHighlight.dimOthers === false` 可关）
  const pathEdgeKeys = useMemo(() => {
    if (!resolvedPath || resolvedPath.edges.length === 0) return null
    if (pathHighlight?.dimOthers === false) return null
    const s = new Set<string>()
    for (const e of resolvedPath.edges) {
      if (!e.actionElementId) continue
      s.add(`${e.fromId}|${e.toId}|${e.actionElementId}`)
      s.add(`${e.toId}|${e.fromId}|${e.actionElementId}`)
    }
    return s
  }, [resolvedPath, pathHighlight?.dimOthers])

  // 路径动画：用「渲染期 key 校正 + 定时器自增」代替在 effect 里同步 setState（同 2D 实现）
  const pathAnimKey = resolvedPath
    ? `${resolvedPath.nodeIds.join(',')}|${resolvedPath.edges.map(e => e.actionElementId).join(',')}|${pathHighlight?.animate ? 1 : 0}`
    : ''
  const [revealState, setRevealState] = useState<{ key: string; tick: number }>({ key: '', tick: 0 })
  if (revealState.key !== pathAnimKey) {
    setRevealState({ key: pathAnimKey, tick: 0 })
  }
  const pathReveal = revealState.key === pathAnimKey ? revealState.tick : 0

  useEffect(() => {
    const total = resolvedPath?.edges.length ?? 0
    if (!resolvedPath || !pathHighlight?.animate || total === 0) return
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setRevealState(prev => (prev.key === pathAnimKey ? { key: pathAnimKey, tick: i } : prev))
      if (i >= total) window.clearInterval(timer)
    }, 320)
    return () => window.clearInterval(timer)
  }, [pathAnimKey, resolvedPath, pathHighlight?.animate])

  const pathOverlay = useMemo(() => {
    if (!group || !resolvedPath || positions.length === 0) return null
    const color = pathHighlight?.color ?? '#ffd93d'
    const width = pathHighlight?.width ?? 5
    const animate = !!pathHighlight?.animate
    const total = resolvedPath.edges.length
    const visible = animate ? Math.min(pathReveal, total) : total

    const indexOfId = new Map<string, number>()
    group.elements.forEach((el, i) => indexOfId.set(el.id, i))

    const segments: ReactNode[] = []
    for (let i = 0; i < visible; i++) {
      const e = resolvedPath.edges[i]
      if (!e.actionElementId) continue
      const a = indexOfId.get(e.fromId)
      const b = indexOfId.get(e.toId)
      if (a === undefined || b === undefined) continue
      const pa = positions[a]
      const pb = positions[b]
      segments.push(
        <Line
          key={`ph-seg-${i}`}
          points={[[pa.x, pa.y, pa.z], [pb.x, pb.y, pb.z]]}
          color={color}
          lineWidth={width}
          transparent
          opacity={0.95}
        />,
      )
    }

    const nodeLimit = animate
      ? Math.min(visible + 1, resolvedPath.nodeIds.length)
      : resolvedPath.nodeIds.length
    const rings = resolvedPath.nodeIds.slice(0, nodeLimit).map((id, i) => {
      const idx = indexOfId.get(id)
      if (idx === undefined) return null
      // 序号不常显（几百个徽标互相遮挡、远处看不清）：仅悬停该节点时显示它的次序
      const showBadge = !!pathHighlight?.showOrder && effectiveHover?.id === id
      return (
        <group key={`ph-node-${id}-${i}`} position={positions[idx]}>
          <mesh>
            <sphereGeometry args={[0.42 * nodeScale + 0.2, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} />
          </mesh>
          {showBadge && (
            <Html
              position={[0, 0.95, 0]}
              distanceFactor={12}
              center
              style={{ pointerEvents: 'none', userSelect: 'none' }}
              wrapperClass="gv-html-overlay"
            >
              <div style={{
                background: color, color: '#111111', borderRadius: 9, width: 18, height: 18,
                fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontFamily: 'monospace',
              }}>{i + 1}</div>
            </Html>
          )}
        </group>
      )
    })

    return (
      <>
        {segments}
        {rings}
      </>
    )
  }, [group, resolvedPath, positions, nodeScale, pathHighlight, pathReveal, effectiveHover])

  return (
    <>
      {/* 字长球：深度雾——远处的节点/边向背景淡化，前后层次可辨、投影交叉感降低 */}
      {layout3D === 'wordLengthSphere' && (
        <fog
          attach="fog"
          args={[
            theme === 'dark' ? '#0a0a1a' : '#f4f4f7',
            bounds.radius * 2.6,
            bounds.radius * 5.2,
          ]}
        />
      )}

      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-10, -5, -10]} intensity={0.3} color="#4488ff" />
      <pointLight position={[0, 0, 0]} intensity={0.3} color="#ffffff" />

      {/* 字长球：半透明球壳——给出"球"的整体轮廓，depthWrite=false 不遮挡内部节点/边
          （受光材质才有球面明暗渐变，纯 basic 材质会退化成一块均匀色圆盘） */}
      {shellRadius > 0 && (
        <mesh renderOrder={-1}>
          <sphereGeometry args={[shellRadius, 48, 32]} />
          <meshStandardMaterial
            color={theme === 'dark' ? '#6f9bff' : '#4f7fd6'}
            transparent
            opacity={0.07}
            depthWrite={false}
            roughness={0.9}
            metalness={0}
          />
        </mesh>
      )}

      <Html fullscreen position={[0, 0, 0]} style={{ pointerEvents: 'none' }} wrapperClass="gv-html-fullscreen">
        <div style={{
          position: 'absolute', top: 10, right: 10,
          display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto'
        }}>
          <div style={{
            background: 'var(--bg-tooltip)', color: 'var(--text-secondary)',
            padding: '6px 12px', borderRadius: 8, fontSize: 13,
            fontFamily: 'monospace', pointerEvents: 'none'
          }}>
            <span style={{ fontWeight: 'bold' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(group.symbol)) }} />
            <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>|G| = {group.order}</span>
          </div>
          <button
            onClick={() => setAutoRotateState(v => !v)}
            title={t('cayley3d.autoRotate')}
            aria-label={t('cayley3d.autoRotate')}
            style={{
              background: 'var(--bg-tooltip)',
              color: autoRotate ? 'var(--accent-teal)' : 'var(--text-secondary)',
              border: autoRotate ? '1px solid var(--accent-teal)' : '1px solid var(--border-primary)',
              borderRadius: 8, padding: '6px 10px', fontSize: 13,
              cursor: 'pointer', fontFamily: 'monospace'
            }}
          >
            {autoRotate ? '❚❚' : '▶'}
          </button>
          <button
            onClick={resetCamera}
            title={t('cayley3d.resetView')}
            aria-label={t('cayley3d.resetView')}
            style={{
              background: 'var(--bg-tooltip)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-primary)', borderRadius: 8, padding: '6px 10px',
              fontSize: 13, cursor: 'pointer', fontFamily: 'monospace'
            }}
          >
            ⟲
          </button>
        </div>
      </Html>

      {actions.length > 0 && (
        <Html fullscreen position={[0, 0, 0]} style={{ pointerEvents: 'none' }} wrapperClass="gv-html-fullscreen">
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'var(--bg-tooltip)', color: 'var(--text-secondary)',
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            fontFamily: 'monospace', pointerEvents: 'none'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {multiplyType === 'right' ? t('cayley3d.multiplyRight') : t('cayley3d.multiplyLeft')}
            </div>
            {actions.filter(a => a.enabled).map(action => {
              const label = actionLabelMap.get(action.elementId) || action.elementId
              return (
                <div key={action.elementId} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <span style={{ display: 'inline-block', width: 12, height: 3, background: action.color, borderRadius: 2 }} />
                  <span dangerouslySetInnerHTML={{ __html: renderTex(texify(label)) }} />
                </div>
              )
            })}
          </div>
        </Html>
      )}

      {faceMeshes.map(fm => (
        <mesh key={fm.key} geometry={fm.geometry} renderOrder={-2}>
          <meshBasicMaterial color={fm.color} transparent opacity={faceOpacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}

      {Array.from(edgeDataMap.values()).map((edge) => {
        const fromEl = elementLookup.get(edge.fromId)
        const toEl = elementLookup.get(edge.toId)
        if (!fromEl || !toEl) return null
        const isHighlighted = (
          selectedElements.has(fromEl.id) ||
          selectedElements.has(toEl.id)
        )
        // 路径高亮时：非路径边淡化（只留路径上的边醒目）
        const dimmed = !!pathEdgeKeys && !pathEdgeKeys.has(`${edge.fromId}|${edge.toId}|${edge.gen.name}`)
        return (
          <EdgeLine
            key={`edge-${edge.fromIdx}-${edge.toIdx}`}
            start={edge.fromPos}
            end={edge.toPos}
            color={edge.gen.color}
            isHighlighted={isHighlighted}
            isSelfLoop={edge.isSelfLoop}
            isBidirectional={edge.isBidirectional}
            showArrow={!isLargeGroup}
            curved={false}
            dimmed={dimmed}
          />
        )
      })}

      {pathOverlay}

      {positions.map((pos, i) => {
        const el = group.elements[i]
        if (isLargeGroup && !visibleElementIds.has(el.id)) return null
        const isSelected = selectedElements.has(el.id)
        const parentSubset = subsetOf.get(el.id)
        return (
          <NodeSphere
            key={el.id}
            position={pos}
            label={el.label}
            color={(layout3D === 'wordLengthSphere' ? wordLengthColor(group, el) : null) ?? getElementColor(i, group.order, group.isAbelian)}
            isSelected={isSelected}
            isHovered={effectiveHover?.id === el.id}
            subsetColor={parentSubset ? parentSubset.color : null}
            element={el}
            nodeScale={nodeScale}
            showLabel={showLabels}
            isDark={theme === 'dark'}
            onSelectElement={selectElement}
            onPointerEnter={setHoverElement}
            onPointerLeave={setHoverElement}
          />
        )
      })}

    </>
  )
}

/** 受控 3D 凯莱图（props 驱动；ViewWindow 与测试用）。空群渲染占位，非空渲染 R3F 场景。 */
export function Cayley3DScene(props: Cayley3DSceneProps) {
  const { group, theme: themeProp } = props
  const { t } = useTranslation()
  const { theme: ctxTheme } = useTheme()
  const theme = themeProp ?? ctxTheme

  if (!group) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  const bgColor = theme === 'dark' ? '#0a0a1a' : '#f4f4f7'

  return (
    <div style={{ width: '100%', height: '100%', background: bgColor }}>
      <Canvas
        camera={{ position: [0, 3, 12], fov: 50, near: 0.1, far: 400 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bgColor]} />
        <Cayley3DSceneBody {...props} group={group} theme={theme} />
      </Canvas>
    </div>
  )
}

/** 主应用入口（context 组装壳）：从全局 Provider 组装 Cayley3DScene 所需 props（保留原行为） */