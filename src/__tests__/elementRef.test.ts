import { describe, it, expect } from 'vitest'
import {
  normalizeElementRef,
  resolveElement,
  findElement,
  resolveElementRefs,
  resolveElementIds,
  elementRefId,
} from '../core/algebra/elementRef'
import { elementOrder, elementOrderDistribution, elementOrderDistributionOf } from '../core/algebra/elementOrder'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'

const s4 = createSymmetricGroup(4)
const c5 = createCyclicGroup(5)

// S₄ 的某个非恒等元素：id 是逗号置换串、label 是人类记号 —— 两者必然不同
const someS4 = s4.elements.find(e => e.label !== 'e')!
// C₅ 的某个非恒等元素：id 形如 e3，label 是 '3'
const someC5 = c5.elements[3]

describe('normalizeElementRef', () => {
  it('去首尾空白与内部空白', () => {
    expect(normalizeElementRef('  1, 3, 4, 2 ')).toBe('1,3,4,2')
    expect(normalizeElementRef('e2')).toBe('e2')
  })
})

describe('resolveElement: 三档匹配（id → label → value）', () => {
  it('空群 / 空引用 → null，不抛', () => {
    expect(resolveElement(null, 'e0')).toBeNull()
    expect(resolveElement(undefined, 'e0')).toBeNull()
    expect(resolveElement(c5, null)).toBeNull()
    expect(resolveElement(c5, '')).toBeNull()
    expect(resolveElement(c5, '   ')).toBeNull()
  })

  it('id 精确命中', () => {
    expect(resolveElement(c5, someC5.id)?.id).toBe(someC5.id)
    expect(resolveElement(s4, someS4.id)?.id).toBe(someS4.id)
  })

  it('label 命中 —— 这正是此前「传 (234) 静默查不到」的场景', () => {
    expect(resolveElement(s4, someS4.label)?.id).toBe(someS4.id)
    expect(resolveElement(c5, someC5.label)?.id).toBe(someC5.id)
    // 两套记号确实不同，说明测试有意义
    expect(someS4.label).not.toBe(someS4.id)
  })

  it('value 串命中（兼容手写置换数组）', () => {
    expect(resolveElement(s4, someS4.value.join(','))?.id).toBe(someS4.id)
    expect(resolveElement(s4, someS4.value.join(', '))?.id).toBe(someS4.id)
  })

  it('空白容错：id / label / value 带空格也能命中', () => {
    expect(resolveElement(s4, someS4.id.split(',').join(', '))?.id).toBe(someS4.id)
  })

  it('未命中返回 null（不再静默返回 undefined 值）', () => {
    expect(resolveElement(s4, '(99)')).toBeNull()
    expect(resolveElement(c5, 'zzz')).toBeNull()
  })

  it('findElement 是 resolveElement 的同义别名', () => {
    expect(findElement).toBe(resolveElement)
    expect(findElement(s4, someS4.label)?.id).toBe(someS4.id)
  })

  it('elementRefId 返回规范 id', () => {
    expect(elementRefId(someS4)).toBe(someS4.id)
  })
})

describe('resolveElementRefs / resolveElementIds', () => {
  it('保持顺序、去重、回收未命中项', () => {
    const ids = [s4.elements[2].id, s4.elements[1].id, s4.elements[2].id]
    const res = resolveElementRefs(s4, [...ids, '(99)'])
    expect(res.ids).toEqual([s4.elements[2].id, s4.elements[1].id])
    expect(res.elements).toHaveLength(2)
    expect(res.unresolved).toEqual(['(99)'])
  })

  it('混合 id / label 输入', () => {
    const res = resolveElementRefs(s4, [s4.elements[1].id, s4.elements[2].label])
    expect(res.ids).toEqual([s4.elements[1].id, s4.elements[2].id])
    expect(res.unresolved).toEqual([])
  })

  it('空输入 / 空群安全', () => {
    expect(resolveElementRefs(null, ['x'])).toEqual({ elements: [], ids: [], unresolved: [] })
    expect(resolveElementRefs(s4, null)).toEqual({ elements: [], ids: [], unresolved: [] })
    expect(resolveElementIds(c5, ['e0', 'e0'])).toEqual(['e0'])
  })
})

describe('elementOrder facade（group-first）', () => {
  it('恒等元阶为 1，其余按群运算幂序', () => {
    expect(elementOrder(c5, c5.identity)).toBe(1)
    expect(elementOrder(c5, c5.elements[1])).toBe(5)
    const order2 = c5.elements.find(e => elementOrder(c5, e) === 5)!
    expect(elementOrder(c5, order2)).toBe(5)
  })

  it('S₄ 阶分布 = {1:1, 2:9, 3:8, 4:6}，总数守恒', () => {
    const dist = elementOrderDistribution(s4)
    expect([...dist.entries()].sort((a, b) => a[0] - b[0])).toEqual([[1, 1], [2, 9], [3, 8], [4, 6]])
    expect([...dist.values()].reduce((a, b) => a + b, 0)).toBe(s4.order)
  })

  it('elementOrderDistributionOf 支持元素子集（如某个陪集）', () => {
    const sub = [c5.identity, c5.elements[1], c5.elements[4]]
    const dist = elementOrderDistributionOf(sub, c5)
    expect(dist.get(1)).toBe(1)
    expect(dist.get(5)).toBe(2)
  })
})
