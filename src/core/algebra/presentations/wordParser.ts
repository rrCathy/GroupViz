import type { GroupPresentation, PresentationTerm } from '../../types'
import { parseError } from '../../result'

export function simplifyWord(terms: PresentationTerm[]): PresentationTerm[] {
  const out: PresentationTerm[] = []
  for (const t of terms) {
    if (t.e === 0) continue
    const last = out[out.length - 1]
    if (last && last.g === t.g) {
      last.e += t.e
      if (last.e === 0) out.pop()
    } else {
      out.push({ g: t.g, e: t.e })
    }
  }
  return out
}

function parseExponent(text: string, pos: number): { e: number; next: number } {
  let i = pos
  if (text[i] !== '^') return { e: 1, next: i }
  i++
  if (text[i] === '{') {
    i++
    const innerStart = i
    while (i < text.length && text[i] !== '}') i++
    if (i >= text.length) throw parseError('Unbalanced braces in exponent')
    const digits = text.slice(innerStart, i)
    i++
    if (!/^[+-]?\d+$/.test(digits)) throw parseError(`Invalid exponent '${digits}'`)
    const e = parseInt(digits, 10)
    return { e, next: i }
  }
  let sign = 1
  if (text[i] === '-') { sign = -1; i++ }
  else if (text[i] === '+') { i++ }
  const numStart = i
  while (i < text.length && /\d/.test(text[i])) i++
  if (i === numStart) throw parseError('Invalid exponent')
  const e = parseInt(text.slice(numStart, i), 10) * sign
  return { e, next: i }
}

function parseSequence(
  text: string,
  pos: number,
  gens: string[],
): { terms: PresentationTerm[]; next: number } {
  const terms: PresentationTerm[] = []
  let i = pos
  while (i < text.length) {
    const ch = text[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if (ch === '(') {
      const inner = parseSequence(text, i + 1, gens)
      if (inner.next >= text.length || text[inner.next] !== ')') {
        throw parseError('Unbalanced parentheses in word')
      }
      i = inner.next + 1
      const factor = parseExponent(text, i)
      i = factor.next
      const e = factor.e
      if (e === 0) continue
      if (e < 0) {
        for (let k = 0; k < -e; k++) {
          for (let j = inner.terms.length - 1; j >= 0; j--) {
            terms.push({ g: inner.terms[j].g, e: -inner.terms[j].e })
          }
        }
      } else {
        for (let k = 0; k < e; k++) {
          for (const t of inner.terms) terms.push({ g: t.g, e: t.e })
        }
      }
      continue
    }
    if (ch === ')') return { terms, next: i }
    let matched: number | null = null
    let matchedLen = 0
    for (let g = 0; g < gens.length; g++) {
      const sym = gens[g]
      if (sym.length === 0) continue
      if (sym.length > matchedLen && text.startsWith(sym, i)) {
        matched = g
        matchedLen = sym.length
      }
    }
    if (matched === null) throw parseError(`Unexpected character '${ch}' in word`)
    i += matchedLen
    const factor = parseExponent(text, i)
    i = factor.next
    if (factor.e === 0) continue
    terms.push({ g: matched, e: factor.e })
  }
  return { terms, next: i }
}

/** Unicode 上标（a²、b³、a⁻¹）归一为 ASCII 幂记号（a^2、b^3、a^-1） */
const UNICODE_SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '-',
}

export function normalizeSuperscripts(text: string): string {
  let out = ''
  for (const ch of text) {
    const ascii = UNICODE_SUPERSCRIPT[ch]
    if (ascii === undefined) {
      out += ch
      continue
    }
    const last = out.length > 0 ? out[out.length - 1] : ''
    if (last !== '^' && last !== '{' && last !== '-' && last !== '+' && !/\d/.test(last)) out += '^'
    out += ascii
  }
  return out
}

