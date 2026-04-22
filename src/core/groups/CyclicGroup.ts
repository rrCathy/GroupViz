import type { Group, GroupElement, Generator } from '../types'

export function createCyclicGroup(n: number): Group {
  if (n < 1) throw new Error('Order must be positive')

  const elements: GroupElement[] = []
  
  for (let i = 0; i < n; i++) {
    elements.push({
      id: `e${i}`,
      label: i === 0 ? '0' : i.toString(),
      value: [i]
    })
  }

  const identity = elements[0]
  
  const generators: Generator[] = [{
    name: 'a',
    symbol: '1',
    color: '#ff6b6b',
    apply: (el: GroupElement) => {
      const next = (el.value[0] + 1) % n
      return elements[next]
    },
    inverse: null as unknown as Generator
  }]
  
  generators[0].inverse = {
    name: 'a⁻¹',
    symbol: '1⁻¹',
    color: '#ff6b6b',
    apply: (el: GroupElement) => {
      const prev = (el.value[0] - 1 + n) % n
      return elements[prev]
    },
    inverse: generators[0]
  }

  function multiply(a: GroupElement, b: GroupElement): GroupElement {
    const result = (a.value[0] + b.value[0]) % n
    return elements[result]
  }

  function inverse(element: GroupElement): GroupElement {
    const result = (-element.value[0] + n) % n
    return elements[result]
  }

  return {
    name: `Cyclic Group Z${n}`,
    symbol: `Z${n}`,
    order: n,
    elements,
    generators,
    multiply,
    inverse,
    identity,
    isAbelian: true,
    exponent: n
  }
}