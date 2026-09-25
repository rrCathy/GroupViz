/**
 * TestPagePkgConsume — /?test=1 页面主体（TestPage 懒加载）。
 *
 * 2026-09-23 清空改写：本页改为**本次开发内容的消费矩阵** —— VCL
 * B1–B3（3D 球壳/纬度环/重排）+ F1–F4（共轭类着色/阶徽标/⟨g⟩ 高亮/中心·正规子群标记）
 * + E2–E4（自动图例/打印单色+虚线/边线宽+箭头）。
 *
 * 全部 Scene 直接吃 **dist-pkg 产物**（vite alias @groupviz/core·@groupviz/react →
 * dist-pkg），日常打开 ?test=1 即对这批新控件做参数级回归。改动 src/core / Scene /
 * src/package 后需先 `npm run build:pkg` 再刷新本页。
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  createGroupFromSymbol, getAvailableShapes3D, wordLengthSphereActions, TORUS_HEX_STAR_GENERATORS,
  type Group, type Layout3D,
} from '@groupviz/core'
import { CayleyView, Cayley3DScene, I18nProvider } from '@groupviz/react'

const VB = { width: 860, height: 520 }
const CT = { x: 40, y: 40, scale: 1 }
const CARD_BG = '#0b1220'
// 稳定空选择集：避免每次渲染新建 Set 触发 Scene 内部 effect
const EMPTY_SEL = new Set<string>()

// ── 群选择（全部经 dist-pkg core 实测可载入；前几个最能体现本次 VCL 特性） ──
const GROUP_OPTIONS = [
  { symbol: 'S_{4}', label: 'S₄' },     // 5 共轭类 · 正规 V₄ · 3D 字长球
  { symbol: 'S_{3}', label: 'S₃' },     // 3 共轭类 · 正规 A₃ · 中心平凡
  { symbol: 'D_{4}', label: 'D₄' },     // 中心 {e, r²}
  { symbol: 'A_{4}', label: 'A₄' },     // 正规 V₄
  { symbol: 'Q_{8}', label: 'Q₈' },     // 中心 {±1}
  { symbol: 'C_{6}', label: 'C₆' },     // 交换群：共轭类全单元素 / Z(G)=G
  { symbol: 'C_{4}', label: 'C₄' },
  { symbol: 'C_{8}', label: 'C₈' },
  { symbol: 'C_{12}', label: 'C₁₂' },
  { symbol: 'D_{6}', label: 'D₆' },
  { symbol: 'D_{7}', label: 'D₇' },
  { symbol: 'A_{5}', label: 'A₅' },     // 单群：markNormalSubgroup 无 N ⇒ 不画
  { symbol: 'V_{4}', label: 'V₄' },     // 交换群
] as const

const normSym = (s: string) => s.replace(/[{}]/g, '')

/**
 * 多面体形状的「专属作用边」—— 与主应用 `context/cayleyActions.getSpecialCayleyActions`
 * 同源（S₄ 各多面体布局的生成元集互不相同）。**包未向消费端导出该 helper**，故此页内联；
 * 不套用它、直接喂群默认生成元，这些形状的边会横跨整个多面体（最大边 ≈ 外接球直径）→ 视觉上「乱」。
 * 实测（S₄ 24 阶，max 边长 / 外接球直径）：默认 vs 专属 —— truncatedCube .54→.39、
 * rhombicuboctahedron .96→.41、truncatedOctahedron3 .77→.32、torusHex .95→.51、wordLengthSphere .85→.42；
 * truncatedOctahedron2 的专属集恰等于默认集（故它本来就不乱）。
 */
const SHAPE_SPECIAL_ACTIONS: Record<string, Partial<Record<Layout3D, readonly string[]>>> = {
  S_4: {
    torusHex: TORUS_HEX_STAR_GENERATORS,
    rhombicuboctahedron: ['4,1,2,3', '3,1,2,4'],
    truncatedOctahedron2: ['2,3,4,1', '2,1,3,4'],
    truncatedCube: ['1,4,2,3', '2,1,3,4'],
    truncatedOctahedron3: ['2,1,3,4', '1,3,2,4', '1,2,4,3'],
  },
  A_5: {
    truncatedIcosahedron: ['2,3,4,5,1', '2,1,4,3,5'],
    truncatedDodecahedron: ['2,3,1,4,5', '1,5,4,3,2'],
  },
}

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

const MINI: React.CSSProperties = {
  fontSize: 11, padding: '2px 8px', cursor: 'pointer', borderRadius: 6,
  border: '1px solid #334155', background: '#1e293b', color: '#cbd5e1',
}

