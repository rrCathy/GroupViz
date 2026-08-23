// SmallGroups barrel：数据与逻辑分离后的公共导出面（与拆分前完全一致）。
// 内部实现见 SmallGroups/ 目录；createTableGroup/structureToSymbol 等内部
// 函数不进 barrel，保持原有公共面。
export {
  getAllSmallGroups,
  getSmallGroup,
  getSmallGroupBySymbol,
  getPrecomputed,
  type PrecomputedData,
  type SmallGroupEntry
} from './SmallGroups/registry'
export { createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3, createZ6xZ2 } from './SmallGroups/abelianProducts'
export { assignWordLabels, applyDihedralNormalForm } from './SmallGroups/wordLabels'
