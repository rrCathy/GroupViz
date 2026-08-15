import { useMemo, useRef, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import { useGroup } from '../../context/useGroup'
import { texify, renderTex } from '../../utils/texify'
import { computeFreeTree, computeFoldTree } from '../../core/algebra/cayleyTree'
import type { CayleyTree, CayleyTreeNode } from '../../core/algebra/cayleyTree'
import { presentationOf, formatPresentation } from '../../core/algebra/presentations'
import type { GroupPresentation } from '../../core/types'

const GEN_COLORS = ['#ff6b6b', '#4ecdc4', '#a78bfa']
const GLUE_COLOR = '#ffd93d'
const ROOT_COLOR = '#ffd93d'
const MAX_ZOOM = 64
const MIN_ZOOM = 0.02
const HOME_ZOOM = 8

const nodeR = (depth: number) => (depth === 0 ? 3.4 : Math.max(0.5, 2.4 - depth * 0.2))
const nodeFs = (depth: number) => (depth === 0 ? 12 : Math.max(3, 11 - depth * 1.1))
const edgeOpacity = (depth: number) => Math.max(0.5, 1 - depth * 0.05)

function Tree3DScene({ tree, selectedWord, onSelect }: {
  tree: CayleyTree
  selectedWord: string | null
  onSelect: (word: string) => void
}) {
  const base = useMemo(() => {
    let maxR = 0
    for (const n of tree.nodes) {
      const r = Math.hypot(n.x, n.y, n.z)
      if (r > maxR) maxR = r
    }
    return Math.max(100, maxR + 60)
  }, [tree])

  const camDist = base * 2.6
  const nodeR3 = Math.max(1.2, base * 0.02)

  return (
    <Canvas
      camera={{ position: [camDist, camDist * 0.75, camDist * 0.9], fov: 45 }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <ambientLight intensity={0.75} />
      <pointLight position={[base * 1.5, base * 1.5, base * 1.5]} intensity={1.1} />
      <pointLight position={[-base, -base, -base]} intensity={0.4} />
      {tree.edges.map((ed, i) => {
        const a = tree.nodes[ed.from]
        const b = tree.nodes[ed.to]
        if (!ed.isTree || a.rep !== undefined || b.rep !== undefined) return null
        return (
          <Line
            key={`e${i}`}
            points={[[a.x, a.y, a.z], [b.x, b.y, b.z]]}
            color={GEN_COLORS[ed.d >> 1] ?? '#888'}
            lineWidth={1.6}
            transparent
            opacity={0.9}
          />
        )
      })}
      {tree.nodes.map(n => {
        if (n.rep !== undefined) return null
        const isSel = selectedWord === n.label
        const color = n.depth === 0 ? ROOT_COLOR : GEN_COLORS[n.dir >> 1] ?? '#888'
        return (
          <mesh
            key={n.id}
            position={[n.x, n.y, n.z]}
            onClick={(e) => { e.stopPropagation(); onSelect(n.label) }}
          >
            <sphereGeometry args={[isSel ? nodeR3 * 1.5 : nodeR3, 14, 14]} />
            <meshStandardMaterial
              color={color}
              emissive={isSel ? GLUE_COLOR : '#000000'}
              emissiveIntensity={isSel ? 0.6 : 0}
            />
          </mesh>
        )
      })}
      <OrbitControls enableDamping={false} minDistance={20} maxDistance={base * 20} />
    </Canvas>
  )
}

export function FreeGroupTreeView() {
  const { viewBoxSize, currentGroup, activePresentationGroup, templateGenCount, visualDraft } = useGroup()
  const [zoom, setZoom] = useState(HOME_ZOOM)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)
  const dragMovedRef = useRef(false)

  const pres = useMemo<GroupPresentation | null>(() => {
    if (visualDraft) {
      const group = visualDraft.group
      return {
        generators: visualDraft.gens,
        relators: visualDraft.relators,
        generatorElements: group ? group.generators.map(g => g.apply(group.identity)) : [],
      }
    }
    const group = activePresentationGroup ?? currentGroup
    if (!group) return null
    if (group.presentation) return group.presentation
    try {
      return presentationOf(group)
    } catch {
      return null
    }
  }, [currentGroup, activePresentationGroup, visualDraft])

  const genCount = pres ? pres.generators.length : ((activePresentationGroup ?? currentGroup) ? (activePresentationGroup ?? currentGroup)!.generators.length : templateGenCount)

  const depthCap = useMemo(() => {
    return Math.min(8, Math.max(0, Math.round(Math.log2(zoom)) + 3))
  }, [zoom])

  const tree = useMemo<CayleyTree>(() => {
    if (currentGroup || activePresentationGroup || visualDraft) {
      const rels = pres ? pres.relators : []
      const group = visualDraft ? (visualDraft.group ?? null) : (activePresentationGroup ?? currentGroup ?? null)
      const order = visualDraft ? visualDraft.group?.order : (activePresentationGroup ?? currentGroup)?.order
      const fixedD = order !== undefined
        ? Math.min(14, Math.ceil(Math.log2(order + 1)) + 3)
        : 6
      const D = order !== undefined ? fixedD : (rels.length > 0 ? depthCap + 1 : depthCap)
      if (rels.length === 0) return computeFreeTree(genCount, D)
      return computeFoldTree(genCount, rels, D, group, pres?.generatorElements)
    }
    return computeFreeTree(templateGenCount, depthCap)
  }, [currentGroup, activePresentationGroup, visualDraft, templateGenCount, depthCap, pres, genCount])

  const vw = viewBoxSize.width
  const vh = viewBoxSize.height
  const cx = vw / 2
  const cy = vh / 2

  const view = useMemo(() => {
    const inv = 1 / zoom
    const pad = 400
    return {
      xMin: (-cx - pan.x) * inv - pad,
      xMax: (vw - cx - pan.x) * inv + pad,
      yMin: (-cy - pan.y) * inv - pad,
      yMax: (vh - cy - pan.y) * inv + pad,
    }
  }, [zoom, pan, cx, cy, vw, vh])
  const nodeInView = (n: CayleyTreeNode): boolean =>
    n.x >= view.xMin && n.x <= view.xMax && n.y >= view.yMin && n.y <= view.yMax

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
    if (next === zoom) return
    const rect = e.currentTarget.getBoundingClientRect()
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    const u = { x: (p.x - (cx + pan.x)) / zoom, y: (p.y - (cy + pan.y)) / zoom }
    setZoom(next)
    setPan({ x: p.x - cx - u.x * next, y: p.y - cy - u.y * next })
  }, [zoom, pan, cx, cy])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    setIsDragging(true)
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    e.preventDefault()
    e.stopPropagation()
    setPan({
      x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
    })
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    e.preventDefault()
    e.stopPropagation()
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    dragMovedRef.current = Math.hypot(dx, dy) > 3
    dragRef.current = null
    setIsDragging(false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    dragRef.current = null
    setIsDragging(false)
  }, [])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setZoom(HOME_ZOOM)
    setPan({ x: 0, y: 0 })
  }, [])

  const handleSelectNode = useCallback((e: React.MouseEvent, word: string) => {
    e.stopPropagation()
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    setSelectedWord(prev => (prev === word ? null : word))
  }, [])

  const handleClearSelection = useCallback(() => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    setSelectedWord(null)
  }, [])

  const layout = tree.layout
  const glueCount = useMemo(() => tree.edges.filter(e => !e.isTree).length, [tree])

  const barTitle = useMemo(() => {
    if ((currentGroup || visualDraft) && pres) {
      return renderTex(texify(formatPresentation(pres.generators, pres.relators)))
    }
    return renderTex(texify(`F(${['a', 'b', 'c'].slice(0, genCount).join(', ')}) = \\langle ${['a', 'b', 'c'].slice(0, genCount).join(', ')} \\mid \\rangle`))
  }, [currentGroup, visualDraft, pres, genCount])

  return (
    <>
      <div className="relator-bar">
        <span className="relator-bar-title">
          <span dangerouslySetInnerHTML={{ __html: barTitle }} />
        </span>
        <span className="relator-gen">
          <span className="relator-swatch" style={{ background: GEN_COLORS[0] }} /> a
          {genCount > 1 && (
            <>
              <span className="relator-swatch" style={{ background: GEN_COLORS[1], marginLeft: 6 }} /> b
            </>
          )}
          {genCount > 2 && (
            <>
              <span className="relator-swatch" style={{ background: GEN_COLORS[2], marginLeft: 6 }} /> c
            </>
          )}
          <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
            {visualDraft ? (visualDraft.group?.order ?? '∞') : ((activePresentationGroup ?? currentGroup)?.order ?? '∞')}
          </span>
          <span style={{ marginLeft: 8, color: GLUE_COLOR }}>粘合边 ×{glueCount}</span>
          {!(currentGroup || visualDraft) && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>模板树 · 去「群展示」面板创建</span>}
        </span>
        {selectedWord && (
          <span className="relator-gen" style={{ color: ROOT_COLOR, fontWeight: 600 }}>
            <span className="relator-swatch" style={{ background: ROOT_COLOR }} /> {selectedWord}
          </span>
        )}
      </div>
      {layout === 'tree3d' ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Tree3DScene tree={tree} selectedWord={selectedWord} onSelect={setSelectedWord} />
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${vw} ${vh}`}
          className="view-svg"
          style={{ userSelect: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onClick={handleClearSelection}
        >
          <g transform={`translate(${cx + pan.x}, ${cy + pan.y}) scale(${zoom})`}>
            {tree.edges.map((ed, i) => {
              const a = tree.nodes[ed.from]
              const to = tree.nodes[ed.to]
              if (!ed.isTree || a.rep !== undefined || to.rep !== undefined) return null
              if (!nodeInView(a) && !nodeInView(to)) return null
              return (
                <line
                  key={`e${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={GEN_COLORS[ed.d >> 1] ?? '#888'}
                  strokeWidth={Math.max(0.15, (2 - a.depth * 0.08) / zoom)}
                  opacity={edgeOpacity(a.depth)}
                />
              )
            })}
            {tree.nodes.map(n => {
              if (n.rep !== undefined) return null
              if (!nodeInView(n)) return null
              const isSel = selectedWord === n.label
              const color = n.depth === 0 ? ROOT_COLOR : GEN_COLORS[n.dir >> 1] ?? '#888'
              const r = nodeR(n.depth) / zoom
              const fs = nodeFs(n.depth) / zoom
              return (
                <g key={n.id} className={`ft-node${isSel ? ' selected' : ''}`} transform={`translate(${n.x}, ${n.y})`} onClick={(e) => handleSelectNode(e, n.label)}>
                  <circle r={r} fill={color} stroke="#fff" strokeWidth={0.35 / zoom} />
                  <circle r={Math.max(r, 4 / zoom)} fill="transparent" />
                  {(n.depth <= 1 || isSel) && (
                    <text
                      y={-r - fs * 0.7}
                      textAnchor="middle"
                      fontSize={fs}
                      fontFamily="serif"
                      fill={n.depth === 0 ? ROOT_COLOR : isSel ? ROOT_COLOR : 'var(--text)'}
                      fontWeight={n.depth === 0 || isSel ? 'bold' : 'normal'}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      {n.label}
                    </text>
                  )}
                  <title>{n.label}</title>
                </g>
              )
            })}
          </g>
        </svg>
      )}
    </>
  )
}
