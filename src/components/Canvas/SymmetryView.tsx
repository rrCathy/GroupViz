import { useMemo, useState, useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { texify, renderTex } from '../../utils/texify'
import { computeElementRotation } from '../../core/elementRotation'
import type { Group, GroupElement } from '../../core/types'

type SymmetryType = 'cyclic' | 'dihedral' | 'tetrahedron' | 'cube' | 'icosahedron' | 'rectangle' | 'unsupported'

function getSymmetryType(group: Group): SymmetryType {
  const sym = group.symbol
  if (sym.startsWith('C')) return 'cyclic'
  if (sym.startsWith('D')) return 'dihedral'
  if (sym === 'A₄' || sym === 'A4') return 'tetrahedron'
  if (sym === 'S₄' || sym === 'S4') return 'cube'
  if (sym === 'A₅' || sym === 'A5') return 'icosahedron'
  if (sym === 'V₄' || sym === 'V4') return 'rectangle'
  if (sym.includes('×') || sym.includes('²') || sym.includes('³') || sym.includes('⁴')) return 'unsupported'
  if (sym.startsWith('S') || sym.startsWith('A')) return 'unsupported'
  return 'unsupported'
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

function getGeometryAxes(data: SymmetryData, symmetryType: SymmetryType):
  { vertexAxes: [number,number,number][]; faceAxes: [number,number,number][]; edgeAxes: [number,number,number][] } {
  const result = { vertexAxes: [] as [number,number,number][], faceAxes: [] as [number,number,number][], edgeAxes: [] as [number,number,number][] }

  const seen = new Set<string>()
  function addAxis(v: THREE.Vector3, pool: [number,number,number][]) {
    const rounded = [Math.round(v.x*1e6)/1e6, Math.round(v.y*1e6)/1e6, Math.round(v.z*1e6)/1e6]
    const k = rounded.join(',')
    const negK = rounded.map(x => -x).join(',')
    if (seen.has(k) || seen.has(negK)) return
    seen.add(k)
    pool.push([v.x, v.y, v.z])
  }

  if (symmetryType === 'tetrahedron') {
    for (const v of data.vertices) {
      addAxis(v.clone().normalize(), result.vertexAxes)
    }
    result.edgeAxes = [[1,0,0], [0,1,0], [0,0,1]]
  } else if (symmetryType === 'cube') {
    result.faceAxes = [[1,0,0], [0,1,0], [0,0,1]]
    result.vertexAxes = [[1,1,1], [1,-1,-1], [-1,1,-1], [-1,-1,1]].map(a =>
      [a[0]/Math.sqrt(3), a[1]/Math.sqrt(3), a[2]/Math.sqrt(3)] as [number,number,number])
    result.edgeAxes = [[1,1,0],[1,0,1],[0,1,1],[1,-1,0],[1,0,-1],[0,1,-1]].map(a =>
      [a[0]/Math.sqrt(2), a[1]/Math.sqrt(2), a[2]/Math.sqrt(2)] as [number,number,number])
  } else if (symmetryType === 'icosahedron') {
    const isDodecahedron = data.vertices.length >= 20
    for (const v of data.vertices) {
      addAxis(v.clone().normalize(), result.vertexAxes)
    }
    const triangularFaces = computeTriangularFaces(data)
    const faceCenters = computeFaceCenters(data, triangularFaces)
    for (const fc of faceCenters) {
      addAxis(fc.clone().normalize(), result.faceAxes)
    }
    for (const [a, b] of data.edges) {
      const mid = data.vertices[a].clone().add(data.vertices[b]).multiplyScalar(0.5)
      addAxis(mid.clone().normalize(), result.edgeAxes)
    }
    if (isDodecahedron) {
      const swapped = result.vertexAxes
      result.vertexAxes = result.faceAxes
      result.faceAxes = swapped
    }
  }

  return result
}

type ElementRotationKind = 'identity' | 'face' | 'vertex' | 'edge'

function getElementRotationKind(groupSymbol: string, cycleType: string): ElementRotationKind | null {
  if (cycleType === '1') return 'identity'
  if (groupSymbol.startsWith('C')) return 'face'
  if (groupSymbol.startsWith('D')) return cycleType === '1-1' || cycleType === '1' ? null : 'vertex'
  if (groupSymbol === 'S4' || groupSymbol === 'S₄') {
    if (cycleType === '4' || cycleType === '2-2') return 'face'
    if (cycleType === '3') return 'vertex'
    if (cycleType === '2') return 'edge'
  }
  if (groupSymbol === 'A4' || groupSymbol === 'A₄') {
    if (cycleType === '3') return 'vertex'
    if (cycleType === '2-2') return 'edge'
  }
  if (groupSymbol === 'A5' || groupSymbol === 'A₅') {
    if (cycleType === '5') return 'vertex'
    if (cycleType === '3') return 'face'
    if (cycleType === '2-2') return 'edge'
  }
  return null
}

function computeGeometricRotation(group: Group, element: GroupElement, data: SymmetryData, symmetryType: SymmetryType): { axis: [number,number,number]; angleRad: number; label: string } | null {
  const fromCode = computeElementRotation(group, element)
  if (!fromCode) return null
  if (fromCode.angleRad === 0) return fromCode

  const val = element.value
  const cycleType = (() => {
    const n = val.length
    if (n < 2) return '1'
    const visited = new Array(n).fill(false)
    const cycles: number[] = []
    const normalized = val.map((v: number) => v - 1)
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue
      let len = 0, j = i
      while (!visited[j]) { visited[j] = true; j = normalized[j]; len++ }
      if (len > 1) cycles.push(len)
    }
    return cycles.sort().join('-') || '1'
  })()

  const kind = getElementRotationKind(group.symbol, cycleType)
  if (!kind || kind === 'identity') return fromCode

  const geoAxes = getGeometryAxes(data, symmetryType)
  const id = element.id
  let axes: readonly [number,number,number][]

  if (kind === 'vertex') {
    axes = geoAxes.vertexAxes
  } else if (kind === 'face') {
    axes = geoAxes.faceAxes
  } else {
    axes = geoAxes.edgeAxes
  }

  if (axes.length === 0) return fromCode

  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  const idx = Math.abs(h) % axes.length
  const axis = axes[idx]

  return {
    axis: [axis[0], axis[1], axis[2]],
    angleRad: fromCode.angleRad,
    label: fromCode.label,
  }
}

function SymmetryViewInner({ group, symmetryType }: { group: Group; symmetryType: SymmetryType }) {
  const [variant, setVariant] = useState(false)
  const { symmetryShowAction, symmetryRotateSpeed, symmetryActionElementId } = useGroup()

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

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a1a' }}>
      <Canvas camera={{ position: [0, 3, 10], fov: 50, near: 0.1, far: 100 }} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}>
        <color attach="background" args={['#0a0a1a']} />
        <SymmetryScene
          group={group}
          symmetryType={symmetryType}
          data={data}
          variant={variant}
          onToggleVariant={() => setVariant(v => !v)}
          showAction={symmetryShowAction}
          actionElementId={symmetryActionElementId}
          rotateSpeed={symmetryRotateSpeed}
        />
      </Canvas>
    </div>
  )
}

