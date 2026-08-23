import type { Group, GroupElement, Generator } from '../../types'

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
