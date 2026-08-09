import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGroupFromSymbol } from '../utils/groupFactory'

type Bridge = {
  _setGroup: ((g: unknown) => void) | null
  _setView: ((v: string) => void) | null
  _setSymmetryElement: ((id: string | null) => void) | null
  _setSymmetryShowAction: ((show: boolean) => void) | null
  waitReady: () => Promise<void>
  getSymmetryInfo: () => { type: string; shapes: string[] } | null
  getAvailableShapes2D: () => string[]
  getAvailableShapes3D: () => string[]
  getAvailableViewsForExport: () => string[]
  hideOverlays: () => void
  showOverlays: () => void
  exportSVGContent: () => string | null
  exportCanvasDataUrl: () => string | null
  recordGIF: (elementId: string, durationMs?: number) => Promise<string | null>
}

let bridge: Bridge

function loadBridge() {
  vi.stubGlobal('window', {})
  vi.resetModules()
  return import('../utils/exportApi').then(() => {
    bridge = (globalThis.window as unknown as Record<string, Bridge>).__groupVizExport__
    return bridge
  })
}

function fakeElement<T extends Record<string, unknown> = Record<string, unknown>>(overrides: T = {} as T): T {
  const children: unknown[] = []
  return {
    style: {}, getAttribute: vi.fn(() => null), cloneNode: vi.fn(function (this: unknown) { return this }),
    setAttribute: vi.fn(), querySelectorAll: vi.fn(() => []),
    insertBefore: vi.fn((child: unknown) => { children.push(child) }),
    children, firstChild: null, textContent: '',
    ...overrides,
  }
}

function fakeCanvas() {
  return fakeElement({
    width: 4, height: 4,
    toDataURL: vi.fn(() => 'data:image/png;base64,AAA'),
    getContext: vi.fn(() => ({
      fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4 * 4 * 4) })),
    })),
  })
}

function stubDom(opts: { svg?: unknown; canvas?: unknown; historyPanel?: unknown; hintBox?: unknown } = {}) {
  vi.stubGlobal('document', {
    querySelector: vi.fn((sel: string) => {
      if (sel === '.canvas-viewport canvas') return opts.canvas ?? null
      if (sel === '.canvas-viewport') {
        return {
          querySelector: (s: string) => (s === 'svg' ? opts.svg ?? null : s === 'canvas' ? opts.canvas ?? null : null),
        }
      }
      if (sel === '.history-panel') return opts.historyPanel ?? null
      if (sel === '.hint-box') return opts.hintBox ?? null
      return null
    }),
    createElement: vi.fn((tag: string) => (tag === 'canvas' ? fakeCanvas() : fakeElement())),
    createElementNS: vi.fn(() => fakeElement()),
    documentElement: fakeElement({ getPropertyValue: vi.fn(() => '') }),
  })
  vi.stubGlobal('getComputedStyle', vi.fn(() => ({ getPropertyValue: vi.fn(() => '#000') })))
  vi.stubGlobal('XMLSerializer', class {
    serializeToString = vi.fn((el: { children?: { textContent?: string }[] }) =>
      `<svg xmlns="x">${(el.children ?? []).map(c => c.textContent ?? '').join('')}</svg>`)
  })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 0))
  vi.stubGlobal('alert', vi.fn())
}