/** 生成元作用元素（elementId + 标签）：2D/3D 的 actions 源 */
function useGenRefs(group: Group | null) {
  return useMemo(() => {
    if (!group) return [] as { elementId: string; label: string }[]
    const seen = new Set<string>()
    const out: { elementId: string; label: string }[] = []
    for (const gen of group.generators) {
      const el = gen.apply(group.identity)
      if (!el || seen.has(el.id)) continue
      seen.add(el.id)
      out.push({ elementId: el.id, label: el.label })
    }
    return out
  }, [group])
}

// ── 卡片 1：2D 语义装饰（F1–F4） ──
function CayleySemanticCard({ group }: { group: Group | null }) {
  const [colorMode, setColorMode] = useState<'none' | 'conjugacy'>('conjugacy')
  const [orderBadge, setOrderBadge] = useState(true)
  const [genHighlight, setGenHighlight] = useState(true)
  const [markCenter, setMarkCenter] = useState(false)
  const [markNormal, setMarkNormal] = useState(false)
  const [labels, setLabels] = useState(true)
  // F3 需要选中元素：点节点选中/取消（单选，与主画布语义一致）
  const [sel, setSel] = useState<Set<string>>(EMPTY_SEL)
  const onSelect = (id: string) => setSel(prev => (prev.has(id) ? new Set() : new Set([id])))

  const selCount = sel.size
  return (
    <Card testid="pkg-cayley-f" title="CayleyView · 2D 语义装饰（F1–F4）"
      tag={`nodeColorMode=${colorMode} · 阶徽标 ${orderBadge ? 'on' : 'off'} · 选中 ${selCount} 个元素${genHighlight && selCount > 0 ? '（⟨g⟩ 已高亮）' : ''}`}
      controls={<>
        <Ctl label="nodeColor"><Seg value={colorMode} onChange={setColorMode} testid="pkg-cf-color"
          options={[{ value: 'none', label: 'Theme' }, { value: 'conjugacy', label: 'Conjugacy' }]} /></Ctl>
        <Chk checked={orderBadge} onChange={setOrderBadge} testid="pkg-cf-order">F2 阶徽标</Chk>
        <Chk checked={genHighlight} onChange={setGenHighlight} testid="pkg-cf-gen">F3 ⟨g⟩ 高亮</Chk>
        <Chk checked={markCenter} onChange={setMarkCenter} testid="pkg-cf-center">F4 中心 Z(G)</Chk>
        <Chk checked={markNormal} onChange={setMarkNormal} testid="pkg-cf-normal">F4 正规子群 N</Chk>
        <Chk checked={labels} onChange={setLabels} testid="pkg-cf-labels">标签</Chk>
      </>}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>
        F1 共轭类一键着色（交换群退化为单元素类）· F2 阶徽标 · F3 点节点选中后高亮其 ⟨g⟩ · F4 中心双环 / 最小正规子群虚线环
      </div>
      {group
        ? <Frame h={430}><CayleyView group={group} selectedElements={sel} onSelect={onSelect}
            canvasTransform={CT} viewBoxSize={VB} showLabels={labels}
            nodeColorMode={colorMode} showOrderBadge={orderBadge} highlightGenerated={genHighlight}
            markCenter={markCenter} markNormalSubgroup={markNormal} /></Frame>
        : <EmptyHint />}
    </Card>
  )
}

