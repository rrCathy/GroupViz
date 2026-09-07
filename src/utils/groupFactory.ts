/**
 * 群符号 → Group 工厂（纯算法，已下沉到 core）。
 *
 * 此文件保留为向后兼容的再导出 shim：外部层（components/context/tests）
 * 继续从这里导入 createGroupFromSymbol；实现位于 core/groups/groupFactory，
 * 不引入任何 UI / 渲染依赖。
 */
export { createGroupFromSymbol } from '../core/groups/groupFactory'
