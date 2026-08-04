import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import { I18nProvider } from './i18n/I18nContext'
import { useTranslation } from './i18n/useTranslation'
import { ThemeProvider, useTheme } from './theme/useTheme'
import { GroupProvider } from './context/GroupContext'
import { useGroup } from './context/useGroup'
import { LeftPanel } from './components/Panels/LeftPanel'
import { RightPanel } from './components/Panels/RightPanel'
import { GroupCanvas } from './components/Canvas/GroupCanvas'
import { FloatingViewWindow } from './components/Canvas/FloatingViewWindow'
import { WelcomePage } from './components/WelcomePage'
import { createGroupFromSymbol } from './utils/groupFactory'
import { createS3 } from './core/groups/SymmetricGroup'
import { computeQuotientGroup } from './core/algebra/subgroups'
import { createAutomorphismGroup, isAutomorphismGroup } from './core/algebra/automorphisms'
import { reconstructSemidirectProduct } from './context/semidirectProduct/semidirectProductStorage'
import type { StoredSemidirectProduct } from './context/semidirectProduct/semidirectProductStorage'
import { AutomorphismPreviewPopup } from './components/Canvas/AutomorphismPreviewPopup'
import type { Group, ViewMode } from './core/types'
import type { Subgroup } from './core/algebra/subgroups'
import './App.css'

const DirectProductViewLazy = lazy(() => import('./components/Canvas/DirectProductView').then(m => ({ default: m.DirectProductView })))
const SemidirectProductViewLazy = lazy(() => import('./components/Canvas/SemidirectProductView').then(m => ({ default: m.SemidirectProductView })))

const STORAGE_KEY = 'groupviz-session'

interface SavedSession {
  symbol: string
  view: ViewMode
  quotientData?: {
    normalSubgroupElementIds: string[]
    normalSubgroupLabel: string
    isoSymbol: string | null
  }
  automorphismData?: {
    isoSymbol: string | null
  }
  semidirectData?: StoredSemidirectProduct
}

function saveSession(session: SavedSession) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
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
  const { currentGroup, currentView, setCurrentGroup, setCurrentView, selectNextElement, selectPrevElement, floatingViews, isDirectProductMode, isSemidirectProductMode } = useGroup()
  const restoreViewRef = useRef<ViewMode | null>(null)

  // Auto-save session whenever group or view changes
  useEffect(() => {
    if (!currentGroup) return
    const sym = currentGroup.symbol
    if (sym.includes('/N')) {
      // Save parent symbol + enough data to reconstruct the quotient group
      const parentSym = sym.endsWith('/N') ? sym.slice(0, -2) : sym
      if (currentGroup.normalSubgroupElementIds && currentGroup.normalSubgroupElementIds.length > 0) {
        saveSession({
          symbol: parentSym,
          view: currentView,
          quotientData: {
            normalSubgroupElementIds: currentGroup.normalSubgroupElementIds,
            normalSubgroupLabel: currentGroup.elements[0]?.label ?? '',
            isoSymbol: currentGroup.isoSymbol ?? null,
          },
        })
        return
      }
    }
    if (isAutomorphismGroup(currentGroup)) {
      const parentSym = currentGroup.automorphismParentSymbol
      if (parentSym) {
        saveSession({
          symbol: parentSym,
          view: currentView,
          automorphismData: {
            isoSymbol: currentGroup.isoSymbol ?? null,
          },
        })
        return
      }
    }
    const sdMeta = currentGroup._semidirectProduct
    if (sdMeta) {
      const { normal: N, acting: H, phiMap } = sdMeta
      const phiGenMapping: Record<string, string> = {}
      for (const gen of H.generators) {
        const genElId = gen.apply(H.identity).id
        const auto = phiMap.get(genElId)
        if (auto) phiGenMapping[genElId] = auto.id
      }
      saveSession({
        symbol: sym,
        view: currentView,
        semidirectData: {
          id: `sd-session-${Date.now()}`,
          normalSymbol: N.symbol,
          actingSymbol: H.symbol,
          phiGenMapping,
        },
      })
      return
    }
    saveSession({ symbol: sym, view: currentView })
  }, [currentGroup, currentView])

  // Restore session on first mount
  useEffect(() => {
    const saved = loadSession()
    if (saved) {
      if (saved.semidirectData) {
        const sdGroup = reconstructSemidirectProduct(saved.semidirectData)
        if (sdGroup) {
          restoreViewRef.current = saved.view
          setCurrentGroup(sdGroup)
          return
        }
      }
      const parentGroup = createGroupFromSymbol(saved.symbol)
      if (parentGroup) {
        restoreViewRef.current = saved.view
        if (saved.automorphismData) {
          const autoGroup = createAutomorphismGroup(parentGroup)
          if (autoGroup) {
            autoGroup.isoSymbol = saved.automorphismData.isoSymbol ?? undefined
            setCurrentGroup(autoGroup)
            return
          }
        }
        if (saved.quotientData && saved.quotientData.normalSubgroupElementIds) {
          const subgroupElements = saved.quotientData.normalSubgroupElementIds
            .map(id => parentGroup.elements.find(e => e.id === id))
            .filter((e): e is Group['elements'][0] => e !== undefined)
          if (subgroupElements.length > 0) {
            const normalSubgroup: Subgroup = {
              elements: subgroupElements,
              order: subgroupElements.length,
              index: parentGroup.order / subgroupElements.length,
              generators: [],
              isNormal: true,
            }
            const qg = computeQuotientGroup(parentGroup, normalSubgroup)
            if (qg) {
              qg.isoSymbol = saved.quotientData.isoSymbol ?? undefined
              setCurrentGroup(qg)
              return
            }
          }
        }
        setCurrentGroup(parentGroup)
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
        {isDirectProductMode
          ? <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><DirectProductViewLazy /></Suspense>
          : isSemidirectProductMode
            ? <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><SemidirectProductViewLazy /></Suspense>
            : <GroupCanvas />}
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
      <AutomorphismPreviewPopup />
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
