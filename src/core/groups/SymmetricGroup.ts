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
      if (cycle.length > 1) {
        cycles.push(cycle)
      }
    }
  }
  
  if (cycles.length === 0) return 'e'
  
  return cycles.map(c => {
    if (c.length === 2) return `(${c[0]}${c[1]})`
    return `(${c.join('')})`
  }).join('').replace(/\(\)/g, '').replace(/^\(/, '').replace(/\)$/, '') || 'e'
}

function findPermIndex(elements: GroupElement[], perm: number[]): number {
  return elements.findIndex(el => 
    el.value.every((v, i) => v === perm[i])
  )
}

export function createSymmetricGroup(n: number): Group {
  const elements: GroupElement[] = []
  const usedPerms = new Set<string>()
  
  function generatePermutations(current: number[]): void {
    if (current.length === n) {
      const key = current.join(',')
      if (!usedPerms.has(key)) {
        usedPerms.add(key)
        elements.push({
          id: key,
          label: permToString([...current]),
          value: [...current]
        })
      }
      return
    }
    for (let i = 1; i <= n; i++) {
      if (!current.includes(i)) {
        current.push(i)
        generatePermutations(current)
        current.pop()
      }
    }
  }
  
  generatePermutations([])
  
  function getGenerator(name: string, symbol: string, color: string, perm: number[]): Generator {
    const gen: Generator = {
      name,
      symbol,
      color,
      apply: (el: GroupElement) => {
        const result = applyPermutation(el.value, perm)
        const idx = findPermIndex(elements, result)
        return elements[idx]
      },
      inverse: null as unknown as Generator
    }
    
    gen.inverse = {
      name: `${name}⁻¹`,
      symbol: `${symbol}⁻¹`,
      color,
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
  
  const swap12 = Array.from({ length: n }, (_, i) => i === 0 ? 2 : i === 1 ? 1 : i + 1)
  const swap23 = Array.from({ length: n }, (_, i) => i === 1 ? 3 : i === 2 ? 2 : i + 1)
  
  const generators: Generator[] = []
  
  if (n >= 2) {
    generators.push(getGenerator('s12', 'σ₁₂', '#ff6b6b', swap12))
  }
  if (n === 3) {
    generators.push(getGenerator('s23', 'σ₂₃', '#4ecdc4', swap23))
  }
  if (n === 4) {
    // S₄: a=(12) order 2, b=(234) order 3 → 24 vertices, 36 edges = truncated cube
    const bPerm = Array.from({ length: n }, (_, j) => j + 1)
    const tmp = bPerm[1]; bPerm[1] = bPerm[2]; bPerm[2] = bPerm[3]; bPerm[3] = tmp
    generators.push(getGenerator('b', '(234)', '#4ecdc4', bPerm))
  }
  if (n >= 5) {
    // Sₙ with 2 generators: (12) and n-cycle (12...n)
    const nCycle = Array.from({ length: n }, (_, i) => i + 2)
    nCycle[n - 1] = 1
    generators.push(getGenerator('c', `σ₁₂···${n}`, '#4ecdc4', nCycle))
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
    name: `Symmetric Group S${n}`,
    symbol: `S${n}`,
    order: elements.length,
    elements,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian: n <= 2,
    exponent: n <= 2 ? 2 : undefined
  }
}

export function createS3(): Group {
  const group = createSymmetricGroup(3)
  
  const elements = group.elements.map(el => {
    let label = el.label
    label = label.replace(/^\(/, '')
    label = label.replace(/\)$/, '')
    label = label || 'e'
    
    return {
      ...el,
      label
    }
  })
  
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
    ...group,
    name: 'Symmetric Group S₃',
    symbol: 'S₃',
    order: elements.length,
    elements,
    generators: group.generators,
    multiply,
    inverse,
    identity,
    isAbelian: false,
    exponent: 6
  }
}