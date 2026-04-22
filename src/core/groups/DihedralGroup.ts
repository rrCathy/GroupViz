import type { Group, GroupElement, Generator } from '../types'

export function createDihedralGroup(n: number): Group {
  if (n < 3) throw new Error('Order must be at least 3')

  const elements: GroupElement[] = []
  
  for (let i = 0; i < n; i++) {
    elements.push({
      id: `r${i}`,
      label: i === 0 ? 'e' : i === 1 ? `r` : `r${i}`,
      value: [i, 0]
    })
  }
  
  for (let i = 0; i < n; i++) {
    elements.push({
      id: `s${i}`,
      label: i === 0 ? 's' : `sr${i}`,
      value: [i, 1]
    })
  }

  const identity = elements[0]
  
  function applyR(el: GroupElement): GroupElement {
    const [r, s] = el.value
    const newR = (r + 1) % n
    return elements[newR + s * n]
  }
  
  function applyS(el: GroupElement): GroupElement {
    const [r, s] = el.value
    const newR = (-r + n) % n
    const newS = 1 - s
    return elements[newR + newS * n]
  }

  const generators: Generator[] = [{
    name: 'r',
    symbol: 'r',
    color: '#ff6b6b',
    apply: applyR,
    inverse: null as unknown as Generator
  }, {
    name: 's',
    symbol: 's',
    color: '#4ecdc4',
    apply: applyS,
    inverse: null as unknown as Generator
  }]
  
  generators[0].inverse = {
    name: 'r⁻¹',
    symbol: 'r⁻¹',
    color: '#ff6b6b',
    apply: (el: GroupElement) => {
      const [r, s] = el.value
      const newR = (r - 1 + n) % n
      return elements[newR + s * n]
    },
    inverse: generators[0]
  }
  
  generators[1].inverse = {
    name: 's⁻¹',
    symbol: 's⁻¹',
    color: '#4ecdc4',
    apply: applyS,
    inverse: generators[1]
  }

  function multiply(a: GroupElement, b: GroupElement): GroupElement {
    const [ra, sa] = a.value
    const [rb, sb] = b.value
    
    if (sa === 0 && sb === 0) {
      const r = (ra + rb) % n
      return elements[r]
    } else if (sa === 0 && sb === 1) {
      const r = (ra + rb) % n
      return elements[r + n]
    } else if (sa === 1 && sb === 0) {
      const r = (ra - rb + n) % n
      return elements[r + n]
    } else {
      const r = (ra - rb + n) % n
      return elements[r]
    }
  }

  function inverse(element: GroupElement): GroupElement {
    const [r, s] = element.value
    if (s === 0) {
      const newR = (-r + n) % n
      return elements[newR]
    } else {
      return elements[r + n]
    }
  }

  return {
    name: `Dihedral Group D${n}`,
    symbol: `D${n}`,
    order: 2 * n,
    elements,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian: n === 2,
    exponent: n % 2 === 0 ? n : 2 * n
  }
}