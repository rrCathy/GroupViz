/**
 * 群记号规范化：把人类写法归一到引擎的 symbol 形态。
 *
 * 归一目标就是 registry 里那套写法（实测 93 个注册表群只用到这些形状）：
 *   C_{4} · S_{3} · D_{4} · A_{5} · Q_{8} · Q_{16} · V_{4} · QD_{16} · SL(2,3)
 *   C_{2}^{2} · C_{2}\times C_{2} · C_{3}\times D_{4}
 *   C_{7}:C_{3} · (C_{4}\times C_{2}):C_{2} · SmallGroup(16,13) · Aut(S_{4})
 *
 * 覆盖的写法规格（每条都有单测）：
 *   - 大小写：c4 / s3 / gl(2,3) → C_{4} / S_{3} / GL(2,3)
 *   - 下标：C4 / C_4 / C{4} → C_{4}
 *   - 上标：C_2^2 / (C_2)^2 → C_{2}^{2}
 *   - 乘号：x / X / * / · / \times → ×（顶层）
 *   - 半直积：⋊ / \rtimes → :
 *   - 循环群等价记号：Z_{n} / Z4 / ℤ_{4} → C_{n}
 *   - 商群写法：Z/4Z → C_{4}
 *
 * ## 设计取舍：拒绝 Unicode 上下标
 *
 * 解析入口只收 TeX 形态，遇到 `C₄` / `S₃` / `C_2²` 一律报错，并给出等价的 TeX
 * 写法。理由：
 *   1. 引擎与 registry 全程用 TeX 记号。收了 Unicode 就得在两套写法间来回猜，
 *      边界必然出错——实测 `C_2²` 会在归一链里被吞成 `C_{22}`（22 阶），
 *      **静默给出错误的群**，比直接报错危险得多。
 *   2. 报错信息能直接告诉用户该写什么（`请改用 C_{2}^{2}`），比"猜对一半"有用。
 *
 * 展示方向（utils/texify.ts 的 Unicode→TeX 转换）不受此限，那是给人看的。
 */
import type { Group } from '../../types'

/** 规范化失败的错误码（UI 按 === 定向提示） */
export type CanonicalError =
  /** 输入为空 */
  | 'empty'
  /** 使用了 Unicode 上下标（ₙ / ⁿ），请改 TeX 形态 */
  | 'unicode-script'
  /** 无法识别的记法 */
  | 'unknown'

export interface CanonicalOk {
  ok: true
  /** 规范形态 */
  canonical: string
  /** 命中并应用的归一化规则名（供 UI 展示「已识别为」） */
  applied: string[]
}

/** 规范化失败的结构化描述（UI 用它 + i18n 模板渲染，不直接吃中文文案）。 */
export interface NotationIssue {
  kind:
    /** 空输入 */
    | 'empty'
    /** 用了 Unicode 上下标 */
    | 'unicode'
    /** 专名有多个候选，需用户指定 */
    | 'ambiguous'
    /** 专名相关阶超出本地注册表范围 */
    | 'no-ring'
    /** 半直积定不了 φ */
    | 'semidirect'
    /** 族参数越界（如 Q_n 要求 n ≡ 0 mod 4） */
    | 'family'
    /** 认不出 */
    | 'unknown'
  /** 建议改写成的写法（unicode / family 用） */
  suggestion?: string
  /** 歧义候选（ambiguous 用） */
  candidates?: string[]
  /** 相关阶（no-ring 用） */
  order?: number
}

export interface CanonicalFail {
  ok: false
  error: CanonicalError
  /** 结构化失败信息（UI 用 i18n 渲染） */
  issue: NotationIssue
  /** 中文兜底文案（测试与日志用；UI 优先用 issue + i18n） */
  hint?: string
  /** 尽力给出的可读中间结果 */
  canonical: string
}

export type CanonicalResult = CanonicalOk | CanonicalFail

// ── Unicode 上下标 ────────────────────────────────────────────────────────────
// 下标 U+2080–U+2089（数字）、U+2090–U+209C（字母）；上标见下表。
const UNICODE_SCRIPT_RE = /[\u00b2\u00b3\u00b9\u2070-\u207f\u2080-\u2089\u2090-\u209c]/

const UNICODE_SUB_TO_ASCII: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₔ': 'e',
  'ₕ': 'h', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n',
  'ₚ': 'p', 'ₛ': 's', 'ₜ': 't',
}