// ── 卡片 2：2D 边样式与图例（E2–E4） ──
function CayleyEdgeCard({ group }: { group: Group | null }) {
  const genRefs = useGenRefs(group)
  const [printPalette, setPrintPalette] = useState(false)
  const [width, setWidth] = useState(1)
  const [arrows, setArrows] = useState(true)
  const [legend, setLegend] = useState(true)
  const [dashSet, setDashSet] = useState<Set<string>>(EMPTY_SEL)
  const [offSet, setOffSet] = useState<Set<string>>(EMPTY_SEL)

  const toggleDash = (id: string) => setDashSet(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  // 图例点击 = 切换该生成元边的显隐（E2）
  const toggleEnabled = (id: string) => setOffSet(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const actions = useMemo(
    () => genRefs.map(g => ({ elementId: g.elementId, enabled: !offSet.has(g.elementId), dash: dashSet.has(g.elementId) })),
    [genRefs, offSet, dashSet],
  )
  const dashCount = dashSet.size

  return (
    <Card testid="pkg-cayley-e" title="CayleyView · 2D 边样式与图例（E2–E4）"
      tag={`printPalette=${printPalette ? 'on' : 'off'} · 线宽 ${width.toFixed(1)}× · 箭头 ${arrows ? 'on' : 'off'} · 虚线 ${dashCount} 条`}
      controls={<>
        <Chk checked={printPalette} onChange={setPrintPalette} testid="pkg-ce-print">E3 打印/单色</Chk>
        <Chk checked={arrows} onChange={setArrows} testid="pkg-ce-arrows">E4 箭头</Chk>
        <Chk checked={legend} onChange={setLegend} testid="pkg-ce-legend">E2 图例</Chk>
        <Ctl label="edgeWidth">
          <input type="range" min={0.4} max={3} step={0.1} value={width} data-testid="pkg-ce-width"
            onChange={(e) => setWidth(Number(e.target.value))} style={{ width: 96 }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>{width.toFixed(1)}×</span>
        </Ctl>
        <Ctl label="逐生成元虚线（E3）">
          {genRefs.length === 0
            ? <span style={{ fontSize: 10, color: '#475569' }}>（换群后出现）</span>
            : genRefs.map(g => (
              <button key={g.elementId} data-testid={`pkg-ce-dash-${g.elementId}`} onClick={() => toggleDash(g.elementId)}
                title="切换这条生成元边的虚实"
                style={{ ...MINI, color: dashSet.has(g.elementId) ? '#4ecdc4' : '#94a3b8' }}>
                {g.label} {dashSet.has(g.elementId) ? '· · ·' : '——'}
              </button>
            ))}
        </Ctl>
      </>}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>
        E2 生成元图例（点色块行 = 切换该生成元边显隐）· E3 printPalette 全体同色+线型区分 / 逐生成元虚线 · E4 边线宽 / 箭头开关
      </div>
      {group
        ? <Frame h={400}><CayleyView group={group} selectedElements={EMPTY_SEL}
            canvasTransform={CT} viewBoxSize={VB} showLabels
            actions={actions} onToggleAction={toggleEnabled}
            printPalette={printPalette} edgeWidthScale={width} showArrows={arrows} showLegend={legend} /></Frame>
        : <EmptyHint />}
    </Card>
  )
}

// ── 卡片 3：3D 渲染开关 + 语义（B1–B3 / F1–F2） ──
function Cayley3DVclCard({ group }: { group: Group | null }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [layout, setLayout] = useState<Layout3D | null>(null)
  const [shell, setShell] = useState(true)
  const [layerRings, setLayerRings] = useState(false)
  const [relayout, setRelayout] = useState(0)
  const [colorMode, setColorMode] = useState<'none' | 'conjugacy'>('conjugacy')
  const [orderBadge, setOrderBadge] = useState(false)

  const genRefs = useGenRefs(group)
  const shapes3d = useMemo<Layout3D[]>(() => (group ? getAvailableShapes3D(group) : []), [group])
  // 缺省优先字长球（B 组开关仅对它生效）
  const layoutValue: Layout3D = (layout && shapes3d.includes(layout))
    ? layout
    : (shapes3d.includes('wordLengthSphere') ? 'wordLengthSphere' : (shapes3d[0] ?? 'cone'))
  const isWordLength = layoutValue === 'wordLengthSphere'

  // 作用边：字长球 → 相邻对换；S₄/A₅ 多面体 → 该形状专属生成集；其余 → 群默认生成元
  const specialIds = useMemo(() => {
    if (!group) return null
    if (isWordLength) return wordLengthSphereActions(group)?.map(a => a.elementId) ?? null
    return SHAPE_SPECIAL_ACTIONS[normSym(group.symbol)]?.[layoutValue] ?? null
  }, [group, isWordLength, layoutValue])
  const actionSource = specialIds ? `形状专属（${specialIds.length} 条）` : '群默认生成元'
  const actions = useMemo(
    () => specialIds
      ? specialIds.map(elementId => ({ elementId }))
      : genRefs.map(g => ({ elementId: g.elementId })),
    [specialIds, genRefs],
  )

  return (
    <Card testid="pkg-cayley3d-f" title="Cayley3DScene · B 组渲染开关 + F 组语义"
      tag={`layout3D=${layoutValue} · 边=${actionSource} · shell=${shell ? 'on' : 'off'} · 纬度环 ${layerRings ? 'on' : 'off'} · relayout ${relayout}× · nodeColor=${colorMode}`}
      controls={<>
        <Ctl label="theme"><Seg value={theme} onChange={setTheme} testid="pkg-c3-theme"
          options={[{ value: 'dark', label: 'dark' }, { value: 'light', label: 'light' }]} /></Ctl>
        <Ctl label="layout3D"><Sel value={layoutValue} onChange={(v) => setLayout(v)} testid="pkg-c3-layout"
          options={shapes3d.map(s => ({ value: s, label: s }))} /></Ctl>
        <Chk checked={shell} onChange={setShell} testid="pkg-c3-shell">B1 球壳</Chk>
        <Chk checked={layerRings} onChange={setLayerRings} testid="pkg-c3-rings">B2 纬度环</Chk>
        <button style={MINI} data-testid="pkg-c3-relayout" onClick={() => setRelayout(n => n + 1)}
          title="自增即再松弛 N 轮（不改形状语义）">B3 ⟳ 重新优化{relayout > 0 ? ` (${relayout}×)` : ''}</button>
        <Ctl label="nodeColor"><Seg value={colorMode} onChange={setColorMode} testid="pkg-c3-color"
          options={[{ value: 'none', label: 'Theme' }, { value: 'conjugacy', label: 'Conjugacy' }]} /></Ctl>
        <Chk checked={orderBadge} onChange={setOrderBadge} testid="pkg-c3-order">F2 阶→球径</Chk>
      </>}>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>
        B1 球壳开关 / B2 纬度层环 / B3 重新优化布局 —— 三者仅 `wordLengthSphere` 布局生效（当前{isWordLength ? '已' : '未'}选中）。
        F1 共轭类着色覆盖默认配色 · F2 阶→球径 + 悬停标签附阶数。
        <br />作用边 = <b>{actionSource}</b>：S₄/A₅ 的多面体形状（truncatedCube / rhombicuboctahedron / truncatedOctahedron3 / torusHex / 字长球）各有专属生成元集，
        <b>不套用会让边横跨整个多面体</b>（与主应用 `getSpecialCayleyActions` 同源）。
      </div>
      {group
        ? <Frame h={440} bg={theme === 'light' ? '#e8edf4' : undefined}>
            <Cayley3DScene group={group} selectedElements={EMPTY_SEL} theme={theme}
              actions={actions} layout3D={layoutValue}
              shell={shell} layerRings={layerRings} relayoutNonce={relayout}
              nodeColorMode={colorMode} showOrderBadge={orderBadge} />
          </Frame>
        : <EmptyHint />}
    </Card>
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
        {/* ── 页头：群切换（同步驱动三张卡片，切群即重挂载清空卡片本地态） ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 16, color: '#e2e8f0' }}>🧩 VCL 控件消费矩阵（2026-09-23）</h1>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            @groupviz/core + @groupviz/react（dist-pkg 产物，非 src）· B1–B3 / F1–F4 / E2–E4
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
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
          <span style={{ fontSize: 10, color: '#475569' }}>
            （切群 = 三卡以新群重挂载，卡片本地控件态复位）
          </span>
        </div>
        <div data-testid="pkg-errors" style={{ fontSize: 11, marginBottom: 12 }}>
          {errors.length === 0
            ? <span style={{ color: '#4ade80' }}>✓ 无未捕获 runtime error</span>
            : <span style={{ color: '#f87171', display: 'block' }}>✗ {errors.join(' | ')}</span>}
        </div>

        {/* ── 本次开发的控件矩阵 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))', gap: 12, alignItems: 'start' }}>
          <CayleySemanticCard key={`f-${symbol}`} group={group} />
          <CayleyEdgeCard key={`e-${symbol}`} group={group} />
          <Cayley3DVclCard key={`3d-${symbol}`} group={group} />
        </div>

        <p style={{ fontSize: 11, color: '#64748b', marginTop: 16, maxWidth: 1000, lineHeight: 1.7 }}>
          覆盖本次开发：<b>F1</b> 共轭类一键着色 <code>nodeColorMode='conjugacy'</code>（交换群 C₆/V₄ 退化为单元素类，数学事实非 bug）·
          <b>F2</b> 元素阶徽标 <code>showOrderBadge</code>（2D 角标 / 3D 阶→球径）·
          <b>F3</b> <code>highlightGenerated</code> 点节点选中 → ⟨g⟩ 循环子群外圈 + 组内边加粗（联动 selection）·
          <b>F4</b> <code>markCenter</code> 中心双环 / <code>markNormalSubgroup</code> 最小正规子群虚线环（A₅ 单群无 N ⇒ 不画）·
          <b>E2</b> <code>showLegend</code> 生成元图例（点行切显隐）·
          <b>E3</b> <code>printPalette</code> 打印单色 + <code>actions[].dash</code> 逐生成元虚线 ·
          <b>E4</b> <code>edgeWidthScale</code> 线宽 / <code>showArrows</code> 箭头 ·
          <b>B1/B2/B3</b> <code>shell</code> / <code>layerRings</code> / <code>relayoutNonce</code>（仅字长球布局；S₄ 默认字长球）。
          改动包源码后先 <code>npm run build:pkg</code>。
        </p>
      </div>
    </I18nProvider>
  )
}
