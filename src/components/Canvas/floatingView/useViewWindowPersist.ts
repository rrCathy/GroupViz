// ── ViewWindow 持久化 + 受控/非受控 state 判定（B2 自 ViewWindow.tsx 抽出，逻辑未动）──
// 受控判定规则见下方原注释：宿主「同时传 xx + onXxxChange」= 严格受控；「只传 xx」
// 视为非受控初始默认值（内部 state 接管后续交互）。
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { Group, Homomorphism, ViewMode } from '../../../core/types'
import type { ViewWindowConfig } from '../../../core/types/viewConfig'
import { setViewParamsSchema, cayleyViewParamsSchema, cayley3DViewParamsSchema, cycleViewParamsSchema, tableViewParamsSchema, sublatticeViewParamsSchema, cosetStripViewParamsSchema, symmetryViewParamsSchema, homomorphismViewParamsSchema, actionViewParamsSchema } from '../../../core/types/viewConfig'
import { loadVwPersist, saveVwPersist } from './persist'
import type { VwGeometry } from './geometry'
import type { ViewParams, ViewParamsPatch } from './types'

export function useViewWindowPersist({
  view, group, homomorphism, storageKey, configProp, onConfigChange,
  viewParamsProp, onViewParamsChange, defaultPosition, defaultSize,
}: {
  view: ViewMode
  group?: Group | null
  homomorphism?: Homomorphism | null
  storageKey?: string
  configProp?: ViewWindowConfig
  onConfigChange?: (c: ViewWindowConfig) => void
  viewParamsProp?: ViewParams
  onViewParamsChange?: (p: ViewParams) => void
  defaultPosition: { x: number; y: number }
  defaultSize: { width: number; height: number }
}) {

  // 默认持久化键含视图名：同群的 set/cayley 窗口各自独立持久化，互不覆盖
  const persistKey = storageKey ?? (group ? `${group.symbol}|${group.order}|${view}` : (view === 'homomorphism' && homomorphism ? `${homomorphism.source.symbol}|${homomorphism.target.symbol}|homomorphism` : null))
  const persisted = useMemo(() => persistKey ? loadVwPersist(persistKey) : null, [persistKey])

  const [geometry, setGeometry] = useState<VwGeometry>(() => {
    if (persisted) return { position: persisted.position, size: persisted.size }
    return { position: defaultPosition, size: defaultSize }
  })

  const [configState, setConfigState] = useState<ViewWindowConfig>(() =>
    configProp ?? persisted?.config ?? {})
  const [viewParamsState, setViewParamsState] = useState<ViewParams>(() => {
    if (viewParamsProp) return viewParamsProp
    if (persisted) {
      // 按视图用对应 schema 校验持久化参数：键残留他视图参数/手改坏值时回退默认
      const schema = view === 'cayley' ? cayleyViewParamsSchema
        : view === '3d' ? cayley3DViewParamsSchema
          : view === 'set' ? setViewParamsSchema
            : view === 'cycle' ? cycleViewParamsSchema
              : (view === 'table' || view === 'heatmap') ? tableViewParamsSchema
                : view === 'sublattice' ? sublatticeViewParamsSchema
                  : view === 'cosetstrip' ? cosetStripViewParamsSchema
                    : view === 'symmetry' ? symmetryViewParamsSchema
                      : view === 'homomorphism' ? homomorphismViewParamsSchema
                        : view === 'action' ? actionViewParamsSchema
                          : null
      if (schema) {
        const parsed = schema.safeParse(persisted.viewParams)
        if (parsed.success) return parsed.data as ViewParams
      } else {
        return persisted.viewParams as ViewParams
      }
    }
    return {}
  })
  // 受控判定：是否传入对应 onXxxChange。宿主「同时传 xx + onXxxChange」为严格受控
  // （渲染读 prop、交互回传宿主）；「只传 xx」视为非受控的初始默认值（内部 state 接管
  // 后续交互）——否则预设默认参数的窗口（如博客锁定插图）会因既无回调又不更新 state
  // 而冻结，任何参数点击都无效。
  const config = (configProp && onConfigChange) ? configProp : configState
  const viewParams = (viewParamsProp && onViewParamsChange) ? viewParamsProp : viewParamsState
  // Persist on geometry + config + viewParams change
  const persistTimer = useRef<ReturnType<typeof setTimeout>>(null as unknown as ReturnType<typeof setTimeout>)
  useEffect(() => {
    if (!persistKey) return
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      saveVwPersist(persistKey, { position: geometry.position, size: geometry.size, config, viewParams: viewParams as Record<string, unknown> })
    }, 300)
    return () => { if (persistTimer.current) clearTimeout(persistTimer.current) }
  }, [geometry, config, viewParams, persistKey])

  const updateConfig = useCallback((p: Partial<ViewWindowConfig>) => {
    // 与「有效值」合并（受控时 prop 优先）：受控模式下内部 state 不更新，
    // 若与陈旧的内部快照合并，连续调整多个开关时后续载荷会丢失之前的值
    const next = { ...config, ...p }
    if (onConfigChange) onConfigChange(next)
    else setConfigState(next)
  }, [config, onConfigChange])

  const updateViewParams = useCallback((p: ViewParamsPatch) => {
    // 参数对象按 view 判别（同一时刻只属于一种视图），跨类型合并不需要判别字段
    const next = { ...viewParams, ...p } as ViewParams
    if (onViewParamsChange) onViewParamsChange(next)
    else setViewParamsState(next)
  }, [viewParams, onViewParamsChange])

  return {
    persistKey, geometry, setGeometry, config, viewParams,
    setConfigState, setViewParamsState, updateConfig, updateViewParams,
  }
}
