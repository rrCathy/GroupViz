import type { Group, ViewMode } from '../core/types'
import { createGroupFromSymbol } from './groupFactory'
import { getAvailableShapesForView, getAvailableShapes3D } from '../core/types'
import { exportSymmetryAsGifBlob } from './export'

interface SymmetryInfo {
  type: string
  shapes: string[]
}

interface ExportBridge {
  createGroupFromSymbol(symbol: string): Group | null
  _setGroup: ((group: Group) => void) | null
  _setView: ((view: ViewMode) => void) | null
  _setCayleyShape2D: ((shape: string) => void) | null
  _setCayleyShape3D: ((shape: string) => void) | null
  _setSymmetryElement: ((id: string | null) => void) | null
  _setSymmetryShowAction: ((show: boolean) => void) | null
  _setSymmetryVariant: ((variant: number) => void) | null
  _getGroup: (() => Group | null) | null
  _getView: (() => ViewMode) | null
  _ready: Promise<void>
  _resolveReady: (() => void) | null
  waitReady(): Promise<void>
  getAvailableShapes2D(): string[]
  getAvailableShapes3D(): string[]
  getSymmetryInfo(): SymmetryInfo | null
  getAvailableViewsForExport(): string[]
  hideOverlays(): void
  showOverlays(): void
  exportSVGContent(): string | null
  exportCanvasDataUrl(): string | null
  recordGIF(elementId: string, durationMs?: number): Promise<string | null>
}

const _prevDisplayMap = new Map<HTMLElement, string>()
const OVERLAY_SELECTORS = ['.history-panel', '.hint-box']

function hideOverlaysImpl(): void {
  for (const sel of OVERLAY_SELECTORS) {
    const el: HTMLElement | null = document.querySelector(sel)
    if (el) {
      _prevDisplayMap.set(el, el.style.display)
      el.style.display = 'none'
    }
  }
}

function showOverlaysImpl(): void {
  for (const sel of OVERLAY_SELECTORS) {
    const el: HTMLElement | null = document.querySelector(sel)
    if (el) el.style.display = _prevDisplayMap.get(el) ?? ''
  }
  _prevDisplayMap.clear()
}

let _readyResolve: (() => void) | null = null
const _readyPromise = new Promise<void>(r => { _readyResolve = r })

const bridge: ExportBridge = {
  createGroupFromSymbol,

  _setGroup: null,
  _setView: null,
  _setCayleyShape2D: null,
  _setCayleyShape3D: null,
  _setSymmetryElement: null,
  _setSymmetryShowAction: null,
  _setSymmetryVariant: null,
  _getGroup: null,
  _getView: null,

  _ready: _readyPromise,
  _resolveReady: null,

  async waitReady(): Promise<void> {
    // Poll until bridge is registered (for Playwright scripts)
    while (!bridge._setGroup || !bridge._setView) {
      await new Promise(r => setTimeout(r, 50))
    }
  },

  getAvailableShapes2D(): string[] {
    const group = bridge._getGroup?.() ?? null
    const view = bridge._getView?.() ?? 'cayley'
    return getAvailableShapesForView(group, view)
  },

  getAvailableShapes3D(): string[] {
    const group = bridge._getGroup?.() ?? null
    if (!group) return []
    return getAvailableShapes3D(group)
  },

  getSymmetryInfo(): SymmetryInfo | null {
    const group = bridge._getGroup?.() ?? null
    if (!group) return null
    const sym = group.symbol
    if (sym.startsWith('C')) return { type: 'cyclic', shapes: ['regular n-gon'] }
    if (sym.startsWith('D')) return { type: 'dihedral', shapes: ['regular n-gon'] }
    if (sym === 'A_{4}') return { type: 'tetrahedron', shapes: ['tetrahedron'] }
    if (sym === 'S_{4}') return { type: 'cube', shapes: ['cube', 'octahedron'] }
    if (sym === 'A_{5}') return { type: 'icosahedron', shapes: ['icosahedron', 'dodecahedron'] }
    if (sym === 'V_{4}') return { type: 'rectangle', shapes: ['rectangle'] }
    return null
  },

  getAvailableViewsForExport(): string[] {
    const group = bridge._getGroup?.() ?? null
    if (!group) return []
    const views: string[] = ['set', 'cayley', 'cycle', 'table', '3d', 'sublattice']
    if (!group.symbol.includes('\\times') && !group.symbol.includes('\u00d7')) {
      const si = bridge.getSymmetryInfo?.()
      if (si) views.push('symmetry')
    }
    if (group.order > 30) {
      const i = views.indexOf('table')
      if (i >= 0) views.splice(i, 1)
    }
    return views
  },

  hideOverlays: hideOverlaysImpl,
  showOverlays: showOverlaysImpl,

  exportSVGContent(): string | null {
    const viewport = document.querySelector('.canvas-viewport')
    if (!viewport) return null
    const svg = viewport.querySelector('svg') as SVGElement | null
    if (!svg) return null
    const clone = svg.cloneNode(true) as SVGElement
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    const root = document.documentElement
    const cs = (n: string) => getComputedStyle(root).getPropertyValue(n).trim() || '#000'
    const cssVars = [
      '--canvas-bg', '--text-primary', '--text-muted', '--node-fill', '--node-stroke',
      '--border-color', '--bg-secondary', '--accent-teal', '--bg-muted', '--text-subtle', '--border-primary',
    ]
    let rules = ':root{'
    for (const v of cssVars) rules += `${v}:${cs(v)};`
    rules += '}'
    styleEl.textContent = rules
    clone.insertBefore(styleEl, clone.firstChild)
    return new XMLSerializer().serializeToString(clone)
  },

  exportCanvasDataUrl(): string | null {
    const canvas: HTMLCanvasElement | null = document.querySelector('.canvas-viewport canvas')
    return canvas?.toDataURL('image/png') ?? null
  },

  async recordGIF(elementId: string, durationMs = 3000): Promise<string | null> {
    if (!bridge._setSymmetryElement || !bridge._setSymmetryShowAction) return null

    bridge._setSymmetryShowAction(true)
    bridge._setSymmetryElement(null)
    await new Promise(r => setTimeout(r, 300))

    const blob = await exportSymmetryAsGifBlob(durationMs, 10, () => {
      bridge._setSymmetryElement?.(null)
      setTimeout(() => bridge._setSymmetryElement?.(elementId), 80)
    })

    if (!blob) return null

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1] ?? null)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  },
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__groupVizExport__ = bridge
}

export function registerExportBridge(opts: {
  setGroup: (group: Group) => void
  setView: (view: ViewMode) => void
  setCayleyShape2D?: (shape: string) => void
  setCayleyShape3D?: (shape: string) => void
  setSymmetryElement?: (id: string | null) => void
  setSymmetryShowAction?: (show: boolean) => void
  setSymmetryVariant?: (variant: number) => void
  getGroup: () => Group | null
  getView: () => ViewMode
}) {
  bridge._setGroup = opts.setGroup
  bridge._setView = opts.setView
  bridge._setCayleyShape2D = opts.setCayleyShape2D ?? null
  bridge._setCayleyShape3D = opts.setCayleyShape3D ?? null
  bridge._setSymmetryElement = opts.setSymmetryElement ?? null
  bridge._setSymmetryShowAction = opts.setSymmetryShowAction ?? null
  bridge._setSymmetryVariant = opts.setSymmetryVariant ?? null
  bridge._getGroup = opts.getGroup
  bridge._getView = opts.getView
  if (_readyResolve) { _readyResolve(); _readyResolve = null }
}
