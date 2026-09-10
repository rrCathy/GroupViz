import { useMemo, useState } from 'react'
import { createGroupFromSymbol, buildCosetViewData, type Group } from '@groupviz/core'
import { useSceneState, SetView, CycleView, CayleyView, CosetStripScene } from '@groupviz/react'

type ViewKind = 'set' | 'cycle' | 'cayley' | 'coset'
type ThemeKind = 'dark' | 'light'

const SYMBOLS = ['S_{4}', 'C_{6}', 'D_{4}', 'A_{4}']

/**
 * FGVE 最小宿主：消费 dist-pkg 双包产物（vite alias 等价 npm 安装）。
 *
 * 本版示范「包外嵌入者」的三条主线：
 *   1. useSceneState —— 受控四件套 + ResizeObserver + 滚轮缩放/拖拽平移 + hover 气泡，
 *      一张图的接入代码从 ~80 行胶水压到 3 行；
 *   2. theme prop —— 单图主题与宿主主题解耦（右上角切换，不改全局 CSS）；
 *   3. 元素引用 —— actions[].elementId / coset 的 H 都能写 label（人类记号），
 *      解析不到会 console.warn 而不是静默失败。
 */
export function Demo() {
  const [view, setView] = useState<ViewKind>('set')
  const [symbol, setSymbol] = useState('S_{4}')
  const [theme, setTheme] = useState<ThemeKind>('dark')
  const [exportMsg, setExportMsg] = useState('')

  const group: Group | null = useMemo(() => createGroupFromSymbol(symbol), [symbol])

  // 一行拿到：hostProps / sceneProps / hoverBubble / 共享节点位置（ref 内含在 hostProps 里）
  const s = useSceneState(group, { theme })

  // 陪集视图：core 一键装配（H 也可写 label；这里取一个真子群）
  const cosetData = useMemo(() => {
    if (!group) return null
    const h = group.elements.filter((_, i) => i < 2).map(e => e.id)
    return buildCosetViewData(group, h, { side: 'left' })
  }, [group])

  function exportSvg() {
    const svg = s.getHostElement()?.querySelector('svg')
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
    <div data-theme={theme} style={{ width: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', flexWrap: 'wrap', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
        <strong>GroupViz host-minimal</strong>
        <span data-testid="group-label" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {group ? `${group.symbol} · |G|=${group.order}` : `群未载入（${symbol}）`}
        </span>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ padding: '2px 6px' }} aria-label="切换群">
          {SYMBOLS.map(sym => <option key={sym} value={sym}>{sym}</option>)}
        </select>
        {(['set', 'cycle', 'cayley', 'coset'] as ViewKind[]).map(k => (
          <button key={k} data-testid={`view-${k}`} onClick={() => setView(k)} style={btnStyle(view === k)}>
            {k} 视图
          </button>
        ))}
        <button data-testid="toggle-theme" onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))} style={btnStyle(false)}>
          主题：{theme}
        </button>
        <button data-testid="export-svg" onClick={exportSvg}>导出 SVG</button>
        <span data-testid="selection" style={{ fontSize: 12, color: 'var(--accent-teal)' }}>
          已选 {s.selectedElements.size}
        </span>
        {exportMsg && <span style={{ fontSize: 12, color: 'var(--accent-teal)' }}>{exportMsg}</span>}
      </div>

      {/* 宿主容器：hostProps 一次给齐（内含 ref + 内建样式 + 拖拽/滚轮事件）；
          sceneProps 一喂给任意受控 Scene。注意别再自己写 ref —— 那会顶掉内建 ref。 */}
      <div
        {...s.hostProps}
        data-testid="view-host"
        style={{ ...s.hostProps.style, flex: 1, minHeight: 540 }}
      >
        {!group ? (
          <div className="view-empty"><p>无法构建群：{symbol}</p></div>
        ) : view === 'set' ? (
          <SetView group={group} {...s.sceneProps} theme={theme} />
        ) : view === 'cycle' ? (
          <CycleView
            group={group}
            {...s.sceneProps}
            theme={theme}
            getNodePosition={s.getNodePosition}
            onNodePositionChange={s.onNodePositionChange}
          />
        ) : view === 'cayley' ? (
          <CayleyView
            group={group}
            {...s.sceneProps}
            theme={theme}
            showLabels={false}
            // 元素引用：直接写 label（人类记号）也认；写错会 console.warn 而非静默
            actions={[{ elementId: group.elements[1].label }]}
          />
        ) : cosetData ? (
          <CosetStripScene group={group} {...s.sceneProps} theme={theme} {...cosetData} />
        ) : (
          <div className="view-empty"><p>该群无可用陪集数据</p></div>
        )}
        {s.hoverBubble}
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
