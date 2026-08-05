import type { Group, ViewMode, CayleyAction, Layout3D } from '../core/types'
import { COLOR_PALETTE, getDefaultLayout3D, getAvailableShapes3D, getDefaultShape2D, getAvailableShapesForView, isQuotientGroup, type CayleyShape2D } from '../core/types'

export function getInitialCayleyActions(group: Group): CayleyAction[] {
  return group.generators.map((gen, i) => {
    const targetEl = gen.apply(group.identity)
    return {
      elementId: targetEl?.id || group.elements[0].id,
      enabled: true,
      color: COLOR_PALETTE[i % COLOR_PALETTE.length]
    }
  })
}

export interface CayleyShapeConfig {
  defaultShape3D: Layout3D
  availableShapes3D: Layout3D[]
  defaultShape2D: CayleyShape2D
  availableShapes2D: CayleyShape2D[]
}

export function getCayleyShapeConfig(group: Group): CayleyShapeConfig {
  if (isQuotientGroup(group)) {
    return {
      defaultShape3D: 'spherical' as Layout3D,
      availableShapes3D: [],
      defaultShape2D: 'circular',
      availableShapes2D: ['circular'] as CayleyShape2D[],
    }
  }
  const defaultShape = getDefaultLayout3D(group)
  const shapes3D = getAvailableShapes3D(group)
  const shapes2D = getAvailableShapesForView(group, 'cayley') as CayleyShape2D[]
  const default2D = getDefaultShape2D(group)

  return {
    defaultShape3D: defaultShape,
    availableShapes3D: shapes3D,
    defaultShape2D: shapes2D.includes(default2D) ? default2D : (shapes2D[0] || 'circular'),
    availableShapes2D: shapes2D,
  }
}

export function getSpecialCayleyActions(group: Group, shape: Layout3D): CayleyAction[] | null {
  const sym = group.symbol

  if (sym === 'S_{4}') {
    if (shape === 'rhombicuboctahedron') {
      return [
        { elementId: '4,1,2,3', enabled: true, color: COLOR_PALETTE[0] },
        { elementId: '3,1,2,4', enabled: true, color: COLOR_PALETTE[1] },
      ]
    } else if (shape === 'truncatedOctahedron2') {
      return [
        { elementId: '2,3,4,1', enabled: true, color: COLOR_PALETTE[0] },
        { elementId: '2,1,3,4', enabled: true, color: COLOR_PALETTE[1] },
      ]
    } else if (shape === 'truncatedOctahedron3') {
      return [
        { elementId: '2,1,3,4', enabled: true, color: COLOR_PALETTE[0] },
        { elementId: '1,3,2,4', enabled: true, color: COLOR_PALETTE[1] },
        { elementId: '1,2,4,3', enabled: true, color: COLOR_PALETTE[2] },
      ]
    } else if (shape === 'truncatedCube') {
      return [
        { elementId: '1,4,2,3', enabled: true, color: COLOR_PALETTE[0] },
        { elementId: '2,1,3,4', enabled: true, color: COLOR_PALETTE[1] },
      ]
    }
  }

  if (sym === 'A_{5}') {
    if (shape === 'truncatedIcosahedron') {
      return [
        { elementId: '2,3,4,5,1', enabled: true, color: COLOR_PALETTE[0] },
        { elementId: '2,1,4,3,5', enabled: true, color: COLOR_PALETTE[1] },
      ]
    } else if (shape === 'truncatedDodecahedron') {
      return [
        { elementId: '2,3,1,4,5', enabled: true, color: COLOR_PALETTE[0] },
        { elementId: '1,5,4,3,2', enabled: true, color: COLOR_PALETTE[1] },
      ]
    }
  }

  return null
}

export function toggleCayleyActionReducer(prev: CayleyAction[], elementId: string): CayleyAction[] {
  const idx = prev.findIndex(a => a.elementId === elementId)
  if (idx === -1) {
    const colorIdx = prev.length
    return [...prev, { elementId, enabled: true, color: COLOR_PALETTE[colorIdx % COLOR_PALETTE.length] }]
  }
  return prev.map((a, i) => i === idx ? { ...a, enabled: !a.enabled } : a)
}

export function addAllCayleyActionsHelper(
  group: Group,
  currentView: ViewMode,
  cayleyShape3D: Layout3D,
  existingActions: CayleyAction[]
): CayleyAction[] {
  const isQuotientGroup = group.symbol.includes('/N')
  const canonical3D = (() => {
    const sym = group.symbol
    if (currentView !== '3d') return new Set<string>()
    if (sym === 'S_{4}' || sym === 'S4' || sym === 'S₄') {
      if (cayleyShape3D === 'rhombicuboctahedron') return new Set(['4,1,2,3', '3,1,2,4'])
      if (cayleyShape3D === 'truncatedOctahedron2') return new Set(['2,3,4,1', '2,1,3,4'])
      if (cayleyShape3D === 'truncatedOctahedron3') return new Set(['2,1,3,4', '1,3,2,4', '1,2,4,3'])
      if (cayleyShape3D === 'truncatedCube') return new Set(['1,4,2,3', '2,1,3,4'])
    }
    if (sym === 'A_{5}' || sym === 'A5' || sym === 'A₅') {
      if (cayleyShape3D === 'truncatedIcosahedron') return new Set(['2,3,4,5,1', '2,1,4,3,5'])
      if (cayleyShape3D === 'truncatedDodecahedron') return new Set(['2,3,1,4,5', '1,5,4,3,2'])
    }
    return new Set<string>()
  })()

  if (isQuotientGroup) {
    // For quotient groups, only expose generator actions so the Cayley graph
    // shows the quotient structure (edges between cosets), not internal
    // subgroup edges rendered inside compound nodes.
    return group.generators.map((gen, i) => {
      const targetEl = gen.apply(group.identity)
      const elementId = targetEl?.id || group.elements[0].id
      const existing = existingActions.find(a => a.elementId === elementId)
      return {
        elementId,
        enabled: existing?.enabled ?? true,
        color: existing?.color ?? COLOR_PALETTE[i % COLOR_PALETTE.length]
      }
    })
  }

  return group.elements.map((el, i) => {
    const existing = existingActions.find(a => a.elementId === el.id)
    const defaultEnabled = currentView === '3d'
      ? canonical3D.has(el.id)
      : group.generators.some(g => g.apply(group.identity).id === el.id)
    return {
      elementId: el.id,
      enabled: existing?.enabled ?? defaultEnabled,
      color: existing?.color ?? COLOR_PALETTE[i % COLOR_PALETTE.length]
    }
  })
}
