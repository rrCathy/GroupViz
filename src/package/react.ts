/**
 * @groupviz/react 门面 — FGVE 阶段 3 双包产物（vite lib 构建入口）。
 *
 * 导出清单（随视图入包批次扩充）：
 *   - 视图 Scene：SetView / CycleView / CayleyView / CosetStripScene 等纯渲染内核。
 *     Scene 仅依赖 i18n context（文案 key）+ core；不读 useGroup/useHover/useTheme
 *     —— context 组装壳（*View/*FromContext）留在主应用，不入包。
 *   - I18nProvider：react 包自带中文/英文语言包（translations.ts 全量打包），
 *     Scene 文案消费方需以 <I18nProvider> 包裹（缺省 Provider 时 t() 回落 key）。
 *
 * 注意：本文件内不要直接 import '../../core/...' —— core 由宿主安装的
 * @groupviz/core 包供给（构建期 coreToPackage 插件把相对 core 引用 external）。
 */
export { SetView } from '../components/Canvas/SetView'
export type { SetViewProps } from '../components/Canvas/SetView'
export { CycleView } from '../components/Canvas/CycleView'
export type { CycleViewProps } from '../components/Canvas/CycleView'
export { CayleyView } from '../components/Canvas/CayleyView'
export type { CayleyViewProps } from '../components/Canvas/CayleyView'
export { CosetStripScene } from '../components/Canvas/CosetStripScene'
export type { CosetStripSceneProps } from '../components/Canvas/CosetStripScene'
export { TableView } from '../components/Canvas/TableView'
export type { TableViewProps } from '../components/Canvas/TableView'
export { ActionScene } from '../components/Canvas/ActionScene'
export type { ActionSceneProps } from '../components/Canvas/ActionScene'
export { HomomorphismScene } from '../components/Canvas/HomomorphismScene'
export type { HomomorphismSceneProps } from '../components/Canvas/HomomorphismScene'
export { SymmetryViewScene } from '../components/Canvas/SymmetryViewScene'
export type { SymmetryViewSceneProps } from '../components/Canvas/SymmetryViewScene'
export { Cayley3DScene } from '../components/Canvas/Cayley3DScene'
export type { Cayley3DSceneProps } from '../components/Canvas/Cayley3DScene'
export { SublatticeScene } from '../components/Canvas/SublatticeScene'
export type { SublatticeSceneProps } from '../components/Canvas/SublatticeScene'

export { SceneWindow } from '../components/Canvas/SceneWindow'
export type { SceneWindowProps, SceneWindowConfig, SceneWindowCaps, SceneWindowTheme } from '../components/Canvas/SceneWindow'

// ── 便利层（FGVE 外部嵌入反馈批次） ───────────────────────────────────────────
// useSceneState：把「selectedElements + canvasTransform + viewBoxSize + hover」
// 四件套 + ResizeObserver + 滚轮缩放/拖拽平移 + 就地气泡包成一行，Scene 仍是纯受控内核。
export { useSceneState } from '../hooks/useSceneState'
export type { SceneState, SceneStateOptions, SceneStateProps } from '../hooks/useSceneState'
// 主题统一：2D Scene 的 `theme` prop 由它落地（缺省不注入、跟随外层）。
export { SceneThemeRoot } from '../components/Canvas/SceneThemeRoot'
export type { SceneTheme, SceneThemeRootProps } from '../components/Canvas/SceneThemeRoot'
// 悬停就地气泡默认实现（也可用 useSceneState().renderHoverBubble 自绘）。
export { SceneHoverBubble } from '../components/Canvas/SceneHoverBubble'
export type { SceneHoverBubbleProps } from '../components/Canvas/SceneHoverBubble'
// 宿主自建 chrome 时复用同一套文案（无 Provider 也返回真实中文）。
export { useTranslation } from '../i18n/useTranslation'

export { I18nProvider } from '../i18n/I18nContext'
export type { I18nProviderProps, I18nContextValue } from '../i18n/I18nContext'

export type { Group, GroupElement } from '../core/types'
