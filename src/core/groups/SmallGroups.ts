import type { Group, GroupElement, Generator } from '../types'
import { findAllSubgroups, findAllNormalSubgroups, getConjugacyClasses, getGroupCenter, isSimpleGroup } from '../algebra/subgroups'
import type { Subgroup } from '../algebra/subgroups'
import { createCyclicGroup } from './CyclicGroup'
import { createSymmetricGroup } from './SymmetricGroup'
import { createDihedralGroup } from './DihedralGroup'
import { createKleinFour, createQuaternion } from './SpecialGroup'

// ─── Precomputed Data Interface ────────────────────────────────────────────

export interface PrecomputedData {
  subgroups: Subgroup[]
  normalSubgroups: Subgroup[]
  conjugacyClasses: GroupElement[][]
  center: GroupElement[]
  isSimple: boolean
}

// ─── Small Group Entry ─────────────────────────────────────────────────────

export interface SmallGroupEntry {
  order: number
  index: number
  group: Group
  precomputed: PrecomputedData
}

// ─── Direct Product Z₄ × Z₂ (order 8, abelian) ────────────────────────────

export function createZ4xZ2(): Group {
  const nA = 4, nB = 2
  const elements: GroupElement[] = []
  for (let b = 0; b < nB; b++) {
    for (let a = 0; a < nA; a++) {
      elements.push({
        id: `e${a}${b}`,
        label: `(${a},${b})`,
        value: [a, b]
      })
    }
  }

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    const a = (x.value[0] + y.value[0]) % nA
    const b = (x.value[1] + y.value[1]) % nB
    return elements[a + b * nA]
  }

  function inv(el: GroupElement): GroupElement {
    return elements[((-el.value[0] + nA) % nA) + el.value[1] * nA]
  }

  const identity = elements[0]

  const genA: Generator = {
    name: 'a', symbol: 'a', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] + 1) % nA) + el.value[1] * nA],
    inverse: null as unknown as Generator
  }
  const genB: Generator = {
    name: 'b', symbol: 'b', color: '#4ecdc4',
    apply: (el: GroupElement) => elements[el.value[0] + ((el.value[1] + 1) % nB) * nA],
    inverse: null as unknown as Generator
  }
  genA.inverse = genA
  genB.inverse = genB

  return {
    name: 'Z₄ × Z₂',
    symbol: 'Z₄×Z₂',
    order: 8,
    elements,
    generators: [genA, genB],
    multiply: mul,
    inverse: inv,
    identity,
    isAbelian: true,
    exponent: 4
  }
}

// ─── Direct Product Z₂ × Z₂ × Z₂ (order 8, abelian) ───────────────────────

export function createZ2xZ2xZ2(): Group {
  const elements: GroupElement[] = []
  for (let i = 0; i < 8; i++) {
    elements.push({
      id: `e${(i>>2)&1}${(i>>1)&1}${i&1}`,
      label: `(${(i>>2)&1},${(i>>1)&1},${i&1})`,
      value: [(i>>2)&1, (i>>1)&1, i&1]
    })
  }

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    const a = x.value[0] ^ y.value[0]
    const b = x.value[1] ^ y.value[1]
    const c = x.value[2] ^ y.value[2]
    return elements[(a << 2) | (b << 1) | c]
  }

  function inv(el: GroupElement): GroupElement { return el }
  const identity = elements[0]

  function makeGen(name: string, symbol: string, color: string, bit: number): Generator {
    const shift = 2 - bit
    const gen: Generator = {
      name, symbol, color,
      apply: (el: GroupElement) => {
        const i = (el.value[0] << 2) | (el.value[1] << 1) | el.value[2]
        return elements[i ^ (1 << shift)]
      },
      inverse: null as unknown as Generator
    }
    gen.inverse = gen
    return gen
  }

  return {
    name: 'Z₂ × Z₂ × Z₂',
    symbol: 'Z₂³',
    order: 8,
    elements,
    generators: [makeGen('a', 'a', '#ff6b6b', 2), makeGen('b', 'b', '#4ecdc4', 1), makeGen('c', 'c', '#ffd93d', 0)],
    multiply: mul,
    inverse: inv,
    identity,
    isAbelian: true,
    exponent: 2
  }
}

// ─── Direct Product Z₃ × Z₃ (order 9, abelian) ────────────────────────────

