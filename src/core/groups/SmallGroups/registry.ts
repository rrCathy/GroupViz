import type { Group, GroupElement } from '../../types'
import { findAllSubgroups, findAllNormalSubgroups, getConjugacyClasses, getGroupCenter, isSimpleGroup } from '../../algebra/subgroups'
import type { Subgroup } from '../../algebra/subgroups'
import { createCyclicGroup } from '../CyclicGroup'
import { createSymmetricGroup } from '../SymmetricGroup'
import { createDihedralGroup } from '../DihedralGroup'
import { createAlternatingGroup } from '../AlternatingGroup'
import { createKleinFour, createQuaternion } from '../SpecialGroup'
import { SMALL_GROUP_DATA } from '../smallGroupData'
import { createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3, createZ6xZ2 } from './abelianProducts'
import { createTableGroup } from './tableGroup'

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
