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
        <Html distanceFactor={12} center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div
            style={{
              color: '#fff', fontSize: 11, fontWeight: 'bold',
              textShadow: '0 0 6px rgba(0,0,0,0.8)', whiteSpace: 'nowrap',
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

const EdgeLine = memo(function EdgeLine({ start, end, color, isHighlighted, isSelfLoop }: EdgeLineProps) {
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
      {/* Skip arrow cones to reduce draw calls on large graphs */}
    </group>
  )
})

// ArrowCone removed for performance on large graphs

function SceneContent() {
  const {
    currentGroup, selectedElements, selectElement,
    cayleyActions, cayleyMultiplyType, cayleyShape3D, subsets
  } = useGroup()
  const { hoverElement, setHoverElement } = useHover()
  const { t } = useTranslation()
  const { gl, camera } = useThree()
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
      o.radius = Math.min(25, Math.max(3, o.radius * Math.pow(0.95, e.deltaY / 100)))
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
  }, [gl, camera])

  // 每帧：手动拖拽的 theta/phi 已在 pointer 处理中直接更新；此处应用自动旋转增量并同步相机。
  // 球坐标 phi 无界（可无限翻越上下极点）；up 在 phi 越过 0 或 π（两极点）时翻转，画面保持正立
  useFrame((_, delta) => {
    if (!currentGroup) return
    const o = orbit.current
    if (!o.initialized) {
      // 从当前相机位置反推初始轨道（兼容会话恢复等外部设置的相机）
      const v = new THREE.Vector3().subVectors(camera.position, o.target)
      o.radius = Math.min(25, Math.max(3, v.length()))
      o.phi = Math.acos(Math.min(1, Math.max(-1, v.y / o.radius)))
      o.theta = Math.atan2(v.x, v.z)
      o.initialized = true
    }
    if (autoRotate) {
      const d = dragVec.current
      const len = Math.hypot(d.x, d.y)
      const rate = (len >= 8 ? 0.35 + Math.min(0.65, len / 360) : 1) * 2 * Math.PI
      // 与手动拖拽同约定（拖右 theta -=；拖下 phi -=），方向与最后一次拖拽完全一致
      o.theta -= (len >= 8 ? (d.x / len) * rate : rate) * delta
      o.phi -= (len >= 8 ? (d.y / len) * rate : 0) * delta
    }
    const sinP = Math.sin(o.phi)
    camera.position.set(
      o.target.x + o.radius * sinP * Math.sin(o.theta),
      o.target.y + o.radius * Math.cos(o.phi),
      o.target.z + o.radius * sinP * Math.cos(o.theta)
    )
    // 越过上下任一极点（sinφ 变号）时翻转 up，保持画面正立连续
    camera.up.set(0, sinP >= 0 ? 1 : -1, 0)
    camera.lookAt(o.target)
  })

  const resetCamera = useCallback(() => {
    const o = orbit.current
    o.theta = 0
    o.phi = Math.acos(3 / Math.sqrt(3 ** 2 + 12 ** 2))
    o.radius = Math.sqrt(3 ** 2 + 12 ** 2)
    o.target.set(0, 0, 0)
  }, [])

  useEffect(() => {
    const el = gl.domElement
    const onDoubleClick = () => resetCamera()
    el.addEventListener('dblclick', onDoubleClick)
    return () => el.removeEventListener('dblclick', onDoubleClick)
  }, [gl, resetCamera])

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

  const sphericalThreshold = 400
  const isLargeGroup = currentGroup ? (
    cayleyShape3D === 'spherical' ? currentGroup.order > sphericalThreshold : currentGroup.order > 100
  ) : false
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
        <Html fullscreen position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: 10, right: 10,
            display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto'
          }}>
            <div style={{
              background: 'rgba(15, 15, 26, 0.85)', color: '#ccc',
              padding: '6px 12px', borderRadius: 8, fontSize: 13,
              fontFamily: 'monospace', pointerEvents: 'none'
            }}>
              <span style={{ fontWeight: 'bold' }} dangerouslySetInnerHTML={{ __html: renderTex(texify(currentGroup.symbol)) }} />
              <span style={{ marginLeft: 8, color: '#888' }}>|G| = {currentGroup.order}</span>
            </div>
            <button
              onClick={() => setAutoRotate(v => !v)}
              title={t('cayley3d.autoRotate')}
              aria-label={t('cayley3d.autoRotate')}
              style={{
                background: 'rgba(15, 15, 26, 0.85)',
                color: autoRotate ? '#4ecdc4' : '#ccc',
                border: autoRotate ? '1px solid #4ecdc4' : '1px solid #444',
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
                background: 'rgba(15, 15, 26, 0.85)', color: '#ccc',
                border: '1px solid #444', borderRadius: 8, padding: '6px 10px',
                fontSize: 13, cursor: 'pointer', fontFamily: 'monospace'
              }}
            >
              ⟲
            </button>
          </div>
        </Html>
      )}

      {currentGroup && cayleyActions.length > 0 && (
        <Html fullscreen position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(15, 15, 26, 0.85)', color: '#ccc',
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
        camera={{ position: [0, 3, 12], fov: 50, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bgColor]} />
        <SceneContent />
      </Canvas>
    </div>
  )
}
