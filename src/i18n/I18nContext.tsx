import { createContext, useState, useCallback, type ReactNode } from 'react'
import { translations, getDefaultLang, type Lang } from './translations'

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export const I18nContext = createContext<I18nContextValue>({
  lang: 'zh',
  setLang: () => { },
  t: (key: string) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getDefaultLang)

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
    localStorage.setItem('groupviz-lang', newLang)
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const dict = translations[lang]
    let text = dict[key]
    if (text === undefined) {
      text = translations['en'][key]
    }
    if (text === undefined) {
      console.warn(`Missing translation key: "${key}" for lang "${lang}"`)
      return key
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}
