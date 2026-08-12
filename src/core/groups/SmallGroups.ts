import type { Group, GroupElement, Generator } from '../types'
import { COLOR_PALETTE } from '../types'
import { findAllSubgroups, findAllNormalSubgroups, getConjugacyClasses, getGroupCenter, isSimpleGroup } from '../algebra/subgroups'
import type { Subgroup } from '../algebra/subgroups'
import { createCyclicGroup } from './CyclicGroup'
import { createSymmetricGroup } from './SymmetricGroup'
import { createDihedralGroup } from './DihedralGroup'
import { createAlternatingGroup } from './AlternatingGroup'
import { createKleinFour, createQuaternion } from './SpecialGroup'
import { SMALL_GROUP_DATA } from './smallGroupData'

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

// Direct Product Z4 x Z2 (order 8, abelian)

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
    name: 'C_{4} \\times C_{2}',
    symbol: 'C_{4}\\times C_{2}',
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

// Direct Product Z2 x Z2 x Z2 (order 8, abelian)

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
    name: 'C_{2} \\times C_{2} \\times C_{2}',
    symbol: 'C_{2}^{3}',
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

// Direct Product Z3 x Z3 (order 9, abelian)

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
    name: 'a^{-1}', symbol: 'a^{-1}', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] - 1 + n) % n) * n + el.value[1]],
    inverse: genA
  }
  genB.inverse = {
    name: 'b^{-1}', symbol: 'b^{-1}', color: '#4ecdc4',
    apply: (el: GroupElement) => elements[el.value[0] * n + ((el.value[1] - 1 + n) % n)],
    inverse: genB
  }

  return {
    name: 'C_{3}^{2}',
    symbol: 'C_{3}^{2}',
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

// Direct Product Z6 x Z2 (order 12, abelian, non-cyclic)

export function createZ6xZ2(): Group {
  const nA = 6, nB = 2
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
  genA.inverse = {
    name: 'a^{-1}', symbol: 'a^{-1}', color: '#ff6b6b',
    apply: (el: GroupElement) => elements[((el.value[0] - 1 + nA) % nA) + el.value[1] * nA],
    inverse: genA
  }
  genB.inverse = genB

  return {
    name: 'C_{6} \\times C_{2}',
    symbol: 'C_{6}\\times C_{2}',
    order: 12,
    elements,
    generators: [genA, genB],
    multiply: mul,
    inverse: inv,
    identity,
    isAbelian: true,
    exponent: 6
  }
}

// ─── Table-Driven Group from GAP SmallGroups Data (orders 16-31) ──────────

// Convert a GAP StructureDescription into a front-end TeX symbol.
// Rules:
//   - Cyclic C_{n} keeps 'C'; any other leading C-family token maps to Z
//     (guards isGroupCyclic() misdetection, e.g. C4 x C4, C5 : C4).
//   - Dihedral Dk (GAP order k) maps to the front-end rotation convention
//     D_{k/2} (front-end D_{n} has order 2n), e.g. D16 -> D_{8}.
//   - ' x ' -> '\times ', ' : ' kept verbatim.
//   - GAP cannot distinguish some isomorphism types (e.g. two groups with
//     StructureDescription "(C4 x C2) : C2"); ensureTable() disambiguates
//     symbol collisions by falling back to 'SmallGroup(n,i)'.
function structureToSymbol(_n: number, _i: number, structure: string): string {
  let s = structure
  // 循环群统一用 C 记号（isGroupCyclic 已升级为元素阶精确检测，
  // 不再依赖符号首字母，复合符号如 'C_{2} \times C_{2} \times S_{3}' 不会误判为循环群）
  s = s.replace(/(^|[^A-Za-z])D(\d+)/g, (_m, pre: string, k: string) => {
    const kk = parseInt(k, 10)
    if (kk % 2 === 0 && kk >= 6) return `${pre}D_{${kk / 2}}`
    return `${pre}D${k}`
  })
  s = s.replace(/([A-Za-z]+)(\d+)/g, '$1_{$2}')
  s = s.replace(/ x /g, '\\times ')
  s = s.replace(/ : /g, ':')
  return s
}

function createTableGroup(order: number, gapIndex: number): Group {
  const rec = SMALL_GROUP_DATA.find(r => r.n === order && r.i === gapIndex)
  if (!rec) {
    throw new Error(`SmallGroups: no data for SmallGroup(${order},${gapIndex})`)
  }
  const n = order
  const elements: GroupElement[] = []
  for (let k = 0; k < n; k++) {
    elements.push({ id: `g${k}`, label: `g_{${k}}`, value: [k] })
  }
  const symbol = structureToSymbol(n, gapIndex, rec.structure)
  const table = rec.table

  function mul(x: GroupElement, y: GroupElement): GroupElement {
    return elements[table[x.value[0]][y.value[0]] - 1]
  }

  function inv(el: GroupElement): GroupElement {
    const row = table[el.value[0]]
    for (let k = 0; k < n; k++) {
      if (row[k] === 1) return elements[k]
    }
    return elements[0]
  }

  const generators: Generator[] = rec.gens.map((pos, idx) => {
    const name = String.fromCharCode(97 + idx)
    const genEl = elements[pos - 1]
    const gen: Generator = {
      name, symbol: name,
      color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      apply: (el: GroupElement) => mul(el, genEl),
      inverse: null as unknown as Generator
    }
    gen.inverse = {
      name: `${name}^{-1}`, symbol: `${name}^{-1}`, color: gen.color,
      apply: (el: GroupElement) => mul(el, inv(genEl)),
      inverse: gen
    }
    return gen
  })

  return {
    name: symbol,
    symbol,
    order: n,
    elements,
    generators,
    multiply: mul,
    inverse: inv,
    identity: elements[0],
    isAbelian: rec.abelian,
    exponent: rec.exponent
  }
}

// ─── Registry: All Groups of Order < 32 ────────────────────────────────────

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
  { order: 12, index: 0, factory: () => createCyclicGroup(12) },
  { order: 12, index: 1, factory: createZ6xZ2 },
  { order: 12, index: 2, factory: () => createDihedralGroup(6) },
  { order: 12, index: 3, factory: () => createAlternatingGroup(4) },
  { order: 13, index: 0, factory: () => createCyclicGroup(13) },
  { order: 14, index: 0, factory: () => createCyclicGroup(14) },
  { order: 14, index: 1, factory: () => createDihedralGroup(7) },
  { order: 15, index: 0, factory: () => createCyclicGroup(15) },
  { order: 12, index: 4, factory: () => createTableGroup(12, 1) },
  // Orders 16-31 (GAP SmallGroups data, index i is GAP's 1-based index)
  ...SMALL_GROUP_DATA.filter(r => r.n >= 16).map(r => ({
    order: r.n,
    index: r.i - 1,
    factory: () => createTableGroup(r.n, r.i)
  })),
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
    let symbol = entry.group.symbol
    if (_bySymbol.has(symbol)) {
      // GAP StructureDescription collision (e.g. two groups described as
      // "(C4 x C2) : C2"): disambiguate with the SmallGroup(n,i) identifier
      symbol = `SmallGroup(${entry.order},${entry.index + 1})`
      entry.group.symbol = symbol
      entry.group.name = symbol
    }
    if (!_byOrder.has(entry.order)) _byOrder.set(entry.order, [])
    _byOrder.get(entry.order)!.push(entry)
    _bySymbol.set(symbol, entry)
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
  // 兼容旧 Z 记号（统一 C 之前创建的会话/查询）
  const normalized = symbol.replace(/Z_/g, 'C_')
  return _bySymbol!.get(normalized) ?? null
}

export function getPrecomputed(group: Group): PrecomputedData | null {
  ensureTable()
  return _bySymbol!.get(group.symbol)?.precomputed ?? null
}
