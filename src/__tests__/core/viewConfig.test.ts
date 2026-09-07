import { describe, it, expect } from 'vitest'
import {
  viewWindowConfigSchema,
  setViewParamsSchema,
  cayleyViewParamsSchema,
  sublatticeViewParamsSchema,
  viewWindowPersistDataSchema,
} from '../../core/types/viewConfig'

describe('cayleyViewParamsSchema', () => {
  it('accepts a full valid params object', () => {
    const res = cayleyViewParamsSchema.safeParse({
      shape2D: 'rewiring',
      multiplyType: 'left',
      actions: [
        { elementId: 'e1' },
        { elementId: 'e2', enabled: false, color: '#ffffff' },
      ],
      nodeRadius: 40,
      showLabels: false,
    })
    expect(res.success).toBe(true)
  })

  it('accepts an empty object (all defaults live in the render layer)', () => {
    expect(cayleyViewParamsSchema.safeParse({}).success).toBe(true)
  })

  it('rejects an unknown 2D shape', () => {
    expect(cayleyViewParamsSchema.safeParse({ shape2D: 'bogus' }).success).toBe(false)
  })

  it('rejects an unknown multiply type', () => {
    expect(cayleyViewParamsSchema.safeParse({ multiplyType: 'sideways' }).success).toBe(false)
  })

  it('rejects nodeRadius outside [8, 120]', () => {
    expect(cayleyViewParamsSchema.safeParse({ nodeRadius: 5 }).success).toBe(false)
    expect(cayleyViewParamsSchema.safeParse({ nodeRadius: 121 }).success).toBe(false)
  })

  it('rejects an action entry missing elementId and guards the array length', () => {
    expect(cayleyViewParamsSchema.safeParse({ actions: [{ enabled: true }] }).success).toBe(false)
    const tooMany = Array.from({ length: 241 }, (_, i) => ({ elementId: `e${i}` }))
    expect(cayleyViewParamsSchema.safeParse({ actions: tooMany }).success).toBe(false)
  })
})

describe('setViewParamsSchema / window schemas (regression)', () => {
  it('setViewParamsSchema still validates the same fields', () => {
    expect(setViewParamsSchema.safeParse({ nodeRadius: 26, gap: 8, columns: 0, showLabels: true }).success).toBe(true)
    expect(setViewParamsSchema.safeParse({ columns: 51 }).success).toBe(false)
  })

  it('viewWindowConfigSchema and persist schema accept unknown extra view params', () => {
    expect(viewWindowConfigSchema.safeParse({ locked: true }).success).toBe(true)
    const persist = viewWindowPersistDataSchema.safeParse({
      position: { x: 1, y: 2 },
      size: { width: 300, height: 250 },
      config: {},
      viewParams: { shape2D: 'torus', actions: [{ elementId: 'e1' }] },
    })
    expect(persist.success).toBe(true)
  })
})

describe('sublatticeViewParamsSchema', () => {
  it('accepts a full valid params object and an empty one (defaults live in the render layer)', () => {
    expect(sublatticeViewParamsSchema.safeParse({
      labelDetail: 'compact',
      mergeConjugates: true,
      nodeScale: 0.8,
      showSeriesPanel: false,
    }).success).toBe(true)
    expect(sublatticeViewParamsSchema.safeParse({}).success).toBe(true)
  })

  it('accepts every LOD tier including auto', () => {
    for (const labelDetail of ['auto', 'full', 'compact', 'dots']) {
      expect(sublatticeViewParamsSchema.safeParse({ labelDetail }).success).toBe(true)
    }
  })

  it('rejects an unknown tier and out-of-range card size', () => {
    expect(sublatticeViewParamsSchema.safeParse({ labelDetail: 'huge' }).success).toBe(false)
    expect(sublatticeViewParamsSchema.safeParse({ nodeScale: 0.5 }).success).toBe(false)
    expect(sublatticeViewParamsSchema.safeParse({ nodeScale: 1.7 }).success).toBe(false)
    expect(sublatticeViewParamsSchema.safeParse({ mergeConjugates: 'yes' }).success).toBe(false)
  })
})
