import { memo, useMemo, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import type { Group, GroupElement } from '../../core/types'
import { layoutSylowFiber, type SylowFiberNode } from '../../core/algebra/layoutSylowFiber'
import { renderTex, texify } from '../../utils/texify'

/** 节点球半径。层内节点间距约 1.3（layoutSylowFiber 的 nodeSpacing），
 *  取 0.30 让球/间距 ≈ 0.23——环面上 120 个节点的场景下仍能看清管子与中孔。 */
const NODE_RADIUS = 0.3
const NODE_COLOR = '#5B8FF9'
const NODE_ACTIVE = '#FFD93D'
/** 子群内部凯莱边（每一层都是同一个群的不同共轭副本，故同色） */
const INNER_EDGE_COLOR = '#1D9E75'
/** 共轭映射（层间侧棱） */
const CONJ_EDGE_COLOR = '#EF9F27'
const RING_GUIDE_COLOR = '#8A93A6'
const CAMERA_FOV = 40
/** 默认机位方向：斜上方 + 偏转方位角，让环面前后层错开、中孔可辨 */
const CAMERA_DIR: Triple = [0.42, 0.62, 0.66]
const RING_SEGMENTS = 72

type Triple = [number, number, number]

export interface SylowTorusSceneProps {
  /** 群；null → 空态占位 */
  group: Group | null
  /** 素数 p：铺开该素数下的全部 Sylow p-子群 */
  prime: number
  /** 选中元素集合（调用方自持会话态） */
  selectedElements?: Set<string>
  /** 节点点击选中回调；缺省 no-op */
  onSelectElement?: (id: string, additive: boolean) => void
  /** 渲染主题；缺省回落到 ThemeContext */
  theme?: 'dark' | 'light'
  /** 节点球缩放 0.5–2.0；缺省 1 */
  nodeScale?: number
  /** 布局模式；缺省 auto（n_p ≥ 4 圆环面，否则弧状柱面） */
  mode?: 'auto' | 'cylinder' | 'torus'
  /** 自动旋转；缺省 false */
  autoRotate?: boolean
}

interface FiberNodeProps {
  node: SylowFiberNode
  isActive: boolean
  isSelected: boolean
  nodeScale: number
  isDark: boolean
  onSelect: (id: string, additive: boolean) => void
  onHover: (el: GroupElement | null) => void
}

const FiberNode = memo(function FiberNode({
  node, isActive, isSelected, nodeScale, isDark, onSelect, onHover,
}: FiberNodeProps) {
  const texLabel = useMemo(() => renderTex(texify(node.element.label)), [node.element.label])
  const p = node.position
  const lit = isActive || isSelected
  return (
    <group position={[p.x, p.y, p.z]}>
      <mesh
        onClick={e => {
          e.stopPropagation()
          onSelect(node.element.id, e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)
        }}
        onPointerEnter={() => onHover(node.element)}
        onPointerLeave={() => onHover(null)}
      >
        <sphereGeometry args={[NODE_RADIUS * nodeScale * (lit ? 1.22 : 1), 16, 16]} />
        <meshStandardMaterial
          color={lit ? NODE_ACTIVE : NODE_COLOR}
          emissive={lit ? NODE_ACTIVE : NODE_COLOR}
          emissiveIntensity={isSelected ? 0.85 : isActive ? 0.6 : 0.22}
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
      {lit && (
        <Html
          distanceFactor={12}
          center
          style={{ pointerEvents: 'none', userSelect: 'none' }}
          wrapperClass="gv-html-overlay"
        >
          <div
            style={{
              color: 'var(--node-text, #eaeaea)',
              fontSize: 11,
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              fontFamily: 'serif',
              textShadow: isDark ? '0 0 6px rgba(0,0,0,0.85)' : '0 0 4px rgba(255,255,255,0.9)',
            }}
            dangerouslySetInnerHTML={{ __html: texLabel }}
          />
        </Html>
      )}
    </group>
  )
})

interface BodyProps {
  group: Group
  prime: number
  selectedElements: Set<string>
  onSelectElement: (id: string, additive: boolean) => void
  theme: 'dark' | 'light'
  nodeScale: number
  mode: 'auto' | 'cylinder' | 'torus'
  autoRotate: boolean
}

function SylowTorusBody({
  group, prime, selectedElements, onSelectElement, theme, nodeScale, mode, autoRotate,
}: BodyProps) {
  const [hovered, setHovered] = useState<GroupElement | null>(null)
  const layout = useMemo(() => layoutSylowFiber(group, prime, { mode }), [group, prime, mode])

  const nodeOf = useMemo(() => {
    const m = new Map<string, SylowFiberNode>()
    for (const n of layout?.nodes ?? []) m.set(n.key, n)
    return m
  }, [layout])

  /** 把一批边摊平成 segments（每两个点一段），从而每条线只占一个 drawcall */
  const segmentPoints = useMemo(() => {
    const collect = (pick: (e: NonNullable<typeof layout>['edges'][number]) => boolean): Triple[] => {
      const out: Triple[] = []
      for (const e of layout?.edges ?? []) {
        if (!pick(e)) continue
        const a = nodeOf.get(e.a)
        const b = nodeOf.get(e.b)
        if (!a || !b) continue
        out.push(
          [a.position.x, a.position.y, a.position.z],
          [b.position.x, b.position.y, b.position.z],
        )
      }
      return out
    }
    return {
      inner: collect(e => e.kind === 'inner'),
      conjCommon: collect(e => e.kind === 'conj' && !!e.common),
      conjPlain: collect(e => e.kind === 'conj' && !e.common),
    }
  }, [layout, nodeOf])

  /** 每层的截面圆导轨 */
  const ringGuidePoints = useMemo(() => {
    const out: Triple[] = []
    for (const l of layout?.layers ?? []) {
      const rx = Math.cos(l.theta)
      const rz = Math.sin(l.theta)
      const at = (phi: number): Triple => [
        l.center.x + l.radius * Math.cos(phi) * rx,
        l.center.y + l.radius * Math.sin(phi),
        l.center.z + l.radius * Math.cos(phi) * rz,
      ]
      for (let i = 0; i < RING_SEGMENTS; i++) {
        out.push(at((2 * Math.PI * i) / RING_SEGMENTS), at((2 * Math.PI * (i + 1)) / RING_SEGMENTS))
      }
    }
    return out
  }, [layout])

  if (!layout) return null

  const isDark = theme === 'dark'
  const rings: ReactNode[] = layout.nodes.map(n => (
    <FiberNode
      key={n.key}
      node={n}
      isActive={hovered?.id === n.element.id}
      isSelected={selectedElements.has(n.element.id)}
      nodeScale={nodeScale}
      isDark={isDark}
      onSelect={onSelectElement}
      onHover={setHovered}
    />
  ))

  return (
    <>
      <ambientLight intensity={isDark ? 0.45 : 0.75} />
      <directionalLight position={[8, 14, 10]} intensity={isDark ? 0.9 : 0.7} color="#ffffff" />
      <directionalLight position={[-10, -6, -10]} intensity={0.25} color="#7fa8ff" />

      {ringGuidePoints.length > 0 && (
        <Line
          points={ringGuidePoints}
          segments
          color={RING_GUIDE_COLOR}
          lineWidth={0.8}
          transparent
          opacity={0.22}
        />
      )}
      {segmentPoints.inner.length > 0 && (
        <Line
          points={segmentPoints.inner}
          segments
          color={INNER_EDGE_COLOR}
          lineWidth={1.6}
          transparent
          opacity={0.6}
        />
      )}
      {segmentPoints.conjPlain.length > 0 && (
        <Line
          points={segmentPoints.conjPlain}
          segments
          color={CONJ_EDGE_COLOR}
          lineWidth={1.3}
          transparent
          opacity={0.42}
        />
      )}
      {segmentPoints.conjCommon.length > 0 && (
        <Line
          points={segmentPoints.conjCommon}
          segments
          color={CONJ_EDGE_COLOR}
          lineWidth={3}
          transparent
          opacity={0.95}
        />
      )}

      {rings}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.12}
        autoRotate={autoRotate}
        autoRotateSpeed={0.9}
        minDistance={layout.boundsRadius * 0.6}
        maxDistance={layout.boundsRadius * 8}
      />
    </>
  )
}

