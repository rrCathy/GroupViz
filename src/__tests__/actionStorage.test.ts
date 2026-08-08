import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadGroupActionsFromStorage,
  saveGroupActionsToStorage,
} from '../context/actions/actionStorage'

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

describe('actionStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns empty list when nothing is stored', () => {
    expect(loadGroupActionsFromStorage()).toEqual([])
  })

  it('round-trips saved actions including unbound arrows', () => {
    const actions = [
      {
        id: 'action-1',
        symbol: 'S₃',
        setSize: 3,
        arrows: [
          { generatorId: 'g1', from: 0, to: 1 },
          { generatorId: null, from: 2, to: 2 },
        ],
        savedAt: 12345,
      },
    ]
    saveGroupActionsToStorage(actions)
    expect(loadGroupActionsFromStorage()).toEqual(actions)
  })

  it('keeps multiple actions for different groups', () => {
    saveGroupActionsToStorage([
      { id: 'a1', symbol: 'S₃', setSize: 3, arrows: [], savedAt: 1 },
      { id: 'a2', symbol: 'D₄', setSize: 4, arrows: [{ generatorId: null, from: 0, to: 1 }], savedAt: 2 },
    ])
    const loaded = loadGroupActionsFromStorage()
    expect(loaded).toHaveLength(2)
    expect(loaded.map(a => a.symbol)).toEqual(['S₃', 'D₄'])
  })

  it('returns empty list on corrupted JSON', () => {
    const store = localStorage as Storage
    store.setItem('groupviz-actions', '{not json')
    expect(loadGroupActionsFromStorage()).toEqual([])
  })

  it('filters invalid records (non-number setSize)', () => {
    const store = localStorage as Storage
    store.setItem('groupviz-actions', JSON.stringify([
      { id: 'a1', symbol: 'S₃', setSize: 3, arrows: [], savedAt: 1 },
      { id: 'a2', symbol: 'D₄', setSize: '4', arrows: [], savedAt: 2 },
    ]))
    const loaded = loadGroupActionsFromStorage()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('a1')
  })

  it('overwrites the whole list on save', () => {
    saveGroupActionsToStorage([{ id: 'a1', symbol: 'S₃', setSize: 3, arrows: [], savedAt: 1 }])
    saveGroupActionsToStorage([{ id: 'a2', symbol: 'Q₈', setSize: 2, arrows: [], savedAt: 2 }])
    const loaded = loadGroupActionsFromStorage()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('a2')
  })
})
