import {
  COLOR_PALETTE,
  type Generator,
  type Group,
  type GroupElement,
  type GroupPresentation,
  type PresentationTerm,
} from '../../types'
import { computeElementOrderInGroup, detectIsomorphicGroup } from '../subgroups'
import {
  formatPresentation,
  parseWord,
  simplifyWord,
  wordToCanonicalString,
} from './wordParser'

import {
  PRESENTATION_MAX_ORDER,
  TC_MAX_COSETS,
  TC_MAX_STEPS,
} from '../../guards'

// Re-exported for backwards compatibility; the canonical definitions live in
// core/guards.ts alongside every other engine guard constant.
export { PRESENTATION_MAX_ORDER, TC_MAX_COSETS, TC_MAX_STEPS }

// ─── Todd–Coxeter coset enumeration ──────────────────────────────────────

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

// ─── Group construction from a presentation ──────────────────────────────

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