export function parseWord(text: string, gens: string[]): PresentationTerm[] {
  const trimmed = normalizeSuperscripts(text).trim()
  const res = parseSequence(trimmed, 0, gens)
  if (res.next !== trimmed.length) {
    throw parseError(`Unexpected character at position ${res.next}`)
  }
  return simplifyWord(res.terms)
}

export function wordToCanonicalString(terms: PresentationTerm[], gens: string[]): string {
  return terms
    .map(t => {
      const sym = gens[t.g] ?? `g${t.g}`
      if (t.e === 1) return sym
      if (t.e >= 2 && t.e < 10) return `${sym}^${t.e}`
      return `${sym}^{${t.e}}`
    })
    .join(' ')
}

// 将关系词规范到「循环旋转 + 逆」的字典序最小形式：
// 关系 w=e 蕴含任意循环旋转（x₂…xₙx₁ = x₁⁻¹·(x₁…xₙ)·x₁ = e）与逆（w⁻¹=e）也是关系。
// 借此把 QD16 的 868 条共轭/逆变体折叠成少数规范词，供贪心极小化快速收敛。
export function canonicalCyclicForm(terms: PresentationTerm[], gens: string[]): PresentationTerm[] {
  if (terms.length === 0) return terms
  // 纯幂词（单个生成元）：旋转无意义，直接取正指数（a⁻⁴ → a⁴）
  const g0 = terms[0].g
  if (terms.every(t => t.g === g0)) {
    return terms[0].e > 0 ? terms : terms.map(t => ({ g: t.g, e: -t.e }))
  }
  const inv = terms.map(t => ({ g: t.g, e: -t.e })).reverse()
  let best = terms
  let bestStr = wordToCanonicalString(best, gens)
  for (const w of [terms, inv]) {
    for (let k = 0; k < w.length; k++) {
      const rot = [...w.slice(k), ...w.slice(0, k)]
      const s = wordToCanonicalString(rot, gens)
      if (s < bestStr) {
        best = rot
        bestStr = s
      }
    }
  }
  return best
}

export function parsePresentation(text: string): GroupPresentation {
  let t = text.trim()
  if ((t.startsWith('⟨') && t.endsWith('⟩')) || (t.startsWith('<') && t.endsWith('>'))) {
    t = t.slice(1, -1)
  }
  const candidates = [t.indexOf('|'), t.indexOf(';')].filter(i => i >= 0)
  const sepIdx = candidates.length > 0 ? Math.min(...candidates) : -1
  const genPart = sepIdx >= 0 ? t.slice(0, sepIdx) : t
  const relPart = sepIdx >= 0 ? t.slice(sepIdx + 1) : ''
  const generators = genPart
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0)
  const relators = relPart
    .split(',')
    .map(s => s.replace(/\s*=\s*e\s*$/i, '').trim())
    .filter(s => s.length > 0)
  return { generators, relators }
}

/**
 * 单条关系校验（可视化创建）：必须为 f=e 或 f1=f2，两侧为生成元词或 e。
 */
export function parseRelationEquation(text: string, genNames: string[]): { ok: true; relation: string } | { ok: false; error: string } {
  const trimmed = text.trim()
  const parts = trimmed.split('=')
  if (parts.length !== 2) return { ok: false, error: 'format' }
  const lhs = parts[0].trim()
  const rhs = parts[1].trim()
  if (!lhs || !rhs) return { ok: false, error: 'format' }
  const isWord = (w: string): boolean => {
    if (w === 'e') return true
    try {
      parseWord(w, genNames)
      return true
    } catch {
      return false
    }
  }
  if (!isWord(lhs) || !isWord(rhs)) return { ok: false, error: 'word' }
  return { ok: true, relation: `${lhs} = ${rhs}` }
}

export function formatPresentation(generators: string[], relators: string[]): string {
  return `\\langle ${generators.join(', ')} \\mid ${relators.join(', ')} \\rangle`
}
