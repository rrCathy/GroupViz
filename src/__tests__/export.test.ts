import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  triggerDownload,
  exportView,
  captureSvgFrame,
  encodeGif,
  exportSymmetryAsGifBlob,
  exportSymmetryAsGif,
  cayley3DExportPlan,
  exportCayley3DGif,
} from '../utils/export'
import {
  registerCayley3DControls,
  unregisterCayley3DControls,
  getCayley3DControls,
} from '../utils/cayley3dControls'
import type { Cayley3DControlAPI, Cayley3DOrbitSnapshot } from '../utils/cayley3dControls'

function makeFakeElement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    setAttribute: vi.fn(),
    getAttribute: vi.fn(() => null),
    cloneNode: vi.fn(function (this: unknown) { return this }),
    querySelectorAll: vi.fn(() => []),
    insertBefore: vi.fn(),
    clientWidth: 800,
    clientHeight: 600,
    style: {},
    ...overrides,
  }
}

function makeFakeCanvas2d(imageData: ImageData = { data: new Uint8ClampedArray(4 * 4 * 4) } as ImageData) {
  return makeFakeElement({
    width: 4,
    height: 4,
    toDataURL: vi.fn(() => `data:image/png;base64,${btoa('png')}`),
    getContext: vi.fn(() => ({
      fillStyle: '',
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => imageData),
    })),
  })
}

function stubBasicDom(opts: { viewport?: unknown; styleSheets?: unknown[] } = {}) {
  vi.stubGlobal('document', {
    createElement: vi.fn((tag: string) => (tag === 'canvas' ? makeFakeCanvas2d() : makeFakeElement({ click: vi.fn() }))),
    createElementNS: vi.fn(() => makeFakeElement()),
    querySelector: vi.fn((sel: string) => (sel === '.canvas-viewport' ? opts.viewport ?? null : null)),
    styleSheets: opts.styleSheets ?? [],
    body: makeFakeElement({ appendChild: vi.fn(), removeChild: vi.fn() }),
    documentElement: makeFakeElement({ getPropertyValue: vi.fn(() => '') }),
  })
  vi.stubGlobal('getComputedStyle', vi.fn(() => ({ getPropertyValue: vi.fn(() => '') })))
  vi.stubGlobal('XMLSerializer', class {
    serializeToString = vi.fn(() => '<svg/>')
  })
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:fake')
    static revokeObjectURL = vi.fn()
  })
  vi.stubGlobal('alert', vi.fn())
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 0))
}

