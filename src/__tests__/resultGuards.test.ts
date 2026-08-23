import { describe, it, expect } from 'vitest'
import {
  ok,
  err,
  parseError,
  guardError,
  unsupportedError,
  type Result,
} from '../core/result'
import {
  SERIES_MAX_ORDER,
  PRESENTATION_MAX_ORDER,
  SYLOW_MAX_ORDER,
  PROPERTIES_CUTOFF,
  DISCOVERER_MAX_ORDER,
  FALLBACK_CUTOFF,
  TC_MAX_COSETS,
  TC_MAX_STEPS,
  DISCOVERER_RELATOR_CAP,
  DISCOVERER_WORD_BUDGET,
  AUTOMORPHISM_MAX_COMBINATIONS,
} from '../core/guards'
// Re-export sites must keep exposing the same constants.
import { SERIES_MAX_ORDER as SERIES_FROM_SERIES } from '../core/algebra/series'
import { SYLOW_MAX_ORDER as SYLOW_FROM_SYLOW } from '../core/algebra/sylow'
import { PROPERTIES_CUTOFF as PROPS_FROM_PROPERTIES } from '../core/algebra/properties'
import {
  PRESENTATION_MAX_ORDER as PRES_FROM_TC,
  TC_MAX_COSETS as COSETS_FROM_TC,
  TC_MAX_STEPS as STEPS_FROM_TC,
} from '../core/algebra/presentations/toddCoxeter'
import {
  DISCOVERER_MAX_ORDER as DISC_FROM_MINIMIZER,
  DISCOVERER_RELATOR_CAP as CAP_FROM_MINIMIZER,
  DISCOVERER_WORD_BUDGET as BUDGET_FROM_MINIMIZER,
} from '../core/algebra/presentations/minimizer'
import { parseWord } from '../core/algebra/presentations'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createTableGroup } from '../core/groups/SmallGroups/tableGroup'

describe('Result helpers', () => {
  it('ok wraps a value with ok=true', () => {
    const r: Result<number> = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe(42)
  })

  it('err carries an EngineError', () => {
    const r: Result<number> = err(guardError('bad input'))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error.kind).toBe('guard')
      expect(r.error).toBeInstanceOf(Error)
      expect(r.error.message).toBe('bad input')
    }
  })
})

describe('EngineError constructors', () => {
  it('parseError produces kind=parse', () => {
    const e = parseError('Unbalanced braces in exponent')
    expect(e.name).toBe('EngineError')
    expect(e.kind).toBe('parse')
    expect(e.reason).toBeUndefined()
  })

  it('guardError defaults to no reason and accepts overflow', () => {
    expect(guardError('x').kind).toBe('guard')
    expect(guardError('x').reason).toBeUndefined()
    expect(guardError('too big', 'overflow').reason).toBe('overflow')
    expect(guardError('diverges', 'infinite').reason).toBe('infinite')
    expect(guardError('slow', 'timeout').reason).toBe('timeout')
  })

  it('unsupportedError produces kind=unsupported', () => {
    const e = unsupportedError('no data')
    expect(e.kind).toBe('unsupported')
  })
})

describe('guard constants: canonical values preserved', () => {
  it('guards.ts values match the historical literals', () => {
    expect(SERIES_MAX_ORDER).toBe(240)
    expect(PRESENTATION_MAX_ORDER).toBe(240)
    expect(SYLOW_MAX_ORDER).toBe(240)
    expect(PROPERTIES_CUTOFF).toBe(60)
    expect(DISCOVERER_MAX_ORDER).toBe(120)
    expect(FALLBACK_CUTOFF).toBe(240)
    expect(TC_MAX_COSETS).toBe(3000)
    expect(TC_MAX_STEPS).toBe(5_000_000)
    expect(DISCOVERER_RELATOR_CAP).toBe(2000)
    expect(DISCOVERER_WORD_BUDGET).toBe(70_000)
    expect(AUTOMORPHISM_MAX_COMBINATIONS).toBe(30000)
  })

  it('module re-exports stay identical to guards.ts', () => {
    expect(SERIES_FROM_SERIES).toBe(SERIES_MAX_ORDER)
    expect(SYLOW_FROM_SYLOW).toBe(SYLOW_MAX_ORDER)
    expect(PROPS_FROM_PROPERTIES).toBe(PROPERTIES_CUTOFF)
    expect(PRES_FROM_TC).toBe(PRESENTATION_MAX_ORDER)
    expect(COSETS_FROM_TC).toBe(TC_MAX_COSETS)
    expect(STEPS_FROM_TC).toBe(TC_MAX_STEPS)
    expect(DISC_FROM_MINIMIZER).toBe(DISCOVERER_MAX_ORDER)
    expect(CAP_FROM_MINIMIZER).toBe(DISCOVERER_RELATOR_CAP)
    expect(BUDGET_FROM_MINIMIZER).toBe(DISCOVERER_WORD_BUDGET)
  })
})

describe('typed throws preserve messages', () => {
  it('word parser throws EngineError(kind=parse)', () => {
    try {
      parseWord('a^{2', ['a'])
      expect.unreachable()
    } catch (e) {
      expect((e as { kind?: string }).kind).toBe('parse')
      expect((e as Error).message).toBe('Unbalanced braces in exponent')
    }
  })

  it('factory guards throw EngineError(kind=guard)', () => {
    expect(() => createCyclicGroup(0)).toThrow('Order must be positive')
    expect(() => createDihedralGroup(2)).toThrow('Order must be at least 3')
    expect(() => createAlternatingGroup(2)).toThrow('n must be at least 3')
    try {
      createAlternatingGroup(6)
      expect.unreachable()
    } catch (e) {
      expect((e as { kind?: string; reason?: string }).kind).toBe('guard')
      expect((e as { reason?: string }).reason).toBe('overflow')
    }
  })

  it('missing SmallGroup data throws EngineError(kind=unsupported)', () => {
    try {
      createTableGroup(9999, 1)
      expect.unreachable()
    } catch (e) {
      expect((e as { kind?: string }).kind).toBe('unsupported')
      expect((e as Error).message).toContain('SmallGroup(9999,1)')
    }
  })
})
