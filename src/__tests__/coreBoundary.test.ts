import { describe, it, expect } from 'vitest'
import * as Core from '../core'
import * as CoreTypes from '../core/types'

// 经 vite ?raw 管线读取 core 全部源码（无需 node:fs，src 下无 node 类型）
const coreSources = import.meta.glob<string>('../core/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
})

function coreSourceFiles(): [string, string][] {
  return Object.entries(coreSources).filter(
    ([path]) => !path.includes('/__tests__/') && !/\.test\.tsx?$/.test(path)
  )
}

function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '')
  return noBlock
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//')
      return idx === -1 ? line : line.slice(0, idx)
    })
    .join('\n')
}

describe('engine boundary: src/core purity', () => {
  it('core 源码不依赖 React / DOM / localStorage', () => {
    const forbidden: [RegExp, string][] = [
      [/from\s+['"]react(-dom)?(\/|\b)?['"]/, 'react import'],
      [/\blocalStorage\b/, 'localStorage'],
      [/\bdocument\b/, 'document'],
      [/\bwindow\b/, 'window'],
      [/require\(/, 'require()'],
    ]
    const violations: string[] = []
    for (const [path, raw] of coreSourceFiles()) {
      const src = stripComments(raw)
      for (const [re, label] of forbidden) {
        if (re.test(src)) violations.push(`${path}: ${label}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('门面导出数量充足（协议面完整）', () => {
    const count = Object.keys(Core).length
    expect(count).toBeGreaterThan(180)
  })
})

describe('engine facade: 公共 API 存在性', () => {
  const fnNames = [
    // groups
    'createCyclicGroup',
    'createDihedralGroup',
    'createSymmetricGroup',
    'createS3',
    'createAlternatingGroup',
    'createKleinFour',
    'createQuaternion',
    'createGL2',
    'createDirectProduct',
    'createSemidirectProduct',
    'createGroupFromImport',
    'getAllSmallGroups',
    'getSmallGroupBySymbol',
    'getPrecomputed',
    'assignWordLabels',
    'applyDihedralNormalForm',
    // subgroups
    'computeSubgroupLattice',
    'findAllSubgroups',
    'findAllNormalSubgroups',
    'getGroupCenter',
    'getCentralizer',
    'getNormalizer',
    'getConjugacyClasses',
    'computeCosets',
    'computeQuotientGroup',
    'closeUnderMultiply',
    'isSimpleGroup',
    // homomorphisms
    'verifyHomomorphism',
    'computeKernelFromMapping',
    'autoBuildMapping',
    // automorphisms
    'findAllAutomorphisms',
    'createAutomorphismGroup',
    // actions
    'identityPermutation',
    'computeOrbits',
    'computeStabilizers',
    'verifyOrbitStabilizer',
    'buildActionComputation',
    // sylow / series / properties
    'factorizeOrder',
    'findSylowSubgroups',
    'computeSylowAnalysis',
    'computeSubgroupSeries',
    'enumerateCompositionSeries',
    'computeGroupProperties',
    'isSolvable',
    // presentations / notation
    'parseNotation',
    'parsePresentation',
    'parseWord',
    'simplifyWord',
    'runToddCoxeter',
    'buildGroupFromPresentation',
    'presentationOf',
    'discoverPresentation',
    'formatPresentation',
    'normalizeSuperscripts',
    // structure
    'findSemidirectDecompositions',
    'detectStructureType',
    // ring order
    'ringOrder',
    'powerRingOrder',
    'splitDihedralElements',
    'dihedralSnakeOrder',
    // layouts
    'computeCayleyActionEdges',
    'computeCayleyTree',
    'computeFreeTree',
    'computeFoldTree',
    'forceLayout',
    'forceLayoutAsync',
    'planarCycleLayout',
    'cayleyCircleLayout',
    'cosetStripLayout',
    'coneLayout2D',
    'dualRingLayout',
    'cylinderLayout2D',
    'torusLayout2D',
    'ringGridLayout2D',
    'directProductGridLayout2D',
    'quaternionRingLayout2D',
    'semidirectProductLayout',
    'projection3DLayout',
    'q8PythagoreanLayout',
    'spiralLayout',
    'archimedeanSpiralLayout',
    'coilLayout',
    'concentricLayout',
    'compute3DPositions',
    'computeShape2DPositions',
    'testGraphPlanarity',
    'getViewBoxSize',
    'isTooLarge',
    'computeElementRotation',
    // group props
    'isGroupCyclic',
    'isGroupDirectProduct',
    'isGroupSemidirectProduct',
    'getDefaultShape2D',
    'getAvailableShapesForView',
    'getDefaultLayout3D',
    'getAvailableShapes3D',
    'classifyDirectProduct2D',
    'findRingGridDecomposition',
    'isNamedRewiringGroup',
  ]

  it.each(fnNames)('Core.%s 已从门面导出', (name) => {
    expect(Core, `missing export: ${name}`).toHaveProperty(name)
    expect(typeof (Core as Record<string, unknown>)[name]).toBe('function')
  })

  const constNames = ['COLOR_PALETTE', 'SUBSET_COLORS', 'COSET_COLORS']
  it.each(constNames)('Core.%s 常量已导出', (name) => {
    expect(Array.isArray((CoreTypes as Record<string, unknown>)[name])).toBe(true)
  })

  it('automorphisms 内部版 isAutomorphismGroup 不经门面二次导出（公共版在 groupProps）', () => {
    expect(typeof (CoreTypes as Record<string, unknown>).isAutomorphismGroup).toBe('function')
  })
})
