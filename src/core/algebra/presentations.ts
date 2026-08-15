import {
  COLOR_PALETTE,
  type Generator,
  type Group,
  type GroupElement,
  type GroupPresentation,
  type PresentationTerm,
  isGroupDirectProduct,
  isGroupSemidirectProduct,
  isQuotientGroup,
} from '../types'
import { computeElementOrderInGroup, detectIsomorphicGroup } from './subgroups'
import { createGroupFromSymbol } from '../../utils/groupFactory'

export const PRESENTATION_MAX_ORDER = 240
export const TC_MAX_COSETS = 3000
export const TC_MAX_STEPS = 5_000_000
export const DISCOVERER_MAX_ORDER = 120
// relator 候选截断：需容纳共轭组合词（a³b²a 型）之外的关键长关系
// （QD16 的 (ba)⁴ 长 8——200 名额会被 ≤5 terms 的共轭词占满挤出；
// TC 对千级 relators × ≤8 terms 扫描很快，2000 安全）。
export const DISCOVERER_RELATOR_CAP = 2000
// 词长预算：4^8 = 65536 ≤ 70000 → k=2 群可枚举到长度 8 的关系
// （QD16 等的生成元关系 a⁸ 长度恰为 8；旧预算 40000 只能枚举到长度 7 → 识别失败）。
export const DISCOVERER_WORD_BUDGET = 70_000
// 验证长度序列：k≥2 时 maxL≤8（4⁸=65536 已达预算上限，9 层 4⁹=262144 不可达，被循环内
// L > maxL 守卫自动跳过，无空转）；L=9 仅对 k=1 生效（2⁹=512 ≤ 预算，覆盖 C₁₈/⟨a²⟩≅C₉
// 一类长度为 9 的关系）。偶数长度（8）覆盖 a⁸ 类关系，奇数上界（7）覆盖 b⁻¹aba⁻³ 类。
export const DISCOVERER_LENGTHS = [5, 7, 8, 9] as const

// 发现器结果缓存：同一 symbol+order+生成元数的群，其展示恒定。
// presentationOf 被信息栏/树视图/乘法表视图在每次渲染时反复调用，
// 全量枚举（2 生成元 4⁸=65536 词）+ 极小化每次约 1.6s，缓存避免重复计算。
// 仅缓存结构（generators/relators），generatorElements 每次按当前群重新求值。
// 键含乘法表指纹：防御同符号不同表（如重映射重建的同构群）静默命中错误展示。
const DISCOVERY_CACHE = new Map<string, { generators: string[]; relators: string[] }>()

// 轻量乘法表指纹：折叠前 min(order,16) 行 × 全列的乘积 id（FNV-1a 32 位）。
// 成本 ≤16·order 次 multiply（order=240 时约 4k 次查找，微秒级），足以区分不同表的群。
function tableFingerprint(group: Group): number {
  let h = 2166136261
  const rows = Math.min(group.order, 16)
  for (let i = 0; i < rows; i++) {
    const a = group.elements[i]
    for (let j = 0; j < group.order; j++) {
      const uid = group.multiply(a, group.elements[j]).id
      for (let k = 0; k < uid.length; k++) {
        h = ((h ^ uid.charCodeAt(k)) * 16777619) >>> 0
      }
    }
  }
  return h
}

// ─── Word parsing ────────────────────────────────────────────────────────────

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
    if (i >= text.length) throw new Error('Unbalanced braces in exponent')
    const digits = text.slice(innerStart, i)
    i++
    if (!/^[+-]?\d+$/.test(digits)) throw new Error(`Invalid exponent '${digits}'`)
    const e = parseInt(digits, 10)
    return { e, next: i }
  }
  let sign = 1
  if (text[i] === '-') { sign = -1; i++ }
  else if (text[i] === '+') { i++ }
  const numStart = i
  while (i < text.length && /\d/.test(text[i])) i++
  if (i === numStart) throw new Error('Invalid exponent')
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
        throw new Error('Unbalanced parentheses in word')
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
    if (matched === null) throw new Error(`Unexpected character '${ch}' in word`)
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
    throw new Error(`Unexpected character at position ${res.next}`)
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

// ─── Todd–Coxeter coset enumeration ──────────────────────────────────────────

