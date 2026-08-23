/**
 * GroupViz engine facade (FGVE 前置：未来 src/engine 的协议雏形)。
 *
 * 外部层（components/context/utils）应优先从这里导入；直接深导入
 * core 内部分片（core/types/{group,view,homomorphism,actions} 与
 * _internal/*）被 ESLint 边界规则禁止。
 *
 * 注意：isAutomorphismGroup 的公共版本是 algebra/groupProps.ts（经
 * ./types 导出）；automorphisms.ts 内的同名实现为内部细节，不在门面导出。
 */
export * from './types'
export * from './viewBox'
export * from './elementRotation'
export * from './polyhedra'
export * from './result'
export * from './guards'

export * from './groups/CyclicGroup'
export * from './groups/DihedralGroup'
export * from './groups/SymmetricGroup'
export * from './groups/AlternatingGroup'
export * from './groups/SpecialGroup'
export * from './groups/GeneralLinearGroup'
export * from './groups/DirectProduct'
export * from './groups/SemidirectProduct'
export * from './groups/SmallGroups'
export * from './groups/importGroup'

export * from './algebra/subgroups'
export * from './algebra/homomorphisms'
export * from './algebra/actions'
export * from './algebra/sylow'
export * from './algebra/series'
export * from './algebra/properties'
export {
  findAllAutomorphisms,
  createAutomorphismGroup,
} from './algebra/automorphisms'
export type { Automorphism } from './algebra/automorphisms'
export * from './algebra/presentations'
export * from './algebra/notationParser'
export * from './algebra/semidirectDecompositions'
export * from './algebra/ringOrder'
export * from './algebra/cayleyEdges'
export * from './algebra/cayleyTree'
export * from './algebra/cycleLayouts'
export * from './algebra/forceLayout'
export * from './algebra/layout3D'
export * from './algebra/shapeLayouts'
export * from './algebra/planarity'
