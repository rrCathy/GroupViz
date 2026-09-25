import { describe, it, expect } from 'vitest'
import {
  DECORATION_ANCHOR_TYPES,
  DECORATION_ANCHOR_TYPES_RESERVED,
  decorationAnchorSchema,
  annotationSchema,
  decorationsSchemaV1,
  emptyDecorations,
  serializeDecorations,
  deserializeDecorations,
  readDecorations,
  addAnnotation,
  removeAnnotation,
  upsertAnnotation,
  annotationAnchorKey,
  resolveAnnotationAnchor,
} from '../../core/types/decorations'

const nodeAnnotation = {
  id: 'a1',
  anchor: { type: 'node' as const, ref: '(12)' },
  text: '(12)^2=e',
}

describe('decorationsSchemaV1', () => {
  it('accepts an empty set (no annotations)', () => {
    expect(decorationsSchemaV1.safeParse({ schemaVersion: '1', annotations: [] }).success).toBe(true)
  })

  it('accepts the three implemented anchor types', () => {
    for (const type of DECORATION_ANCHOR_TYPES) {
      expect(decorationAnchorSchema.safeParse({ type }).success).toBe(true)
    }
  })

  it('accepts reserved anchor types in the schema (inset/callout) but they are not implemented', () => {
    expect(DECORATION_ANCHOR_TYPES).toEqual(['node', 'edge', 'figure'])
    for (const type of DECORATION_ANCHOR_TYPES_RESERVED) {
      expect(decorationAnchorSchema.safeParse({ type }).success).toBe(true)
    }
  })

  it('rejects an unknown anchor type', () => {
    expect(decorationAnchorSchema.safeParse({ type: 'subgroup' }).success).toBe(false)
  })

  it('accepts an edge anchor carrying both ref and actionRef', () => {
    const res = decorationAnchorSchema.safeParse({
      type: 'edge',
      ref: '(12)',
      actionRef: '(23)',
      offset: { dx: 12, dy: -8 },
    })
    expect(res.success).toBe(true)
  })

  it('rejects a non-numeric offset', () => {
    expect(
      decorationAnchorSchema.safeParse({ type: 'node', ref: 'e', offset: { dx: '1', dy: 0 } }).success
    ).toBe(false)
  })

  it('rejects an annotation without text', () => {
    expect(annotationSchema.safeParse({ id: 'x', anchor: { type: 'figure' } }).success).toBe(false)
  })

  it('accepts a figure anchor with no ref (annotation on the whole figure)', () => {
    const res = decorationsSchemaV1.safeParse({
      schemaVersion: '1',
      annotations: [{ id: 'cap', anchor: { type: 'figure' }, text: '\\text{图 3.2：}S_4' }],
    })
    expect(res.success).toBe(true)
  })

  it('keeps the reserved `paths` slot open (recorded as unknown[])', () => {
    const res = decorationsSchemaV1.safeParse({
      schemaVersion: '1',
      annotations: [],
      paths: [{ elements: ['e', '(12)'] }],
    })
    expect(res.success).toBe(true)
  })

  it('rejects a wrong schemaVersion literal', () => {
    expect(decorationsSchemaV1.safeParse({ schemaVersion: '2', annotations: [] }).success).toBe(false)
  })
})

