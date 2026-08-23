import {
  type Group,
  type GroupElement,
  type GroupPresentation,
  type PresentationTerm,
  isGroupDirectProduct,
  isGroupSemidirectProduct,
  isQuotientGroup,
} from '../../types'
import { computeElementOrderInGroup } from '../subgroups'
import { createGroupFromSymbol } from '../../../utils/groupFactory'
import { runToddCoxeter } from './toddCoxeter'
import { discoverPresentationCached } from './minimizer'
import { parseWord, wordToCanonicalString } from './wordParser'

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
  const factorGenStarts: number[] = []
  let genOffset = 0
  for (const { fp } of factors) {
    factorGenStarts.push(genOffset)
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
  const bound = (idx: number): number =>
    idx + 1 < factorGenStarts.length ? factorGenStarts[idx + 1] : names.length
  for (let fi = 0; fi < factorGenStarts.length; fi++) {
    for (let fj = fi + 1; fj < factorGenStarts.length; fj++) {
      for (let i = factorGenStarts[fi]; i < bound(fi); i++) {
        for (let j = factorGenStarts[fj]; j < bound(fj); j++) {
          relators.push(`${names[i]}${names[j]}${names[i]}^{-1}${names[j]}^{-1}`)
        }
      }
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