export function createZ3xZ3(): Group {
  const n = 3
  const elements: GroupElement[] = []
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      elements.push({ id: `e${a}${b}`, label: `(${a},${b})`, value: [a, b] })
    }
  }

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    return elements[((x.value[0] + y.value[0]) % n) * n + ((x.value[1] + y.value[1]) % n)]
  }

  function inv(el: GroupElement): GroupElement {
    return elements[((-el.value[0] + n) % n) * n + ((-el.value[1] + n) % n)]
  }

  const identity = elements[0]

  const genA: Generator = {
    name: 'a', symbol: 'a', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] + 1) % n) * n + el.value[1]],
    inverse: null as unknown as Generator
  }
  const genB: Generator = {
    name: 'b', symbol: 'b', color: '#4ecdc4',
    apply: (el: GroupElement) => elements[el.value[0] * n + ((el.value[1] + 1) % n)],
    inverse: null as unknown as Generator
  }
  genA.inverse = {
    name: 'a⁻¹', symbol: 'a⁻¹', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] - 1 + n) % n) * n + el.value[1]],
    inverse: genA
  }
  genB.inverse = {
    name: 'b⁻¹', symbol: 'b⁻¹', color: '#4ecdc4',
    apply: (el: GroupElement) => elements[el.value[0] * n + ((el.value[1] - 1 + n) % n)],
    inverse: genB
  }

  return {
    name: 'Z₃ × Z₃',
    symbol: 'Z₃×Z₃',
    order: 9,
    elements,
    generators: [genA, genB],
    multiply: mul,
    inverse: inv,
    identity,
    isAbelian: true,
    exponent: 3
  }
}

// ─── Registry: All Groups of Order < 12 ────────────────────────────────────

function compile(group: Group): PrecomputedData {
  return {
    subgroups: findAllSubgroups(group),
    normalSubgroups: findAllNormalSubgroups(group),
    conjugacyClasses: getConjugacyClasses(group),
    center: getGroupCenter(group),
    isSimple: isSimpleGroup(group)
  }
}

type GroupFactory = () => Group

const FACTORIES: { order: number; index: number; factory: GroupFactory }[] = [
  { order: 1, index: 0, factory: () => createCyclicGroup(1) },
  { order: 2, index: 0, factory: () => createCyclicGroup(2) },
  { order: 3, index: 0, factory: () => createCyclicGroup(3) },
  { order: 4, index: 0, factory: () => createCyclicGroup(4) },
  { order: 4, index: 1, factory: createKleinFour },
  { order: 5, index: 0, factory: () => createCyclicGroup(5) },
  { order: 6, index: 0, factory: () => createCyclicGroup(6) },
  { order: 6, index: 1, factory: () => createSymmetricGroup(3) },
  { order: 7, index: 0, factory: () => createCyclicGroup(7) },
  { order: 8, index: 0, factory: () => createCyclicGroup(8) },
  { order: 8, index: 1, factory: createZ4xZ2 },
  { order: 8, index: 2, factory: createZ2xZ2xZ2 },
  { order: 8, index: 3, factory: () => createDihedralGroup(4) },
  { order: 8, index: 4, factory: createQuaternion },
  { order: 9, index: 0, factory: () => createCyclicGroup(9) },
  { order: 9, index: 1, factory: createZ3xZ3 },
  { order: 10, index: 0, factory: () => createCyclicGroup(10) },
  { order: 10, index: 1, factory: () => createDihedralGroup(5) },
  { order: 11, index: 0, factory: () => createCyclicGroup(11) },
]

// ─── Lazy-Initialized Table ────────────────────────────────────────────────

let _table: SmallGroupEntry[] | null = null
let _byOrder: Map<number, SmallGroupEntry[]> | null = null
let _bySymbol: Map<string, SmallGroupEntry> | null = null

function ensureTable(): void {
  if (_table) return
  _table = FACTORIES.map(def => {
    const group = def.factory()
    const precomputed = compile(group)
    return { order: def.order, index: def.index, group, precomputed }
  })
  _byOrder = new Map()
  _bySymbol = new Map()
  for (const entry of _table) {
    if (!_byOrder.has(entry.order)) _byOrder.set(entry.order, [])
    _byOrder.get(entry.order)!.push(entry)
    _bySymbol.set(entry.group.symbol, entry)
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export function getAllSmallGroups(): SmallGroupEntry[] {
  ensureTable()
  return _table!
}

export function getSmallGroup(order: number, index: number = 0): SmallGroupEntry | null {
  ensureTable()
  return _byOrder!.get(order)?.[index] ?? null
}

export function getSmallGroupBySymbol(symbol: string): SmallGroupEntry | null {
  ensureTable()
  return _bySymbol!.get(symbol) ?? null
}

export function getPrecomputed(group: Group): PrecomputedData | null {
  ensureTable()
  return _bySymbol!.get(group.symbol)?.precomputed ?? null
}
