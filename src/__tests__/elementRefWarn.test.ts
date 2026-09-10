import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveElementWarn, resolveElementIdsWarn, clearElementRefWarnCache } from '../utils/elementRef'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'

const s4 = createSymmetricGroup(4)
const someS4 = s4.elements.find(e => e.label !== 'e')!

let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  clearElementRefWarnCache()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warnSpy.mockRestore()
})

describe('resolveElementWarn', () => {
  it('命中（id 或 label）时不告警', () => {
    expect(resolveElementWarn(s4, someS4.id, 'ctx')?.id).toBe(someS4.id)
    expect(resolveElementWarn(s4, someS4.label, 'ctx')?.id).toBe(someS4.id)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('未命中 → 返回 null 且告警一次（把静默失败变可见）', () => {
    expect(resolveElementWarn(s4, '(99)', 'SymmetryViewScene.actionElementId')).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const msg = String(warnSpy.mock.calls[0][0])
    expect(msg).toContain('(99)')
    expect(msg).toContain(s4.symbol)
  })

  it('同一上下文 + 群 + 引用只告警一次（不刷屏）', () => {
    resolveElementWarn(s4, '(99)', 'ctx')
    resolveElementWarn(s4, '(99)', 'ctx')
    resolveElementWarn(s4, '(99)', 'ctx')
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('不同上下文各自告警一次', () => {
    resolveElementWarn(s4, '(99)', 'ctxA')
    resolveElementWarn(s4, '(99)', 'ctxB')
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })

  it('空引用 / 空群不告警（属正常缺省，不算错误）', () => {
    expect(resolveElementWarn(s4, null, 'ctx')).toBeNull()
    expect(resolveElementWarn(s4, '', 'ctx')).toBeNull()
    expect(resolveElementWarn(null, '(99)', 'ctx')).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('resolveElementIdsWarn', () => {
  it('去重 + 丢未命中 + 逐项告警', () => {
    const ids = resolveElementIdsWarn(s4, [someS4.label, someS4.id, '(99)'], 'subsets')
    expect(ids).toEqual([someS4.id])
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('null 入参 → 空数组', () => {
    expect(resolveElementIdsWarn(s4, null, 'ctx')).toEqual([])
  })
})
