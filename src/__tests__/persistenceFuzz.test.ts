import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  parseStoredJson,
  loadStoredJson,
  saveStoredJson,
  loadVersionedJson,
  saveVersionedJson,
  STORAGE_FORMAT_VERSION,
} from '../utils/persistence'
import { z } from 'zod'
import { parseWord, parsePresentation } from '../core/algebra/presentations'
import { parseNotation } from '../core/algebra/notationParser'
import { parseRelationEquation } from '../core/algebra/presentations'
import { loadGroupActionsFromStorage } from '../context/actions/actionStorage'

const schema = z.object({ a: z.number() })

// node 环境：手工 stub 一个 Map 版 localStorage
const backingStore = new Map<string, string>()
beforeEach(() => {
  backingStore.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => backingStore.get(k) ?? null,
    setItem: (k: string, v: string) => { backingStore.set(k, String(v)) },
    removeItem: (k: string) => { backingStore.delete(k) },
    clear: () => { backingStore.clear() },
  })
})

describe('parseStoredJson hardening', () => {
  it('returns null for syntactically broken JSON', () => {
    expect(parseStoredJson('{not json', schema)).toBeNull()
    expect(parseStoredJson('', schema)).toBeNull()
    expect(parseStoredJson('   ', schema)).toBeNull()
  })

  it('returns null when JSON parses but fails the schema', () => {
    expect(parseStoredJson('"just a string"', schema)).toBeNull()
    expect(parseStoredJson('42', schema)).toBeNull()
    expect(parseStoredJson('null', schema)).toBeNull()
    expect(parseStoredJson('{"a":"not-a-number"}', schema)).toBeNull()
    expect(parseStoredJson('{"a":1,"extra":true}', z.object({ a: z.number() }).strict())).toBeNull()
  })

  it('returns validated data for well-formed input', () => {
    expect(parseStoredJson('{"a":1}', schema)).toEqual({ a: 1 })
  })
})

describe('load/save round-trip', () => {
  it('loadStoredJson returns null for missing/corrupt keys', () => {
    expect(loadStoredJson('gv-test-missing', schema)).toBeNull()
    localStorage.setItem('gv-test-corrupt', '{{{{')
    expect(loadStoredJson('gv-test-corrupt', schema)).toBeNull()
    localStorage.setItem('gv-test-wrong', '[1,2,3]')
    expect(loadStoredJson('gv-test-wrong', schema)).toBeNull()
  })

  it('saveStoredJson survives and reloads', () => {
    expect(saveStoredJson('gv-test-ok', { a: 7 })).toBe(true)
    expect(loadStoredJson('gv-test-ok', schema)).toEqual({ a: 7 })
  })

  it('versioned envelope round-trips and legacy raw is still accepted', () => {
    saveVersionedJson('gv-test-ver', { a: 3 })
    const raw = localStorage.getItem('gv-test-ver')!
    expect(JSON.parse(raw).__gvVersion).toBe(STORAGE_FORMAT_VERSION)
    expect(loadVersionedJson('gv-test-ver', schema)).toEqual({ a: 3 })

    // legacy session written before the envelope existed
    localStorage.setItem('gv-test-legacy', '{"a":9}')
    expect(loadVersionedJson('gv-test-legacy', schema)).toEqual({ a: 9 })

    // future version without migrate hook → rejected
    localStorage.setItem('gv-test-future', '{"__gvVersion":99,"data":{"a":1}}')
    expect(loadVersionedJson('gv-test-future', schema)).toBeNull()

    // corrupt envelope payload → rejected
    localStorage.setItem('gv-test-badenv', '{"__gvVersion":1,"data":{"a":"x"}}')
    expect(loadVersionedJson('gv-test-badenv', schema)).toBeNull()
  })

  it('storage loaders swallow corrupted entries', () => {
    localStorage.setItem('groupviz-actions', 'garbage-not-json')
    expect(loadGroupActionsFromStorage()).toEqual([])
    localStorage.setItem('groupviz-actions', '[{"id":123}]')
    expect(loadGroupActionsFromStorage()).toEqual([])
  })
})

const HOSTILE_STRINGS = [
  '',
  ' ',
  '\u0000',
  'a'.repeat(10000),
  '^'.repeat(500),
  '((((((((((a))))))))))',
  'a^' + '9'.repeat(30),
  '{',
  '}',
  '{}{}{}{}',
  '(a',
  'a)',
  ')a(',
  '²³¹⁻⁺',
  '\\frac{a}{b}',
  'a=b=c',
  '=',
  'e=e',
  ':',
  ':::',
  'SmallGroup(',
  'Aut(',
  '×',
  '×C₂×',
  'C_999999999999999999999',
]

describe('parser fuzz: hostile inputs never produce uncaught non-Errors', () => {
  it('parseWord throws only EngineError-like Errors on bad words', () => {
    for (const s of HOSTILE_STRINGS) {
      try {
        parseWord(s, ['a', 'b'])
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
      }
      // valid gens with empty string returns []
    }
    expect(parseWord('', ['a'])).toEqual([])
  })

  it('parsePresentation reports failures instead of crashing', () => {
    for (const s of HOSTILE_STRINGS) {
      try {
        parsePresentation(`<a | ${s}>`)
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
      }
    }
  })

  it('parseRelationEquation rejects malformed equations', () => {
    for (const s of HOSTILE_STRINGS) {
      const r = parseRelationEquation(s, ['a'])
      if (!r.ok) expect(typeof r.error).toBe('string')
    }
  })

  it('parseNotation never throws on hostile notation', () => {
    for (const s of HOSTILE_STRINGS) {
      const r = parseNotation(s)
      // 唯一契约：不抛异常、回显输入；ok 与否取决于记号是否碰巧合法
      expect(r.input).toBe(s)
      if (!r.ok) expect(typeof r.error).toBe('string')
    }
    // sanity: real notation still parses
    expect(parseNotation('S_3').ok).toBe(true)
    expect(parseNotation('C_12').ok).toBe(true)
  })
})
