import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import { GroupProvider } from './context/GroupContext'
import { useGroup } from './context/useGroup'
import { useTranslation } from './i18n/useTranslation'
import { LeftPanel } from './components/Panels/LeftPanel'
import { RightPanel } from './components/Panels/RightPanel'
import { GroupCanvas } from './components/Canvas/GroupCanvas'
import { FloatingViewWindow } from './components/Canvas/FloatingViewWindow'
import { TopProgressBar } from './components/TopProgressBar'
import { AutomorphismPreviewPopup } from './components/Canvas/AutomorphismPreviewPopup'
import { createGroupFromSymbol } from './utils/groupFactory'
import { createS3 } from './core/groups/SymmetricGroup'
import { computeQuotientGroup } from './core/algebra/subgroups'
import { createAutomorphismGroup, isAutomorphismGroup } from './core/algebra/automorphisms'
import { reconstructSemidirectProduct } from './context/semidirectProduct/semidirectProductStorage'
import type { StoredSemidirectProduct } from './context/semidirectProduct/semidirectProductStorage'
import { STORAGE_KEY } from './utils/sessionKey'
import { z } from 'zod'
import { loadVersionedJson, saveVersionedJson } from './utils/persistence'
import type { Group, ViewMode } from './core/types'
import type { Subgroup } from './core/algebra/subgroups'

const DirectProductViewLazy = lazy(() => import('./components/Canvas/DirectProductView').then(m => ({ default: m.DirectProductView })))
const SemidirectProductViewLazy = lazy(() => import('./components/Canvas/SemidirectProductView').then(m => ({ default: m.SemidirectProductView })))

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

const sessionSchema: z.ZodType<SavedSession> = z.object({
  symbol: z.string(),
  view: z.string() as z.ZodType<ViewMode>,
  quotientData: z.object({
    normalSubgroupElementIds: z.array(z.string()),
    normalSubgroupLabel: z.string(),
    isoSymbol: z.string().nullable(),
  }).optional(),
  automorphismData: z.object({
    isoSymbol: z.string().nullable(),
  }).optional(),
  semidirectData: z.object({
    id: z.string(),
    symbol: z.string().optional(),
    normalSymbol: z.string(),
    actingSymbol: z.string(),
    phiGenMapping: z.record(z.string(), z.string()),
    name: z.string().optional(),
  }).optional(),
})

function saveSession(session: SavedSession) {
  saveVersionedJson(STORAGE_KEY, session)
}

function loadSession(): SavedSession | null {
  // Accepts both the versioned { __gvVersion, data } envelope and legacy raw
  // sessions; corrupt or forged data returns null → default S3 session.
  return loadVersionedJson(STORAGE_KEY, sessionSchema)
}

function WorkspaceContent() {
  const { currentGroup, currentView, setCurrentGroup, setCurrentView, selectNextElement, selectPrevElement, floatingViews, isDirectProductMode, isSemidirectProductMode, backendCache, isLargeGroup } = useGroup()
  const { t } = useTranslation()
  const restoreViewRef = useRef<ViewMode | null>(null)
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false)
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false)
  const [leftDrawerView, setLeftDrawerView] = useState<ViewMode | null>(null)

  // True while the backend is being queried (or the local fallback is
  // computing); TopProgressBar reveals itself after 3s via CSS animation.
  const computing = backendCache.loading && isLargeGroup

  // The left drawer auto-closes when the view changes (derived from currentView)
  const leftOpen = leftDrawerOpen && leftDrawerView === currentView

  const toggleLeftDrawer = useCallback(() => {
    setLeftDrawerOpen(o => {
      if (!o) {
        setRightDrawerOpen(false)
        setLeftDrawerView(currentView)
      }
      return !o
    })
  }, [currentView])

  const toggleRightDrawer = useCallback(() => {
    setRightDrawerOpen(o => {
      if (!o) setLeftDrawerOpen(false)
      return !o
    })
  }, [])

  const closeDrawers = useCallback(() => {
    setLeftDrawerOpen(false)
    setRightDrawerOpen(false)
  }, [])

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
      } else if (e.key === 'Escape') {
        closeDrawers()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectNextElement, selectPrevElement, closeDrawers])

  return (
    <div className="app-layout">
      <TopProgressBar active={computing} />
      <aside className={`left-sidebar${leftOpen ? ' sidebar-open' : ''}`}>
        <LeftPanel />
      </aside>

      <main className="main-canvas">
        {isDirectProductMode
          ? <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><DirectProductViewLazy /></Suspense>
          : isSemidirectProductMode
            ? <Suspense fallback={<div className="view-loading"><div className="loading-spinner" /></div>}><SemidirectProductViewLazy /></Suspense>
            : <GroupCanvas />}
      </main>

      <aside className={`right-sidebar${rightDrawerOpen ? ' sidebar-open' : ''}`}>
        <RightPanel />
      </aside>

      {(leftOpen || rightDrawerOpen) && (
        <div className="sidebar-overlay" onClick={closeDrawers} />
      )}
      <button
        className="drawer-btn drawer-btn-left"
        onClick={toggleLeftDrawer}
        title={t('ui.openToolbar')}
        aria-label={t('ui.openToolbar')}
      >
        {'\u2630'}
      </button>
      <button
        className="drawer-btn drawer-btn-right"
        onClick={toggleRightDrawer}
        title={t('ui.openInfo')}
        aria-label={t('ui.openInfo')}
      >
        {'\u2139'}
      </button>

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

export default function Workspace() {
  return (
    <GroupProvider>
      <WorkspaceContent />
    </GroupProvider>
  )
}