/** Sylow p-子群共轭纤维化：柱面 / 圆环面（自包含 Canvas，与 Cayley3DScene 同惯例） */
export function SylowTorusScene(props: SylowTorusSceneProps) {
  const {
    group, prime, selectedElements, onSelectElement, theme: themeProp,
    nodeScale = 1, mode = 'auto', autoRotate = false,
  } = props
  const { t } = useTranslation()
  const { theme: ctxTheme } = useTheme()
  const theme = themeProp ?? ctxTheme
  const layout = useMemo(
    () => (group ? layoutSylowFiber(group, prime, { mode }) : null),
    [group, prime, mode],
  )

  if (!group) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }
  if (!layout) {
    return (
      <div className="view-empty">
        <p>{t('sylowView.torusNoOrbit')}</p>
      </div>
    )
  }

  const bgColor = theme === 'dark' ? '#0a0a1a' : '#f4f4f7'
  const distance = (layout.boundsRadius / Math.tan((CAMERA_FOV * Math.PI) / 360)) * 1.28
  const norm = Math.hypot(CAMERA_DIR[0], CAMERA_DIR[1], CAMERA_DIR[2])
  const camPos: Triple = [
    (CAMERA_DIR[0] / norm) * distance,
    (CAMERA_DIR[1] / norm) * distance,
    (CAMERA_DIR[2] / norm) * distance,
  ]

  return (
    <div style={{ width: '100%', height: '100%', background: bgColor }}>
      <Canvas
        camera={{ position: camPos, fov: CAMERA_FOV, near: 0.1, far: 2000 }}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={[bgColor]} />
        <SylowTorusBody
          group={group}
          prime={prime}
          selectedElements={selectedElements ?? new Set<string>()}
          onSelectElement={onSelectElement ?? (() => {})}
          theme={theme}
          nodeScale={nodeScale}
          mode={mode}
          autoRotate={autoRotate}
        />
      </Canvas>
    </div>
  )
}
