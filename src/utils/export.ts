import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { ViewMode } from '../core/types'
import { getCayley3DControls } from './cayley3dControls'

export function triggerDownload(blob: Blob, filename: string) {
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
  // Rewrite dev-server KaTeX font paths to a CDN so exported SVG renders
  // math correctly outside the local dev server.
  return css.replace(
    /url\(["']?\/node_modules\/katex\/dist\/fonts\/([^"')]+)["']?\)/g,
    'url("https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/fonts/$1")',
  )
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

export async function captureSvgFrame(
  svgEl: SVGSVGElement, w: number, h: number,
): Promise<Uint8Array> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement

  const root = document.documentElement
  const cs = (name: string) => getComputedStyle(root).getPropertyValue(name).trim() || '#000'
  const cssVars: Record<string, string> = {}
  for (const v of ['--text-primary','--text-muted','--node-text','--node-fill','--node-stroke',
    '--border-color','--bg-secondary','--canvas-bg','--accent-teal','--text-subtle','--bg-muted',
    '--border-primary','--bg-hint']) {
    cssVars[v] = cs(v)
  }

  const resolveStyle = (s: string): string => {
    let out = s
    for (const [k, v] of Object.entries(cssVars)) {
      out = out.replace(new RegExp(`var\\(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g'), v)
    }
    return out
  }

  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))

  for (const el of clone.querySelectorAll('*')) {
    for (const attr of ['fill', 'stroke', 'color', 'opacity'] as const) {
      const v = el.getAttribute(attr)
      if (v && v.includes('var(')) el.setAttribute(attr, resolveStyle(v))
    }
    const st = el.getAttribute('style')
    if (st && st.includes('var(')) el.setAttribute('style', resolveStyle(st))
  }

  const foreignObjects = clone.querySelectorAll('foreignObject')

  for (const fo of foreignObjects) {
    const div = fo.querySelector('div')
    if (!div) { fo.parentNode?.removeChild(fo); continue }
    // Strip KaTeX MathML (duplicates visible text via textContent)
    const mathml = div.querySelector('.katex-mathml')
    if (mathml) mathml.remove()
    const text = div.textContent?.trim() ?? ''
    if (!text) { fo.parentNode?.removeChild(fo); continue }
    const fw = parseFloat(fo.getAttribute('width') ?? '0')
    const fh = parseFloat(fo.getAttribute('height') ?? '0')
    const fx = parseFloat(fo.getAttribute('x') ?? '0')
    const fy = parseFloat(fo.getAttribute('y') ?? '0')
    const fs = String(parseFloat(div.style.fontSize || '11') || 11)
    const fcolor = resolveStyle(div.style.color || 'var(--text-primary)')

    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    textEl.setAttribute('x', String(fx + fw / 2))
    textEl.setAttribute('y', String(fy + fh / 2 + 1))
    textEl.setAttribute('text-anchor', 'middle')
    textEl.setAttribute('dominant-baseline', 'middle')
    textEl.setAttribute('fill', fcolor)
    textEl.setAttribute('font-size', fs)
    textEl.setAttribute('font-family', 'KaTeX_Main, KaTeX_AMS, serif')
    const foOpacity = fo.getAttribute('opacity')
    if (foOpacity) textEl.setAttribute('opacity', foOpacity)
    textEl.textContent = text
    fo.parentNode?.replaceChild(textEl, fo)
  }

  const svgString = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  return new Promise<Uint8Array>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = cssVars['--canvas-bg'] || '#1a1a2e'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      resolve(new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load SVG as image')) }
    img.src = url
  })
}

export function encodeGif(
  frames: Uint8Array[], width: number, height: number, fps: number,
): Blob {
  const frameDelay = Math.round(1000 / fps)
  const gif = GIFEncoder()

  for (let i = 0; i < frames.length; i++) {
    const data = frames[i]
    const palette = quantize(data, 256, { format: 'rgba' })
    const index = applyPalette(data, palette, 'rgba')
    gif.writeFrame(index, width, height, {
      palette,
      delay: frameDelay,
      repeat: i === 0 ? 0 : undefined,
    })
  }

  gif.finish()
  const bytes = gif.bytes()
  return new Blob([bytes as BlobPart], { type: 'image/gif' })
}

export async function exportSymmetryAsGifBlob(
  durationMs = 3000,
  fps = 10,
  onRestartAnimation?: () => void,
): Promise<Blob | null> {
  const viewport = document.querySelector('.canvas-viewport')
  if (!viewport) return null

  const canvas = viewport.querySelector('canvas')
  if (!canvas) return null

  const frameDelay = Math.round(1000 / fps)
  const frameCount = Math.ceil(durationMs / frameDelay)

  const gif = GIFEncoder()
  const captureStart = performance.now()

  for (let i = 0; i < frameCount; i++) {
    if (onRestartAnimation && i === Math.floor(frameCount / 3)) {
      onRestartAnimation()
    }

    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        const offCanvas = document.createElement('canvas')
        offCanvas.width = canvas.width
        offCanvas.height = canvas.height
        const ctx = offCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, 0)
        const imageData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height)
        const frame = new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength)
        const palette = quantize(frame, 256, { format: 'rgba' })
        const index = applyPalette(frame, palette, 'rgba')
        gif.writeFrame(index, canvas.width, canvas.height, {
          palette,
          delay: frameDelay,
          repeat: i === 0 ? 0 : undefined,
        })
        resolve()
      })
    })

    if (i < frameCount - 1) {
      const nextTarget = captureStart + (i + 1) * frameDelay
      const wait = Math.max(0, nextTarget - performance.now())
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
    }
  }

  gif.finish()
  const bytes = gif.bytes()
  return new Blob([bytes as BlobPart], { type: 'image/gif' })
}

export async function exportSymmetryAsGif(
  filename: string,
  durationMs = 3000,
  fps = 10,
  onRestartAnimation?: () => void,
) {
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

  const captureStart = performance.now()
  const animPlayMs = 1000
  const holdMs = 500
  let nextRestartAt = animPlayMs + holdMs

  for (let i = 0; i < frameCount; i++) {
    const elapsed = performance.now() - captureStart

    // After animation finishes + hold, restart (callback is non-blocking,
    // so captures keep running and record the new animation).
    if (onRestartAnimation && elapsed >= nextRestartAt) {
      onRestartAnimation()
      nextRestartAt = elapsed + animPlayMs + holdMs
    }

    // Capture one frame, synced to the next paint
    await new Promise<void>(resolve => {
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

    // Pace captures to the target fps
    if (i < frameCount - 1) {
      const targetNext = captureStart + (i + 1) * frameDelay
      const wait = Math.max(0, targetNext - performance.now())
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
    }
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

export interface Cayley3DExportPlan {
  seconds: number
  cycles: number
  periodSec: number
  fps: number
  frameCount: number
  frameDelay: number
  radPerSec: number
}

// 3D 凯莱图 GIF 导出方案（纯函数）：「3s」= 3 秒时长（2 圈）；「5 个旋转周期」= 5 圈 × periodSec
export function cayley3DExportPlan(
  opts: { seconds?: number; cycles?: number; periodSec?: number; fps?: number } = {},
): Cayley3DExportPlan {
  const fps = opts.fps ?? 20
  const periodSec = opts.periodSec ?? 1.5
  const cycles = opts.cycles ?? 2
  const seconds = opts.seconds ?? cycles * periodSec
  const frameDelay = Math.round(1000 / fps)
  const frameCount = Math.ceil((seconds * 1000) / frameDelay)
  const radPerSec = (cycles * 2 * Math.PI) / seconds
  return { seconds, cycles, periodSec, fps, frameCount, frameDelay, radPerSec }
}

// 3D 凯莱图旋转 GIF：通过 cayley3dControls 桥以固定角速度驱动主视口相机旋转并逐帧采集
export async function exportCayley3DGif(
  filename: string,
  plan: Cayley3DExportPlan,
): Promise<Blob | null> {
  const viewport = document.querySelector('.canvas-viewport')
  if (!viewport) {
    alert('No viewport found')
    return null
  }

  const canvas = viewport.querySelector('canvas')
  if (!canvas) {
    alert('No canvas found for GIF export')
    return null
  }

  const ctrl = getCayley3DControls()
  if (!ctrl || !ctrl.isReady()) {
    alert('3D view not ready for GIF export')
    return null
  }

  const snapshot = ctrl.snapshotOrbit()
  ctrl.beginRotation(plan.radPerSec)
  try {
    const gif = GIFEncoder()
    const captureStart = performance.now()

    for (let i = 0; i < plan.frameCount; i++) {
      await new Promise<void>((resolve, reject) => {
        requestAnimationFrame(() => {
          try {
            const offCanvas = document.createElement('canvas')
            offCanvas.width = canvas.width
            offCanvas.height = canvas.height
            const ctx = offCanvas.getContext('2d')!
            ctx.drawImage(canvas, 0, 0)
            const imageData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height)
            const frame = new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength)
            const palette = quantize(frame, 256, { format: 'rgba' })
            const index = applyPalette(frame, palette, 'rgba')
            gif.writeFrame(index, canvas.width, canvas.height, {
              palette,
              delay: plan.frameDelay,
              repeat: i === 0 ? 0 : undefined,
            })
            resolve()
          } catch (err) {
            reject(err)
          }
        })
      })

      if (i < plan.frameCount - 1) {
        const nextTarget = captureStart + (i + 1) * plan.frameDelay
        const wait = Math.max(0, nextTarget - performance.now())
        if (wait > 0) await new Promise(r => setTimeout(r, wait))
      }
    }

    gif.finish()
    const bytes = gif.bytes()
    const blob = new Blob([bytes as BlobPart], { type: 'image/gif' })
    triggerDownload(blob, filename)
    return blob
  } finally {
    ctrl.endRotation(snapshot)
  }
}
