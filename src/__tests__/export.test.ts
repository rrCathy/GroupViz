import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  triggerDownload,
  exportView,
  captureSvgFrame,
  encodeGif,
  exportSymmetryAsGifBlob,
  exportSymmetryAsGif,
} from '../utils/export'

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