export interface TCCResult {
  status: 'finite' | 'infinite' | 'overflow' | 'unconnected'
  order?: number
  table?: number[][]
  alive?: boolean[]
  wordsByCoset?: PresentationTerm[][]
}

export function runToddCoxeter(gens: string[], relatorTerms: PresentationTerm[][]): TCCResult {
  const k = gens.length
  const col = (g: number, e: number) => (e > 0 ? 2 * g : 2 * g + 1)

  const scans: PresentationTerm[][] = []
  const seen = new Set<string>()
  const rotations = (rel: PresentationTerm[]): PresentationTerm[][] => {
    const rots: PresentationTerm[][] = []
    for (let i = 0; i < rel.length; i++) rots.push(rel.slice(i).concat(rel.slice(0, i)))
    return rots
  }
  for (const rel of relatorTerms) {
    if (rel.length === 0) continue
    const inverted = rel.map(t => ({ g: t.g, e: -t.e })).reverse()
    for (const r of rotations(rel).concat(rotations(inverted))) {
      const key = r.map(t => `${t.g},${t.e}`).join(';')
      if (!seen.has(key)) {
        seen.add(key)
        scans.push(r)
      }
    }
  }

  const rows: number[][] = []
  const alive: boolean[] = []
  let steps = 0
  let overflow = false

  const define = (): number => {
    if (rows.length >= TC_MAX_COSETS) {
      overflow = true
      return -1
    }
    rows.push([])
    alive.push(true)
    return rows.length - 1
  }

  const setCell = (r: number, c: number, v: number) => {
    rows[r][c] = v
    if (rows[v][c ^ 1] === undefined) rows[v][c ^ 1] = r
    steps++
    if (steps > TC_MAX_STEPS) overflow = true
  }

  const scanRow = (r: number, rel: PresentationTerm[]): number => {
    let cur = r
    for (const t of rel) {
      const c = col(t.g, t.e)
      for (let n = 0; n < Math.abs(t.e); n++) {
        let v = rows[cur][c]
        if (v === undefined) {
          const nw = define()
          if (nw < 0) return -1
          v = nw
          setCell(cur, c, v)
        }
        cur = v
        steps++
        if (steps > TC_MAX_STEPS) return -1
      }
    }
    return cur
  }

  const coalesceRows = (a0: number, b0: number) => {
    const stack: number[][] = [[a0, b0]]
    while (stack.length > 0) {
      const [x0, y0] = stack.pop()!
      let x = x0
      let y = y0
      if (x === y) continue
      if (!alive[x] || !alive[y]) continue
      if (x > y) {
        const t = x
        x = y
        y = t
      }
      for (let r = 0; r < rows.length; r++) {
        if (!alive[r]) continue
        for (let c = 0; c < 2 * k; c++) {
          if (rows[r][c] === y) rows[r][c] = x
        }
      }
      const rx = rows[x]
      const ry = rows[y]
      for (let c = 0; c < 2 * k; c++) {
        const v = ry[c]
        if (v === undefined) continue
        const cur = rx[c]
        if (cur === undefined) rx[c] = v
        else if (cur !== v) stack.push([cur, v])
      }
      alive[y] = false
      steps++
      if (steps > TC_MAX_STEPS) overflow = true
    }
  }

  define()
  let changed = true
  while (changed) {
    changed = false
    for (let r = 0; r < rows.length; r++) {
      if (!alive[r]) continue
      for (const rel of scans) {
        const end = scanRow(r, rel)
        if (end < 0) return { status: 'overflow' }
        if (end !== r) {
          coalesceRows(r, end)
          if (overflow) return { status: 'overflow' }
          changed = true
        }
      }
      if (overflow) break
    }
    if (overflow) return { status: 'overflow' }
  }

  for (let r = 0; r < rows.length; r++) {
    if (!alive[r]) continue
    for (let c = 0; c < 2 * k; c++) {
      if (rows[r][c] === undefined) return { status: 'infinite' }
    }
  }

  const wordsByCoset: PresentationTerm[][] = new Array(rows.length)
  const dist = new Array(rows.length).fill(-1)
  const queueB: number[] = [0]
  dist[0] = 0
  wordsByCoset[0] = []
  let head = 0
  while (head < queueB.length) {
    const cur = queueB[head++]
    for (let g = 0; g < k; g++) {
      for (const e of [1, -1]) {
        const nxt = rows[cur][col(g, e)]
        if (dist[nxt] === -1) {
          dist[nxt] = dist[cur] + 1
          wordsByCoset[nxt] = [...wordsByCoset[cur], { g, e }]
          queueB.push(nxt)
        }
      }
    }
  }
  let order = 0
  for (let r = 0; r < rows.length; r++) {
    if (!alive[r]) continue
    order++
    if (dist[r] === -1) return { status: 'unconnected' }
  }
  return { status: 'finite', order, table: rows, alive, wordsByCoset }
}

