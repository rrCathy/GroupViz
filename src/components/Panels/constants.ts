import type { ViewMode } from '../../core/types'
import type { Group } from '../../core/types'
import { createSymmetricGroup } from '../../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../../core/groups/CyclicGroup'
import { createDihedralGroup } from '../../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../../core/groups/SpecialGroup'
import { getAllSmallGroups } from '../../core/groups/SmallGroups'

export interface GroupTypeConfig {
  key: string
  label: string
  minN: number
  maxN: number
  defaultN: number
  create: (n: number) => ReturnType<typeof createCyclicGroup>
}

export interface SpecialGroupEntry {
  label: string
  desc: string
  order: number
  create: () => Group
}

export interface ViewModeEntry {
  value: ViewMode
  icon: string
  label: string
  desc: string
}

export interface OrderEntry {
  symbol: string
  label: string
  desc: string
  create: () => Group
}

export function buildGroupTypeConfigs(t: (key: string) => string): GroupTypeConfig[] {
  return [
    { key: 'cyclic', label: t('group.cyclic.full'), minN: 2, maxN: 120, defaultN: 6, create: (n) => createCyclicGroup(n) },
    { key: 'symmetric', label: t('group.symmetric.full'), minN: 2, maxN: 5, defaultN: 3, create: (n) => createSymmetricGroup(n) },
    { key: 'dihedral', label: t('group.dihedral.full'), minN: 3, maxN: 8, defaultN: 4, create: (n) => createDihedralGroup(n) },
    { key: 'alternating', label: t('group.alternating.full'), minN: 3, maxN: 5, defaultN: 4, create: (n) => createAlternatingGroup(n) }
  ]
}

export function buildSpecialGroups(t: (key: string) => string): SpecialGroupEntry[] {
  return [
    { label: 'V_{4}', desc: t('group.klein'), order: 4, create: createKleinFour },
    { label: 'Q_{8}', desc: t('group.quaternion'), order: 8, create: createQuaternion }
  ]
}

export function buildViewModes(t: (key: string) => string): ViewModeEntry[] {
  return [
    { value: 'set', icon: '⊡', label: t('view.set'), desc: t('view.set.desc') },
    { value: 'cayley', icon: '⬡', label: t('view.cayley'), desc: t('view.cayley.desc') },
    { value: 'cycle', icon: '◎', label: t('view.cycle'), desc: t('view.cycle.desc') },
    { value: 'table', icon: '⊞', label: t('view.table'), desc: t('view.table.desc') },
    { value: '3d', icon: '◈', label: t('view.3d'), desc: t('view.3d.desc') },
    { value: 'symmetry', icon: '⬠', label: t('view.symmetry'), desc: t('view.symmetry.desc') },
    { value: 'sublattice', icon: '⫘', label: t('view.sublattice'), desc: t('view.sublattice.desc') },
    { value: 'cosetstrip', icon: '▦', label: t('view.cosetstrip'), desc: t('view.cosetstrip.desc') },
    { value: 'sylow', icon: 'S', label: t('view.sylow'), desc: t('view.sylow.desc') }
  ]
}

export function buildOrderGroupsMap(t: (key: string) => string): Map<number, OrderEntry[]> {
  const map = new Map<number, OrderEntry[]>()
  const add = (order: number, entry: OrderEntry) => {
    if (!map.has(order)) map.set(order, [])
    map.get(order)!.push(entry)
  }
  // All groups of order 1..31 from the SmallGroups registry (GAP data)
  for (const entry of getAllSmallGroups()) {
    const order = entry.order
    add(order, {
      symbol: entry.group.symbol,
      label: entry.group.symbol,
      desc: `SmallGroup(${order},${entry.index + 1})`,
      create: () => entry.group
    })
  }
  // Beyond the registry: keep the classic hand-built groups (order 60 / 120)
  add(60, { symbol: 'A_{5}', label: 'A_{5}', desc: t('group.alternating'), create: () => createAlternatingGroup(5) })
  add(120, { symbol: 'S_{5}', label: 'S_{5}', desc: t('group.symmetric'), create: () => createSymmetricGroup(5) })
  return map
}

export function typeTabLabel(key: string, t: (key: string) => string): string {
  if (key === 'cyclic') return t('group.cyclic')
  if (key === 'symmetric') return t('group.symmetric')
  if (key === 'dihedral') return t('group.dihedral')
  return t('group.alternating')
}
