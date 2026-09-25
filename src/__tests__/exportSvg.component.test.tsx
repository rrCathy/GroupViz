import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  collectStyleText,
  serializeSvg,
  exportFileName,
  exportSvgElement,
  exportCanvasElement,
} from '../utils/exportSvg'

const makeSvg = (viewBox = '0 0 400 300') => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', viewBox)
  return svg
}

let createdUrls: string[] = []
const clickSpy = vi.fn()

beforeEach(() => {
  createdUrls = []
  clickSpy.mockClear()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn((b: Blob) => {
      createdUrls.push(b.type)
      return 'blob:fake'
    })
    static revokeObjectURL = vi.fn()
  })
  HTMLAnchorElement.prototype.click = clickSpy
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exportFileName', () => {
  it('keeps CJK + digits, folds separators (window titles contain "·", "/" and spaces)', () => {
    expect(exportFileName('图 2 · 凯莱图', 'view', 'svg')).toBe('图-2-凯莱图.svg')
    expect(exportFileName('A₄ / S₄', 'view', 'svg')).toBe('A-S.svg')
  })

  it('falls back when the title is empty or only separators', () => {
    expect(exportFileName('', 'cayley', 'svg')).toBe('cayley.svg')
    expect(exportFileName('   ', 'cayley', 'png')).toBe('cayley.png')
    expect(exportFileName(null, 'cayley', 'svg')).toBe('cayley.svg')
    expect(exportFileName('· ·', 'cayley', 'svg')).toBe('cayley.svg')
  })
})

describe('serializeSvg', () => {
  it('returns an SVG blob carrying the viewBox size (so the file has intrinsic size)', async () => {
    const blob = serializeSvg(makeSvg())
    expect(blob.type).toBe('image/svg+xml;charset=utf-8')
    const text = await blob.text()
    expect(text).toContain('width="400"')
    expect(text).toContain('height="300"')
  })

  it('falls back to client size when viewBox is missing', async () => {
    const svg = makeSvg('')
    Object.defineProperty(svg, 'clientWidth', { value: 640 })
    Object.defineProperty(svg, 'clientHeight', { value: 480 })
    const text = await serializeSvg(svg).text()
    expect(text).toContain('width="640"')
    expect(text).toContain('height="480"')
  })

  it('inlines the page stylesheet into a leading <style> (KaTeX labels/annotations rely on it)', () => {
    const style = document.createElement('style')
    style.textContent = '.gv-node-label{color:red}'
    document.head.appendChild(style)
    try {
      expect(collectStyleText()).toContain('.gv-node-label')
      const svg = makeSvg()
      // 断言 style 被插到 clone 首位（原 svg 本身不变）
      const original = XMLSerializer.prototype.serializeToString
      const seen: string[] = []
      XMLSerializer.prototype.serializeToString = function (node: Node) {
        const s = original.call(this, node)
        seen.push(s)
        return s
      }
      try {
        serializeSvg(svg)
      } finally {
        XMLSerializer.prototype.serializeToString = original
      }
      expect(seen[0].indexOf('<style')).toBeLessThan(seen[0].indexOf('<svg') + 200)
      expect(svg.querySelector('style')).toBeNull()
    } finally {
      document.head.removeChild(style)
    }
  })
})

describe('exportSvgElement / exportCanvasElement', () => {
  it('exports an SVG by triggering a download (blob URL + anchor click)', () => {
    expect(exportSvgElement(makeSvg(), 'a.svg')).toBe(true)
    expect(createdUrls).toEqual(['image/svg+xml;charset=utf-8'])
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('returns false (no download) when the SVG is missing', () => {
    expect(exportSvgElement(null, 'a.svg')).toBe(false)
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('exports a canvas as PNG through toBlob', () => {
    const canvas = document.createElement('canvas')
    const toBlob = vi.fn((cb: BlobCallback) => cb(new Blob(['x'], { type: 'image/png' })))
    Object.defineProperty(canvas, 'toBlob', { value: toBlob })
    expect(exportCanvasElement(canvas, 'a.png')).toBe(true)
    expect(toBlob).toHaveBeenCalled()
    expect(createdUrls).toEqual(['image/png'])
  })

  it('ignores a null blob (tainted/empty canvas) and a missing canvas', () => {
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'toBlob', { value: vi.fn((cb: BlobCallback) => cb(null)) })
    expect(exportCanvasElement(canvas, 'a.png')).toBe(true)
    expect(clickSpy).not.toHaveBeenCalled()
    expect(exportCanvasElement(null, 'a.png')).toBe(false)
  })
})
