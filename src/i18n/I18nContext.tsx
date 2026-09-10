import { createContext, useState, useCallback, type ReactNode } from 'react'
import { translations, getDefaultLang, type Lang } from './translations'

export interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * 缺省 `t`（无 `<I18nProvider>` 包裹时）——**查真实词典**，而不是回落成 key。
 *
 * 旧实现是 `t: (key) => key`，于是外部嵌入漏包 Provider 时整屏文案都变成
 * `canvas.cosetStripNoCosets` 这样的 key（反馈里的高频踩坑点）。现在缺省就按
 * 「中文优先、英文兜底」渲染，漏包 Provider 只是拿不到 `setLang` 的切换能力。
 */
function defaultTranslate(key: string, params?: Record<string, string | number>): string {
  let text = translations['zh'][key] ?? translations['en'][key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return text
}

// eslint-disable-next-line react-refresh/only-export-components
export const I18nContext = createContext<I18nContextValue>({
  lang: 'zh',
  setLang: () => { },
  t: defaultTranslate,
})

export interface I18nProviderProps {
  children: ReactNode
  /** 初始语言；缺省按 `getDefaultLang()`（读 localStorage / 浏览器语言） */
  lang?: Lang
  /** 是否把语言选择写入 `localStorage('groupviz-lang')`；缺省 `true`。
   *  嵌入宿主不希望与主应用抢同一 key 时可传 `false`。 */
  persist?: boolean
}

export function I18nProvider({ children, lang: langProp, persist = true }: I18nProviderProps) {
  const [lang, setLangState] = useState<Lang>(() => langProp ?? getDefaultLang())

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang)
    if (persist) localStorage.setItem('groupviz-lang', newLang)
  }, [persist])

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
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
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
