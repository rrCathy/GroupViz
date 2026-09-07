/**
 * 通用 Blob 下载触发 —— 与导出链（gifenc/渲染收集）解耦的纯 DOM 工具。
 *
 * 独立成模块的动机（FGVE 阶段 3 入包）：TableView 等纯内核 Scene 需要
 * "导出当前 SVG" 能力，但 utils/export.ts 整模块顶层依赖 gifenc（GIF 编码，
 * 无 sideEffects 声明时会被打包器保守内嵌）。把 triggerDownload 抽到零依赖
 * 模块后，react 包的程序图不再触及 export.ts，gifenc 不会进入包产物。
 */
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
