// FloatingViewWindow 拆分 shim（B1 纯搬家，2026-09-22；W-5 收口后补注模块现状）。
// 原单文件 2705 行拆为 ./floatingView/ 下多个模块：
//   FloatingViewWindow.tsx   老式悬浮窗外壳（context 壳，应用浮窗；W-3/W-4 后已按 KERNEL_VIEWS
//                            把 8 个视图的**内容+面板**交给内核 ViewContent/ViewParamsPanel）
//   ViewWindow.tsx           受控 ViewWindow（FGVE 引擎窗口内核）
//   ViewContent.tsx          按 view 分发到包内 Scene 内核（props 受控，消费 viewParams/decorations）
//   ViewParamsPanel.tsx      ⚙ 参数面板（含 Decorations 编辑器）
//   lazyViews.tsx            老式壳的**兜底**分发（仅 sylow/tree/prestable/action/homomorphism）
//   persist.ts / geometry.ts / styles.ts / CayleyPathEditor.tsx / types.ts
//   use*.ts                  8 个 hook（persist / dragResize / viewport / tableMinSize /
//                            cosetStrip 数据 / action 数据 / 面板数据 / 窗口视图数据）
// 本文件仅保留原导出路径，既有 import 零改动。分刀见 docs/PLAN_WINDOW_FRAMEWORK.md §5。
export { FloatingViewWindow } from './floatingView/FloatingViewWindow'
export { ViewWindow, type ViewParams } from './floatingView/ViewWindow'
