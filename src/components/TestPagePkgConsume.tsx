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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  createGroupFromSymbol, buildActionComputation, getAvailableShapes3D, getAvailableShapesForView,
  wordLengthSphereActions, resolveElement,
  type Group, type GroupElement, type Layout3D, type CayleyShape2D,
} from '@groupviz/core'
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
  { symbol: 'D_{7}', label: 'D₇' },
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
// 稳定空倍率表（换群未匹配时用；字面量 {} 会破坏 useMemo 依赖稳定性）
const EMPTY_SCALES: Record<string, number> = {}

// ── VCL 示例预设（页头一键复现四个用例；卡片以 key=nonce 重挂载为示例初值） ──
type VclDemoKind = 's3-curve' | 'a4-len' | 's4-ham' | 'd7-force'
interface VclDemo {
  nonce: number
  kind: VclDemoKind
  /** a4-len：按生成元顺序的边长倍率（(12)(34) 拉长 / (234) 缩短） */
  lengthScales?: number[]
  /** s4-ham：算好的哈密顿路径生成元单词（元素引用，空格分隔） */
  pathWord?: string
}

/**
 * 凯莱图上的一条哈密顿路径（覆盖全部元素的生成元单词）。
 * 贪心 + 回溯：每步按 Warnsdorff 启发式（优先访问后继最少的邻居）排序，
 * S₄ 字长球（24 顶点 3-正则）毫秒级命中；步数上限防病态群卡死。
 *
 * **返回生成元的 label**（如 S₄ 的 '12 23 34 …'）而非元素 id：Sₙ 的元素 id 是
 * `2,1,3,4` 这种**含逗号**的形式，会被单词输入框的 `[\s,]+` 分词拆碎，且 label 更好读。
 */
function findHamiltonianWord(group: Group, gens: GroupElement[]): string[] | null {
  if (gens.length === 0) return null
  const n = group.order
  const visited = new Set<string>([group.identity.id])
  const word: string[] = []
  let steps = 0
  const MAX_STEPS = 400_000
  const dfs = (cur: GroupElement): boolean => {
    if (visited.size === n) return true
    if (++steps > MAX_STEPS) return false
    const cands: { el: GroupElement; genRef: string; deg: number }[] = []
    for (const gen of gens) {
      const next = group.multiply(cur, gen)
      if (!next || visited.has(next.id)) continue
      let deg = 0
      for (const h of gens) {
        const nn = group.multiply(next, h)
        if (nn && !visited.has(nn.id)) deg++
      }
      cands.push({ el: next, genRef: gen.label, deg })
    }
    cands.sort((a, b) => a.deg - b.deg)
    for (const c of cands) {
      visited.add(c.el.id)
      word.push(c.genRef)
      if (dfs(c.el)) return true
      visited.delete(c.el.id)
      word.pop()
    }
    return false
  }
  return dfs(group.identity) ? word : null
}

const DEMO_BTN: React.CSSProperties = {
  fontSize: 11, padding: '3px 10px', cursor: 'pointer', borderRadius: 6,
  border: '1px solid #334155', background: '#1e293b', color: '#cbd5e1',
}

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

