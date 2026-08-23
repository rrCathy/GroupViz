// 群展示（Presentation）系统模块桶：公共 API 与拆分前完全一致。
// 内部结构：wordParser（词解析/规范化）→ toddCoxeter（陪集枚举 + 建群）
// → minimizer（关系发现 + 极小化 + 缓存）→ presentationOf（标准展示分发）。
export {
  simplifyWord,
  normalizeSuperscripts,
  parseWord,
  wordToCanonicalString,
  canonicalCyclicForm,
  parsePresentation,
  parseRelationEquation,
  formatPresentation,
} from './presentations/wordParser'
export {
  PRESENTATION_MAX_ORDER,
  TC_MAX_COSETS,
  TC_MAX_STEPS,
  runToddCoxeter,
  buildGroupFromPresentation,
} from './presentations/toddCoxeter'
export type { TCCResult, BuildPresentationOptions, BuildPresentationResult } from './presentations/toddCoxeter'
export {
  DISCOVERER_MAX_ORDER,
  DISCOVERER_RELATOR_CAP,
  DISCOVERER_WORD_BUDGET,
  DISCOVERER_LENGTHS,
  discoverPresentation,
} from './presentations/minimizer'
export {
  parseDirectProductParts,
  presentationOf,
} from './presentations/presentationOf'
