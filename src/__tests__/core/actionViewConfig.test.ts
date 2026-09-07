import { describe, it, expect } from 'vitest'
import { actionViewParamsSchema } from '../../core/types/viewConfig'
import { arrowListAdd, arrowListBind, arrowListRemove, arrowListReplaceGen } from '../../core/algebra/actions'

describe('actionViewParamsSchema', () => {
  it('accepts a full valid params object', () => {
    expect(actionViewParamsSchema.safeParse({
      actionKind: 'custom',
      setSize: 6,
      arrows: [
        { generatorId: 'r', from: 0, to: 1 },
        { generatorId: null, from: 2, to: 3 },
      ],
      showLabels: true,
    }).success).toBe(true)
  })

  it('accepts an empty object and an empty arrows array (平凡作用)', () => {
    expect(actionViewParamsSchema.safeParse({}).success).toBe(true)
    expect(actionViewParamsSchema.safeParse({ actionKind: 'custom', setSize: 6, arrows: [] }).success).toBe(true)
  })

  it('accepts all three window kinds and rejects sylow/coset', () => {
    expect(actionViewParamsSchema.safeParse({ actionKind: 'conjugation' }).success).toBe(true)
    expect(actionViewParamsSchema.safeParse({ actionKind: 'regular' }).success).toBe(true)
    expect(actionViewParamsSchema.safeParse({ actionKind: 'custom' }).success).toBe(true)
    expect(actionViewParamsSchema.safeParse({ actionKind: 'sylow' }).success).toBe(false)
    expect(actionViewParamsSchema.safeParse({ actionKind: 'coset' }).success).toBe(false)
  })

  it('rejects setSize outside [1, 20] and non-integers', () => {
    expect(actionViewParamsSchema.safeParse({ setSize: 0 }).success).toBe(false)
    expect(actionViewParamsSchema.safeParse({ setSize: 21 }).success).toBe(false)
    expect(actionViewParamsSchema.safeParse({ setSize: 3.5 }).success).toBe(false)
  })

  it('rejects arrows with out-of-range indices or wrong count', () => {
    expect(actionViewParamsSchema.safeParse({ arrows: [{ generatorId: 'r', from: -1, to: 0 }] }).success).toBe(false)
    expect(actionViewParamsSchema.safeParse({ arrows: [{ generatorId: 'r', from: 0, to: 20 }] }).success).toBe(false)
    expect(actionViewParamsSchema.safeParse({ arrows: [{ from: 0, to: 1 }] }).success).toBe(false)
    const tooMany = Array.from({ length: 201 }, (_, i) => ({ generatorId: null, from: i % 20, to: (i + 1) % 20 }))
    expect(actionViewParamsSchema.safeParse({ arrows: tooMany }).success).toBe(false)
  })

  it('round-trips through JSON (viewParams persistence shape)', () => {
    const params = { actionKind: 'custom', setSize: 4, arrows: [{ generatorId: 'a', from: 0, to: 1 }], showLabels: false }
    const round = JSON.parse(JSON.stringify(params))
    expect(actionViewParamsSchema.safeParse(round).success).toBe(true)
  })
})

describe('arrowList* pure transforms (shared by context shell and controlled window)', () => {
  it('arrowListAdd appends or updates by key (gen|from, unbound by from|to)', () => {
    let list = arrowListAdd([], 0, 1, 'r')
    expect(list).toEqual([{ generatorId: 'r', from: 0, to: 1 }])
    // 同生成元同 from → 更新 to
    list = arrowListAdd(list, 0, 2, 'r')
    expect(list).toEqual([{ generatorId: 'r', from: 0, to: 2 }])
    // 未绑定按 (from,to) 键更新
    list = arrowListAdd(list, 3, 4, null)
    list = arrowListAdd(list, 3, 4, null)
    expect(list).toEqual([{ generatorId: 'r', from: 0, to: 2 }, { generatorId: null, from: 3, to: 4 }])
  })

  it('arrowListBind converts an unbound arrow and removes the old same-gen arrow', () => {
    let list = arrowListAdd([], 0, 1, null)
    list = arrowListAdd(list, 0, 2, 'r')
    list = arrowListBind(list, 0, 1, 's')
    // u(0,1) 转 s 箭头；同生成元 s 同 from 无旧箭头；r(0,2) 不受影响
    expect(list).toEqual([{ generatorId: 'r', from: 0, to: 2 }, { generatorId: 's', from: 0, to: 1 }])
    // 无对应未绑定箭头 → 原样返回
    expect(arrowListBind(list, 5, 6, 'r')).toBe(list)
  })

  it('arrowListRemove targets unbound (with optional to) or generator arrows', () => {
    let list = arrowListAdd([], 0, 1, null)
    list = arrowListAdd(list, 0, 2, null)
    list = arrowListAdd(list, 0, 3, 'r')
    // 未绑定 + 指定 to → 精确删
    list = arrowListRemove(list, 0, null, 1)
    expect(list).toEqual([{ generatorId: null, from: 0, to: 2 }, { generatorId: 'r', from: 0, to: 3 }])
    // 未绑定 + 无 to → 全删该 from 未绑定
    list = arrowListRemove(list, 0, null)
    expect(list).toEqual([{ generatorId: 'r', from: 0, to: 3 }])
    // 生成元删
    list = arrowListRemove(list, 0, 'r')
    expect(list).toEqual([])
  })

  it('arrowListReplaceGen swaps all arrows of one generator and drops shadowed unbound', () => {
    let list = arrowListAdd([], 0, 1, null)
    list = arrowListAdd(list, 2, 3, null)
    list = arrowListAdd(list, 0, 5, 'r')
    list = arrowListAdd(list, 4, 5, 's')
    list = arrowListReplaceGen(list, 'r', [[0, 1], [2, 3]])
    // 未绑定 from∈{0,2} 被清除；r 旧箭头(0→5)被整体替换；追加对在尾部
    expect(list).toEqual([
      { generatorId: 's', from: 4, to: 5 },
      { generatorId: 'r', from: 0, to: 1 },
      { generatorId: 'r', from: 2, to: 3 },
    ])
  })
})