// ─── Group construction from a presentation ──────────────────────────────────

export interface BuildPresentationOptions {
  maxOrder?: number
}

export interface BuildPresentationResult {
  ok: boolean
  group?: Group
  order?: number
  reason?: 'parse' | 'infinite' | 'overflow' | 'unconnected'
}

function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

export function buildGroupFromPresentation(
  pres: GroupPresentation,
  opts?: BuildPresentationOptions,
): BuildPresentationResult {
  const maxOrder = opts?.maxOrder ?? PRESENTATION_MAX_ORDER
  const gens = pres.generators
  if (gens.length === 0) return { ok: false, order: 0, reason: 'parse' }
  if (new Set(gens).size !== gens.length) return { ok: false, reason: 'parse' }

  let relTerms: PresentationTerm[][]
  try {
    // 归一化：f1=f2 型关系转成 f1·f2⁻¹（如 ab=ba → aba⁻¹b⁻¹），e=f / f=e 取另一侧
    relTerms = pres.relators.map(r => {
      const eq = r.indexOf('=')
      if (eq < 0) return parseWord(r, gens)
      const lhs = r.slice(0, eq).trim()
      const rhs = r.slice(eq + 1).trim()
      if (lhs === 'e') return parseWord(rhs, gens)
      if (rhs === 'e') return parseWord(lhs, gens)
      const rhsInv = parseWord(rhs, gens).map(t => ({ g: t.g, e: -t.e })).reverse()
      return simplifyWord([...parseWord(lhs, gens), ...rhsInv])
    })
  } catch {
    return { ok: false, reason: 'parse' }
  }
  const tc = runToddCoxeter(gens, relTerms)
  if (tc.status !== 'finite') return { ok: false, order: tc.order, reason: tc.status }
  const order = tc.order!
  if (order > maxOrder) return { ok: false, reason: 'overflow', order }

  const table = tc.table!
  const alive = tc.alive!
  const wordsByCoset = tc.wordsByCoset!
  const liveIdx: number[] = []
  for (let c = 0; c < table.length; c++) if (alive[c]) liveIdx.push(c)

  const byCoset = new Map<number, GroupElement>()
  const elements: GroupElement[] = liveIdx.map((c, i) => {
    const el: GroupElement = {
      id: `p${c}`,
      label: c === 0 ? 'e' : wordToCanonicalString(wordsByCoset[c], gens),
      value: [i],
    }
    byCoset.set(c, el)
    return el
  })

  const trace = (start: number, terms: PresentationTerm[]): number => {
    let cur = start
    for (const t of terms) {
      const c = t.e > 0 ? 2 * t.g : 2 * t.g + 1
      for (let n = 0; n < Math.abs(t.e); n++) cur = table[cur][c]
    }
    return cur
  }

  const cosetOf = (el: GroupElement): number => liveIdx[el.value[0]]

  const multiply = (a: GroupElement, b: GroupElement): GroupElement => {
    let cur = trace(0, wordsByCoset[cosetOf(a)])
    cur = trace(cur, wordsByCoset[cosetOf(b)])
    return byCoset.get(cur)!
  }

  const inverse = (el: GroupElement): GroupElement => {
    const w = wordsByCoset[cosetOf(el)]
    const invW = w.map(t => ({ g: t.g, e: -t.e })).reverse()
    return byCoset.get(trace(0, invW))!
  }

  const generators: Generator[] = gens.map((sym, g) => {
    const color = COLOR_PALETTE[g % COLOR_PALETTE.length]
    const apply = (el: GroupElement): GroupElement =>
      byCoset.get(trace(cosetOf(el), [{ g, e: 1 }]))!
    const invApply = (el: GroupElement): GroupElement =>
      byCoset.get(trace(cosetOf(el), [{ g, e: -1 }]))!
    const gen: Generator = {
      name: sym,
      symbol: sym,
      color,
      apply,
      inverse: undefined as unknown as Generator,
    }
    const invGen: Generator = {
      name: `${sym}^{-1}`,
      symbol: `${sym}^{-1}`,
      color,
      apply: invApply,
      inverse: gen,
    }
    gen.inverse = invGen
    return gen
  })

  const identity = byCoset.get(0)!

  const group: Group = {
    name: 'Presentation Group',
    symbol: formatPresentation(gens, pres.relators),
    order,
    elements,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian: false,
  }

  let isAbelian = true
  outer: for (let i = 0; i < gens.length; i++) {
    for (let j = i + 1; j < gens.length; j++) {
      if (trace(0, [{ g: i, e: 1 }, { g: j, e: 1 }]) !== trace(0, [{ g: j, e: 1 }, { g: i, e: 1 }])) {
        isAbelian = false
        break outer
      }
    }
  }
  group.isAbelian = isAbelian

  let exp = 1
  for (const el of elements) {
    exp = lcm(exp, computeElementOrderInGroup(el, group))
  }
  group.exponent = exp
  group.presentation = { generators: [...gens], relators: [...pres.relators] }
  group.isoSymbol = detectIsomorphicGroup(group) ?? undefined

  return { ok: true, group, order }
}

