import { describe, it, expect } from 'vitest'
import { translations } from '../i18n/translations'

const zhKeys = Object.keys(translations.zh)
const enKeys = Object.keys(translations.en)

describe('i18n integrity', () => {
  it('zh and en have the same key sets', () => {
    const onlyZh = zhKeys.filter(k => !enKeys.includes(k))
    const onlyEn = enKeys.filter(k => !zhKeys.includes(k))
    expect(onlyZh, 'keys present only in zh').toEqual([])
    expect(onlyEn, 'keys present only in en').toEqual([])
    expect(zhKeys.length).toBe(enKeys.length)
  })

  it('all translations are non-empty strings', () => {
    for (const lang of ['zh', 'en'] as const) {
      const map = translations[lang]
      for (const key of Object.keys(map)) {
        expect(typeof map[key], `${lang}.${key} should be a string`).toBe('string')
        expect(map[key].trim().length, `${lang}.${key} should not be empty`).toBeGreaterThan(0)
      }
    }
  })

  it('placeholder params are consistent between zh and en', () => {
    for (const key of zhKeys) {
      const params = (v: string) =>
        [...v.matchAll(/\{([a-zA-Z]+)\}/g)].map(m => m[1]).sort()
      expect(
        params(translations.zh[key]),
        `placeholder params mismatch for ${key}`
      ).toEqual(params(translations.en[key]))
    }
  })
})
