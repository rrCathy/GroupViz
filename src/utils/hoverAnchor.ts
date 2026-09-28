/**
 * 悬停锚点：把鼠标事件换算成**画布容器内**的像素坐标。
 *
 * 背景（2026-09-26 真机实测发现）：Scene 里节点位置是 **viewBox 坐标**（0..viewBoxSize，
 * 如 2000×2000），而「就地气泡」是 HTML 绝对定位（像素）。此前 Scene 直接把
 * `pos.x * canvasTransform.scale + canvasTransform.x` 当 anchor 上报 ⇒ 消费端拿它当 left/top
 * 会把气泡放到容器外（500×400 的浮窗实测气泡落在 x≈1107）。`ViewWindow` 的手写气泡同病，
 * 只是它的窗口更大、恰好落在框内才没暴露。
 *
 * 取**鼠标位置**而不是节点中心：hover 场景下鼠标就在节点圆内，气泡贴鼠标比贴圆心更贴合视线，
 * 也免去"节点中心还要再做一次 viewBox→像素换算"。表格类视图不提供锚点（调用方传 null）。
 *
 * 返回 null ⇒ 消费端不渲染气泡（拿不到 svg 或容器尚未布局，如 jsdom/happy-dom 的零尺寸 rect）。
 */
export function hoverAnchorFromEvent(e: {
  clientX: number
  clientY: number
  currentTarget: EventTarget | null
}): { x: number; y: number } | null {
  const el = e.currentTarget as Element | null
  const svg = el?.closest?.('svg')
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}