// ─── Standard presentation extraction ────────────────────────────────────────

function factorial(n: number): number {
  let r = 1
  for (let i = 2; i <= n; i++) r *= i
  return r
}

function generatorElement(group: Group, i: number): GroupElement | null {
  const gen = group.generators[i]
  if (!gen) return null
  return gen.apply(group.identity)
}

function closureSize(group: Group, seed: GroupElement[]): number {
  const seen = new Set<string>([group.identity.id])
  const stack: GroupElement[] = [group.identity]
  while (stack.length > 0) {
    const el = stack.pop()!
    for (const s of seed) {
      const p = group.multiply(el, s)
      if (!seen.has(p.id)) {
        seen.add(p.id)
        stack.push(p)
      }
    }
  }
  return seen.size
}

function transpositionElement(group: Group, i: number, n: number): GroupElement | null {
  const perm: number[] = []
  for (let j = 1; j <= n; j++) perm.push(j)
  perm[i - 1] = i + 1
  perm[i] = i
  for (const el of group.elements) {
    if (el.value.length === perm.length && el.value.every((v, j) => v === perm[j])) return el
  }
  return null
}

function familyPresentation(group: Group, fam: string, n: number): GroupPresentation | null {
  if (fam === 'C') {
    const genEl = generatorElement(group, 0)
    return {
      generators: ['a'],
      relators: [`a^{${n}}`],
      generatorElements: genEl ? [genEl] : [],
    }
  }
  if (fam === 'D') {
    const rEl = generatorElement(group, 0)
    const sEl = generatorElement(group, 1)
    if (!rEl || !sEl) return null
    return {
      generators: ['r', 's'],
      relators: [`r^{${n}}`, 's^{2}', 'srsr'],
      generatorElements: [rEl, sEl],
    }
  }
  if (fam === 'S') {
    const gens: string[] = []
    const rels: string[] = []
    const genEls: GroupElement[] = []
    for (let i = 1; i < n; i++) {
      gens.push(`\\sigma_{${i}}`)
      const el = transpositionElement(group, i, n)
      genEls.push(el ?? group.identity)
      rels.push(`\\sigma_{${i}}^{2}`)
    }
    for (let i = 1; i < n - 1; i++) {
      rels.push(`(\\sigma_{${i}}\\sigma_{${i + 1}})^{3}`)
    }
    for (let i = 1; i < n; i++) {
      for (let j = i + 2; j < n; j++) {
        rels.push(`(\\sigma_{${i}}\\sigma_{${j}})^{2}`)
      }
    }
    const pres: GroupPresentation = { generators: gens, relators: rels, generatorElements: genEls }
    try {
      const relTerms = pres.relators.map(r => parseWord(r, gens))
      const tc = runToddCoxeter(gens, relTerms)
      if (tc.status === 'finite' && tc.order === group.order) return pres
    } catch {
      /* fall through to discoverer */
    }
    return null
  }
  if (fam === 'A') {
    if (n === 3) {
      const genEl = generatorElement(group, 0)
      return {
        generators: ['a'],
        relators: ['a^{3}'],
        generatorElements: genEl ? [genEl] : [],
      }
    }
    const target = n === 4 ? 3 : 5
    const order2: GroupElement[] = []
    const order3: GroupElement[] = []
    for (const el of group.elements) {
      if (el.id === group.identity.id) continue
      const ord = computeElementOrderInGroup(el, group)
      if (ord === 2) order2.push(el)
      else if (ord === 3) order3.push(el)
    }
    for (const x of order2) {
      for (const y of order3) {
        if (computeElementOrderInGroup(group.multiply(x, y), group) !== target) continue
        if (closureSize(group, [x, y]) !== group.order) continue
        return {
          generators: ['x', 'y'],
          relators: ['x^{2}', 'y^{3}', `(xy)^{${target}}`],
          generatorElements: [x, y],
        }
      }
    }
    return null
  }
  return null
}

