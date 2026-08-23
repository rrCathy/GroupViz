import type { Group } from './group'

export type HomomorphismMap = Map<string, string>

export interface HomomorphismResult {
  isHomomorphism: boolean
  kernel: string[]
  image: string[]
  violation?: {
    a: string
    b: string
    lhs: string
    rhs: string
  }
}

export interface Homomorphism {
  id: string
  source: Group
  target: Group
  mapping: HomomorphismMap
  result?: HomomorphismResult
  name?: string
}

export interface HomomorphismProperties {
  isInjective: boolean
  isSurjective: boolean
  isIsomorphism: boolean
  kernelOrder: number
  imageOrder: number
}
