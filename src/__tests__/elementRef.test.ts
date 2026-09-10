import { describe, it, expect } from 'vitest'
import {
  normalizeElementRef,
  resolveElement,
  findElement,
  resolveElementRefs,
  resolveElementIds,
  elementRefId,
  parseCycleNotation,
} from '../core/algebra/elementRef'
import { elementOrder, elementOrderDistribution, elementOrderDistributionOf } from '../core/algebra/elementOrder'
import { createSymmetricGroup, createS3 } from '../core/groups/SymmetricGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'

const s4 = createSymmetricGroup(4)
const s3 = createS3()
const a4 = createAlternatingGroup(4)
const c5 = createCyclicGroup(5)
const d4 = createDihedralGroup(4)

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

describe('parseCycleNotation：循环记号 → 置换', () => {
  it('连续数字串按单点逐位拆（`234` 不是数字 234，而是 2→3→4）', () => {
    expect(parseCycleNotation('234', 4)).toEqual([1, 3, 4, 2])
    expect(parseCycleNotation('(234)', 4)).toEqual([1, 3, 4, 2])
    expect(parseCycleNotation('(1234)', 4)).toEqual([2, 3, 4, 1])
    expect(parseCycleNotation('12', 4)).toEqual([2, 1, 3, 4])
  })

  it('多环：`(12)(34)` 与 `12)(34`（旧畸形 label）等价', () => {
    expect(parseCycleNotation('(12)(34)', 4)).toEqual([2, 1, 4, 3])
    expect(parseCycleNotation('12)(34', 4)).toEqual([2, 1, 4, 3])
  })

  it('带分隔符：空格 / 逗号 / 多位数点', () => {
    expect(parseCycleNotation('(1 2 3)', 4)).toEqual([2, 3, 1, 4])
    expect(parseCycleNotation('(1,2)(3,4)', 4)).toEqual([2, 1, 4, 3])
    // 有分隔符时 token 即点，故多位数点也支持：10→12→3→10
    const perm24 = parseCycleNotation('(10 12 3)', 24)!
    expect(perm24[10 - 1]).toBe(12)
    expect(perm24[12 - 1]).toBe(3)
    expect(perm24[3 - 1]).toBe(10)
    expect(perm24.filter((v, i) => v !== i + 1)).toHaveLength(3)
  })

  it('歧义防护：`(12)(34)` ≠ `(1234)`（naïve 去括号会塌成同一个串）', () => {
    expect(parseCycleNotation('(12)(34)', 4)).not.toEqual(parseCycleNotation('(1234)', 4))
  })

  it('非循环记号 / 越界 / 重复点 / 全不动点 → null', () => {
    expect(parseCycleNotation('1,3,4,2', 4)).toBeNull() // 数组记号交给 value 档
    expect(parseCycleNotation('e', 4)).toBeNull()
    expect(parseCycleNotation('\\alpha_3', 4)).toBeNull()
    expect(parseCycleNotation('(99)', 4)).toBeNull() // 点越界
    expect(parseCycleNotation('(112)', 4)).toBeNull() // 点重复
    expect(parseCycleNotation('1', 4)).toBeNull() // 全不动点
    expect(parseCycleNotation('()', 4)).toBeNull()
    expect(parseCycleNotation('(234)', 1)).toBeNull() // degree 非法
  })
})

describe('resolveElement：循环记号语义档（跨群 / 跨约定）', () => {
  it('同一置换的多种写法解析到同一元素', () => {
    const canonical = resolveElement(s4, '(234)')!
    expect(canonical.id).toBe('1,3,4,2')
    expect(resolveElement(s4, '234')!.id).toBe(canonical.id) // 旧 S₄ label 记号
    expect(resolveElement(s4, '(2 3 4)')!.id).toBe(canonical.id)
  })

  it('跨群互写：A₄ 的 `(234)` 与 S₄ 的 `234` 是同一置换，各自都能命中', () => {
    const inA4 = resolveElement(a4, '234')! // A₄ 只认带括号，靠语义档命中
    const inS4 = resolveElement(s4, '(234)')! // S₄ 只认无括号，靠语义档命中
    expect(inA4.id).toBe('1,3,4,2')
    expect(inS4.id).toBe('1,3,4,2')
  })

  it('多环：`(12)(34)` / `12)(34` / `(1 2)(3 4)` 在 S₄ 与 A₄ 都命中', () => {
    for (const g of [s4, a4]) {
      for (const ref of ['(12)(34)', '12)(34', '(1 2)(3 4)']) {
        expect(resolveElement(g, ref)?.id).toBe('2,1,4,3')
      }
    }
  })

  it('精确性：`(1234)` 命中 4-环，不会撞上 `(12)(34)`', () => {
    expect(resolveElement(s4, '(1234)')!.id).toBe('2,3,4,1')
    expect(resolveElement(s4, '(1234)')!.id).not.toBe('2,1,4,3')
  })

  it('S₃ 越界记号仍不命中（不会解析出群里没有的置换）', () => {
    expect(resolveElement(s3, '(1234)')).toBeNull() // 4 环不在 S₃
    expect(resolveElement(s3, '(234)')).toBeNull() // 点 4 越界
    expect(resolveElement(s3, '(1 2 3)')!.id).toBe('2,3,1')
  })

  it('非置换群不受语义档影响（循环群 / 二面体群）', () => {
    expect(resolveElement(c5, '(234)')).toBeNull()
    expect(resolveElement(c5, '(12)')).toBeNull()
    expect(resolveElement(c5, '3')!.id).toBe('e3') // 指数记号照旧
    expect(resolveElement(d4, '(12)')).toBeNull()
    expect(resolveElement(d4, 'r2')!.id).toBe('r2') // 既有 label 记号照旧
  })

  it('全不动点引用（`1` / `(1)`）不再误命中恒等元', () => {
    expect(resolveElement(s4, '1')).toBeNull()
    expect(resolveElement(s4, '(1)')).toBeNull()
  })
})

describe('Sₙ 元素 label：环形记法自洽', () => {
  it('多环 label 不再畸形（`(12)(34)` 而非 `12)(34`）', () => {
    const el = s4.elements.find(e => e.id === '2,1,4,3')!
    expect(el.label).toBe('(12)(34)')
    expect(s4.elements.some(e => /^[0-9]+\)\(/.test(e.label))).toBe(false)
  })

  it('单环 label 仍保持紧凑无括号（既有约定）', () => {
    expect(s4.elements.find(e => e.id === '1,3,4,2')!.label).toBe('234')
    expect(s3.elements.map(e => e.label).sort()).toEqual(['12', '123', '13', '132', '23', 'e'])
  })

  it('每个非恒等 label 都可被 parseCycleNotation 复原成该元素的 value', () => {
    for (const g of [s4, s3]) {
      const degree = g.elements[0].value.length
      for (const el of g.elements) {
        if (el.label === 'e') continue
        expect(parseCycleNotation(el.label, degree)).toEqual(el.value)
      }
    }
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
