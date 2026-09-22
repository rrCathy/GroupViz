// FloatingViewWindow 拆分 shim（B1 纯搬家，2026-09-22）。
// 原单文件 2705 行拆为 ./floatingView/ 下 7 个模块：
//   lazyViews.tsx            老式窗口内容分发（renderViewContent + 包装组件）
//   FloatingViewWindow.tsx   老式悬浮窗外壳（context 壳）
//   ViewWindow.tsx           受控 ViewWindow（FGVE 引擎窗口内核）
//   persist.ts               几何/配置/参数持久化（zod schema）
//   geometry.ts              常量 / resize 方向 / 尺寸钳制
//   styles.ts                工具栏与按钮样式
//   CayleyPathEditor.tsx     路径高亮编辑器
// 本文件仅保留原导出路径，8 处既有 import 零改动。
export { FloatingViewWindow } from './floatingView/FloatingViewWindow'
export { ViewWindow, type ViewParams } from './floatingView/ViewWindow'
