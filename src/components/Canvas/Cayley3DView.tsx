import { useRef, useMemo, useEffect, useState, useCallback, memo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import type { GroupElement, Generator, CayleyEdgeData } from '../../core/types'
import { computeCayleyActionEdges } from '../../core/algebra/forceLayout'
import { compute3DPositions } from '../../core/algebra/layout3D'
import { texify, renderTex } from '../../utils/texify'
import { registerCayley3DControls, unregisterCayley3DControls } from '../../utils/cayley3dControls'
import type { Cayley3DControlAPI } from '../../utils/cayley3dControls'

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
  onSelectElement: (id: string, additive: boolean) => void
  onPointerEnter: (el: GroupElement) => void
  onPointerLeave: (el: GroupElement | null) => void
}

const NodeSphere = memo(function NodeSphere({ position, label, color, isSelected, isHovered, subsetColor, element, onSelectElement, onPointerEnter, onPointerLeave }: NodeSphereProps) {
  const texLabel = useMemo(() => renderTex(texify(label)), [label])
  const { theme } = useTheme()
  const isDark = theme === 'dark'

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
        <sphereGeometry args={[isSelected || isHovered ? 0.55 : 0.42, isSelected || isHovered ? 24 : 12, isSelected || isHovered ? 24 : 12]} />
        <meshStandardMaterial
          color={isSelected || isHovered ? color : subsetColor || color}
          emissive={isSelected || isHovered ? color : subsetColor || color}
          emissiveIntensity={isSelected || isHovered ? 0.6 : subsetColor ? 0.4 : 0.2}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {subsetColor && !isSelected && (
        <mesh>
          <sphereGeometry args={[0.55, 32, 32]} />
          <meshBasicMaterial color={subsetColor} transparent opacity={0.25} />
        </mesh>
      )}
      {isSelected && (
        <mesh>
          <sphereGeometry args={[0.62, 32, 32]} />
          <meshBasicMaterial color="#ffd93d" transparent opacity={0.3} />
        </mesh>
      )}
      {(isSelected || isHovered) && (
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
}

const StraightEdge = memo(function StraightEdge({ start, end, color, isHighlighted }: { start: THREE.Vector3; end: THREE.Vector3; color: string; isHighlighted: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const dir = new THREE.Vector3().subVectors(end, start)
  const len = dir.length()
  dir.normalize()

  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  const thickness = isHighlighted ? 0.08 : 0.05

  useEffect(() => {
    if (!meshRef.current) return
    const quat = new THREE.Quaternion()
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone())
    meshRef.current.quaternion.copy(quat)
  }, [dir])

  return (
    <mesh ref={meshRef} position={mid}>
      <cylinderGeometry args={[thickness, thickness, len, 4, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHighlighted ? 0.7 : 0.25} roughness={0.4} />
    </mesh>
  )
})

// 直线边箭头锥：仅小群渲染（避免大群 draw call 爆炸）；与 2D 约定一致，双向边不画箭头
const ArrowCone = memo(function ArrowCone({ position, direction, color, isHighlighted }: {
  position: THREE.Vector3
  direction: THREE.Vector3
  color: string
  isHighlighted: boolean
}) {
  const quat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    return q
  }, [direction])
  return (
    <mesh position={position} quaternion={quat}>
      <coneGeometry args={[0.11, 0.32, 8, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHighlighted ? 0.7 : 0.25} roughness={0.4} />
    </mesh>
  )
})

const EdgeLine = memo(function EdgeLine({ start, end, color, isHighlighted, isSelfLoop, isBidirectional, showArrow }: EdgeLineProps) {
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

  const dir = new THREE.Vector3().subVectors(end, start)
  dir.normalize()

  return (
    <group>
      <StraightEdge start={start} end={end} color={color} isHighlighted={isHighlighted} />
      {showArrow && !isBidirectional && (
        <ArrowCone
          position={end.clone().addScaledVector(dir, -0.66)}
          direction={dir}
          color={color}
          isHighlighted={isHighlighted}
        />
      )}
    </group>
  )
})

function SceneContent() {
  const {
    currentGroup, selectedElements, selectElement,
    cayleyActions, cayleyMultiplyType, cayleyShape3D, subsets
  } = useGroup()
  const { hoverElement, setHoverElement } = useHover()
  const { t } = useTranslation()
  const { gl, camera, scene } = useThree()
  const [autoRotate, setAutoRotate] = useState(false)
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

  const isLargeGroup = currentGroup ? currentGroup.order > 100 : false
  const visibleElementIds = useMemo(() => {
    if (!currentGroup) return new Set<string>()
    if (!isLargeGroup) return new Set(currentGroup.elements.map(e => e.id))
    const ids = new Set<string>([currentGroup.identity.id])
    for (const a of cayleyActions.filter(x => x.enabled).slice(0, 4)) ids.add(a.elementId)
    for (const id of selectedElements) ids.add(id)
    for (let i = 0; i < currentGroup.elements.length; i += Math.max(1, Math.ceil(currentGroup.order / 24))) {
      ids.add(currentGroup.elements[i].id)
    }
    return ids
  }, [currentGroup, cayleyActions, selectedElements, isLargeGroup])

  const cayleyEdges = useMemo(() => {
    if (!currentGroup) return [] as CayleyEdgeData[]
    return computeCayleyActionEdges(currentGroup, cayleyActions, cayleyMultiplyType)
  }, [currentGroup, cayleyActions, cayleyMultiplyType])

  const positions = useMemo(() => {
    if (!currentGroup) return [] as THREE.Vector3[]
    return compute3DPositions(currentGroup, cayleyShape3D).map(
      p => new THREE.Vector3(p[0], p[1], p[2])
    )
  }, [currentGroup, cayleyShape3D])

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
  const groupKey = currentGroup ? `${currentGroup.symbol}|${currentGroup.order}` : ''

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
  }, [groupKey, cayleyShape3D, resetCamera])

  useEffect(() => {
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
  }, [gl, camera, fitOrbit])

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
    if (!currentGroup) return
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
      isReady: () => !!currentGroup,
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
  }, [currentGroup, gl, scene, camera, displayAngVel])

  const elementLookup = useMemo(() => {
    const m = new Map<string, GroupElement>()
    if (!currentGroup) return m
    for (const el of currentGroup.elements) m.set(el.id, el)
    return m
  }, [currentGroup])

  const actionLabelMap = useMemo(() => {
    const m = new Map<string, string>()
    if (!currentGroup) return m
    for (const a of cayleyActions) {
      const el = elementLookup.get(a.elementId)
      if (el) m.set(a.elementId, el.label)
    }
    return m
  }, [cayleyActions, currentGroup, elementLookup])

  const subsetOf = useMemo(() => {
    const m = new Map<string, (typeof subsets)[number]>()
    if (!currentGroup) return m
    for (const s of subsets) {
      for (const id of s.elementIds) {
        if (!m.has(id)) m.set(id, s)
      }
    }
    return m
  }, [subsets, currentGroup])

  const edgeDataMap = useMemo(() => {
    const m = new Map<string, EdgeData>()
    if (!currentGroup) return m
    const edgeBudget = isLargeGroup ? Math.max(60, currentGroup.order * 2) : Number.POSITIVE_INFINITY
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
            apply: () => currentGroup.elements[0],
            inverse: {} as Generator
          },
          isSelfLoop: edge.isSelfLoop,
          isBidirectional: edge.isBidirectional,
        })
      }
      if (m.size >= edgeBudget) break
    }
    return m
  }, [cayleyEdges, positions, currentGroup, isLargeGroup, visibleElementIds, elementLookup])

  if (!currentGroup) return null

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} color="#ffffff" />
      <directionalLight position={[-10, -5, -10]} intensity={0.3} color="#4488ff" />
      <pointLight position={[0, 0, 0]} intensity={0.3} color="#ffffff" />

      {currentGroup && (
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
              <span style={{ fontWeight: 'bold' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup.symbol)) }} />
              <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>|G| = {currentGroup.order}</span>
            </div>
            <button
              onClick={() => setAutoRotate(v => !v)}
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
      )}

      {currentGroup && cayleyActions.length > 0 && (
        <Html fullscreen position={[0, 0, 0]} style={{ pointerEvents: 'none' }} wrapperClass="gv-html-fullscreen">
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'var(--bg-tooltip)', color: 'var(--text-secondary)',
            padding: '8px 14px', borderRadius: 8, fontSize: 13,
            fontFamily: 'monospace', pointerEvents: 'none'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              {cayleyMultiplyType === 'right' ? t('cayley3d.multiplyRight') : t('cayley3d.multiplyLeft')}
            </div>
            {cayleyActions.filter(a => a.enabled).map(action => {
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

      {Array.from(edgeDataMap.values()).map((edge) => {
        const fromEl = elementLookup.get(edge.fromId)
        const toEl = elementLookup.get(edge.toId)
        if (!fromEl || !toEl) return null
        const isHighlighted = (
          selectedElements.has(fromEl.id) ||
          selectedElements.has(toEl.id)
        )
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
          />
        )
      })}

      {positions.map((pos, i) => {
        const el = currentGroup.elements[i]
        if (isLargeGroup && !visibleElementIds.has(el.id)) return null
        const isSelected = selectedElements.has(el.id)
        const parentSubset = subsetOf.get(el.id)
        return (
          <NodeSphere
            key={el.id}
            position={pos}
            label={el.label}
            color={getElementColor(i, currentGroup.order, currentGroup.isAbelian)}
            isSelected={isSelected}
            isHovered={hoverElement?.id === el.id}
            subsetColor={parentSubset ? parentSubset.color : null}
            element={el}
            onSelectElement={selectElement}
            onPointerEnter={setHoverElement}
            onPointerLeave={setHoverElement}
          />
        )
      })}

    </>
  )
}

export function Cayley3DView() {
  const { currentGroup } = useGroup()
  const { t } = useTranslation()
  const { theme } = useTheme()

  if (!currentGroup) {
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
        <SceneContent />
      </Canvas>
    </div>
  )
}
