// Layout entry point — re-exports for backward compatibility.
// Implementation modules:
//   ./cycleLayouts        force-directed + cycle-based layouts
//   ./ringOrder           element orderings & factor parsing/clustering
//   ./cayleyEdges         Cayley edge computation
//   ./layouts/shared      shared layout utils (normalize, element order)
//   ./layouts/factorLayouts     direct-product factor layouts (grid/cylinder/ring-grid/torus)
//   ./layouts/ringShapeLayouts  ring-family layouts (concentric/cone/dual-ring/Q16/circle/spirals)
//   ./layouts/specialLayouts    special layouts (coset strip/3D projection/semidirect/Q8)

export {
  computeCayleyActionEdges, type ForceLayoutEdge, type ForceLayoutOptions,
} from './cayleyEdges'
export {
  computeCycleSubgroups, computeMaximalCycles, forceLayout, forceLayoutAsync, planarCycleLayout,
} from './cycleLayouts'
export type { PlanarCycleInput } from './cycleLayouts'
export {
  ringOrder, detectS3PermSet, S3_PERM_IDS, cayleyRingKeys, parseProductFactors,
  type ProductFactors, matrixGridLayout, nestedFactorLayout2D, factorPipeGroups,
  parseCompactFactors, type CompactFactorPart, clusterFactorGroups, tableGroupFactorSplit, clusterIsCyclic,
  factorPipeGroupsGrouped, type PipeFactorGrouped, splitDihedralElements, dihedralSnakeOrder,
} from './ringOrder'
export { normalizeLayout2D, computeElementOrder } from './layouts/shared'
export {
  directProductGridLayout2D, buildFactorSubgroup, factorCopyRingLayout,
  cylinderLayout2D, ringGridLayout2D, torusLayout2D,
} from './layouts/factorLayouts'
export {
  concentricLayout,
  type ConeRingOrderInfo, computeConeRingOrder, coneLayout2D,
  dualRingLayout, quaternionRingLayout2D, cayleyCircleLayout,
  archimedeanSpiralLayout, spiralLayout, coilLayout,
} from './layouts/ringShapeLayouts'
export {
  type CosetStripData, type CosetStripInfo, cosetStripLayout,
  projection3DLayout, semidirectProductLayout, q8PythagoreanLayout,
} from './layouts/specialLayouts'
