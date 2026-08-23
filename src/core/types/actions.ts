import type { GroupElement } from './group'

export type GroupActionKind = 'conjugation' | 'custom' | 'sylow' | 'regular' | 'coset'

export interface GroupActionArrow {
  generatorId: string | null
  from: number
  to: number
}

export interface OrbitInfo {
  representative: number
  elements: number[]
}

export interface GroupActionComputation {
  n: number
  perms: Map<string, number[]>
  orbits: OrbitInfo[]
  orbitOf: number[]
  stabilizers: Map<number, string[]>
  isHomomorphism: boolean
  violation?: { g: string; a: string; x: number }
  // Point labels for the acted-upon set (e.g. Sylow subgroups "P₁", ...)
  setLabels?: string[]
}

export interface GroupActionDef {
  kind: GroupActionKind
  setSize?: number
  prime?: number
  // For the coset action G ↷ G/H: left cosets are taken with respect to this subgroup.
  subgroupElements?: GroupElement[]
}
