// 子群代数模块桶：公共 API 与拆分前完全一致。
// 内部结构：shared（Subgroup 类型 + 闭包/极小生成集）→ detection（元素阶/同构识别）
// → enumerate（findAllSubgroups）→ lattice（子群格）/ normalSubgroups / quotient（陪集·商群）
// → conjugacy（中心/中心化子/正规化子/共轭类）。
export type { Subgroup } from './subgroups/shared'
export { findMinimalGenerators, closeUnderMultiply } from './subgroups/shared'
export {
  computeElementOrderInGroup,
  distributionsEqual,
  abelianFactorChains,
  abelianChainDistribution,
  detectAbelianType,
  detectIsomorphicGroup,
} from './subgroups/detection'
export { findAllSubgroups } from './subgroups/enumerate'
export {
  computeSubgroupLattice,
  SUBLATTICE_COLORS,
} from './subgroups/lattice'
export type { SubgroupLatticeNode, SubgroupLatticeEdge } from './subgroups/lattice'
export { isSimpleGroup, findAllNormalSubgroups } from './subgroups/normalSubgroups'
export {
  getGroupCenter,
  getCentralizer,
  getNormalizer,
  getConjugacyClasses,
} from './subgroups/conjugacy'
export { computeCosets, computeQuotientGroup } from './subgroups/quotient'
export type { CosetInfo } from './subgroups/quotient'
