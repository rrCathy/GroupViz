// ── ViewWindow 窗口几何：常量 / resize 方向 / 手柄样式 / 尺寸钳制（纯搬家）──
const RESIZE_H = 8
export const TBAR_H = 32
export const MIN_W = 280
export const MIN_H = 180
export const PARAMS_W = 200
export const PARAMS_GAP = 8
export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const RESIZE_CURSORS: Record<ResizeDir, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  nw: 'nwse-resize', se: 'nwse-resize',
}

export const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

// 边 8px、角 22px —— 角更大易抓取，resize 跟手。
const CORNER_H = 22

export function resizeHandleStyle(dir: ResizeDir): React.CSSProperties {
  const s = RESIZE_H
  const c = CORNER_H
  const base: React.CSSProperties = {
    position: 'absolute', zIndex: 10, cursor: RESIZE_CURSORS[dir],
  }
  switch (dir) {
    case 'n': return { ...base, top: 0, left: s, right: s, height: s }
    case 's': return { ...base, bottom: 0, left: s, right: s, height: s }
    case 'e': return { ...base, right: 0, top: s, bottom: s, width: s }
    case 'w': return { ...base, left: 0, top: s, bottom: s, width: s }
    case 'ne': return { ...base, top: 0, right: 0, width: c, height: c }
    case 'nw': return { ...base, top: 0, left: 0, width: c, height: c }
    case 'se': return { ...base, bottom: 0, right: 0, width: c, height: c }
    case 'sw': return { ...base, bottom: 0, left: 0, width: c, height: c }
  }
}

export interface VwGeometry { position: { x: number; y: number }; size: { width: number; height: number } }

export function clampResize(dir: ResizeDir, startGeo: VwGeometry, dx: number, dy: number, min?: { width: number; height: number }): VwGeometry {
  const mw = min?.width ?? MIN_W
  const mh = min?.height ?? MIN_H
  let { x: px, y: py } = startGeo.position
  let { width: w, height: h } = startGeo.size
  if (dir.includes('e')) { w = Math.max(mw, startGeo.size.width + dx) }
  if (dir.includes('w')) { const nw = Math.max(mw, startGeo.size.width - dx); px += startGeo.size.width - nw; w = nw }
  if (dir.includes('s')) { h = Math.max(mh, startGeo.size.height + dy) }
  if (dir.includes('n')) { const nh = Math.max(mh, startGeo.size.height - dy); py += startGeo.size.height - nh; h = nh }
  return { position: { x: px, y: py }, size: { width: w, height: h } }
}