const UNICODE_SUP_TO_ASCII: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  'ⁱ': 'i', 'ⁿ': 'n', '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')',
}

/**
 * 把 Unicode 上下标折成 ASCII，仅用于生成「建议写法」的提示串。
 *
 * 必须保留上下标语义：`C_2²` 要折成 `C_2^2`（而不是 `C_22`），否则提示会
 * 建议用户改写成 `C_{22}` —— 那正是原来静默给错群的根源。
 */
function foldUnicodeScript(input: string): string {
  let out = ''
  let prevKind: 'sub' | 'sup' | null = null
  for (const ch of input) {
    const sub = UNICODE_SUB_TO_ASCII[ch]
    const sup = UNICODE_SUP_TO_ASCII[ch]
    if (sub !== undefined) {
      if (prevKind !== 'sub') out += '_'
      out += sub
      prevKind = 'sub'
    } else if (sup !== undefined) {
      if (prevKind !== 'sup') out += '^'
      out += sup
      prevKind = 'sup'
    } else {
      out += ch
      prevKind = null
    }
  }
  return out
}

// ── 规则表 ───────────────────────────────────────────────────────────────────

/** 多字母族名 / 函数名统一大小写（不区分大小写匹配）。顺序敏感：长的在前。 */
const FUNCTION_NAMES: string[] = [
  'SmallGroup', 'Frobenius', 'Klein', 'Dihedral', 'Symmetric', 'Alternating',
  'Cyclic', 'Quaternion', 'PGL', 'PSL', 'GL', 'SL', 'Aut', 'Sym', 'Alt', 'Dic', 'QD',
]

/** 单字母群族（其后跟数字/下标时应当大写）。 */
const SINGLE_LETTER_FAMILIES = 'CDSAQVZ'

interface Step {
  name: string
  fn: (s: string) => string
}

/**
 * 归一步骤流水线。每一步只在真的改动字符串时才登记进 applied。
 *
 * 顺序有讲究：**乘号归一必须在单字母族大写之前**——`s3xs3` 里第二个 `s` 前面
 * 是乘号，要先把它变成 `×`，那个 `s` 才会被识别成族字母而大写。
 */
const STEPS: Step[] = [
  {
    name: '去空白',
    fn: (s) => s.replace(/\s+/g, ''),
  },
  {
    name: '函数名统一大小写',
    fn: (s) => {
      let out = s
      for (const name of FUNCTION_NAMES) {
        // 前面不能是字母数字（避免 SmallGroup 里的 gl、PGL 里的 GL 被误替换）；
        // 后面只排除字母——QD16 / Dic3 / Sym(3) 这类后面跟数字或括号的也要收
        const re = new RegExp(`(?<![A-Za-z0-9])${name}(?![A-Za-z])`, 'gi')
        out = out.replace(re, name)
      }
      return out
    },
  },
  {
    name: '乘号归一为 ×',
    fn: (s) => s
      .replace(/\\times/g, '×')
      .replace(/[*·⨯✕]/g, '×')
      // 裸 x/X 作乘号：左侧是数字或右花括号，右侧是字母或左括号（大小写都收，
      // 大写化在下一步做）
      .replace(/(?<=[0-9}])[xX](?=[A-Za-z(])/g, '×'),
  },
  {
    name: '半直积归一为 :',
    fn: (s) => s.replace(/\\rtimes/g, ':').replace(/⋊/g, ':').replace(/\\ltimes/g, ':'),
  },
  {
    name: '单字母族大写',
    fn: (s) => {
      const re = new RegExp(`(?<![A-Za-z])[${SINGLE_LETTER_FAMILIES}${SINGLE_LETTER_FAMILIES.toLowerCase()}](?=[\\d_{])`, 'g')
      return s.replace(re, (m) => m.toUpperCase())
    },
  },
  {
    name: 'ℤ 归一为 Z',
    fn: (s) => s.replace(/ℤ/g, 'Z'),
  },
  {
    name: '商群写法 Z/nZ → C_{n}',
    fn: (s) => s.replace(/^Z\/(\d+)Z$/i, 'C_{$1}'),
  },
  {
    name: '循环群 Z → C',
    fn: (s) => s.replace(/(?<![A-Za-z])Z(?=[\d_{])/g, 'C'),
  },
  {
    name: '下标补花括号',
    fn: (s) => {
      let out = s
      // C4 → C_{4}
      out = out.replace(new RegExp(`(?<![A-Za-z0-9])[${SINGLE_LETTER_FAMILIES}](\\d+)(?![0-9])`, 'g'), (m) => {
        const letter = m[0]
        return `${letter}_{${m.slice(1)}}`
      })
      // C_4 → C_{4}（已有下划线但没花括号）
      out = out.replace(new RegExp(`([${SINGLE_LETTER_FAMILIES}])_(\\d+)(?!\\})`, 'g'), '$1_{$2}')
      // C{4} → C_{4}
      out = out.replace(new RegExp(`([${SINGLE_LETTER_FAMILIES}])\\{(\\d+)\\}`, 'g'), '$1_{$2}')
      // QD16 → QD_{16}、Dic3 → Dic_{3}
      out = out.replace(/(QD|Dic)(\d+)(?![0-9])/g, '$1_{$2}')
      return out
    },
  },
  {
    name: '上标补花括号',
    fn: (s) => s.replace(/\^(\d+)(?!\})/g, '^{$1}'),
  },
  {
    name: '幂的括号折叠',
    // 只折叠**不含顶层分隔符**的单原子括号：(C_{2})^{2} → C_{2}^{2}。
    // 绝不能碰 (C_{2}×C_{2})^{2} —— 那会被错折成 C_{2}×C_{2}^{2}，语义完全变了
    // （前者的阶是 16 的平方根关系，后者把幂只作用在第二个因子上）。
    fn: (s) => s.replace(/\(([^()×:]+)\)\^/g, '$1^'),
  },
  {
    name: '取幂边界的花括号',
    fn: (s) => s.replace(/\^\{(\d+)\}/g, '^{$1}'),
  },
]