beforeEach(async () => {
  await loadBridge()
  stubDom()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exportApi bridge', () => {
  it('waitReady resolves only after registerExportBridge', async () => {
    let settled = false
    bridge.waitReady().then(() => { settled = true })
    await new Promise(r => setTimeout(r, 120))
    expect(settled).toBe(false)
    const { registerExportBridge } = await import('../utils/exportApi')
    registerExportBridge({
      setGroup: () => {}, setView: () => {},
      getGroup: () => null, getView: () => 'cayley',
    })
    await bridge.waitReady()
    await new Promise(r => setTimeout(r, 120))
    expect(settled).toBe(true)
  })

  it('getSymmetryInfo maps known symbols to shapes', async () => {
    let current: string | null = null
    const { registerExportBridge } = await import('../utils/exportApi')
    registerExportBridge({
      setGroup: () => {}, setView: () => {},
      getGroup: () => (current ? createGroupFromSymbol(current) : null) as never, getView: () => 'cayley',
    })
    const cases: [string, string | null][] = [
      ['C_{5}', 'cyclic'],
      ['D_{4}', 'dihedral'],
      ['A_{4}', 'tetrahedron'],
      ['S_{4}', 'cube'],
      ['A_{5}', 'icosahedron'],
      ['V_{4}', 'rectangle'],
      ['X_{9}', null],
    ]
    for (const [sym, type] of cases) {
      current = sym
      const info = bridge.getSymmetryInfo()
      if (type === null) expect(info).toBeNull()
      else expect(info!.type).toBe(type)
    }
  })

  it('getSymmetryInfo returns null when group lookup fails', async () => {
    expect(bridge.getSymmetryInfo()).toBeNull()
  })

  it('getAvailableShapes2D falls back to cayley defaults without a group', () => {
    expect(Array.isArray(bridge.getAvailableShapes2D())).toBe(true)
    expect(bridge.getAvailableShapes2D().length).toBeGreaterThan(0)
  })

  it('getAvailableShapes3D returns shapes only when group is registered', () => {
    expect(bridge.getAvailableShapes3D()).toEqual([])
  })

  it('getAvailableViewsForExport includes symmetry and table for small groups', async () => {
    const { registerExportBridge } = await import('../utils/exportApi')
    registerExportBridge({
      setGroup: () => {}, setView: () => {},
      getGroup: () => createGroupFromSymbol('S_{4}') as never, getView: () => 'cayley',
    })
    const views = bridge.getAvailableViewsForExport()
    expect(views).toContain('symmetry')
    expect(views).toContain('table')
    expect(views).toContain('3d')
  })

  it('getAvailableViewsForExport drops table for large groups', async () => {
    const { registerExportBridge } = await import('../utils/exportApi')
    registerExportBridge({
      setGroup: () => {}, setView: () => {},
      getGroup: () => createGroupFromSymbol('A_{5}') as never, getView: () => 'cayley',
    })
    const views = bridge.getAvailableViewsForExport()
    expect(views).not.toContain('table')
    expect(views).toContain('symmetry')
  })

  it('getAvailableViewsForExport drops symmetry for direct products', async () => {
    const { registerExportBridge } = await import('../utils/exportApi')
    registerExportBridge({
      setGroup: () => {}, setView: () => {},
      getGroup: () => createGroupFromSymbol('Z_{4}\\times Z_{2}') as never, getView: () => 'cayley',
    })
    const views = bridge.getAvailableViewsForExport()
    expect(views).not.toContain('symmetry')
    expect(views).toContain('table')
  })

  it('getAvailableViewsForExport returns [] without a group', () => {
    expect(bridge.getAvailableViewsForExport()).toEqual([])
  })

  it('hideOverlays stores and hides panel displays, showOverlays restores them', () => {
    const history = fakeElement({ style: { display: 'block' } })
    const hint = fakeElement({ style: { display: 'grid' } })
    stubDom({ historyPanel: history, hintBox: hint })
    bridge.hideOverlays()
    expect(history.style.display).toBe('none')
    expect(hint.style.display).toBe('none')
    bridge.showOverlays()
    expect(history.style.display).toBe('block')
    expect(hint.style.display).toBe('grid')
  })

  it('exportSVGContent returns null without a viewport', () => {
    expect(bridge.exportSVGContent()).toBeNull()
  })

  it('exportSVGContent embeds css variables into the svg', () => {
    stubDom({ svg: fakeElement() })
    const out = bridge.exportSVGContent()
    expect(out).toContain(':root{')
    expect(out).toContain('<svg')
  })

  it('exportCanvasDataUrl returns null without a canvas', () => {
    expect(bridge.exportCanvasDataUrl()).toBeNull()
  })

  it('exportCanvasDataUrl returns the canvas data url', () => {
    const canvas = { toDataURL: vi.fn(() => 'data:image/png;base64,AAA') }
    stubDom({ canvas })
    expect(bridge.exportCanvasDataUrl()).toBe('data:image/png;base64,AAA')
  })

  it('recordGIF returns null when symmetry setters are not registered', async () => {
    expect(await bridge.recordGIF('el-1', 100)).toBeNull()
  })

  it('recordGIF captures frames and resolves base64 data', async () => {
    const setElement = vi.fn()
    const setShowAction = vi.fn()
    stubDom({ canvas: fakeCanvas() })
    vi.stubGlobal('FileReader', class {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.result = 'data:image/gif;base64,QUJD'
        queueMicrotask(() => this.onload?.())
      }
    })
    const { registerExportBridge } = await import('../utils/exportApi')
    registerExportBridge({
      setGroup: () => {}, setView: () => {},
      setSymmetryElement: setElement,
      setSymmetryShowAction: setShowAction,
      getGroup: () => createGroupFromSymbol('S_{4}') as never, getView: () => 'symmetry',
    })
    const out = await bridge.recordGIF('el-1', 100)
    expect(out).toBe('QUJD')
    expect(setShowAction).toHaveBeenCalledWith(true)
    expect(setElement).toHaveBeenCalledWith(null)
  })
})
