/**
 * SVG 序列化（全量样式内联）—— 与导出链（gifenc / GIF 编码）解耦的纯 DOM 工具。
 *
 * 独立成模块的动机与 utils/download.ts 相同：窗口壳 / 内核要「导出当前这张 SVG」，
 * 但不应把 `utils/export.ts` 顶层的 gifenc 依赖拉进自己的程序图（FGVE 入包隔离）。
 *
 * 关键行为（原样沿用 export.ts 既有实现，勿改语义）：
 * 1. 克隆目标 SVG，把 `document.styleSheets` 全量 CSS 内联进 `<style>` —— 节点标签与注释
 *    都是 KaTeX HTML（在 `foreignObject` 里），样式不内联则在导出文件里掉排版；
 * 2. 把 dev-server 的 KaTeX 字体路径改写为 CDN，使文件脱离本项目也能正确渲染公式；
 * 3. 宽高取自 `viewBox`（退化到 clientWidth/Height），保证导出文件自带尺寸。
 */
import { triggerDownload } from './download'

export function collectStyleText(): string {
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

export function serializeSvg(svgEl: SVGElement): Blob {
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

/** 文件名安全化：保留中英数字与 `.`/`-`/`_`，其余折成 `-`（窗口标题常含 `·`/`/`/空格） */
export function exportFileName(title: string | null | undefined, fallback: string, ext: string): string {
  const base = (title ?? '').trim() || fallback
  const safe = base.replace(/[^\w\u4e00-\u9fa5.-]+/g, '-').replace(/^-+|-+$/g, '')
  return `${safe || fallback}.${ext}`
}

/** 导出窗口内的 SVG（含注释/标签样式）；找不到 SVG 返回 false */
export function exportSvgElement(svgEl: SVGSVGElement | null, filename: string): boolean {
  if (!svgEl) return false
  triggerDownload(serializeSvg(svgEl), filename)
  return true
}

/** 导出窗口内的 canvas（3D / 对称性视图）：canvas 栅格为 PNG */
export function exportCanvasElement(canvas: HTMLCanvasElement | null, filename: string): boolean {
  if (!canvas || typeof canvas.toBlob !== 'function') return false
  canvas.toBlob(blob => {
    // 空画布 / 跨域污染：静默放弃，不打断交互
    if (blob) triggerDownload(blob, filename)
  }, 'image/png')
  return true
}

/**
 * 走 **canvas 栅格** 的视图：3D / 对称性 —— 主体是 WebGL/canvas，HTML 覆盖层（标签、提示浮条、
 * 悬停气泡）天然不进栅格（PLAN_VIEW_CONTROL_LAYER §4.6 第 5 条）。其余视图都是内联 SVG，
 * 走 `serializeSvg` 全量样式内联。
 *
 * **口径唯一真源**：两套窗口壳（`ViewWindow` 内核 / `FloatingViewWindow` 应用浮窗）的导出行为与
 * 按钮文案都读这里，勿各写一份。
 */
const CANVAS_EXPORT_VIEWS: readonly string[] = ['3d', 'symmetry']

/** 该视图是否按 canvas 栅格导出（决定扩展名与按钮文案 Export PNG / Export SVG） */
export function isCanvasExportView(view: string): boolean {
  return CANVAS_EXPORT_VIEWS.includes(view)
}

/**
 * 从窗口**自己的内容宿主**导出当前视图：canvas 视图 → PNG，其余 → SVG（含注释/节点标签样式）。
 *
 * `host` 必须是本窗口内容容器的 DOM（`.floating-view-content` / 内核 viewport），**不是**主画布的
 * `.canvas-viewport` —— 两条出口互不干扰（主画布出口见 `utils/exportApi.ts`，按边界决策不接 VCL）。
 * 返回是否真的触发了下载：宿主/svg/canvas 缺失时为 false，不抛错。
 */
export function exportViewHost(
  host: HTMLElement | null,
  title: string | null | undefined,
  view: string,
): boolean {
  if (!host) return false
  const canvasView = isCanvasExportView(view)
  const name = exportFileName(title, view, canvasView ? 'png' : 'svg')
  return canvasView
    ? exportCanvasElement(host.querySelector('canvas'), name)
    : exportSvgElement(host.querySelector('svg'), name)
}
