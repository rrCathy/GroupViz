/**
 * TestPagePkgConsume — FGVE 阶段 3「主应用宿主消费双包」验证区块。
 *
 * 经 React.lazy 由 TestPage 懒加载（独立 chunk，不进主 App bundle）。
 * 群构造与视图组件全部来自 dist-pkg 产物：
 *   - @groupviz/core  → createGroupFromSymbol（descriptor v1 symbol 字段驱动）
 *   - @groupviz/react → SetView / CycleView / CayleyView / CosetStripScene / I18nProvider
 *
 * 关键消费约定：包内 Scene 自带一份 I18nContext（语言包入包），与主应用的是
 * 两个独立实例——因此本区块用「包导出的 I18nProvider」包裹（复用而非主应用
 * Provider），Scene 文案才能走包内语言包（zh/en 全量）。
 *
 * 作用：在真实主应用宿主环境验证包可被 import 并渲染。
 * 注意：改动 src/core 或视图后需先 `npm run build:pkg` 再刷新本页。
 */
import { useMemo, useState, type ReactNode } from 'react'
import { createGroupFromSymbol, type Group } from '@groupviz/core'
import { SetView, CycleView, CayleyView, CosetStripScene, I18nProvider } from '@groupviz/react'

const CANVAS_TRANSFORM = { x: 40, y: 40, scale: 1 }
const VIEWBOX = { width: 860, height: 520 }

/**
 * S₃ 对 H=⟨h⟩（h = 首个非单位、二阶自逆元素）的右陪集划分。
 * 不假设生成元约定（descriptor 重建的 S₃ 生成元与注册表可能不同），
 * 纯用 group.multiply 逐元素归并：同陪集 ⇔ {g·x : x∈H} 的 id 集合相同。
 */
function useS3CosetMap() {
  return useMemo(() => {
    const s3 = createGroupFromSymbol('S_{3}')!
    const e = s3.identity
    // H = ⟨h⟩：找任意非单位二阶元（反射）。自逆 ⇔ h·h = e。
    const h = s3.elements.find(x => x.id !== e.id && s3.multiply(x, x).id === e.id)!
    const hIds = new Set([e.id, h.id])
    // 右陪集 gH = {g, g·h}；按成员 id 排序后 join 作规范化 key
    const cosetKey = (g: Group['elements'][number]) =>
      [g.id, s3.multiply(g, h).id].sort().join(',')
    const byKey = new Map<string, number>()
    const map = new Map<string, number>()
    s3.elements.forEach(g => {
      const k = cosetKey(g)
      let ci = byKey.get(k)
      if (ci === undefined) { ci = byKey.size; byKey.set(k, ci) }
      map.set(g.id, ci)
    })
    const colors = ['#4ecdc4', '#ff6b6b', '#ffd93d']
    return { s3, map, colors, hId: h.id, hIds, cosetCount: byKey.size }
  }, [])
}

function Block({ title, children, testid }: { title: string; children: ReactNode; testid: string }) {
  return (
    <div data-testid={testid} style={{ flex: '1 1 420px', minWidth: 380 }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  )
}

export default function TestPagePkgConsume() {
  const [symbol, setSymbol] = useState('S_{4}')
  const group: Group | null = useMemo(() => createGroupFromSymbol(symbol), [symbol])
  const coset = useS3CosetMap()

  return (
    // 包内 I18nProvider（语言包入包）：供包内 Scene 读文案；主应用外层 Provider 是另一实例
    <I18nProvider>
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
          <Block title="SetView ← @groupviz/react" testid="pkg-set">
            {group && <SetView group={group} selectedElements={new Set<string>()} canvasTransform={CANVAS_TRANSFORM} viewBoxSize={VIEWBOX} showLabels />}
          </Block>
          <Block title="CycleView ← @groupviz/react" testid="pkg-cycle">
            {group && <CycleView group={group} selectedElements={new Set<string>()} canvasTransform={CANVAS_TRANSFORM} viewBoxSize={VIEWBOX} showLabels />}
          </Block>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <Block title="CayleyView ← @groupviz/react（批次九：视图全量入包）" testid="pkg-cayley">
            {group && <CayleyView group={group} selectedElements={new Set<string>()} canvasTransform={CANVAS_TRANSFORM} viewBoxSize={VIEWBOX} showLabels />}
          </Block>
          <Block title={`CosetStripScene ← @groupviz/react（S₃ / H=⟨h⟩ 右陪集 ×${coset.cosetCount}）`} testid="pkg-cosetstrip">
            <CosetStripScene
              group={coset.s3}
              viewBoxSize={VIEWBOX}
              cosetElementMap={coset.map}
              cosetColors={coset.colors}
              showLabels
            />
          </Block>
        </div>
      </div>
    </I18nProvider>
  )
}