beforeEach(() => {
  stubBasicDom()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function makeFake3DControls(overrides: Partial<Cayley3DControlAPI> = {}): Cayley3DControlAPI {
  return {
    isReady: vi.fn(() => true),
    snapshotOrbit: vi.fn(() => ({ theta: 0.5, phi: 1.2, radius: 8, target: {} }) as unknown as Cayley3DOrbitSnapshot),
    beginRotation: vi.fn(),
    endRotation: vi.fn(),
    ...overrides,
  }
}

describe('cayley3DExportPlan', () => {
  it('defaults to 3s / 2 cycles at 20fps', () => {
    const p = cayley3DExportPlan()
    expect(p.seconds).toBe(3)
    expect(p.cycles).toBe(2)
    expect(p.periodSec).toBe(1.5)
    expect(p.fps).toBe(20)
    expect(p.frameDelay).toBe(50)
    expect(p.frameCount).toBe(60)
    expect(p.radPerSec).toBeCloseTo((2 * 2 * Math.PI) / 3)
  })

  it('computes 5 rotation cycles as 7.5s at 1.5s per cycle', () => {
    const p = cayley3DExportPlan({ cycles: 5 })
    expect(p.seconds).toBe(7.5)
    expect(p.frameCount).toBe(150)
    expect(p.radPerSec).toBeCloseTo((2 * Math.PI) / 1.5)
  })

  it('honors explicit seconds / fps', () => {
    const p = cayley3DExportPlan({ seconds: 2, cycles: 4, fps: 10 })
    expect(p.frameDelay).toBe(100)
    expect(p.frameCount).toBe(20)
    expect(p.radPerSec).toBeCloseTo(4 * Math.PI)
  })
})

describe('cayley3dControls registration', () => {
  afterEach(() => {
    const c = getCayley3DControls()
    if (c) unregisterCayley3DControls(c)
  })

  it('registers, retrieves and unregisters the api', () => {
    const api = makeFake3DControls()
    expect(getCayley3DControls()).toBeNull()
    registerCayley3DControls(api)
    expect(getCayley3DControls()).toBe(api)
    unregisterCayley3DControls(api)
    expect(getCayley3DControls()).toBeNull()
  })

  it('later registrations win and unregistering stale api keeps the newest', () => {
    const a = makeFake3DControls()
    const b = makeFake3DControls()
    registerCayley3DControls(a)
    registerCayley3DControls(b)
    expect(getCayley3DControls()).toBe(b)
    unregisterCayley3DControls(a)
    expect(getCayley3DControls()).toBe(b)
  })
})

describe('exportCayley3DGif', () => {
  afterEach(() => {
    const c = getCayley3DControls()
    if (c) unregisterCayley3DControls(c)
  })

  it('alerts when no viewport exists', async () => {
    await exportCayley3DGif('x.gif', cayley3DExportPlan({ seconds: 0.1, cycles: 1 }))
    expect(globalThis.alert).toHaveBeenCalledWith('No viewport found')
  })

  it('alerts when no canvas exists', async () => {
    const viewport = makeFakeElement({ querySelector: vi.fn(() => null) })
    stubBasicDom({ viewport })
    await exportCayley3DGif('x.gif', cayley3DExportPlan({ seconds: 0.1, cycles: 1 }))
    expect(globalThis.alert).toHaveBeenCalledWith('No canvas found for GIF export')
  })

  it('alerts when the 3d view is not registered', async () => {
    const canvas = makeFakeCanvas2d()
    const viewport = makeFakeElement({ querySelector: vi.fn((sel: string) => (sel === 'canvas' ? canvas : null)) })
    stubBasicDom({ viewport })
    await exportCayley3DGif('x.gif', cayley3DExportPlan({ seconds: 0.1, cycles: 1 }))
    expect(globalThis.alert).toHaveBeenCalledWith('3D view not ready for GIF export')
  })

  it('captures frames, drives rotation and restores orbit afterwards', async () => {
    const canvas = makeFakeCanvas2d()
    const viewport = makeFakeElement({ querySelector: vi.fn((sel: string) => (sel === 'canvas' ? canvas : null)) })
    stubBasicDom({ viewport })
    const ctrl = makeFake3DControls()
    registerCayley3DControls(ctrl)

    const plan = cayley3DExportPlan({ seconds: 0.1, cycles: 1, fps: 10 })
    const blob = await exportCayley3DGif('x.gif', plan)

    expect(blob).not.toBeNull()
    expect(blob!.type).toBe('image/gif')
    const bytes = new Uint8Array(await blob!.arrayBuffer())
    expect(new TextDecoder().decode(bytes.subarray(0, 6))).toBe('GIF89a')
    expect(ctrl.beginRotation).toHaveBeenCalledWith(plan.radPerSec)
    expect(ctrl.endRotation).toHaveBeenCalledWith(expect.objectContaining({ theta: 0.5 }))
  })

  it('restores the orbit even when capture fails mid-way', async () => {
    const canvas = makeFakeCanvas2d()
    const viewport = makeFakeElement({ querySelector: vi.fn((sel: string) => (sel === 'canvas' ? canvas : null)) })
    stubBasicDom({ viewport })
    // 离屏采集 canvas 的 2d context 缺失 → 采集流程抛错
    vi.stubGlobal('document', {
      ...(globalThis.document as object),
      createElement: vi.fn(() => makeFakeElement({ width: 4, height: 4, getContext: vi.fn(() => null) })),
    })
    const ctrl = makeFake3DControls()
    registerCayley3DControls(ctrl)

    await expect(exportCayley3DGif('x.gif', cayley3DExportPlan({ seconds: 0.1, cycles: 1, fps: 10 })))
      .rejects.toThrow()
    expect(ctrl.beginRotation).toHaveBeenCalled()
    expect(ctrl.endRotation).toHaveBeenCalled()
  })
})

describe('encodeGif', () => {
  it('encodes RGBA frames into a GIF blob with magic header', async () => {
    const frame = new Uint8Array(4 * 4 * 4)
    frame.fill(200)
    for (let i = 0; i < 4 * 4; i++) frame[i * 4 + 3] = 255
    const blob = encodeGif([frame], 4, 4, 10)
    expect(blob.type).toBe('image/gif')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(new TextDecoder().decode(bytes.subarray(0, 6))).toBe('GIF89a')
    expect(bytes.length).toBeGreaterThan(10)
  })

  it('encodes multiple frames with repeat flag on first frame', async () => {
    const frame = new Uint8Array(2 * 2 * 4).fill(10)
    const blob = encodeGif([frame, frame], 2, 2, 5)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect(new TextDecoder().decode(bytes.subarray(0, 6))).toBe('GIF89a')
  })
})

describe('triggerDownload', () => {
  it('creates a link, clicks it and revokes the url', () => {
    const click = vi.fn()
    const anchor = makeFakeElement({ click, href: '', download: '' })
    const appendChild = vi.fn()
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild, removeChild: vi.fn() },
    })
    triggerDownload(new Blob(['x']), 'out.svg')
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(click).toHaveBeenCalled()
    expect(anchor.download).toBe('out.svg')
  })
})