/**
 * 规范化一个群记号。
 *
 * 成功时返回 canonical（引擎 symbol 形态）；失败时返回错误码与定向提示。
 * 注意：canonical 命不命中本地工厂由 parseGroupNotation 决定，本函数只管形态。
 */
export function canonicalizeNotation(input: string): CanonicalResult {
  const raw = input.trim()
  if (!raw) {
    return { ok: false, error: 'empty', issue: { kind: 'empty' }, canonical: '' }
  }

  // Unicode 上下标：拒绝，但用折叠后的写法给出建议
  if (UNICODE_SCRIPT_RE.test(raw)) {
    const folded = canonicalizeNotation(foldUnicodeScript(raw))
    const suggestion = folded.ok ? folded.canonical : foldUnicodeScript(raw)
    return {
      ok: false,
      error: 'unicode-script',
      canonical: folded.canonical,
      issue: { kind: 'unicode', suggestion },
      hint: `请改用 TeX 记号：${suggestion}`,
    }
  }

  let s = raw
  const applied: string[] = []
  for (const step of STEPS) {
    const next = step.fn(s)
    if (next !== s) {
      applied.push(step.name)
      s = next
    }
  }

  if (!s) {
    return { ok: false, error: 'unknown', issue: { kind: 'unknown' }, canonical: '' }
  }
  return { ok: true, canonical: s, applied }
}

// ── 别名展开（专名/等价记号 → 规范符号）────────────────────────────────────────

export interface AliasResolution {
  ok: boolean
  symbol: string
  /** 命中的别名规则名 */
  via?: string
  /** 失败时的结构化信息（UI 用 i18n 渲染） */
  issue?: NotationIssue
  hint?: string
}

/** 静态专名表：别名（已规范化形态）→ 规范符号。 */
const STATIC_ALIASES: Record<string, string> = {
  Klein: 'V_{4}',
  V4: 'V_{4}',
  K4: 'V_{4}',
  // K 不在单字母群族（CDSAQVZ）里，所以带下划线的 K_4 不会被「下标补花括号」
  // 规则处理，得在这里显式登记
  K_4: 'V_{4}',
}