export function parseDirectProductParts(symbol: string): string[] {
  const parts = symbol.split(' \\times ').map(s => s.trim()).filter(s => s.length > 0)
  const out: string[] = []
  parts.forEach(p => {
    const pm = p.match(/^(.+)\^\{(\d+)\}$/)
    if (pm) {
      const base = pm[1].trim()
      const exp = parseInt(pm[2], 10)
      for (let e = 0; e < exp; e++) out.push(base)
    } else {
      out.push(p)
    }
  })
  return out
}

function presentationOfDirectProduct(group: Group): GroupPresentation | null {
  const parts = parseDirectProductParts(group.symbol)
  if (parts.length < 2) return null
  const factors: { fp: GroupPresentation }[] = []
  for (const part of parts) {
    const fg = createGroupFromSymbol(part)
    if (!fg) return null
    let fp: GroupPresentation | null = null
    try {
      fp = presentationOf(fg)
    } catch {
      fp = null
    }
    if (!fp || fp.generators.length === 0) return null
    factors.push({ fp })
  }
  const names: string[] = []
  const relators: string[] = []
  const factorRelTerms: PresentationTerm[][] = []
  let genOffset = 0
  for (const { fp } of factors) {
    fp.generators.forEach((_, idx) => {
      const gi = genOffset + idx
      names.push(gi < 8 ? 'abcdefgh'[gi] : `g_{${gi}}`)
    })
    for (const rel of fp.relators) {
      let terms: PresentationTerm[]
      try {
        terms = parseWord(rel, fp.generators)
      } catch {
        return null
      }
      factorRelTerms.push(terms.map(tm => ({ g: tm.g + genOffset, e: tm.e })))
    }
    genOffset += fp.generators.length
  }
  factorRelTerms.forEach(terms => {
    relators.push(wordToCanonicalString(terms, names))
  })
  const aCount = factors[0].fp.generators.length
  for (let i = 0; i < aCount; i++) {
    for (let j = aCount; j < names.length; j++) {
      relators.push(`${names[i]}${names[j]}${names[i]}^{-1}${names[j]}^{-1}`)
    }
  }
  try {
    const parsedRels = relators.map(r => parseWord(r, names))
    const tc = runToddCoxeter(names, parsedRels)
    if (tc.status === 'finite' && tc.order === group.order) {
      return {
        generators: names,
        relators,
        generatorElements: group.generators.map(g => g.apply(group.identity)),
      }
    }
  } catch {
    /* fall through */
  }
  return null
}

// QD16（SmallGroup(16,8)）标准展示 ⟨a, b | a⁸ = b² = 1, bab = a³⟩ 需阶 8 元素：
// GAP 生成元 g1 阶 4（= 标准 a²），发现器只能恢复出 ⟨a⁴, b², (ba)⁴⟩；
// 教材标准形式按元素阶重新定位 a（阶 8）与 b（阶 2，bab = a³）。
function findStandardQD16Generators(group: Group): { a: GroupElement; b: GroupElement } | null {
  const orderOf = (el: GroupElement): number => {
    let o = 1
    let e = el
    while (e.id !== group.identity.id && o < group.order) {
      e = group.multiply(e, el)
      o++
    }
    return e.id === group.identity.id ? o : group.order
  }
  const a = group.elements.find(el => orderOf(el) === 8)
  if (!a) return null
  const a3 = group.multiply(a, group.multiply(a, a))
  for (const b of group.elements) {
    if (b.id === a.id || b.id === group.identity.id) continue
    if (orderOf(b) !== 2) continue
    if (group.multiply(b, group.multiply(a, b)).id !== a3.id) continue
    if (closureSize(group, [a, b]) !== group.order) continue
    return { a, b }
  }
  return null
}