describe('exportView', () => {
  it('alerts when no viewport exists', () => {
    exportView('cayley', 'x.svg')
    expect(globalThis.alert).toHaveBeenCalledWith('No viewport found')
  })

  it('exports svg for non-3d views', () => {
    const svg = makeFakeElement({ getAttribute: vi.fn(() => '0 0 100 200') })
    const viewport = makeFakeElement({ querySelector: vi.fn((sel: string) => (sel === 'svg' ? svg : null)) })
    stubBasicDom({ viewport })
    exportView('cayley', 'x.svg')
    expect(viewport.querySelector).toHaveBeenCalledWith('svg')
    expect(svg.setAttribute).toHaveBeenCalledWith('width', '100')
  })

  it('alerts when svg is missing', () => {
    const viewport = makeFakeElement({ querySelector: vi.fn(() => null) })
    stubBasicDom({ viewport })
    exportView('table', 'x.svg')
    expect(globalThis.alert).toHaveBeenCalledWith('No SVG found')
  })

  it('exports canvas png for 3d views', () => {
    const canvas = makeFakeCanvas2d()
    const viewport = makeFakeElement({ querySelector: vi.fn((sel: string) => (sel === 'canvas' ? canvas : null)) })
    stubBasicDom({ viewport })
    exportView('3d', 'x.png')
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/png')
  })

  it('alerts when canvas is missing for 3d views', () => {
    const viewport = makeFakeElement({ querySelector: vi.fn(() => null) })
    stubBasicDom({ viewport })
    exportView('3d', 'x.png')
    expect(globalThis.alert).toHaveBeenCalledWith('No canvas found')
  })
})

describe('captureSvgFrame', () => {
  it('resolves rgba pixel data from a rendered svg', async () => {
    const imageData = new Uint8ClampedArray(4 * 4 * 4)
    imageData.fill(7)
    stubBasicDom({ viewport: makeFakeElement() })
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      src = ''
      constructor() {
        queueMicrotask(() => this.onload?.())
      }
    })
    const svg = makeFakeElement()
    const data = await captureSvgFrame(svg as unknown as SVGSVGElement, 4, 4)
    expect(data).toBeInstanceOf(Uint8Array)
    expect(data.length).toBe(4 * 4 * 4)
  })

  it('rejects when the svg fails to load as an image', async () => {
    stubBasicDom()
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: ((ev: Event) => void) | null = null
      src = ''
      constructor() {
        queueMicrotask(() => this.onerror?.(new Event('error')))
      }
    })
    const svg = makeFakeElement()
    await expect(captureSvgFrame(svg as unknown as SVGSVGElement, 4, 4)).rejects.toThrow('Failed to load SVG as image')
  })
})

describe('exportSymmetryAsGifBlob', () => {
  it('returns null without a viewport or canvas', async () => {
    expect(await exportSymmetryAsGifBlob(100)).toBeNull()
  })

  it('captures canvas frames into a gif blob', async () => {
    const canvas = makeFakeCanvas2d()
    const viewport = makeFakeElement({ querySelector: vi.fn((sel: string) => (sel === 'canvas' ? canvas : null)) })
    stubBasicDom({ viewport })
    const restart = vi.fn()
    const blob = await exportSymmetryAsGifBlob(300, 10, restart)
    expect(blob).not.toBeNull()
    expect(blob!.type).toBe('image/gif')
    const bytes = new Uint8Array(await blob!.arrayBuffer())
    expect(new TextDecoder().decode(bytes.subarray(0, 6))).toBe('GIF89a')
    expect(restart).toHaveBeenCalled()
  })
})

describe('exportSymmetryAsGif', () => {
  it('alerts when no viewport exists', () => {
    exportSymmetryAsGif('x.gif', 100)
    expect(globalThis.alert).toHaveBeenCalledWith('No viewport found')
  })

  it('alerts when no canvas exists', () => {
    const viewport = makeFakeElement({ querySelector: vi.fn(() => null) })
    stubBasicDom({ viewport })
    exportSymmetryAsGif('x.gif', 100)
    expect(globalThis.alert).toHaveBeenCalledWith('No canvas found for GIF export')
  })

  it('records frames and downloads the gif', async () => {
    const canvas = makeFakeCanvas2d()
    const viewport = makeFakeElement({ querySelector: vi.fn((sel: string) => (sel === 'canvas' ? canvas : null)) })
    stubBasicDom({ viewport })
    await exportSymmetryAsGif('x.gif', 100, 10)
    expect(globalThis.alert).not.toHaveBeenCalled()
  })
})
