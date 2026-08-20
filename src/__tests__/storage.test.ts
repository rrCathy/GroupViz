import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadSemidirectProductSpecsFromStorage,
  saveSemidirectProductSpecsToStorage,
} from '../context/semidirectProduct/semidirectProductStorage'
import {
  loadHomomorphismsFromStorage,
  saveHomomorphismsToStorage,
} from '../context/homomorphism/homomorphismStorage'
import { createGroupFromSymbol } from '../utils/groupFactory'
import type { Homomorphism } from '../core/types'

function mockStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size },
  } as Storage
}

describe('semidirectProductStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns [] when nothing is stored', () => {
    expect(loadSemidirectProductSpecsFromStorage()).toEqual([])
  })

  it('round-trips stored specs', () => {
    const specs = [
      { id: 'sd-1', normalSymbol: 'C_{4}', actingSymbol: 'C_{2}', phiGenMapping: { g0: 'a1' } },
    ]
    saveSemidirectProductSpecsToStorage(specs)
    expect(loadSemidirectProductSpecsFromStorage()).toEqual(specs)
  })

  it('returns [] for corrupted JSON', () => {
    ;(localStorage as Storage).setItem('groupviz-sd-groups', '{not json')
    expect(loadSemidirectProductSpecsFromStorage()).toEqual([])
  })

  it('returns [] for non-array parsed values instead of crashing the provider', () => {
    for (const bad of ['null', '{}', '42', '"str"']) {
      ;(localStorage as Storage).setItem('groupviz-sd-groups', bad)
      expect(loadSemidirectProductSpecsFromStorage()).toEqual([])
    }
  })
})

function makeHomomorphism(id: string): Homomorphism {
  const source = createGroupFromSymbol('C_{3}')
  const target = createGroupFromSymbol('S_{3}')
  if (!source || !target) throw new Error('group factory failed for C_{3}/S_{3}')
  return {
    id,
    source,
    target,
    mapping: new Map([['g0', 'r1']]),
    name: id,
  }
}

describe('homomorphismStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips homomorphisms', () => {
    saveHomomorphismsToStorage([makeHomomorphism('h-1')])
    const loaded = loadHomomorphismsFromStorage()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('h-1')
    expect(loaded[0].source.symbol).toBe('C_{3}')
    expect(loaded[0].target.symbol).toBe('S_{3}')
    expect([...loaded[0].mapping.entries()]).toEqual([['g0', 'r1']])
  })

  it('keeps valid entries when a single entry is corrupt (missing mapping)', () => {
    saveHomomorphismsToStorage([makeHomomorphism('h-ok')])
    const raw = JSON.parse((localStorage as Storage).getItem('groupviz-homomorphisms')!)
    raw.push({ id: 'h-bad', sourceSymbol: 'C_{3}', targetSymbol: 'S_{3}' })
    ;(localStorage as Storage).setItem('groupviz-homomorphisms', JSON.stringify(raw))

    const loaded = loadHomomorphismsFromStorage()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('h-ok')
  })

  it('keeps valid entries when a single entry has a null mapping', () => {
    saveHomomorphismsToStorage([makeHomomorphism('h-ok')])
    const raw = JSON.parse((localStorage as Storage).getItem('groupviz-homomorphisms')!)
    raw.push({ id: 'h-bad2', sourceSymbol: 'C_{3}', targetSymbol: 'S_{3}', mapping: null })
    ;(localStorage as Storage).setItem('groupviz-homomorphisms', JSON.stringify(raw))

    const loaded = loadHomomorphismsFromStorage()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('h-ok')
  })
})