function discoverPresentationCached(group: Group): GroupPresentation | null {
  const key = `${group.symbol}|${group.order}|${group.generators.length}|${tableFingerprint(group)}`
  const cached = DISCOVERY_CACHE.get(key)
  if (cached) {
    return {
      generators: cached.generators,
      relators: cached.relators,
      generatorElements: group.generators.map(g => g.apply(group.identity)),
    }
  }
  const d = discoverPresentation(group)
  if (d) DISCOVERY_CACHE.set(key, { generators: d.generators, relators: d.relators })
  return d
}

export function presentationOf(group: Group): GroupPresentation | null {
  if (group.presentation) return group.presentation
  if (isGroupSemidirectProduct(group) || isGroupDirectProduct(group) || isQuotientGroup(group)) {
    if (isGroupDirectProduct(group)) {
      const dp = presentationOfDirectProduct(group)
      if (dp) return dp
    }
    return discoverPresentationCached(group)
  }
  const m = group.symbol.match(/^(S|A|C|D)_\{(\d+)\}$/)
  if (m) {
    const fam = m[1]
    const n = parseInt(m[2], 10)
    const orderOk =
      fam === 'C'
        ? n === group.order
        : fam === 'D'
          ? 2 * n === group.order
          : fam === 'S'
            ? factorial(n) === group.order
            : (n === 3 && group.order === 3) ||
              (n === 4 && group.order === 12) ||
              (n === 5 && group.order === 60)
    if (orderOk) {
      const p = familyPresentation(group, fam, n)
      if (p) return p
    }
  }
  if (group.symbol === 'V_{4}' && group.order === 4) {
    const a = generatorElement(group, 0)
    const b = generatorElement(group, 1)
    if (a && b) {
      return {
        generators: ['a', 'b'],
        relators: ['a^{2}', 'b^{2}', 'abab'],
        generatorElements: [a, b],
      }
    }
  }
  if (group.symbol === 'Q_{8}' && group.order === 8) {
    const i = generatorElement(group, 0)
    const j = generatorElement(group, 1)
    if (i && j) {
      return {
        generators: ['i', 'j'],
        relators: ['i^{4}', 'i^{2}j^{2}', 'jij^{-1}i'],
        generatorElements: [i, j],
      }
    }
  }
  if (group.symbol === 'QD_{16}' && group.order === 16) {
    // 标准展示 ⟨a⁸, b², bab=a³⟩（a 阶 8），替代发现器的非标准 ⟨a⁴, b², (ba)⁴⟩
    const std = findStandardQD16Generators(group)
    if (std) {
      return {
        generators: ['a', 'b'],
        relators: ['a^{8}', 'b^{2}', 'baba^{-3}'],
        generatorElements: [std.a, std.b],
      }
    }
  }
  return discoverPresentationCached(group)
}

// ─── Generic relator discovery ───────────────────────────────────────────────

/**
 * 平凡复合关系过滤：若简化词的某个真前缀（逐符号展开）也为 identity，
 * 则该词是更短关系的平凡拼接（如 a⁴b² = e·e），可由更短关系推出 → 冗余。
 * 不过滤时这类词会挤满 RELATOR_CAP 名额，把 (ba)⁴ 等关键长关系挤出
 * （QD16 = ⟨a⁴, b², (ba)⁴⟩ 的 (ba)⁴ 即因此无法识别）。
 */
function isRedundantRelator(
  group: Group,
  terms: PresentationTerm[],
  genEls: GroupElement[],
  invEls: GroupElement[]
): boolean {
  const syms: { g: number; e: number }[] = []
  for (const t of terms) {
    const step = t.e > 0 ? 1 : -1
    for (let i = 0; i < Math.abs(t.e); i++) syms.push({ g: t.g, e: step })
  }
  let pre = group.identity
  for (let i = 0; i < syms.length - 1; i++) {
    pre = group.multiply(pre, syms[i].e > 0 ? genEls[syms[i].g] : invEls[syms[i].g])
    if (pre.id === group.identity.id) return true
  }
  return false
}

