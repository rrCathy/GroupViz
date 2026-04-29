import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { ViewMode } from '../core/types'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function collectStyleText(): string {
  let css = ''
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        css += rule.cssText + '\n'
      }
    } catch {
      continue
    }
  }
  return css
}

function serializeSvg(svgEl: SVGElement): Blob {
  const clone = svgEl.cloneNode(true) as SVGElement

  const styleText = collectStyleText()
  if (styleText) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = styleText
    clone.insertBefore(style, clone.firstChild)
  }

  const viewBox = svgEl.getAttribute('viewBox') || ''
  const vbParts = viewBox.split(/\s+/).map(Number)
  const width = vbParts[2] || svgEl.clientWidth || 800
  const height = vbParts[3] || svgEl.clientHeight || 600

  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const serializer = new XMLSerializer()
  const svgString = serializer.serializeToString(clone)
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
}

export function exportView(viewMode: ViewMode, filename: string) {
  const viewport = document.querySelector('.canvas-viewport')
  if (!viewport) {
    alert('No viewport found')
    return
  }

  if (viewMode === '3d' || viewMode === 'symmetry') {
    const canvas = viewport.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) {
      alert('No canvas found')
      return
    }
    const dataUrl = canvas.toDataURL('image/png')
    const byteString = atob(dataUrl.split(',')[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: 'image/png' })
    triggerDownload(blob, filename)
  } else {
    const svg = viewport.querySelector('svg')
    if (!svg) {
      alert('No SVG found')
      return
    }
    const blob = serializeSvg(svg)
    triggerDownload(blob, filename)
  }
}

export async function exportSymmetryAsGif(filename: string, durationMs = 3000, fps = 10) {
  const viewport = document.querySelector('.canvas-viewport')
  if (!viewport) {
    alert('No viewport found')
    return
  }

  const canvas = viewport.querySelector('canvas')
  if (!canvas) {
    alert('No canvas found for GIF export')
    return
  }

  const frameDelay = Math.round(1000 / fps)
  const frameCount = Math.ceil(durationMs / frameDelay)

  const gif = GIFEncoder()
  const frames: Uint8Array[] = []

  for (let i = 0; i < frameCount; i++) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const offCanvas = document.createElement('canvas')
        offCanvas.width = canvas.width
        offCanvas.height = canvas.height
        const ctx = offCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, 0)
        const imageData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height)
        frames.push(new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength))
        resolve()
      })
    })

    await new Promise((resolve) => setTimeout(resolve, frameDelay))
  }

  for (let i = 0; i < frames.length; i++) {
    const data = frames[i]
    const palette = quantize(data, 256, { format: 'rgba' })
    const index = applyPalette(data, palette, 'rgba')
    gif.writeFrame(index, canvas.width, canvas.height, {
      palette,
      delay: frameDelay,
      repeat: i === 0 ? 0 : undefined,
    })
  }

  gif.finish()
  const bytes = gif.bytes()
  const blob = new Blob([bytes as BlobPart], { type: 'image/gif' })
  triggerDownload(blob, filename)
}
