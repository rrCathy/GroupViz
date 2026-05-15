import type { ViewMode } from '../../core/types'
import type { Group } from '../../core/types'
import { createSymmetricGroup } from '../../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../../core/groups/CyclicGroup'
import { createDihedralGroup } from '../../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../../core/groups/SpecialGroup'
import { createZ6xZ2, createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3 } from '../../core/groups/SmallGroups'

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
    { key: 'cyclic', label: t('group.cyclic.full'), minN: 2, maxN: 20, defaultN: 6, create: (n) => createCyclicGroup(n) },
    { key: 'symmetric', label: t('group.symmetric.full'), minN: 2, maxN: 5, defaultN: 3, create: (n) => createSymmetricGroup(n) },
    { key: 'dihedral', label: t('group.dihedral.full'), minN: 3, maxN: 8, defaultN: 4, create: (n) => createDihedralGroup(n) },
    { key: 'alternating', label: t('group.alternating.full'), minN: 3, maxN: 5, defaultN: 4, create: (n) => createAlternatingGroup(n) }
  ]
}

export function buildSpecialGroups(t: (key: string) => string): SpecialGroupEntry[] {
  return [
    { label: 'V_{4}', desc: t('group.klein'), order: 4, create: createKleinFour },
    { label: 'Z_{6}\\times Z_{2}', desc: t('group.direct.z6z2'), order: 12, create: createZ6xZ2 },
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
    { value: 'sublattice', icon: '⫘', label: t('view.sublattice'), desc: t('view.sublattice.desc') }
  ]
}

export function buildOrderGroupsMap(t: (key: string) => string): Map<number, OrderEntry[]> {
  const factorial = (n: number): number => {
    let r = 1
    for (let i = 2; i <= n; i++) r *= i
    return r
  }
  const map = new Map<number, OrderEntry[]>()
  const add = (order: number, entry: OrderEntry) => {
    if (!map.has(order)) map.set(order, [])
    map.get(order)!.push(entry)
  }
  for (let n = 2; n <= 20; n++) {
    add(n, { symbol: `Z_{${n}}`, label: `Z_{${n}}`, desc: t('group.cyclic'), create: () => createCyclicGroup(n) })
  }
  for (let n = 3; n <= 5; n++) {
    add(factorial(n), { symbol: `S_{${n}}`, label: `S_{${n}}`, desc: t('group.symmetric'), create: () => createSymmetricGroup(n) })
  }
  for (let n = 4; n <= 8; n++) {
    add(2 * n, { symbol: `D_{${n}}`, label: `D_{${n}}`, desc: t('group.dihedral'), create: () => createDihedralGroup(n) })
  }
  for (let n = 4; n <= 5; n++) {
    add(factorial(n) / 2, { symbol: `A_{${n}}`, label: `A_{${n}}`, desc: t('group.alternating'), create: () => createAlternatingGroup(n) })
  }
  add(4, { symbol: 'V_{4}', label: 'V_{4}', desc: t('group.klein'), create: createKleinFour })
  add(8, { symbol: 'Q_{8}', label: 'Q_{8}', desc: t('group.quaternion'), create: createQuaternion })
  add(8, { symbol: 'Z_{4}\\times Z_{2}', label: 'Z_{4}\\times Z_{2}', desc: t('group.direct.z4z2'), create: createZ4xZ2 })
  add(8, { symbol: 'Z_{2}^{3}', label: 'Z_{2}^{3}', desc: t('group.direct.z2cubed'), create: createZ2xZ2xZ2 })
  add(9, { symbol: 'Z_{3}\\times Z_{3}', label: 'Z_{3}\\times Z_{3}', desc: t('group.direct.z3z3'), create: createZ3xZ3 })
  add(12, { symbol: 'Z_{6}\\times Z_{2}', label: 'Z_{6}\\times Z_{2}', desc: t('group.direct.z6z2'), create: createZ6xZ2 })
  return map
}

export function typeTabLabel(key: string, t: (key: string) => string): string {
  if (key === 'cyclic') return t('group.cyclic')
  if (key === 'symmetric') return t('group.symmetric')
  if (key === 'dihedral') return t('group.dihedral')
  return t('group.alternating')
}