export function discoverPresentation(group: Group): GroupPresentation | null {
  if (group.order > DISCOVERER_MAX_ORDER) return null
  const k = group.generators.length
  if (k === 0 || k > 4) return null
  const rawSyms = group.generators.map(g => g.symbol || g.name)
  const genSyms =
    new Set(rawSyms).size === rawSyms.length
      ? rawSyms
      : rawSyms.map((_, i) => (i < 26 ? String.fromCharCode(97 + i) : `g_{${i}}`))
  let maxL = -1
  for (const L of DISCOVERER_LENGTHS) {
    if (Math.pow(2 * k, L) <= DISCOVERER_WORD_BUDGET) maxL = L
  }
  if (maxL < 5) return null

  const genEls = group.generators.map(g => g.apply(group.identity))
  const invEls = genEls.map(el => group.inverse(el))
  const relatorSet = new Map<string, PresentationTerm[]>()

  const cur: PresentationTerm[] = []
  const rec = (depth: number, el: GroupElement) => {
    if (depth >= 2 && el.id === group.identity.id) {
      // 先简化词（合并相邻同生成元、消去 aa⁻¹ 平凡对）再入集合：
      // 不简化时平凡词（a a^{-1} 等）会挤满 relator 排序前列，
      // 长关系（如 QD16 的 a⁸）被 RELATOR_CAP 截断挤出 → 识别失败
      const simplified = simplifyWord(cur)
      if (simplified.length > 0 && !isRedundantRelator(group, simplified, genEls, invEls)) {
        // 循环旋转/逆折叠：同一共轭类的词统一到字典序最小形式再入集合，
        // 将数百条共轭冗余词折叠为少数规范词，供贪心极小化快速收敛
        const cyc = canonicalCyclicForm(simplified, genSyms)
        const key = wordToCanonicalString(cyc, genSyms)
        if (!relatorSet.has(key)) relatorSet.set(key, cyc)
      }
    }
    if (depth >= maxL) return
    for (let g = 0; g < k; g++) {
      cur.push({ g, e: 1 })
      rec(depth + 1, group.multiply(el, genEls[g]))
      cur.pop()
      cur.push({ g, e: -1 })
      rec(depth + 1, group.multiply(el, invEls[g]))
      cur.pop()
    }
  }
  rec(0, group.identity)

  const relators = [...relatorSet.values()]
    .sort((a, b) => a.length - b.length)
    .slice(0, DISCOVERER_RELATOR_CAP)
  if (relators.length === 0) return null

  for (const L of DISCOVERER_LENGTHS) {
    if (L > maxL) continue
    const subset = relators.filter(t => t.length <= L)
    if (subset.length === 0) continue
    const tcFull = runToddCoxeter(genSyms, subset)
    if (tcFull.status === 'finite' && tcFull.order === group.order) {
      // 贪心极小化（保留必要关系）：TC 已确认全子集阶 = |G|。
      // 保护 K 条最短关系（K = 生成元数，即生成元阶关系如 QD16 的 a⁴、b²），
      // 其余词从长到短逐个尝试移除——移除后 TC 阶仍 = |G| 才移除。
      // 这样 QD16 展示 ⟨a⁴, b², (ba)⁴⟩ 而非数百条共轭冗余词。
      const protectN = Math.min(k, subset.length)
      const byLen = [...subset].sort((a, b) => a.length - b.length)
      const protectedSet = new Set(byLen.slice(0, protectN))
      const working = byLen.slice(protectN).sort((a, b) => b.length - a.length)
      const maxAttempts = Math.min(working.length, 300)
      const t0min = Date.now()
      for (let i = 0; i < maxAttempts; i++) {
        if (Date.now() - t0min > 1500) break // 预算守卫：极小化累计超时则中止，返回当前集
        const candidate = [...protectedSet, ...working.filter((_, j) => j !== i)]
        const tc2 = runToddCoxeter(genSyms, candidate)
        if (tc2.status === 'finite' && tc2.order === group.order) {
          working.splice(i, 1)
          i--
        }
      }
      const final = [...protectedSet, ...working]
      return {
        generators: genSyms,
        relators: final.map(t => wordToCanonicalString(t, genSyms)),
        generatorElements: genEls,
      }
    }
  }
  return null
}
