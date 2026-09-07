import { useMemo, useRef, useState } from 'react'
import { createGroupFromSymbol, type Group } from '@groupviz/core'
import { SetView, CycleView, type SetViewProps, type CycleViewProps } from '@groupviz/react'

const CANVAS_TRANSFORM = { x: 40, y: 40, scale: 1 }
const VIEWBOX = { width: 900, height: 620 }

type ViewKind = 'set' | 'cycle'

/**
 * FGVE 阶段3 host-minimal：验证双包被真实消费的能力——
 * JSON 载群（descriptor→symbol→createGroupFromSymbol）→ 切视图 → 切群 → 导出 SVG。
 */
export function Demo() {
  const [view, setView] = useState<ViewKind>('set')
  const [symbol, setSymbol] = useState('S_{4}')
  const [exportMsg, setExportMsg] = useState('')
  const svgHostRef = useRef<HTMLDivElement>(null)

  // 切群：core.createGroupFromSymbol（descriptor v1 的 symbol 字段驱动）
  const group: Group | null = useMemo(() => createGroupFromSymbol(symbol), [symbol])

  const viewProps = {
    canvasTransform: CANVAS_TRANSFORM,
    viewBoxSize: VIEWBOX,
    showLabels: true,
  } as Partial<SetViewProps> & Partial<CycleViewProps>

  function exportSvg() {
    const svg = svgHostRef.current?.querySelector('svg')
    if (!svg) return setExportMsg('未找到 <svg> 节点')
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const xml = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([xml], { type: 'image/svg+xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `groupviz-${symbol.replace(/\W/g, '')}-${view}.svg`
    a.click()
    URL.revokeObjectURL(a.href)
    setExportMsg(`已导出 ${a.download}`)
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', flexWrap: 'wrap', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
        <strong>GroupViz host-minimal</strong>
        <span data-testid="group-label" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {group ? `${group.symbol} · |G|=${group.order}` : `群未载入（${symbol}）`}
        </span>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ padding: '2px 6px' }} aria-label="切换群">
          <option value="S_{4}">S₄</option>
          <option value="C_{6}">C₆</option>
          <option value="D_{4}">D₄</option>
          <option value="A_{4}">A₄</option>
        </select>
        <button data-testid="view-set" onClick={() => setView('set')} style={btnStyle(view === 'set')}>
          Set 视图
        </button>
        <button data-testid="view-cycle" onClick={() => setView('cycle')} style={btnStyle(view === 'cycle')}>
          Cycle 视图
        </button>
        <button data-testid="export-svg" onClick={exportSvg}>导出 SVG</button>
        {exportMsg && <span style={{ fontSize: 12, color: 'var(--accent-teal)' }}>{exportMsg}</span>}
      </div>
      <div ref={svgHostRef} data-testid="view-host" style={{ flex: 1, padding: 12, minHeight: 540 }}>
        {!group ? (
          <div className="view-empty">无法构建群：{symbol}</div>
        ) : view === 'set' ? (
          <SetView group={group} selectedElements={new Set<string>()} {...viewProps} />
        ) : (
          <CycleView group={group} selectedElements={new Set<string>()} {...viewProps} />
        )}
      </div>
    </div>
  )
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    cursor: 'pointer',
    border: '1px solid var(--border-primary)',
    borderRadius: 4,
    background: active ? 'var(--accent-teal)' : 'var(--bg-interactive)',
    color: active ? 'var(--btn-on-accent)' : 'var(--text-primary)',
  }
}
