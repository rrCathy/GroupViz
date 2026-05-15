import { useEffect, useState, useCallback, useRef } from 'react'
import { I18nProvider } from './i18n/I18nContext'
import { useTranslation } from './i18n/useTranslation'
import { ThemeProvider, useTheme } from './theme/useTheme'
import { GroupProvider } from './context/GroupContext'
import { useGroup } from './context/useGroup'
import { LeftPanel } from './components/Panels/LeftPanel'
import { RightPanel } from './components/Panels/RightPanel'
import { GroupCanvas } from './components/Canvas/GroupCanvas'
import { DirectProductView } from './components/Canvas/DirectProductView'
import { FloatingViewWindow } from './components/Canvas/FloatingViewWindow'
import { WelcomePage } from './components/WelcomePage'
import { createGroupFromSymbol } from './utils/groupFactory'
import { createS3 } from './core/groups/SymmetricGroup'
import type { ViewMode } from './core/types'
import './App.css'

const STORAGE_KEY = 'groupviz-session'

interface SavedSession {
  symbol: string
  view: ViewMode
}

function saveSession(symbol: string, view: ViewMode) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ symbol, view }))
  } catch { /* ignore */ }
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.symbol && parsed.view) return parsed
  } catch { /* ignore */ }
  return null
}

function LanguageToggle() {
  const { lang, setLang, t } = useTranslation()
  return (
    <button
      className="lang-toggle"
      onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      title={lang === 'zh' ? t('lang.en') : t('lang.zh')}
    >
      {lang === 'zh' ? 'English' : '简体中文'}
    </button>
  )
}

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      className={className || 'theme-toggle'}
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
    >
      {theme === 'dark' ? '\u2600' : '\u263E'}
    </button>
  )
}

function AppContent() {
  const { currentGroup, currentView, setCurrentGroup, setCurrentView, selectNextElement, selectPrevElement, floatingViews, isDirectProductMode } = useGroup()
  const restoreViewRef = useRef<ViewMode | null>(null)

  // Auto-save session whenever group or view changes
  useEffect(() => {
    if (currentGroup) {
      saveSession(currentGroup.symbol, currentView)
    }
  }, [currentGroup, currentView])

  // Restore session on first mount
  useEffect(() => {
    const saved = loadSession()
    if (saved) {
      const group = createGroupFromSymbol(saved.symbol)
      if (group) {
        restoreViewRef.current = saved.view
        setCurrentGroup(group)
        return
      }
    }
    // No saved session — load default group
    setCurrentGroup(createS3())
  }, [setCurrentGroup])

  // Restore view after group is set
  useEffect(() => {
    if (currentGroup && restoreViewRef.current) {
      setCurrentView(restoreViewRef.current)
      restoreViewRef.current = null
    }
  }, [currentGroup, setCurrentView])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        selectNextElement()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        selectPrevElement()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectNextElement, selectPrevElement])

  return (
    <div className="app-layout">
      <aside className="left-sidebar">
        <LeftPanel />
      </aside>

      <main className="main-canvas">
        {isDirectProductMode ? <DirectProductView /> : <GroupCanvas />}
      </main>

      <aside className="right-sidebar">
        <RightPanel />
      </aside>

      {floatingViews.map(fv => (
        <FloatingViewWindow
          key={fv.id}
          id={fv.id}
          view={fv.view}
          title={fv.title}
        />
      ))}
    </div>
  )
}

function App() {
  const [showMain, setShowMain] = useState(false)
  const { t } = useTranslation()

  const handleEnter = useCallback(() => setShowMain(true), [])
  const handleBackToWelcome = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setShowMain(false)
  }, [])

  return (
    <>
      {!showMain && <WelcomePage onEnter={handleEnter} />}
      {showMain && (
        <GroupProvider>
          <div className="app">
            <header className="app-header">
              <h1 onClick={handleBackToWelcome}>
                {t('app.header')}
              </h1>
              <div className="header-right-group">
                <ThemeToggle />
                <LanguageToggle />
              </div>
            </header>
            <AppContent />
          </div>
        </GroupProvider>
      )}
    </>
  )
}

export default function AppWrapper() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  )
}
