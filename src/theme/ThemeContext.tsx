import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

export interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  /** 视图窗口（浮动窗/ViewWindow）独立的深浅色主题，与主界面 theme 解耦 */
  viewWindowTheme: Theme
  toggleViewWindowTheme: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => { },
  viewWindowTheme: 'dark',
  toggleViewWindowTheme: () => { },
})

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('groupviz-theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* localStorage unavailable (e.g., privacy mode) */ }
  return null
}

function getStoredViewWindowTheme(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem('groupviz-viewwindow-theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* localStorage unavailable (e.g., privacy mode) */ }
  return null
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme()
    if (stored) return stored
    return getSystemTheme()
  })

  // 视图窗口主题：独立于主界面 theme，默认深色（图形对比度更佳）
  const [viewWindowTheme, setViewWindowThemeState] = useState<Theme>(() => {
    return getStoredViewWindowTheme() ?? 'dark'
  })

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('groupviz-theme', next)
      return next
    })
  }, [])

  const toggleViewWindowTheme = useCallback(() => {
    setViewWindowThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('groupviz-viewwindow-theme', next)
      return next
    })
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem('groupviz-theme', t)
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)')
    const handler = (e: MediaQueryListEvent) => {
      const stored = getStoredTheme()
      if (!stored) {
        setTheme(e.matches ? 'light' : 'dark')
      }
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [setTheme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, viewWindowTheme, toggleViewWindowTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