/** 形如 Sym(n) / Alt(n) / Dihedral(n) / Cyclic(n) 的族函数。 */
const FAMILY_FUNCTIONS: [RegExp, (n: string) => string, string][] = [
  [/^Sym\((\d+)\)$/, (n) => `S_{${n}}`, 'Sym(n) → S_{n}'],
  [/^Symmetric\((\d+)\)$/, (n) => `S_{${n}}`, 'Symmetric(n) → S_{n}'],
  [/^Alt\((\d+)\)$/, (n) => `A_{${n}}`, 'Alt(n) → A_{n}'],
  [/^Alternating\((\d+)\)$/, (n) => `A_{${n}}`, 'Alternating(n) → A_{n}'],
  [/^Dihedral\((\d+)\)$/, (n) => `D_{${n}}`, 'Dihedral(n) → D_{n}'],
  [/^Cyclic\((\d+)\)$/, (n) => `C_{${n}}`, 'Cyclic(n) → C_{n}'],
  [/^Quaternion\((\d+)\)$/, (n) => `Q_{${n}}`, 'Quaternion(n) → Q_{n}'],
]

/**
 * 把规范化后的记号里的专名/族函数展开成规范符号。
 *
 * 需要注册表支撑的规则（F_n、Dic_n）由调用方传入 lookup，避免本模块依赖
 * SmallGroups 单例——保持纯函数、可独立测试。
 */
export function expandAliases(
  canonical: string,
  registrySymbolsByOrder: Map<number, string[]>,
): AliasResolution {
  if (STATIC_ALIASES[canonical]) {
    return { ok: true, symbol: STATIC_ALIASES[canonical], via: `${canonical} → ${STATIC_ALIASES[canonical]}` }
  }

  for (const [re, build, via] of FAMILY_FUNCTIONS) {
    const m = re.exec(canonical)
    if (m) return { ok: true, symbol: build(m[1]), via }
  }

  // F_n / F_{n} / Frobenius(n)：阶为 n 的 Frobenius 群 = C_p ⋊ C_q
  // （registry 里的 C_{p}:C_{q}）
  const f = /^(?:F_?\{?(\d+)\}?|Frobenius\((\d+)\))$/.exec(canonical)
  if (f) {
    const n = Number(f[1] ?? f[2])
    const candidates = (registrySymbolsByOrder.get(n) ?? []).filter((s) => /^C_\{(\d+)\}:C_\{(\d+)\}$/.test(s))
    if (candidates.length === 1) {
      return { ok: true, symbol: candidates[0], via: `F_{${n}} → ${candidates[0]}` }
    }
    if (candidates.length === 0) {
      return {
        ok: false,
        symbol: canonical,
        issue: { kind: 'no-ring', order: n },
        hint: `阶 ${n} 的群在本地注册表（1–31 阶）里没有 C_p:C_q 型结构；F_{${n}} 无法确定，请直接写半直积记号或 SmallGroup(n,i)`,
      }
    }
    return {
      ok: false,
      symbol: canonical,
      issue: { kind: 'ambiguous', candidates },
      hint: `F_{${n}} 有 ${candidates.length} 个候选（${candidates.join(' / ')}），请直接指定其中一个`,
    }
  }

  // Dic_n（双循环群）：⟨a,b | a^{2n}=1, b²=a^n, bab⁻¹=a⁻¹⟩，阶 **4n**
  const dic = /^Dic_?\{?(\d+)\}?$/.exec(canonical)
  if (dic) {
    const n = Number(dic[1])
    const target = 4 * n
    const candidates = (registrySymbolsByOrder.get(target) ?? []).filter((s) => /^C_\{(\d+)\}:C_\{(\d+)\}$/.test(s))
    if (candidates.length >= 1) {
      return { ok: true, symbol: candidates[0], via: `Dic_{${n}} → ${candidates[0]}` }
    }
    return {
      ok: false,
      symbol: canonical,
      issue: { kind: 'no-ring', order: target },
      hint: `Dic_{${n}} 的阶是 ${target}，本地注册表（1–31 阶）里没有该阶的 C_p:C_q 结构${n === 2 ? '（Dic_2 ≅ Q_8，可直接写 Q_{8}）' : ''}，请改用 SmallGroup(${target},i)`,
    }
  }

  return { ok: true, symbol: canonical }
}

/** 收集注册表里「阶 → 符号列表」的索引，供 F_n / Dic_n 规则使用。 */
export function buildRegistryIndex(groups: Group[]): Map<number, string[]> {
  const m = new Map<number, string[]>()
  for (const g of groups) {
    if (!m.has(g.order)) m.set(g.order, [])
    m.get(g.order)!.push(g.symbol)
  }
  return m
}
