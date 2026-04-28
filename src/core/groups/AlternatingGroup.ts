import type { GroupElement, Generator, Group } from '../types'

function applyPermutation(p: number[], q: number[]): number[] {
  return q.map((_, i) => p[q[i] - 1])
}

function permToString(p: number[]): string {
  const cycles: number[][] = []
  const visited = new Array(p.length).fill(false)

  for (let i = 0; i < p.length; i++) {
    if (!visited[i]) {
      const cycle: number[] = []
      let j = i
      while (!visited[j]) {
        visited[j] = true
        cycle.push(j + 1)
        j = p[j] - 1
      }
      if (cycle.length > 1) cycles.push(cycle)
    }
  }

  if (cycles.length === 0) return 'e'
  return cycles.map(c => {
    if (c.length === 2) return `(${c[0]}${c[1]})`
    return `(${c.join('')})`
  }).join('') || 'e'
}

function permutationParity(p: number[]): number {
  let inversions = 0
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) {
      if (p[i] > p[j]) inversions++
    }
  }
  return inversions % 2
}

function findPermIndex(elements: GroupElement[], perm: number[]): number {
  return elements.findIndex(el =>
    el.value.every((v, i) => v === perm[i])
  )
}

export function createAlternatingGroup(n: number): Group {
  if (n < 2) throw new Error('n must be at least 2')
  if (n > 5) throw new Error('Aₙ for n > 5 is too large')

  const allPerms: number[][] = []

  function generatePerms(current: number[]): void {
    if (current.length === n) {
      allPerms.push([...current])
      return
    }
    for (let i = 1; i <= n; i++) {
      if (!current.includes(i)) {
        current.push(i)
        generatePerms(current)
        current.pop()
      }
    }
  }

  generatePerms([])

  const elements: GroupElement[] = []
  allPerms.forEach(perm => {
    if (permutationParity(perm) === 0) {
      elements.push({
        id: perm.join(','),
        label: permToString(perm),
        value: [...perm]
      })
    }
  })

  function getGenerator(name: string, symbol: string, color: string, perm: number[]): Generator {
    const gen: Generator = {
      name, symbol, color,
      apply: (el: GroupElement) => {
        const result = applyPermutation(el.value, perm)
        const idx = findPermIndex(elements, result)
        return elements[idx]
      },
      inverse: null as unknown as Generator
    }
    gen.inverse = {
      name: `${name}⁻¹`, symbol: `${symbol}⁻¹`, color,
      apply: (el: GroupElement) => {
        const inverse = perm.map((_, i) => perm.indexOf(i + 1) + 1)
        const result = applyPermutation(el.value, inverse)
        const idx = findPermIndex(elements, result)
        return elements[idx]
      },
      inverse: gen
    }
    return gen
  }

  const generators: Generator[] = []
  if (n === 3) {
    const perm = Array.from({ length: n }, (_, j) => j + 1); [perm[0], perm[1], perm[2]] = [perm[1], perm[2], perm[0]]
    generators.push(getGenerator('c1', '(123)', '#ff6b6b', perm))
  } else if (n === 4) {
    // A₄: a=(12)(34) order 2, b=(234) order 3 → 12 vertices, 18 edges = truncated tetrahedron
    const a = Array.from({ length: n }, (_, j) => j + 1); [a[0], a[1], a[2], a[3]] = [a[1], a[0], a[3], a[2]]
    const b = Array.from({ length: n }, (_, j) => j + 1)
    const tmp = b[1]; b[1] = b[2]; b[2] = b[3]; b[3] = tmp
    generators.push(getGenerator('a', '(12)(34)', '#ff6b6b', a))
    generators.push(getGenerator('b', '(234)', '#4ecdc4', b))
  } else if (n === 5) {
    // A₅: a=(12)(34) order 2, b=(135) order 3, ab order 5 → each vertex degree 3, 60*3/2=90 edges = truncated icosahedron
    const a = Array.from({ length: n }, (_, j) => j + 1); [a[0], a[1], a[2], a[3]] = [a[1], a[0], a[3], a[2]]
    const b = Array.from({ length: n }, (_, j) => j + 1)
    const b0 = b[0]; b[0] = b[2]; b[2] = b[4]; b[4] = b0
    generators.push(getGenerator('a', '(12)(34)', '#ff6b6b', a))
    generators.push(getGenerator('b', '(135)', '#4ecdc4', b))
  }

  function multiply(a: GroupElement, b: GroupElement): GroupElement {
    const result = applyPermutation(a.value, b.value)
    const idx = findPermIndex(elements, result)
    return elements[idx]
  }

  function inverse(element: GroupElement): GroupElement {
    const inv = element.value.map((_, i) => element.value.indexOf(i + 1) + 1)
    const idx = findPermIndex(elements, inv)
    return elements[idx]
  }

  const identity = elements.find(el =>
    el.value.every((v, i) => v === i + 1)
  )!

  return {
    name: `Alternating Group A${n}`,
    symbol: `A${n}`,
    order: elements.length,
    elements,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian: n <= 3
  }
}
