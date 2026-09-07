/**
 * @groupviz/react 门面 — FGVE 阶段 3 双包产物（vite lib 构建入口）。
 *
 * 首批导出（最小闭环，按「零 context/i18n 依赖」标准筛选视图组件）：
 *   - SetView / CycleView：纯 props 视图内核，不读 useGroup/i18n/theme context，
 *     是 react 包独立渲染的干净起点。
 *
 * 后续批次将按视图 props 化 + 文案 props 化进度逐步补入其余 Scene
 * （cosetstrip/homomorphism/action/symmetry/cayley2d/cayley3d/table…）。
 *
 * 注意：本文件内不要直接 import '../../core/...' —— core 由宿主安装的
 * @groupviz/core 包供给（构建期 coreToPackage 插件把相对 core 引用 external）。
 */
export { SetView } from '../components/Canvas/SetView'
export type { SetViewProps } from '../components/Canvas/SetView'
export { CycleView } from '../components/Canvas/CycleView'
export type { CycleViewProps } from '../components/Canvas/CycleView'

export type { Group, GroupElement } from '../core/types'
