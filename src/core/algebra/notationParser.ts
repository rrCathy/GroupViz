/**
 * 群记号解析（对外门面）。
 *
 * 实现在 `notation/` 子目录：
 *   - `notation/canonical.ts` —— 规范化（大小写 / 下标 / 上标 / 乘号 / 半直积符号），
 *     并**拒绝 Unicode 上下标**（`C₄`/`C_2²` 会报错并给出等价 TeX 写法）
 *   - `notation/expr.ts`      —— GAP 表达式 / 阶 / TeX（纯表达式层）
 *   - `notation/parse.ts`     —— 统一入口 `parseGroupNotation`
 *   - `notation/aliases.ts`   —— 反向：`getGroupAliases(群) → 别名列表`
 *
 * 为什么有这一层：此前 `normalizeNotation`/`parseCore` 与 `createGroupFromSymbol`
 * 是两套并行逻辑、口径不一致，产生三类裂缝（均实测）：本地能建但 UI 判失败
 * （`Z4`/`QD16`/`C_7:C_3`）、本地能建却走后端（`S_3^2`/`Q8`/`V4`）、静默给错群
 * （`C_2²` → `C_{22}`）。现在本文件只做转调与旧 API 兼容，不再自行解析。
 *
 * 旧 API（`normalizeNotation` / `parseNotation` / `groupOrder*`）保留：`core/index.ts`
 * 已 `export *` 出去，宿主与既有测试在用。
 */
import {
  parseGroupNotation,
  type GroupNotation,
  type NotationError,
  type NotationSource,
} from './notation/parse'
import { canonicalizeNotation, type NotationIssue } from './notation/canonical'

export type NotationErrorCode = NotationError

export interface NotationParseResult {
  ok: boolean
  error?: NotationErrorCode
  input: string
  /** 规范化后的形态（旧字段名 normalized，语义同 canonical） */
  normalized: string
  tex: string
  order: number | null
  gapExpr: string | null
  localSymbol: string | null
  /** 结构化失败信息：UI 用 kind + i18n 模板渲染（避免 core 里的中文文案漏到英文界面） */
  issue?: NotationIssue
  /** 中文兜底文案（测试与日志用） */
  hint?: string
  /** 记号来源：本地工厂 / 专名别名 / 后端 GAP */
  source?: NotationSource | null
  /** 应用过的归一化规则名 */
  applied?: string[]
  /** 命中的别名规则说明 */
  via?: string
}

/**
 * 规范化记号（保留旧签名）。返回的是引擎 symbol 形态，如 `C_{4}` / `S_{3}^{2}`。
 * Unicode 上下标会被拒绝（返回折叠后的建议写法），由 parseNotation 给出错误码。
 */
export function normalizeNotation(input: string): string {
  return canonicalizeNotation(input).canonical
}

/** 解析记号 → 本地可建 / 专名展开 / 需后端 / 定向错误。 */
export function parseNotation(input: string): NotationParseResult {
  const r: GroupNotation = parseGroupNotation(input)
  return {
    ok: r.ok,
    error: r.ok ? undefined : r.error,
    input,
    normalized: r.canonical,
    tex: r.tex,
    order: r.order,
    gapExpr: r.gapExpr,
    localSymbol: r.symbol,
    issue: r.issue,
    hint: r.hint,
    source: r.source,
    applied: r.applied,
    via: r.via,
  }
}

export { canonicalizeNotation } from './notation/canonical'
export type { NotationIssue } from './notation/canonical'
export { parseGroupNotation } from './notation/parse'
export type { GroupNotation, NotationSource } from './notation/parse'
export { getGroupAliases } from './notation/aliases'
export {
  groupOrderGL,
  groupOrderSL,
  groupOrderPGL,
  groupOrderPSL,
} from './notation/expr'
