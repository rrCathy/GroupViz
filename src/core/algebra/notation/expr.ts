/**
 * 记号 → GAP 表达式 / 阶 / TeX（纯表达式层，不依赖本地工厂与注册表）。
 *
 * 从 notationParser.ts 抽出：那里同时承担「归一化 + 本地建群 + GAP 表达式」三件事，
 * 导致它必须反向依赖 createGroupFromSymbol，新解析入口再复用它就会成环。
 * 现在依赖是单向的：
 *
 *   notation/parse.ts  ──┐
 *                        ├──→ notation/expr.ts
 *   notationParser.ts ───┘
 *
 * 本模块只回答一个问题：这个（已规范化的）记号在 GAP 里等价于什么表达式、阶是
 * 多少。命中不了就返回错误码，由上层决定是本地建群、走后端、还是报错。
 */
import { normalizeSuperscripts } from '../presentations'

/** 表达式层错误码（上层映射成对用户可见的错误）。 */
export type ExprErrorCode = 'empty' | 'semidirect' | 'family' | 'unknown'

export interface CoreResult {
  tex: string
  order: number | null
  gapExpr: string | null
}

export function groupOrderGL(n: number, q: number): number {
  let prod = 1
  for (let i = 1; i <= n; i++) prod *= q ** i - 1
  return Math.round(q ** ((n * (n - 1)) / 2) * prod)
}

export function groupOrderSL(n: number, q: number): number {
  return groupOrderGL(n, q) / (q - 1)
}

export function groupOrderPGL(n: number, q: number): number {
  return groupOrderGL(n, q) / (q - 1)
}

export function groupOrderPSL(n: number, q: number): number {
  return groupOrderSL(n, q) / gcd(n, q - 1)
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    const t = b
    b = a % b
    a = t
  }
  return a || 1
}

function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

/** GAP 线性群族表达式开关：GL/SL/PGL/PSL。 */
const MATRIX_FAMILIES: Record<string, string> = {
  GL: 'GeneralLinearGroup',
  SL: 'SpecialLinearGroup',
  PGL: 'ProjectiveGeneralLinearGroup',
  PSL: 'ProjectiveSpecialLinearGroup',
}

/**
 * 解析一个「原子或复合」记号（输入须已是规范化形态：C_{4} / `×` / `^{n}` 等），
 * 返回 TeX / 阶 / GAP 表达式。
 */
