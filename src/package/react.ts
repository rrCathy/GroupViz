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

export { I18nProvider } from '../i18n/I18nContext'

export type { Group, GroupElement } from '../core/types'