export function SymmetryView() {
  const { currentGroup } = useGroup()
  const { t } = useTranslation()
  if (!currentGroup) return <div className="view-empty"><p>{t('canvas.noGroupCreate')}</p></div>
  const symmetryType = getSymmetryType(currentGroup)
  if (symmetryType === 'unsupported') return <UnsupportedOverlay group={currentGroup} />
  return <SymmetryViewInner group={currentGroup} symmetryType={symmetryType} />
}

function useAnimatedRotation(
  targetQuat: THREE.Quaternion | null,
  speed: number,
  onPhaseChange: (phase: 'rest' | 'reset' | 'rotating') => void,
) {
  const stateRef = useRef({
    target: null as THREE.Quaternion | null,
    t: 2,
    speed: 1,
    phase: 'rest' as 'rest' | 'reset' | 'rotating',
    settled: false,
    currentQuat: new THREE.Quaternion(),
  })

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
  group, symmetryType, data, variant, onToggleVariant,
  showAction, actionElementId, rotateSpeed,
}: {
  group: Group
  symmetryType: SymmetryType
  data: SymmetryData | null
  variant: boolean
  onToggleVariant: () => void
  showAction: boolean
  actionElementId: string | null
  rotateSpeed: number
}) {
  const { setHintMessage } = useGroup()
  const { t } = useTranslation()
  const [animPhase, setAnimPhase] = useState<'rest' | 'reset' | 'rotating'>('rest')

  const animInfo = useMemo(() => {
    if (!showAction || !actionElementId || !data) return null
    const el = group.elements.find(e => e.id === actionElementId)
    if (!el) return null
    const result = computeGeometricRotation(group, el, data, symmetryType)
    if (!result || result.angleRad === 0) return null
    return result
  }, [showAction, actionElementId, group, data, symmetryType])

  const targetQuat = useMemo(() => {
    if (!animInfo || animInfo.angleRad === 0) return null
    const q = new THREE.Quaternion()
    q.setFromAxisAngle(new THREE.Vector3(...animInfo.axis), animInfo.angleRad)
    return q
  }, [animInfo])

  const animRef = useAnimatedRotation(targetQuat, rotateSpeed, setAnimPhase)

  useEffect(() => {
    if (!showAction) return
    if (!animInfo) {
      setHintMessage(t('symmetry.clickHint'))
      return
    }
    const elLabel = group.elements.find(e => e.id === actionElementId!)?.label || ''
    if (animPhase === 'reset') setHintMessage(`<span class="hint-highlight">${elLabel}</span>: ${animInfo.label} — ${t('symmetry.reset')}`)
    else if (animPhase === 'rotating') setHintMessage(`<span class="hint-highlight">${elLabel}</span>: ${animInfo.label} — ${t('symmetry.rotating')}`)
    else setHintMessage(`<span class="hint-highlight">${elLabel}</span>: ${animInfo.label}`)
  }, [showAction, animInfo, animPhase, actionElementId, group, setHintMessage, t])

  const hasData = !!data
  const isDirected = data?.directed === true
  const canToggle = symmetryType === 'cube' || symmetryType === 'icosahedron'
  const topY = data ? data.vertices.reduce((max, v) => Math.max(max, v.y), -Infinity) : 0
  const dataRadius = data ? data.vertices[0].length() : 4

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

      <Html position={[0, topY + 1.5, 0]} center>
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold', textShadow: '0 0 10px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', userSelect: 'none' }}
          dangerouslySetInnerHTML={{ __html: renderTex(texify(group.name)) }} />
      </Html>

      <Html position={[0, topY + 2.2, 0]} center>
        <div style={{ color: '#aaa', fontSize: '13px', textShadow: '0 0 8px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', userSelect: 'none' }}>
          {symmetryType === 'cyclic' && t('symmetry.geo.cyclic', { n: group.order })}
          {symmetryType === 'dihedral' && t('symmetry.geo.dihedral', { n: group.order/2 })}
          {symmetryType === 'tetrahedron' && t('symmetry.geo.tetrahedron')}
          {symmetryType === 'cube' && (variant ? t('symmetry.geo.octahedron') : t('symmetry.geo.cube'))}
          {symmetryType === 'icosahedron' && (variant ? t('symmetry.geo.dodecahedron') : t('symmetry.geo.icosahedron'))}
          {symmetryType === 'rectangle' && t('symmetry.geo.rectangle')}
        </div>
      </Html>

      {canToggle && (
        <Html position={[0, topY + 3.0, 0]} center>
          <button onClick={(e) => { e.stopPropagation(); onToggleVariant() }}
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', color: '#ccc', padding: '3px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
            {symmetryType === 'cube' ? (variant ? t('symmetry.toCube') : t('symmetry.toOctahedron')) : ''}
            {symmetryType === 'icosahedron' ? (variant ? t('symmetry.toIcosahedron') : t('symmetry.toDodecahedron')) : ''}
          </button>
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
        enableDamping
        dampingFactor={0.1}
        minDistance={2}
        maxDistance={20}
        enableRotate={!showAction}
        enablePan={!showAction}
      />
    </>
  )
}

function UnsupportedOverlay({ group }: { group: Group }) {
  const { t } = useTranslation()
  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
      <p style={{ fontSize: '18px', marginBottom: '8px' }}><span dangerouslySetInnerHTML={{ __html: renderTex(texify(group.name)) }} /></p>
      <p style={{ fontSize: '14px', color: '#666' }}>{t('symmetry.unsupported')}</p>
      <p style={{ fontSize: '12px', color: '#555', marginTop: '12px' }}>{t('symmetry.supported')}</p>
    </div>
  )
}