describe('serialize / deserialize round-trip', () => {
  it('emptyDecorations() is a valid v1 payload and survives round-trip', () => {
    const d = emptyDecorations()
    expect(decorationsSchemaV1.safeParse(d).success).toBe(true)
    expect(deserializeDecorations(d)).toEqual(d)
  })

  it('serialize fills defaults (version + empty annotations)', () => {
    expect(serializeDecorations()).toEqual({ schemaVersion: '1', annotations: [] })
    expect(serializeDecorations({ annotations: [nodeAnnotation] }).annotations).toHaveLength(1)
  })

  it('round-trips a mixed set (node + edge + figure, with leader/color/offset)', () => {
    const value = {
      schemaVersion: '1' as const,
      annotations: [
        nodeAnnotation,
        { id: 'a2', anchor: { type: 'edge' as const, ref: '(12)', actionRef: '(23)' }, text: 'a\\cdot b', leader: true },
        { id: 'a3', anchor: { type: 'figure' as const, offset: { dx: 8, dy: 24 } }, text: 'Z(G)=\\{e\\}', color: '#ffd93d' },
      ],
    }
    const once = serializeDecorations(value)
    const twice = deserializeDecorations(JSON.parse(JSON.stringify(once)))
    expect(twice).toEqual(once)
    expect(twice).toEqual(value)
  })

  it('deserialize is idempotent (parse(parse(x)) === parse(x))', () => {
    const first = deserializeDecorations({ schemaVersion: '1', annotations: [nodeAnnotation] })
    expect(deserializeDecorations(first)).toEqual(first)
  })

  it('serialize throws on malformed input (write path is strict)', () => {
    // @ts-expect-error 故意传非法值：写入端必须报错而非静默丢弃
    expect(() => serializeDecorations({ annotations: [{ id: 1 }] })).toThrow()
  })
})

describe('readDecorations（读入端容错：坏数据不抛错、退化为空集）', () => {
  it('returns an empty set for null / undefined / garbage', () => {
    for (const bad of [null, undefined, 42, 'nope', {}, { schemaVersion: '9' }, { annotations: 'x' }]) {
      expect(readDecorations(bad)).toEqual(emptyDecorations())
    }
  })

  it('passes valid input through unchanged', () => {
    const d = serializeDecorations({ annotations: [nodeAnnotation] })
    expect(readDecorations(d)).toEqual(d)
  })
})

describe('add / remove / upsert（纯函数，不改原值）', () => {
  it('addAnnotation appends and leaves the source untouched', () => {
    const base = emptyDecorations()
    const next = addAnnotation(base, nodeAnnotation)
    expect(base.annotations).toHaveLength(0)
    expect(next.annotations).toHaveLength(1)
    expect(next).not.toBe(base)
  })

  it('removeAnnotation drops by id and ignores unknown ids', () => {
    const base = addAnnotation(emptyDecorations(), nodeAnnotation)
    expect(removeAnnotation(base, 'a1').annotations).toHaveLength(0)
    expect(removeAnnotation(base, 'nope').annotations).toHaveLength(1)
  })

  it('upsertAnnotation replaces when the id exists, appends otherwise', () => {
    const base = addAnnotation(emptyDecorations(), nodeAnnotation)
    const edited = upsertAnnotation(base, { ...nodeAnnotation, text: '(12)^2=e  ← 改动' })
    expect(edited.annotations).toHaveLength(1)
    expect(edited.annotations[0].text).toContain('改动')

    const added = upsertAnnotation(base, { id: 'a2', anchor: { type: 'figure' }, text: 'new' })
    expect(added.annotations).toHaveLength(2)
  })

  it('keeps the reserved `paths` slot when mutating annotations', () => {
    const withPaths = serializeDecorations({ annotations: [], paths: [{ elements: ['e'] }] })
    const next = addAnnotation(withPaths, nodeAnnotation)
    expect(next.paths).toEqual([{ elements: ['e'] }])
  })
})

