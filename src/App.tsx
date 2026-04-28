import { useEffect, useState } from 'react'
import { I18nProvider } from './i18n/I18nContext'
import { useTranslation } from './i18n/useTranslation'
import { GroupProvider } from './context/GroupContext'
import { useGroup } from './context/useGroup'
import { createS3 } from './core/groups/SymmetricGroup'
import { LeftPanel } from './components/Panels/LeftPanel'
import { RightPanel } from './components/Panels/RightPanel'
import { GroupCanvas } from './components/Canvas/GroupCanvas'
import { FloatingViewWindow } from './components/Canvas/FloatingViewWindow'
import { WelcomePage } from './components/WelcomePage'
import './App.css'

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

function AppContent() {
  const { setCurrentGroup, selectNextElement, selectPrevElement, floatingViews } = useGroup()

  useEffect(() => {
    setCurrentGroup(createS3())
  }, [setCurrentGroup])

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
        <GroupCanvas />
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

  return (
    <>
      {!showMain && <WelcomePage onEnter={() => setShowMain(true)} />}
      {showMain && (
        <GroupProvider>
          <div className="app">
            <header className="app-header">
              <h1>{t('app.header')}</h1>
              <LanguageToggle />
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
      <App />
    </I18nProvider>
  )
}
