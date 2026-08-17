import { useCallback, useState, lazy, Suspense } from 'react'
import { I18nProvider } from './i18n/I18nContext'
import { useTranslation } from './i18n/useTranslation'
import { ThemeProvider, useTheme } from './theme/useTheme'
import { WelcomePage } from './components/WelcomePage'
import { STORAGE_KEY } from './utils/sessionKey'
import './App.css'

const WorkspaceLazy = lazy(() => import('./Workspace'))

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
          <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}>
            <WorkspaceLazy />
          </Suspense>
        </div>
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