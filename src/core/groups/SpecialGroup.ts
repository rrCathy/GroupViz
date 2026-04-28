import type { GroupElement, Generator, Group } from '../types'

export function createKleinFour(): Group {
  const names = ['e', 'a', 'b', 'c']
  const elements: GroupElement[] = names.map((label, i) => ({
    id: label, label, value: [i]
  }))

  const multTable = [
    [0, 1, 2, 3],
    [1, 0, 3, 2],
    [2, 3, 0, 1],
    [3, 2, 1, 0]
  ]

  function mul(a: number, b: number) { return multTable[a][b] }

  const genA: Generator = {
    name: 'a', symbol: 'a', color: '#ff6b6b',
    apply: (el) => {
      const v = el.value[0]
      if (v === 0) return elements[1]
      if (v === 1) return elements[0]
      return elements[mul(v, 1)]
    },
    inverse: null as unknown as Generator
  }
  const genB: Generator = {
    name: 'b', symbol: 'b', color: '#4ecdc4',
    apply: (el) => {
      const v = el.value[0]
      if (v === 0) return elements[2]
      if (v === 2) return elements[0]
      return elements[mul(v, 2)]
    },
    inverse: null as unknown as Generator
  }
  genA.inverse = genA
  genB.inverse = genB

  return {
    name: 'Klein Four-Group V₄',
    symbol: 'V₄',
    order: 4,
    elements,
    generators: [genA, genB],
    multiply: (a, b) => elements[mul(a.value[0], b.value[0])],
    inverse: (el) => el,
    identity: elements[0],
    isAbelian: true
  }
}

export function createQuaternion(): Group {
  const names = ['1', '-1', 'i', '-i', 'j', '-j', 'k', '-k']
  const elements: GroupElement[] = names.map((label, i) => ({
    id: label, label, value: [i]
  }))

  const multTable: number[][] = [
    [0, 1, 2, 3, 4, 5, 6, 7],
    [1, 0, 3, 2, 5, 4, 7, 6],
    [2, 3, 1, 0, 6, 7, 5, 4],
    [3, 2, 0, 1, 7, 6, 4, 5],
    [4, 5, 7, 6, 1, 0, 2, 3],
    [5, 4, 6, 7, 0, 1, 3, 2],
    [6, 7, 4, 5, 3, 2, 1, 0],
    [7, 6, 5, 4, 2, 3, 0, 1]
  ]

  function mul(a: number, b: number) { return multTable[a][b] }
  function inv(a: number): number {
    if (a === 0) return 0
    if (a === 1) return 1
    return a % 2 === 0 ? a + 1 : a - 1
  }

  const genI: Generator = {
    name: 'i', symbol: 'i', color: '#ff6b6b',
    apply: (el) => elements[mul(el.value[0], 2)],
    inverse: null as unknown as Generator
  }
  const genJ: Generator = {
    name: 'j', symbol: 'j', color: '#4ecdc4',
    apply: (el) => elements[mul(el.value[0], 4)],
    inverse: null as unknown as Generator
  }
  genI.inverse = genI
  genJ.inverse = genJ

  return {
    name: 'Quaternion Group Q₈',
    symbol: 'Q₈',
    order: 8,
    elements,
    generators: [genI, genJ],
    multiply: (a, b) => elements[mul(a.value[0], b.value[0])],
    inverse: (el) => elements[inv(el.value[0])],
    identity: elements[0],
    isAbelian: false
  }
}