export function parseCore(raw: string): CoreResult | { error: ExprErrorCode } {
  const s = raw

  // SmallGroup(n, i)
  const sg = /^SmallGroup\(\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(s)
  if (sg) {
    return {
      tex: `\\mathrm{SmallGroup}(${sg[1]},${sg[2]})`,
      order: Number(sg[1]),
      gapExpr: `SmallGroup(${sg[1]},${sg[2]})`,
    }
  }

  // Aut(X)
  const aut = /^Aut\((.+)\)$/i.exec(s)
  if (aut) {
    const inner = parseCore(aut[1])
    if ('error' in inner) return { error: inner.error }
    return {
      tex: `\\operatorname{Aut}(${inner.tex})`,
      order: null,
      gapExpr: `AutomorphismGroup(${inner.gapExpr})`,
    }
  }

  // 幂 (A×B)^k / A^k——只认最外层（深度 0）的 ^
  const powMatch = matchTopLevelPow(s)
  if (powMatch) {
    const { base, k } = powMatch
    const inner = parseCore(base)
    if ('error' in inner) return { error: inner.error }
    const nested = Array.from({ length: k }, () => inner.gapExpr).join(', ')
    return {
      tex: k === 1 ? inner.tex : `(${inner.tex})^{${k}}`,
      order: inner.order === null ? null : inner.order ** k,
      gapExpr: k === 1 ? inner.gapExpr : `DirectProduct(${nested})`,
    }
  }

  // ':' 半直积——缺 φ 无法自动翻译
  const semi = matchTopLevelChar(s, ':')
  if (semi) {
    return { error: 'semidirect' }
  }

  // 直积 ×：递归各因子
  const parts = splitTopLevel(s, '×')
  if (parts.length > 1) {
    const cores: CoreResult[] = []
    for (const p of parts) {
      const c = parseCore(p)
      if ('error' in c) return { error: c.error }
      cores.push(c)
    }
    let order: number | null = 1
    for (const c of cores) {
      if (c.order === null) order = null
      else if (order !== null) order *= c.order
    }
    return {
      tex: cores.map(c => c.tex).join(' \\times '),
      order,
      gapExpr: `DirectProduct(${cores.map(c => c.gapExpr).join(', ')})`,
    }
  }

  // 线性群族 GL(n,q) / SL / PGL / PSL
  const mat = /^(GL|SL|PGL|PSL)\(\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(s)
  if (mat) {
    const fam = mat[1] as keyof typeof MATRIX_FAMILIES
    const n = Number(mat[2])
    const q = Number(mat[3])
    const order =
      fam === 'GL' ? groupOrderGL(n, q)
      : fam === 'SL' ? groupOrderSL(n, q)
      : fam === 'PGL' ? groupOrderPGL(n, q)
      : groupOrderPSL(n, q)
    return {
      tex: `\\mathrm{${fam}}(${n},${q})`,
      order,
      gapExpr: `${MATRIX_FAMILIES[fam]}(${n},${q})`,
    }
  }

  // 群族原子
  const C = /^C(?:_\{(\d+)\}|\{(\d+)\}|(\d+))$/.exec(s)
  if (C) {
    const n = Number(C[1] ?? C[2] ?? C[3])
    return { tex: `C_{${n}}`, order: n, gapExpr: `CyclicGroup(${n})` }
  }
  const D = /^D(?:_\{(\d+)\}|\{(\d+)\}|(\d+))$/.exec(s)
  if (D) {
    const n = Number(D[1] ?? D[2] ?? D[3])
    return { tex: `D_{${n}}`, order: 2 * n, gapExpr: `DihedralGroup(${2 * n})` }
  }
  const S = /^S(?:_\{(\d+)\}|\{(\d+)\}|(\d+))$/.exec(s)
  if (S) {
    const n = Number(S[1] ?? S[2] ?? S[3])
    return { tex: `S_{${n}}`, order: factorial(n), gapExpr: `SymmetricGroup(${n})` }
  }
  const A = /^A(?:_\{(\d+)\}|\{(\d+)\}|(\d+))$/.exec(s)
  if (A) {
    const n = Number(A[1] ?? A[2] ?? A[3])
    return { tex: `A_{${n}}`, order: factorial(n) / 2, gapExpr: `AlternatingGroup(${n})` }
  }
  const Q = /^Q(?:_\{(\d+)\}|\{(\d+)\}|(\d+))$/.exec(s)
  if (Q) {
    const n = Number(Q[1] ?? Q[2] ?? Q[3])
    if (n % 4 === 0) {
      return { tex: `Q_{${n}}`, order: n, gapExpr: `QuaternionGroup(${n})` }
    }
    return { error: 'family' }
  }
  const V = /^V(?:_\{4\}|\{4\}|4)$/.exec(s)
  if (V) {
    return { tex: 'V_4', order: 4, gapExpr: 'KleinFourGroup()' }
  }

  return { error: 'unknown' }
}

/** 深度 0 的顶层字符切分（'×' 用）。 */
export function splitTopLevel(s: string, ch: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(' || c === '{') depth++
    else if (c === ')' || c === '}') depth--
    if (c === ch && depth === 0) {
      parts.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  parts.push(cur)
  return parts
}

/** 深度 0 的字符 c 是否存在。 */
export function matchTopLevelChar(s: string, ch: string): boolean {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(' || c === '{') depth++
    else if (c === ')' || c === '}') depth--
    else if (c === ch && depth === 0) return true
  }
  return false
}

/** 顶层幂：形如 base^k 或 base^{k}（括号内深度无关）。返回 base 与 k。 */
export function matchTopLevelPow(s: string): { base: string; k: number } | null {
  let depth = 0
  for (let i = s.length - 1; i >= 0; i--) {
    const c = s[i]
    if (c === ')') depth++
    else if (c === '(') depth--
    else if (c === '}') depth++
    else if (c === '{') depth--
    else if (c === '^' && depth === 0) {
      const rest = s.slice(i + 1)
      const m = /^\{\s*(\d+)\s*\}$/.exec(rest)
      if (m) {
        const base = s.slice(0, i)
        if (base.startsWith('(') && base.endsWith(')') && balancedOuter(base)) {
          return { base: base.slice(1, -1), k: Number(m[1]) }
        }
        return { base, k: Number(m[1]) }
      }
      const m2 = /^(\d+)$/.exec(rest)
      if (m2) {
        const base = s.slice(0, i)
        if (base.startsWith('(') && base.endsWith(')') && balancedOuter(base)) {
          return { base: base.slice(1, -1), k: Number(m2[1]) }
        }
        return { base, k: Number(m2[1]) }
      }
      return null
    }
  }
  return null
}

/** 首尾括号是否配对（整体被一对括号包裹）。 */
export function balancedOuter(s: string): boolean {
  let depth = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    if (depth === 0 && i < s.length - 1) return false
  }
  return depth === 0
}

export { normalizeSuperscripts }
