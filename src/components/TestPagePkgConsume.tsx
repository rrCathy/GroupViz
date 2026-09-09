/**
 * TestPagePkgConsume — FGVE「整页包消费参数矩阵」（/?test=1 页面主体，TestPage 懒加载）。
 *
 * TestPage1 整页包消费化改写：原 src ViewWindow 参数矩阵已删除，本文件成为页面本体。
 * 群构造与 10 个已入包 Scene（v1.26.0 批次十收官）全部来自 **dist-pkg 产物**：
 *   - @groupviz/core  → createGroupFromSymbol / buildActionComputation（vite alias 直指产物）
 *   - @groupviz/react → 10 Scene + I18nProvider
 *
 * 每个 Scene 卡片自带控件条，以 props 注入方式覆盖关键参数（对齐原 ViewWindow
 * 参数矩阵的覆盖点）：columns / nodeRadius / 标签开关 / shape2D / multiplyType /
 * strategy / showHeatmap / mergeConjugates / labelDetail / theme（3D 与格的主题
 * prop 化验证）/ layout3D / variant 等。切群 select 同步驱动所有「共享群」卡片，
 * 即日常打开 ?test=1 即对双包做参数级回归。
 *
 * 关键消费约定：包内 Scene 自带 I18nContext（语言包入包），与主应用的是两个独立
 * 实例——本页用「包导出的 I18nProvider」包裹（复用而非主应用 Provider）。
 *
 * 改动 src/core / Scene / src/package 后需先 `npm run build:pkg` 再刷新本页。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createGroupFromSymbol, buildActionComputation, type Group, type GroupElement } from '@groupviz/core'
import {
  SetView, CycleView, CayleyView, CosetStripScene, TableView,
  ActionScene, HomomorphismScene, SublatticeScene, Cayley3DScene, SymmetryViewScene,
  SceneWindow,
  I18nProvider,
} from '@groupviz/react'

const VB = { width: 860, height: 520 }
const CT = { x: 40, y: 40, scale: 1 }
const CARD_BG = '#0b1220'

// ── 群选择（全部经 dist-pkg core 实测可载入） ──
const GROUP_OPTIONS = [
  { symbol: 'C_{4}', label: 'C₄' },
  { symbol: 'C_{6}', label: 'C₆' },
  { symbol: 'C_{8}', label: 'C₈' },
  { symbol: 'C_{12}', label: 'C₁₂' },
  { symbol: 'D_{4}', label: 'D₄' },
  { symbol: 'D_{6}', label: 'D₆' },
  { symbol: 'S_{3}', label: 'S₃' },
  { symbol: 'S_{4}', label: 'S₄' },
  { symbol: 'A_{4}', label: 'A₄' },
  { symbol: 'A_{5}', label: 'A₅' },
  { symbol: 'V_{4}', label: 'V₄' },
  { symbol: 'Q_{8}', label: 'Q₈' },
] as const

// ── 小控件 ──
function Chk({ checked, onChange, children, testid }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; testid?: string }) {
  return (
    <label data-testid={testid} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#cbd5e1', cursor: 'pointer', userSelect: 'none' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: '#4ecdc4' }} />
      {children}
    </label>
  )
}

function Seg<T extends string>({ value, onChange, options, testid }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; testid?: string }) {
  return (
    <span data-testid={testid} style={{ display: 'inline-flex', borderRadius: 5, overflow: 'hidden', border: '1px solid #334155' }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            fontSize: 11, padding: '2px 8px', cursor: 'pointer', border: 'none',
            background: o.value === value ? '#0e7490' : 'transparent',
            color: o.value === value ? '#fff' : '#94a3b8',
          }}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

function Sel<T extends string>({ value, onChange, options, testid }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; testid?: string }) {
  return (
    <select
      data-testid={testid}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{ fontSize: 11, padding: '2px 4px', background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 4 }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Ctl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, color: '#64748b', minWidth: 64 }}>{label}</span>
      {children}
    </div>
  )
}

function Card({ testid, title, tag, controls, children }: { testid: string; title: string; tag?: string; controls?: ReactNode; children: ReactNode }) {
  return (
    <section data-testid={testid} style={{ border: '1px solid #1e293b', borderRadius: 10, background: CARD_BG, padding: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 12, color: '#7dd3fc' }}>{title}</h3>
        {tag && <span style={{ fontSize: 10, color: '#64748b' }}>{tag}</span>}
      </div>
      {controls && <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>{controls}</div>}
      {children}
    </section>
  )
}

function Frame({ h, children, bg }: { h: number; children: ReactNode; bg?: string }) {
  return (
    <div style={{ position: 'relative', height: h, border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden', background: bg ?? CARD_BG }}>
      {children}
    </div>
  )
}

function EmptyHint() {
  return <div style={{ fontSize: 11, color: '#f87171', padding: 8 }}>群未载入 — 切群后再试</div>
}

// 稳定空选择集：避免每次渲染新建 Set 触发 Scene 内部 effect
const EMPTY_SEL = new Set<string>()

// ── 场景卡片（每个自持控件态，独立 re-render） ──

function SetCard({ group }: { group: Group | null }) {
  const [labels, setLabels] = useState(true)
  const [cols, setCols] = useState<'auto' | '2' | '5' | '9'>('auto')
  const [radius, setRadius] = useState<'20' | '28' | '44'>('28')
  return (
    <Card testid="pkg-set" title="SetView ← @groupviz/react" tag="元素集合 · 网格布局"
      controls={<>
        <Ctl label="columns"><Seg value={cols} onChange={setCols} options={[{ value: 'auto', label: 'auto' }, { value: '2', label: '2' }, { value: '5', label: '5' }, { value: '9', label: '9' }]} testid="pkg-set-cols" /></Ctl>
        <Ctl label="nodeRadius"><Seg value={radius} onChange={setRadius} options={[{ value: '20', label: '小' }, { value: '28', label: '中' }, { value: '44', label: '大' }]} /></Ctl>
        <Chk checked={labels} onChange={setLabels} testid="pkg-set-labels">标签</Chk>
      </>}>
      {group
        ? <SetView group={group} selectedElements={EMPTY_SEL} canvasTransform={CT} viewBoxSize={VB}
            showLabels={labels} columns={cols === 'auto' ? undefined : Number(cols)} nodeRadius={Number(radius)} />
        : <EmptyHint />}
    </Card>
  )
}

function CycleCard({ group }: { group: Group | null }) {
  const [labels, setLabels] = useState(true)
  const [maximal, setMaximal] = useState(false)
  return (
    <Card testid="pkg-cycle" title="CycleView ← @groupviz/react" tag="循环子群花瓣"
      controls={<>
        <Chk checked={maximal} onChange={setMaximal} testid="pkg-cycle-max">仅极大循环</Chk>
        <Chk checked={labels} onChange={setLabels} testid="pkg-cycle-labels">标签</Chk>
      </>}>
      {group
        ? <CycleView group={group} selectedElements={EMPTY_SEL} canvasTransform={CT} viewBoxSize={VB}
            showMaximalCycles={maximal} showLabels={labels} />
        : <EmptyHint />}
    </Card>
  )
}

function CayleyCard({ group }: { group: Group | null }) {
  type Shape = 'circular' | 'spiral' | 'dualRing' | 'grid' | 'ringGrid' | 'cylinder' | 'torus'
  const [shape, setShape] = useState<Shape>('circular')
  const [labels, setLabels] = useState(true)
  const [mtype, setMtype] = useState<'right' | 'left'>('right')
  return (
    <Card testid="pkg-cayley" title="CayleyView ← @groupviz/react" tag="生成元有向边 · 形状/左右乘"
      controls={<>
        <Ctl label="shape2D">
          <Sel value={shape} onChange={setShape} testid="pkg-cayley-shape"
            options={[
              { value: 'circular', label: 'circular' }, { value: 'spiral', label: 'spiral' },
              { value: 'dualRing', label: 'dualRing' }, { value: 'grid', label: 'grid' },
              { value: 'ringGrid', label: 'ringGrid' }, { value: 'cylinder', label: 'cylinder' },
              { value: 'torus', label: 'torus' },
            ]} />
        </Ctl>
        <Ctl label="multiplyType"><Seg value={mtype} onChange={setMtype} options={[{ value: 'right', label: 'a·c' }, { value: 'left', label: 'c·a' }]} testid="pkg-cayley-mul" /></Ctl>
        <Chk checked={labels} onChange={setLabels} testid="pkg-cayley-labels">标签</Chk>
      </>}>
      {group
        ? <CayleyView group={group} selectedElements={EMPTY_SEL} canvasTransform={CT} viewBoxSize={VB}
            shape2D={shape} multiplyType={mtype} showLabels={labels} />
        : <EmptyHint />}
    </Card>
  )
}

function TableCard({ group }: { group: Group | null }) {
  type Strategy = 'subgroup' | 'random' | 'full'
  const [strategy, setStrategy] = useState<Strategy>('subgroup')
  const [heat, setHeat] = useState(false)
  const [force, setForce] = useState(true)
  return (
    <Card testid="pkg-table" title="TableView ← @groupviz/react" tag="乘法表 · >16 阶大群策略"
      controls={<>
        <Ctl label="strategy"><Seg value={strategy} onChange={setStrategy} testid="pkg-table-strategy" options={[{ value: 'subgroup', label: 'subgroup' }, { value: 'random', label: 'random' }, { value: 'full', label: 'full' }]} /></Ctl>
        <Chk checked={force} onChange={setForce}>解除大群告警</Chk>
        <Chk checked={heat} onChange={setHeat} testid="pkg-table-heat">热力图</Chk>
      </>}>
      {group
        ? <Frame h={280}><TableView group={group} selectedElements={EMPTY_SEL} canvasTransform={CT} viewBoxSize={VB}
            strategy={strategy} showHeatmap={heat} forceShowLargeGroup={force} cellSize={46} /></Frame>
        : <EmptyHint />}
    </Card>
  )
}

// S₃ 对非正规 H=⟨s⟩（2 阶反射）的左右陪集对照：cosetType 是 ViewWindow 壳层参数，
// 包 Scene 只吃宿主算好的 cosetElementMap——同一 Scene 喂不同分区渲染不同布局。
// Scene 以「含恒等元的陪集」为 H（画 ⟨H⟩ 凯莱圈），本数据恒使 e 所在陪集 = H。
function CosetCard() {
  const s3 = useMemo(() => createGroupFromSymbol('S_{3}')!, [])
  const [side, setSide] = useState<'right' | 'left'>('right')
  const [labels, setLabels] = useState(true)
  const [hCayley, setHCayley] = useState(true)
  const { map, cosetCount } = useMemo(() => {
    const e = s3.identity
    // 首个非单位自逆元素 → 2 阶反射 s；⟨s⟩ 非正规 → 左右陪集分区不同
    const h = s3.elements.find((x: GroupElement) => x.id !== e.id && s3.multiply(x, x).id === e.id)!
    const H = [e, h]
    const keyOf = (g: GroupElement) =>
      H.map((x: GroupElement) => (side === 'right' ? s3.multiply(x, g) : s3.multiply(g, x)))
        .map(el => el.id).sort().join(',')
    const byKey = new Map<string, number>()
    const m = new Map<string, number>()
    s3.elements.forEach((g: GroupElement) => {
      const k = keyOf(g)
      let ci = byKey.get(k)
      if (ci === undefined) { ci = byKey.size; byKey.set(k, ci) }
      m.set(g.id, ci)
    })
    return { map: m, cosetCount: byKey.size }
  }, [s3, side])
  return (
    <Card testid="pkg-cosetstrip" title="CosetStripScene ← @groupviz/react"
      tag={`S₃ / H=⟨s⟩ 非正规 · ${side} 陪集 ×${cosetCount} · 数据宿主算好喂入`}
      controls={<>
        <Ctl label="side"><Seg value={side} onChange={setSide} testid="pkg-coset-side" options={[{ value: 'right', label: '右 H·g' }, { value: 'left', label: '左 g·H' }]} /></Ctl>
        <Chk checked={labels} onChange={setLabels}>节点标签</Chk>
        <Chk checked={hCayley} onChange={setHCayley} testid="pkg-coset-hcayley">H 凯莱圈</Chk>
      </>}>
      <CosetStripScene group={s3} viewBoxSize={VB} cosetElementMap={map} cosetColors={['#4ecdc4', '#ff6b6b', '#ffd93d']}
        showLabels={labels} showSubgroupCayley={hCayley} />
    </Card>
  )
}

function ActionCard() {
  const s3 = useMemo(() => createGroupFromSymbol('S_{3}')!, [])
  const [kind, setKind] = useState<'conjugation' | 'regular'>('conjugation')
  const [labels, setLabels] = useState(true)
  const computation = useMemo(
    () => buildActionComputation(s3, { kind }).computation ?? null,
    [s3, kind],
  )
  return (
    <Card testid="pkg-action" title="ActionScene ← @groupviz/react" tag={`S₃ · ${kind} · computation 宿主算好喂入`}
      controls={<>
        <Ctl label="kind"><Seg value={kind} onChange={setKind} testid="pkg-action-kind" options={[{ value: 'conjugation', label: 'conjugation' }, { value: 'regular', label: 'regular' }]} /></Ctl>
        <Chk checked={labels} onChange={setLabels}>标签/chips</Chk>
      </>}>
      <Frame h={280}>
        <ActionScene group={s3} kind={kind} computation={computation} canvasTransform={CT} viewBoxSize={VB} showLabels={labels} />
      </Frame>
    </Card>
  )
}

function HomoCard() {
  const fixtures = useMemo(() => {
    const c6 = createGroupFromSymbol('C_{6}')!
    const c2 = createGroupFromSymbol('C_{2}')!
    const g = c6.generators[0].apply(c6.identity)
    const r = c2.generators[0].apply(c2.identity)
    const proj = new Map<string, string>()
    let cur = c6.identity
    for (let k = 0; k < c6.order; k++) {
      proj.set(cur.id, k % 2 === 0 ? c2.identity.id : r.id)
      cur = c6.multiply(cur, g)
    }
    const s3 = createGroupFromSymbol('S_{3}')!
    const idMap = new Map(s3.elements.map((el: GroupElement) => [el.id, el.id]))
    return {
      proj: { source: c6, target: c2, map: proj, tag: 'C₆→C₂ 自然投影 mod 2' },
      id: { source: s3, target: s3, map: idMap, tag: 'S₃→S₃ 恒等' },
    }
  }, [])
  const [fixture, setFixture] = useState<'proj' | 'id'>('proj')
  const [labels, setLabels] = useState(true)
  const f = fixtures[fixture]
  return (
    <Card testid="pkg-homo" title="HomomorphismScene ← @groupviz/react" tag={f.tag}
      controls={<>
        <Ctl label="fixture"><Seg value={fixture} onChange={setFixture} testid="pkg-homo-fixture" options={[{ value: 'proj', label: 'C₆→C₂' }, { value: 'id', label: 'S₃→S₃' }]} /></Ctl>
        <Chk checked={labels} onChange={setLabels}>标签</Chk>
      </>}>
      <Frame h={250}>
        <HomomorphismScene source={f.source} target={f.target} mapping={f.map} showLabels={labels} />
      </Frame>
    </Card>
  )
}

function LatticeCard({ group }: { group: Group | null }) {
  type Detail = 'auto' | 'full' | 'compact' | 'dots'
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [detail, setDetail] = useState<Detail>('auto')
  const [merge, setMerge] = useState(false)
  const [series, setSeries] = useState(false)
  return (
    <Card testid="pkg-sublattice" title="SublatticeScene ← @groupviz/react" tag={`theme=${theme} · LOD/合并/子群列`}
      controls={<>
        <Ctl label="theme"><Seg value={theme} onChange={setTheme} testid="pkg-lat-theme" options={[{ value: 'dark', label: 'dark' }, { value: 'light', label: 'light' }]} /></Ctl>
        <Ctl label="labelDetail"><Seg value={detail} onChange={setDetail} options={[{ value: 'auto', label: 'auto' }, { value: 'full', label: 'full' }, { value: 'compact', label: 'compact' }, { value: 'dots', label: 'dots' }]} testid="pkg-lat-detail" /></Ctl>
        <Chk checked={merge} onChange={setMerge} testid="pkg-lat-merge">共轭合并</Chk>
        <Chk checked={series} onChange={setSeries}>子群列面板</Chk>
      </>}>
      {group
        ? <Frame h={320} bg={theme === 'light' ? '#f8fafc' : undefined}><SublatticeScene group={group} canvasTransform={CT}
            theme={theme} labelDetail={detail} mergeConjugates={merge} showSeriesPanel={series} /></Frame>
        : <EmptyHint />}
    </Card>
  )
}

function Cayley3DCard({ group }: { group: Group | null }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [auto, setAuto] = useState(false)
  const [layout, setLayout] = useState<'cone' | 'hexagon' | 'cube' | 'torus' | 'hypercube' | 'truncatedIcosahedron'>('cone')
  return (
    <Card testid="pkg-cayley3d" title="Cayley3DScene ← @groupviz/react" tag={`theme=${theme} · layout3D 显式`}
      controls={<>
        <Ctl label="theme"><Seg value={theme} onChange={setTheme} testid="pkg-3d-theme" options={[{ value: 'dark', label: 'dark' }, { value: 'light', label: 'light' }]} /></Ctl>
        <Ctl label="layout3D">
          <Sel value={layout} onChange={setLayout} testid="pkg-3d-layout"
            options={[
              { value: 'cone', label: 'cone' }, { value: 'hexagon', label: 'hexagon' }, { value: 'cube', label: 'cube' },
              { value: 'torus', label: 'torus' }, { value: 'hypercube', label: 'hypercube' }, { value: 'truncatedIcosahedron', label: 'truncIcosa' },
            ]} />
        </Ctl>
        <Chk checked={auto} onChange={setAuto}>autoRotate</Chk>
      </>}>
      {group
        ? <Frame h={280}><Cayley3DScene group={group} selectedElements={EMPTY_SEL} theme={theme}
            autoRotate={auto} layout3D={layout} /></Frame>
        : <EmptyHint />}
    </Card>
  )
}

function SymmetryCard({ group }: { group: Group | null }) {
  const [dark, setDark] = useState(true)
  const [variant, setVariant] = useState(false)
  const [showAction, setShowAction] = useState(false)
  const [locked, setLocked] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  // 演示元素候选 = 非恒等元素；群切换后旧 actionId 失效 → 受控回退到首个候选
  const demoEls = useMemo(() => {
    if (!group) return []
    return group.elements.filter((el: GroupElement) => el.id !== group.identity.id)
  }, [group])
  const effActionId = demoEls.some((el: GroupElement) => el.id === actionId) ? actionId : (demoEls[0]?.id ?? null)
  return (
    <Card testid="pkg-symmetry" title="SymmetryViewScene ← @groupviz/react"
      tag={`${dark ? 'dark' : 'light'} · variant=${variant} · 演示${showAction ? ' on' : ' off'}${locked ? ' · 锁相机' : ''}`}
      controls={<>
        <Chk checked={dark} onChange={setDark} testid="pkg-sym-dark">深色场景</Chk>
        <Chk checked={variant} onChange={setVariant} testid="pkg-sym-variant">对偶多面体</Chk>
        <Chk checked={showAction} onChange={setShowAction} testid="pkg-sym-action">演示动画</Chk>
        <Chk checked={locked} onChange={setLocked}>锁定相机</Chk>
        <Ctl label="演示元素">
          <Sel value={effActionId ?? ''} onChange={(v) => setActionId(v || null)} testid="pkg-sym-element"
            options={demoEls.map((el: GroupElement) => ({ value: el.id, label: el.label }))} />
        </Ctl>
      </>}>
      {group
        ? <Frame h={280}><SymmetryViewScene group={group} dark={dark} variant={variant} showAction={showAction}
            actionElementId={effActionId} locked={locked} showFigureTitle={false} /></Frame>
        : <EmptyHint />}
    </Card>
  )
}

// ── SceneWindow 窗口壳能力参数化演示（@groupviz/react 新 export） ──
function ShellDemoCard({ group }: { group: Group | null }) {
  const [shell, setShell] = useState<'chrome' | 'none'>('chrome')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [preset, setPreset] = useState<'full' | 'bare' | 'read'>('full')
  const caps = preset === 'full' ? undefined
    : preset === 'bare'
      ? { lockMove: false, toggleInfo: false, params: false } // 拖拽/缩放/关闭保留
      : { drag: false, resize: false, lockMove: false, toggleInfo: false, params: false, persist: false } // 阅读：只标题+关闭
  return (
    <section data-testid="pkg-shell" style={{ border: '1px solid #1e293b', borderRadius: 10, background: '#0b1220', padding: 10, marginTop: 14 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6, alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: 12, color: '#7dd3fc' }}>SceneWindow ← @groupviz/react</h3>
        <span data-testid="pkg-shell-tag" style={{ fontSize: 10, color: '#64748b' }}>
          shell={shell} · caps={preset} · theme={theme} · persist key 固定（拖窗/⚙ 后刷新可验持久化）
        </span>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 8 }}>
        <Ctl label="shell"><Seg value={shell} onChange={setShell} testid="pkg-shell-shell" options={[{ value: 'chrome', label: 'chrome' }, { value: 'none', label: 'none' }]} /></Ctl>
        <Ctl label="theme"><Seg value={theme} onChange={setTheme} testid="pkg-shell-theme" options={[{ value: 'dark', label: 'dark' }, { value: 'light', label: 'light' }]} /></Ctl>
        <Ctl label="capabilities"><Seg value={preset} onChange={setPreset} testid="pkg-shell-caps" options={[{ value: 'full', label: 'full 全开' }, { value: 'bare', label: 'bare 无⚙锁' }, { value: 'read', label: 'read 阅读态' }]} /></Ctl>
      </div>
      <div style={{ position: 'relative', height: 430, overflow: 'hidden', border: '1px dashed #334155', borderRadius: 8, background: theme === 'light' ? '#e8edf4' : '#060b16' }}>
        {group && (
          <SceneWindow title={`CayleyView 壳演示 · ${group.symbol}`} group={group} theme={theme} shell={shell}
            capabilities={caps} storageKey="pkg-shell-demo"
            defaultPosition={{ x: 14, y: 14 }} defaultSize={{ width: 540, height: 372 }}>
            <CayleyView group={group} selectedElements={EMPTY_SEL} canvasTransform={CT} viewBoxSize={{ width: 540, height: 338 }} showLabels />
          </SceneWindow>
        )}
      </div>
    </section>
  )
}

// 页面级 runtime 哨兵：任何未捕获 pageerror/rejection 红字上抛（Playwright 亦可断言）
function usePageErrors() {
  const [errs, setErrs] = useState<string[]>([])
  useEffect(() => {
    const onErr = (e: ErrorEvent) => setErrs(l => [...l.slice(-4), `pageerror: ${e.message}`])
    const onRej = (e: PromiseRejectionEvent) => setErrs(l => [...l.slice(-4), `rejection: ${String(e.reason).slice(0, 160)}`])
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }
  }, [])
  return errs
}

export default function TestPagePkgConsume() {
  const [symbol, setSymbol] = useState<string>(GROUP_OPTIONS[0].symbol)
  const group: Group | null = useMemo(() => createGroupFromSymbol(symbol), [symbol])
  const errors = usePageErrors()

  return (
    <I18nProvider>
      <div data-testid="pkg-page" data-theme="dark"
        style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '18px 22px 60px', fontFamily: 'system-ui, sans-serif' }}>
        {/* ── 页头：群切换（同步驱动所有共享群卡片） ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 16, color: '#e2e8f0' }}>🧩 双包消费参数矩阵</h1>
          <span style={{ fontSize: 11, color: '#64748b' }}>@groupviz/core + @groupviz/react（dist-pkg 产物，非 src）· 10/10 Scene 入包</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
          <select
            data-testid="pkg-group-select"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            aria-label="pkg 切群"
            style={{ padding: '3px 8px', fontSize: 13, background: '#1e293b', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 6 }}
          >
            {GROUP_OPTIONS.map(o => <option key={o.symbol} value={o.symbol}>{o.label}</option>)}
          </select>
          <span data-testid="pkg-group-label" style={{ fontSize: 12, color: '#94a3b8' }}>
            {group ? `${group.symbol} · |G|=${group.order} · ${group.name ?? ''}` : `群未载入（${symbol}）`}
          </span>
        </div>
        <div data-testid="pkg-errors" style={{ fontSize: 11, marginBottom: 12 }}>
          {errors.length === 0
            ? <span style={{ color: '#4ade80' }}>✓ 无未捕获 runtime error</span>
            : <span style={{ color: '#f87171', display: 'block' }}>✗ {errors.join(' | ')}</span>}
        </div>

        {/* ── 场景矩阵 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))', gap: 12, alignItems: 'start' }}>
          <SetCard group={group} />
          <CycleCard group={group} />
          <CayleyCard group={group} />
          <TableCard group={group} />
          <CosetCard />
          <ActionCard />
          <HomoCard />
          <LatticeCard group={group} />
          <Cayley3DCard group={group} />
          <SymmetryCard group={group} />
        </div>

        <ShellDemoCard group={group} />

        <p style={{ fontSize: 11, color: '#64748b', marginTop: 16, maxWidth: 1000, lineHeight: 1.7 }}>
          覆盖：columns 极值 / nodeRadius 三档 / 标签开关（Set/Cycle/Cayley/Coset/Homo）/
          shape2D 7 形状 + multiplyType 左右乘 / table strategy 三档 + 热力图 + 大群告警 /
          action kind（conjugation/regular）/ 同态双 fixture / labelDetail LOD 四档 + 共轭合并 + 子群列 +
          sublattice theme dark/light 对照 / Cayley3D theme + layout3D + autoRotate /
          Symmetry dark + variant + 演示动画（元素受控）+ 锁定相机。群 select 切 12 群同步重渲所有共享群卡片：
          C₈ 八边形 / A₅ 二十面体（60 阶）验证大群对称演示，Q₈ 用于 Symmetry unsupported overlay。
          cosetType（左右乘）属 ViewWindow 壳层参数——包 Scene 中立，上卡以非正规 ⟨s⟩ 数据演示左右分区差异。
          改动包源码后先 npm run build:pkg。
        </p>
      </div>
    </I18nProvider>
  )
}
