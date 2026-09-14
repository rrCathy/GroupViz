/**
 * 群记号解析的**唯一入口**。
 *
 * 为什么要有这一层：此前有两套并行逻辑——`createGroupFromSymbol`（本地工厂，看
 * 的是引擎 symbol 形态）和 `notationParser.parseCore`（算 GAP 表达式与阶，看的是
 * 归一化形态）。两者判断口径不一致，于是出现三种裂缝（均为实测）：
 *   1. 本地明明能建、UI 却判失败：`Z4` / `QD16` / `C_7:C_3` —— parseCore 的
 *      `startswith S` 家族正则与 `:` 一律报 semidirect 的旧规则挡在前面；
 *   2. 本地能建却走后端（离线不可用）：`S_3^2` / `C_2^2` / `Q8` / `V4` ——
 *      归一化没把上标与 Q8/V4 补成花括号形态；
 *   3. 静默给错群：`C_2²` 被吞成 `C_{22}`。
 *
 * 现在流程固定为：规范化 → 专名/别名展开 → 本地建群 → 才考虑后端 → 定向报错。
 * **本地优先**是硬规则：只要工厂能建，绝不放后端（宿主可能离线）。
 */
import { createGroupFromSymbol } from '../../groups/groupFactory'
import { getAllSmallGroups } from '../../groups/SmallGroups'
import type { Group } from '../../types'
import {
  canonicalizeNotation,
  expandAliases,
  buildRegistryIndex,
  type CanonicalError,
  type NotationIssue,
} from './canonical'
import { parseCore, type ExprErrorCode } from './expr'

export type NotationError = CanonicalError | ExprErrorCode | 'alias-ambiguous'

/** 记号能被谁建出来。 */
export type NotationSource =
  /** 本地工厂直接命中（registry 或构造式） */
  | 'local'
  /** 专名/别名展开后本地命中（如 F_{21} → C_{7}:C_{3}） */
  | 'named'
  /** 本地建不了，需要后端 GAP（如 PSL(2,7) / Aut(S_4)） */
  | 'backend'

export interface GroupNotation {
  ok: boolean
  error?: NotationError
  /** 结构化失败信息：UI 用 `kind` + i18n 模板渲染，不直接吃中文文案 */
  issue?: NotationIssue
  /** 中文兜底文案（测试与日志用） */
  hint?: string
  input: string
  /** 规范化后的形态 */
  canonical: string
  /** 引擎规范符号（本地可建时非空；否则为 null） */
  symbol: string | null
  order: number | null
  /** KaTeX 可渲染的 TeX；parseCore 认不出时为空串，由调用方降级显示 canonical */
  tex: string
  source: NotationSource | null
  /** 需后端时给出的 GAP 表达式 */
  gapExpr: string | null
  /** 应用过的归一化规则名（供 UI 展示「已识别为」） */
  applied: string[]
  /** 命中的别名规则说明（如 `专名 F_{21} → C_{7}:C_{3}`） */
  via?: string
}

let registryIndexCache: Map<number, string[]> | null = null

/** 注册表「阶 → 符号列表」索引（惰性构建，供 F_n / Dic_n 规则用）。 */
export function registrySymbolIndex(): Map<number, string[]> {
  if (!registryIndexCache) {
    registryIndexCache = buildRegistryIndex(getAllSmallGroups().map((e) => e.group))
  }
  return registryIndexCache
}

/** 仅供测试：清空索引缓存。 */
export function resetRegistryIndexCache(): void {
  registryIndexCache = null
}

function fail(
  input: string,
  canonical: string,
  error: NotationError,
  issue: NotationIssue,
  hint: string,
  applied: string[] = [],
): GroupNotation {
  return {
    ok: false, error, issue, hint, input, canonical,
    symbol: null, order: null, tex: '', source: null, gapExpr: null, applied,
  }
}

/**
 * 解析一个群记号。宿主与 UI 都应当走这里，而不是直接调 createGroupFromSymbol
 * （后者只认引擎内的规范形态，不收别名）。
 */
export function parseGroupNotation(input: string): GroupNotation {
  const canon = canonicalizeNotation(input)
  if (!canon.ok) {
    return fail(input, canon.canonical, canon.error, canon.issue, canon.hint ?? '', [])
  }

  const applied = [...canon.applied]
  const alias = expandAliases(canon.canonical, registrySymbolIndex())
  if (!alias.ok) {
    return fail(
      input, canon.canonical, 'alias-ambiguous',
      alias.issue ?? { kind: 'ambiguous' }, alias.hint ?? '', applied,
    )
  }

  const symbol = alias.symbol
  const via = alias.via
  let viaNote: string | undefined
  if (via) {
    applied.push(via)
    viaNote = `已按别名识别：${via}`
  }

  // ── 1. 本地优先 ──────────────────────────────────────────────────────────
  let localGroup: Group | null = null
  try {
    localGroup = createGroupFromSymbol(symbol)
  } catch {
    // 本地构造器对超范围参数会抛（如 A_6），视作本地不可建、继续走后端
    localGroup = null
  }

  if (localGroup) {
    const core = parseCore(localGroup.symbol)
    return {
      ok: true,
      hint: viaNote,
      input,
      canonical: canon.canonical,
      // 用引擎自己的 symbol 而非用户输入形态：它才是会话恢复/分享时要落盘的写法
      symbol: localGroup.symbol,
      order: localGroup.order,
      tex: 'error' in core ? '' : core.tex,
      source: via ? 'named' : 'local',
      gapExpr: null,
      applied,
      via,
    }
  }

  // ── 2. 本地建不了 → 交给后端 GAP ────────────────────────────────────────
  const core = parseCore(symbol)
  if (!('error' in core)) {
    return {
      ok: true,
      hint: viaNote,
      input,
      canonical: canon.canonical,
      symbol: null,
      order: core.order,
      tex: core.tex,
      source: 'backend',
      gapExpr: core.gapExpr,
      applied,
      via,
    }
  }

  // ── 3. 都不行 → 定向报错 ────────────────────────────────────────────────
  const issue: NotationIssue =
    core.error === 'semidirect' ? { kind: 'semidirect', suggestion: symbol }
    : core.error === 'family' ? { kind: 'family', suggestion: symbol }
    : { kind: 'unknown' }
  const hint = core.error === 'semidirect'
    ? `半直积记号 ${symbol} 本地没有（registry 未收录，且找不到满足条件的非平凡作用 φ），后端也无法自动定 φ；请改写为 SmallGroup(n,i)，或先用两个子群在半直积面板里显式指定 φ`
    : core.error === 'family'
      ? `${symbol} 的族参数超出本地可构造范围（如 Q_n 要求 n ≡ 0 mod 4），请检查参数或改用 SmallGroup(n,i)`
      : `无法识别的群记号 ${input}。可用写法：C_{12} · S_{3} · D_{4} · A_{5} · Q_{8} · V_{4} · C_{2}\\times C_{2} · C_{7}:C_{3} · GL(2,3) · SmallGroup(16,13)`
  return fail(input, canon.canonical, core.error, issue, hint, applied)
}