describe('annotationAnchorKey', () => {
  it('is coordinate-free: same target ⇒ same key regardless of offset', () => {
    const a = annotationAnchorKey({ type: 'node', ref: '(12)' })
    const b = annotationAnchorKey({ type: 'node', ref: '(12)', offset: { dx: 40, dy: 40 } })
    expect(a).toBe(b)
  })

  it('distinguishes anchor kinds and edge endpoints', () => {
    expect(annotationAnchorKey({ type: 'figure' })).toBe('figure')
    expect(annotationAnchorKey({ type: 'node', ref: '(12)' })).toBe('node:(12)')
    expect(annotationAnchorKey({ type: 'edge', ref: '(12)', actionRef: '(23)' })).toBe('edge:(12)@(23)')
    expect(annotationAnchorKey({ type: 'edge', ref: '(12)' })).toBe('edge:(12)')
    expect(annotationAnchorKey({ type: 'edge', ref: '(12)', actionRef: '(23)' })).not.toBe(
      annotationAnchorKey({ type: 'edge', ref: '(12)', actionRef: '(34)' })
    )
  })

  it('survives an element id containing commas (Sₙ ids look like "2,1,3,4")', () => {
    expect(annotationAnchorKey({ type: 'node', ref: '2,1,3,4' })).toBe('node:2,1,3,4')
  })
})

describe('resolveAnnotationAnchor（锚点 → 坐标，纯函数）', () => {
  const positions = new Map([
    ['e', { x: 100, y: 100 }],
    ['g', { x: 200, y: 100 }],
  ])
  const lookup = {
    positions,
    // 模拟 render 层的 `resolveElement(group, ref)?.id`：引用或裸 id 都能命中
    resolveId: (ref: string) =>
      ref === '(12)' ? 'g' : ref === 'e' || ref === 'g' ? ref : null,
    neighborOf: (fromId: string, actionId: string) =>
      fromId === 'e' && actionId === 'g' ? 'g' : fromId === 'g' && actionId === 'e' ? 'e' : null,
  }

  it('node anchor follows the element position + default offset', () => {
    expect(resolveAnnotationAnchor({ type: 'node', ref: '(12)' }, lookup)).toEqual({ x: 200, y: 78 })
  })

  it('node anchor applies the explicit offset on top of the default one', () => {
    const p = resolveAnnotationAnchor(
      { type: 'node', ref: '(12)', offset: { dx: 30, dy: 10 } },
      lookup
    )
    expect(p).toEqual({ x: 230, y: 88 })
  })

  it('edge anchor sits at the mid-point of the two endpoints', () => {
    expect(resolveAnnotationAnchor({ type: 'edge', ref: 'e', actionRef: 'g' }, lookup)).toEqual({
      x: 150,
      y: 86,
    })
  })

  it('edge anchor falls back to the endpoint when the neighbour cannot be found', () => {
    expect(resolveAnnotationAnchor({ type: 'edge', ref: 'e', actionRef: 'nope' }, lookup)).toEqual({
      x: 100,
      y: 86,
    })
  })

  it('figure anchor uses the figure origin (default 24,24) + offset', () => {
    expect(resolveAnnotationAnchor({ type: 'figure' }, lookup)).toEqual({ x: 24, y: 24 })
    expect(
      resolveAnnotationAnchor({ type: 'figure', offset: { dx: 8, dy: 40 } }, lookup)
    ).toEqual({ x: 32, y: 64 })
    expect(
      resolveAnnotationAnchor({ type: 'figure' }, { ...lookup, figureOrigin: { x: 0, y: 0 } })
    ).toEqual({ x: 0, y: 0 })
  })

  it('returns null (never throws) when the anchor cannot be resolved', () => {
    // 引用解析不出来
    expect(resolveAnnotationAnchor({ type: 'node', ref: '不存在' }, lookup)).toBeNull()
    // 锚点没有 ref
    expect(resolveAnnotationAnchor({ type: 'node' }, lookup)).toBeNull()
    // 元素 id 存在但已不在当前布局里（换群后残留）
    expect(resolveAnnotationAnchor({ type: 'node', ref: 'gone' }, { ...lookup, resolveId: () => 'gone' })).toBeNull()
  })

  it('treats reserved anchor types (inset/callout) like figure for now', () => {
    expect(resolveAnnotationAnchor({ type: 'inset' }, lookup)).toEqual({ x: 24, y: 24 })
  })
})