function CayleyCard({ group, demo }: { group: Group | null; demo: VclDemo | null }) {
  // VCL 示例初值（页头按钮以 key=nonce 重挂载本卡片）：S₃ → 笔直（Straight），D₇ → 力导向
  const preset = demo && (demo.kind === 's3-curve' || demo.kind === 'd7-force') ? demo : null
  const [shape, setShape] = useState<CayleyShape2D>(preset?.kind === 'd7-force' ? 'dualRing' : 'circular')
  const [labels, setLabels] = useState(true)
  const [mtype, setMtype] = useState<'right' | 'left'>('right')
  // VCL：边曲率（0 = 笔直）+ 动态力导向
  const [curvature, setCurvature] = useState(preset?.kind === 's3-curve' ? 0 : 1)
  const [force, setForce] = useState(preset?.kind === 'd7-force')
  const [forceLink, setForceLink] = useState(1)
  const [forceRep, setForceRep] = useState(1)
  const [forceRigid, setForceRigid] = useState(1)
  const [forceGravity, setForceGravity] = useState(1)

  const shapes = useMemo<CayleyShape2D[]>(() => getAvailableShapesForView(group, 'cayley'), [group])
  const shapeValue: CayleyShape2D = shapes.includes(shape) ? shape : (shapes[0] ?? 'circular')

  return (
    <Card testid="pkg-cayley" title="CayleyView ← @groupviz/react" tag="生成元有向边 · 形状/左右乘 · VCL 曲率/力导向"
      controls={<>
        <Ctl label="shape2D">
          <Sel value={shapeValue} onChange={setShape} testid="pkg-cayley-shape"
            options={shapes.map((s) => ({ value: s, label: s }))} />
        </Ctl>
        <Ctl label="multiplyType"><Seg value={mtype} onChange={setMtype} options={[{ value: 'right', label: 'a·c' }, { value: 'left', label: 'c·a' }]} testid="pkg-cayley-mul" /></Ctl>
        <Chk checked={labels} onChange={setLabels} testid="pkg-cayley-labels">标签</Chk>
        <Ctl label="edgeCurvature">
          <input type="range" min={0} max={2} step={0.1} value={curvature}
            data-testid="pkg-cayley-curvature"
            onChange={(e) => setCurvature(Number(e.target.value))} style={{ width: 90 }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>{curvature === 0 ? 'straight' : `${curvature.toFixed(1)}×`}</span>
          <button style={DEMO_BTN} data-testid="pkg-cayley-straight" onClick={() => setCurvature(0)}>Straight</button>
          <button style={DEMO_BTN} data-testid="pkg-cayley-curved" onClick={() => setCurvature(1)}>Curved</button>
        </Ctl>
        <Ctl label="forceDirected">
          <Chk checked={force} onChange={setForce} testid="pkg-cayley-force">力导向</Chk>
          {force && (
            <>
              <span style={{ fontSize: 10, color: '#64748b' }} title="连线长度：边的理想长度倍率，越大整图越舒展">link</span>
              <input type="range" min={0.3} max={3} step={0.1} value={forceLink}
                onChange={(e) => setForceLink(Number(e.target.value))} style={{ width: 70 }} />
              <span style={{ fontSize: 10, color: '#64748b' }} title="节点排斥力：越大越散开、越不易纠缠（远距离自动淡出）">rep</span>
              <input type="range" min={0.2} max={3} step={0.1} value={forceRep}
                onChange={(e) => setForceRep(Number(e.target.value))} style={{ width: 70 }} />
              <span style={{ fontSize: 10, color: '#64748b' }} title="连线刚度：越大越硬，拖拽时局部形状越不易走样（拖拽中自动加强）">rigid</span>
              <input type="range" min={0.4} max={3} step={0.1} value={forceRigid}
                data-testid="pkg-cayley-rigid"
                onChange={(e) => setForceRigid(Number(e.target.value))} style={{ width: 70 }} />
              <span style={{ fontSize: 10, color: '#64748b' }} title="向心力：越大整图越收拢（已按群阶归一，大群不压塌）">center</span>
              <input type="range" min={0} max={3} step={0.1} value={forceGravity}
                onChange={(e) => setForceGravity(Number(e.target.value))} style={{ width: 70 }} />
            </>
          )}
        </Ctl>
      </>}>
      {group
        ? <CayleyView group={group} selectedElements={EMPTY_SEL} canvasTransform={CT} viewBoxSize={VB}
            shape2D={shapeValue} multiplyType={mtype} showLabels={labels}
            edgeCurvature={curvature} forceDirected={force}
            force={force ? { linkScale: forceLink, repulsion: forceRep, stiffness: forceRigid, gravity: forceGravity } : undefined} />
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

function Cayley3DCard({ group, demo }: { group: Group | null; demo: VclDemo | null }) {
  // VCL 示例初值（页头按钮以 key=nonce 重挂载本卡片）：
  // A₄ → 截角四面体 + 逐生成元边长（(12)(34) 拉长 / (234) 缩短）；S₄ → 字长球 + 哈密顿路径
  const preset = demo && (demo.kind === 'a4-len' || demo.kind === 's4-ham') ? demo : null
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [auto, setAuto] = useState(false)
  const [layout, setLayout] = useState<Layout3D>(
    preset?.kind === 'a4-len' ? 'truncatedTetrahedron'
      : preset?.kind === 's4-ham' ? 'wordLengthSphere'
        : 'cone',
  )
  // 换群后旧键失效 → 用「渲染期 key 校正」清空（不在 effect 里同步 setState）
  const gKey = group ? `${group.symbol}|${group.order}` : ''
  const [lenState, setLenState] = useState<{ key: string; map: Record<string, number> }>(() => {
    const map: Record<string, number> = {}
    if (preset?.kind === 'a4-len' && group) {
      group.generators.forEach((gen, i) => {
        const el = gen.apply(group.identity)
        const v = preset.lengthScales?.[i]
        if (el && v !== undefined) map[el.id] = v
      })
    }
    return { key: gKey, map }
  })
  if (lenState.key !== gKey) setLenState({ key: gKey, map: EMPTY_SCALES })
  const lenScales = lenState.key === gKey ? lenState.map : EMPTY_SCALES
  const setLen = (id: string, v: number) => setLenState({ key: gKey, map: { ...lenScales, [id]: v } })
  const [pathState, setPathState] = useState<{ key: string; mode: 'word' | 'elements'; text: string }>(() => ({
    key: gKey, mode: 'word', text: preset?.kind === 's4-ham' ? (preset.pathWord ?? '') : '',
  }))
  if (pathState.key !== gKey) setPathState({ key: gKey, mode: 'word', text: '' })
  const pathMode = pathState.key === gKey ? pathState.mode : 'word'
  const pathText = pathState.key === gKey ? pathState.text : ''

  // 形状下拉按群动态（A₄ → truncatedTetrahedron、S₄ → wordLengthSphere 等）
  const shapes3d = useMemo<Layout3D[]>(() => (group ? getAvailableShapes3D(group) : []), [group])
  const layoutValue: Layout3D = shapes3d.includes(layout) ? layout : (shapes3d[0] ?? 'cone')

  // 生成元作用边（elementId 用生成元作用在恒等元上的元素 id）
  const genRefs = useMemo(() => {
    if (!group) return [] as { id: string; label: string }[]
    const seen = new Set<string>()
    const out: { id: string; label: string }[] = []
    for (const gen of group.generators) {
      const el = gen.apply(group.identity)
      if (!el || seen.has(el.id)) continue
      seen.add(el.id)
      out.push({ id: el.id, label: `${gen.name}: ${el.label}` })
    }
    return out
  }, [group])

  // 字长球布局必须用相邻对换生成集（core 结构判定），否则字长分层不成立
  const wlActions = useMemo(
    () => (group && layoutValue === 'wordLengthSphere' ? wordLengthSphereActions(group) : null),
    [group, layoutValue],
  )
  // 作用边 = 字长球相邻对换（该布局） 或 群生成元（带逐生成元 lengthScale）
  const actions = useMemo(
    () => wlActions ?? genRefs.map((g) => ({ elementId: g.id, lengthScale: lenScales[g.id] ?? 1 })),
    [wlActions, genRefs, lenScales],
  )
  const actionEls = useMemo(() => {
    if (!group) return [] as GroupElement[]
    return actions
      .map((a) => resolveElement(group, a.elementId))
      .filter((el): el is GroupElement => !!el)
  }, [group, actions])

  const tokens = pathText.split(/[\s,]+/).filter(Boolean)
  // 白色路径 + 加粗：与生成元调色板（红/青/黄…）区分，球上最醒目
  const pathHighlight = tokens.length > 0
    ? (pathMode === 'word'
      ? { word: tokens, showOrder: true, color: '#ffffff', width: 6 }
      : { elements: tokens, showOrder: true, color: '#ffffff', width: 6 })
    : null

  // 哈密顿路径：覆盖全部 |G| 个元素的一条 walk（字长球上即"串起所有层的蛇形路线"）
  const hamSteps = useMemo(() => {
    if (!group || actionEls.length === 0) return 0
    return findHamiltonianWord(group, actionEls)?.length ?? 0
  }, [group, actionEls])
  const applyHamiltonian = () => {
    if (!group || actionEls.length === 0) return
    const w = findHamiltonianWord(group, actionEls)
    if (w) setPathState({ key: gKey, mode: 'word', text: w.join(' ') })
  }

  return (
    <Card testid="pkg-cayley3d" title="Cayley3DScene ← @groupviz/react" tag={`theme=${theme} · layout3D=${layoutValue} · VCL len/path`}
      controls={<>
        <Ctl label="theme"><Seg value={theme} onChange={setTheme} testid="pkg-3d-theme" options={[{ value: 'dark', label: 'dark' }, { value: 'light', label: 'light' }]} /></Ctl>
        <Ctl label="layout3D">
          <Sel value={layoutValue} onChange={setLayout} testid="pkg-3d-layout"
            options={shapes3d.map((s) => ({ value: s, label: s }))} />
        </Ctl>
        <Chk checked={auto} onChange={setAuto}>autoRotate</Chk>
        <Ctl label="lengthScale">
          {actions.map((a, i) => {
            const el = group ? resolveElement(group, a.elementId) : null
            const scale = lenScales[a.elementId] ?? 1
            return (
              <label key={`${a.elementId}-${i}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#cbd5e1' }}>
                <span title={a.elementId}>{el ? el.label : a.elementId}</span>
                <input type="range" min={0.3} max={3} step={0.1} value={scale}
                  data-testid={`pkg-3d-len-${i}`}
                  onChange={(e) => setLen(a.elementId, Number(e.target.value))} style={{ width: 72 }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>{scale.toFixed(1)}×</span>
              </label>
            )
          })}
        </Ctl>
        <Ctl label="path">
          <Seg value={pathMode} onChange={(m) => setPathState({ key: gKey, mode: m, text: pathText })}
            options={[{ value: 'word', label: 'word' }, { value: 'elements', label: 'elements' }]} testid="pkg-3d-pathmode" />
          <input value={pathText} placeholder="a b / e1 e2" title={pathText}
            data-testid="pkg-3d-path"
            onChange={(e) => setPathState({ key: gKey, mode: pathMode, text: e.target.value })}
            style={{ width: 150, fontSize: 11, background: '#0f172a', color: '#cbd5e1', border: '1px solid #334155', borderRadius: 4, padding: '2px 4px' }} />
          <button onClick={applyHamiltonian} disabled={hamSteps === 0}
            data-testid="pkg-3d-hamiltonian" title={hamSteps > 0 ? `覆盖全部 ${group?.order ?? 0} 个元素（${hamSteps} 步）` : '无可用生成集'}
            style={{ ...DEMO_BTN, opacity: hamSteps === 0 ? 0.5 : 1 }}>Hamiltonian{hamSteps > 0 ? ` (${hamSteps})` : ''}</button>
          <button onClick={() => setPathState({ key: gKey, mode: pathMode, text: '' })}
            style={{ ...DEMO_BTN, background: 'transparent', color: '#94a3b8' }}>clear</button>
        </Ctl>
      </>}>
      {group
        ? <Frame h={320}><Cayley3DScene group={group} selectedElements={EMPTY_SEL} theme={theme}
            actions={actions}
            pathHighlight={pathHighlight}
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
  // ── VCL 示例：一键切到目标群 + 以示例参数重挂载对应卡片（key=nonce） ──
  const [demo, setDemo] = useState<VclDemo | null>(null)
  const demoNonce = useRef(0)
  const runDemo = useCallback((kind: VclDemoKind) => {
    const sym = kind === 's3-curve' ? 'S_{3}' : kind === 'a4-len' ? 'A_{4}' : kind === 's4-ham' ? 'S_{4}' : 'D_{7}'
    const g = createGroupFromSymbol(sym)
    if (!g) return
    setSymbol(sym)
    const next: VclDemo = { nonce: ++demoNonce.current, kind }
    if (kind === 'a4-len') {
      // 生成元顺序 = A₄ 的 a=(12)(34)（拉长）、b=(234)（缩短）
      next.lengthScales = [2.2, 0.4]
    }
    if (kind === 's4-ham') {
      const gens = (wordLengthSphereActions(g) ?? [])
        .map((a) => resolveElement(g, a.elementId))
        .filter((el): el is GroupElement => !!el)
      next.pathWord = findHamiltonianWord(g, gens)?.join(' ') ?? ''
    }
    setDemo(next)
  }, [])

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
        <div data-testid="pkg-vcl-demos" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>VCL 示例：</span>
          <button style={DEMO_BTN} data-testid="pkg-demo-s3-curve" onClick={() => runDemo('s3-curve')}>S₃ · 2D 边弯曲/笔直</button>
          <button style={DEMO_BTN} data-testid="pkg-demo-a4-len" onClick={() => runDemo('a4-len')}>A₄ · 截角四面体 (12)(34) 长 / (234) 短</button>
          <button style={DEMO_BTN} data-testid="pkg-demo-s4-ham" onClick={() => runDemo('s4-ham')}>S₄ · 字长球哈密顿路径</button>
          <button style={DEMO_BTN} data-testid="pkg-demo-d7-force" onClick={() => runDemo('d7-force')}>D₇ · 2D 动态力导向</button>
          <span style={{ fontSize: 10, color: '#475569' }}>（点击 = 切群 + 以示例参数重挂载 Cayley / Cayley3D 卡片，随后可继续手调）</span>
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
          <CayleyCard key={`cayley-${demo?.nonce ?? 0}`} group={group} demo={demo} />
          <TableCard group={group} />
          <CosetCard />
          <ActionCard />
          <HomoCard />
          <LatticeCard group={group} />
          <Cayley3DCard key={`cayley3d-${demo?.nonce ?? 0}`} group={group} demo={demo} />
          <SymmetryCard group={group} />
        </div>

        <ShellDemoCard group={group} />

        <p style={{ fontSize: 11, color: '#64748b', marginTop: 16, maxWidth: 1000, lineHeight: 1.7 }}>
          覆盖：columns 极值 / nodeRadius 三档 / 标签开关（Set/Cycle/Cayley/Coset/Homo）/
          shape2D（按群动态枚举）+ multiplyType 左右乘 / table strategy 三档 + 热力图 + 大群告警 /
          action kind（conjugation/regular）/ 同态双 fixture / labelDetail LOD 四档 + 共轭合并 + 子群列 +
          sublattice theme dark/light 对照 / Cayley3D theme + layout3D（按群动态）+ autoRotate /
          Symmetry dark + variant + 演示动画（元素受控）+ 锁定相机。群 select 切 13 群同步重渲所有共享群卡片：
          C₈ 八边形 / A₅ 二十面体（60 阶）验证大群对称演示，Q₈ 用于 Symmetry unsupported overlay。
          cosetType（左右乘）属 ViewWindow 壳层参数——包 Scene 中立，上卡以非正规 ⟨s⟩ 数据演示左右分区差异。
          VCL 示例按钮：边曲率 `edgeCurvature`（0 = 笔直）/ 逐生成元 `lengthScale` / `pathHighlight`（含字长球哈密顿路径）/ `forceDirected`。
          改动包源码后先 npm run build:pkg。
        </p>
      </div>
    </I18nProvider>
  )
}
