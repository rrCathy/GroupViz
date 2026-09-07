/**
 * TestPagePkgConsume — FGVE 阶段 3「主应用宿主消费双包」验证区块。
 *
 * 经 React.lazy 由 TestPage 懒加载（独立 chunk，不进主 App bundle）。
 * 群构造与视图组件全部来自 dist-pkg 产物：
 *   - @groupviz/core  → createGroupFromSymbol（descriptor v1 symbol 字段驱动）
 *   - @groupviz/react → SetView / CycleView（首批 props 化视图）
 *
 * 作用：在真实主应用宿主环境（ThemeProvider/I18nProvider 内）验证包可被
 * import 并渲染，与 src 相对导入版的 TestPage 窗口矩阵互为印证。
 * 注意：改动 src/core 或视图后需先 `npm run build:pkg` 再刷新本页。
 */
import { useMemo, useState } from 'react'
import { createGroupFromSymbol, type Group } from '@groupviz/core'
import { SetView, CycleView } from '@groupviz/react'

const CANVAS_TRANSFORM = { x: 40, y: 40, scale: 1 }
const VIEWBOX = { width: 860, height: 520 }

export default function TestPagePkgConsume() {
  const [symbol, setSymbol] = useState('S_{4}')
  const group: Group | null = useMemo(() => createGroupFromSymbol(symbol), [symbol])

  return (
    <div data-testid="pkg-consume" data-theme="dark" style={{ margin: '18px 0', padding: 14, border: '1px solid #334155', borderRadius: 10, background: '#0b1220' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <strong style={{ color: '#7dd3fc' }}>🧩 双包消费验证（dist-pkg 产物）</strong>
        <span data-testid="pkg-group-label" style={{ fontSize: 12, color: '#94a3b8' }}>
          {group ? `${group.symbol} · |G|=${group.order}` : `群未载入（${symbol}）`}
        </span>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ padding: '2px 6px', fontSize: 12 }} aria-label="pkg 切群">
          <option value="S_{4}">S₄</option>
          <option value="A_{4}">A₄</option>
          <option value="C_{6}">C₆</option>
          <option value="D_{4}">D₄</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div data-testid="pkg-set" style={{ flex: '1 1 420px', minWidth: 380 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>SetView ← @groupviz/react</div>
          {group && <SetView group={group} selectedElements={new Set<string>()} canvasTransform={CANVAS_TRANSFORM} viewBoxSize={VIEWBOX} showLabels />}
        </div>
        <div data-testid="pkg-cycle" style={{ flex: '1 1 420px', minWidth: 380 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>CycleView ← @groupviz/react</div>
          {group && <CycleView group={group} selectedElements={new Set<string>()} canvasTransform={CANVAS_TRANSFORM} viewBoxSize={VIEWBOX} showLabels />}
        </div>
      </div>
    </div>
  )
}
