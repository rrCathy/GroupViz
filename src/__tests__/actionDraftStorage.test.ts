import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  loadCustomActionDraft,
  saveCustomActionDraft,
  removeCustomActionDraft,
} from '../context/actions/actionDraftStorage'

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

describe('actionDraftStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when nothing is stored', () => {
    expect(loadCustomActionDraft()).toBeNull()
  })

  it('round-trips a draft with arrows', () => {
    saveCustomActionDraft({
      symbol: 'S₃',
      setSize: 3,
      arrows: [
        { generatorId: 'g1', from: 0, to: 1 },
        { generatorId: null, from: 2, to: 2 },
      ],
      savedAt: 12345,
    })
    const draft = loadCustomActionDraft()
    expect(draft).not.toBeNull()
    expect(draft!.symbol).toBe('S₃')
    expect(draft!.setSize).toBe(3)
    expect(draft!.arrows).toEqual([
      { generatorId: 'g1', from: 0, to: 1 },
      { generatorId: null, from: 2, to: 2 },
    ])
    expect(draft!.savedAt).toBe(12345)
  })

  it('returns null on corrupted JSON', () => {
    const store = localStorage as Storage
    store.setItem('groupviz-action-custom-draft', '{not json')
    expect(loadCustomActionDraft()).toBeNull()
  })

  it('returns null when stored shape is invalid', () => {
    const store = localStorage as Storage
    store.setItem('groupviz-action-custom-draft', JSON.stringify({ symbol: 'S₃', setSize: '3', arrows: 'x' }))
    expect(loadCustomActionDraft()).toBeNull()
  })

  it('remove deletes the draft', () => {
    saveCustomActionDraft({ symbol: 'Q₈', setSize: 2, arrows: [], savedAt: 1 })
    removeCustomActionDraft()
    expect(loadCustomActionDraft()).toBeNull()
  })

  it('overwrites the previous draft on save', () => {
    saveCustomActionDraft({ symbol: 'S₃', setSize: 3, arrows: [], savedAt: 1 })
    saveCustomActionDraft({ symbol: 'D₄', setSize: 4, arrows: [{ generatorId: null, from: 0, to: 1 }], savedAt: 2 })
    const draft = loadCustomActionDraft()
    expect(draft!.symbol).toBe('D₄')
    expect(draft!.arrows).toHaveLength(1)
    expect(draft!.savedAt).toBe(2)
  })
})
