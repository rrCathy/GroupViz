// ── 窗口内容区视图分发（B2 自 ViewWindow.tsx 抽出，JSX 逐字保留）──
// 受控窗口的 renderContent：按 view 分发到各视图内核（Scene 直挂 / 组件传 props）。
import type { Group, Homomorphism, ViewMode, GroupElement, CanvasTransform, GroupActionComputation, GroupActionKind } from '../../../core/types'
import type { ViewWindowConfig, SetViewParams, CayleyViewParams, Cayley3DViewParams, CycleViewParams, TableViewParams, SublatticeViewParams, CosetStripViewParams, SymmetryViewParams, HomomorphismViewParams, ActionViewParams } from '../../../core/types/viewConfig'
import type { CosetStripSubgroupOption } from '../../../core/algebra/cosetStrip'
import { getDefaultShape2D } from '../../../core/types'
import { verifyHomomorphism } from '../../../core/algebra/homomorphisms'
import { arrowListAdd, arrowListBind, arrowListRemove, arrowListReplaceGen } from '../../../core/algebra/actions'
import { computeCosetElementMap, computeCosetColors } from '../../../context/cosetActions'
import { SetView, type SetViewProps } from '../SetView'
import { CycleView } from '../CycleView'
import { TableView } from '../TableView'
import { SublatticeScene } from '../SublatticeScene'
import { HomomorphismScene } from '../HomomorphismScene'
import { CosetStripScene } from '../CosetStripScene'
import { ActionScene } from '../ActionScene'
import { SymmetryViewScene } from '../SymmetryViewScene'
import { CayleyView } from '../CayleyView'
import { Cayley3DScene } from '../Cayley3DScene'
import { COSETSTRIP_NO_LOCAL_SUBGROUPS } from './lazyViews'
import type { ActionEditState, ViewParams } from './types'

export interface ViewContentProps {
  view: ViewMode
  group: Group | null
  homomorphism: Homomorphism | null
  viewParams: ViewParams
  config: ViewWindowConfig
  sel: Set<string>
  ct: CanvasTransform
  vbSize: { width: number; height: number }
  viewWindowTheme: string
  symReplay: number
  hoverEl: GroupElement | null
  csElementMap: ReturnType<typeof computeCosetElementMap> | null
  csColors: ReturnType<typeof computeCosetColors>
  csHighlight: Set<number>
  csSubgroup: CosetStripSubgroupOption | null
  csOpts: CosetStripSubgroupOption[]
  cosetStripVp: CosetStripViewParams
  actionComputation: GroupActionComputation | null
  actionKind: GroupActionKind
  actionVp: ActionViewParams
  actionEdit: ActionEditState | null
  actionSel: number | null
  actionHoverId: string | null
  handleSelect: (id: string, add: boolean) => void
  handleHover: (el: GroupElement | null, anchor?: { x: number; y: number } | null) => void
  setSymHintText: (t: string | null) => void
  setTableLayoutSize: React.Dispatch<React.SetStateAction<{ width: number; height: number } | null>>
  setActionEdit: React.Dispatch<React.SetStateAction<ActionEditState | null>>
  setActionSel: React.Dispatch<React.SetStateAction<number | null>>
  setActionHoverId: React.Dispatch<React.SetStateAction<string | null>>
  updateViewParams: (p: import('./types').ViewParamsPatch) => void
}

export function ViewContent({
  view, group, homomorphism, viewParams, config, sel, ct, vbSize,
  viewWindowTheme, symReplay, hoverEl,
  csElementMap, csColors, csHighlight, csSubgroup, csOpts, cosetStripVp,
  actionComputation, actionKind, actionVp, actionEdit, actionSel, actionHoverId,
  handleSelect, handleHover, setSymHintText, setTableLayoutSize,
  setActionEdit, setActionSel, setActionHoverId, updateViewParams,
}: ViewContentProps) {
    if (view === 'homomorphism') {
      if (!homomorphism) {
        return <div style={{ color: 'var(--text-dim)', padding: 24, textAlign: 'center' }}>No homomorphism</div>
      }
      const homoVp = viewParams as HomomorphismViewParams
      const homoResult = homomorphism.mapping.size === 0
        ? null
        : (homomorphism.result ?? verifyHomomorphism(homomorphism.source, homomorphism.target, homomorphism.mapping))
      return (
        <HomomorphismScene
          key={`homomorphism-${homomorphism.source.symbol}-${homomorphism.target.symbol}`}
          source={homomorphism.source}
          target={homomorphism.target}
          mapping={homomorphism.mapping}
          result={homoResult}
          name={homomorphism.name}
          showLabels={homoVp.showLabels ?? false}
          onHover={handleHover}
        />
      )
    }
    if (!group) return <div style={{ color: 'var(--text-dim)', padding: 24, textAlign: 'center' }}>No group</div>

    if (view === 'cayley') {
      const cvp = viewParams as CayleyViewParams
      const effShape = cvp.shape2D ?? getDefaultShape2D(group)
      return (
        <CayleyView
          key={`cayley-${group.symbol}-${group.order}-${effShape}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          shape2D={cvp.shape2D}
          multiplyType={cvp.multiplyType}
          actions={cvp.actions}
          nodeRadius={cvp.nodeRadius}
          showLabels={false}
          locked={config.locked}
          onSelect={handleSelect}
          onHover={handleHover}
          hoveredElementId={hoverEl?.id ?? null}
          edgeCurvature={cvp.edgeCurvature}
          pathHighlight={cvp.pathHighlight ?? null}
          forceDirected={cvp.forceDirected}
          force={cvp.force}
        />
      )
    }

    if (view === '3d') {
      // 3D 相机自管理（轨道/滚轮/平移），不吃窗口 ct；hover 反馈由 3D 场景内 Html 标签承担
      const p3 = viewParams as Cayley3DViewParams
      return (
        <Cayley3DScene
          key={`3d-${group.symbol}-${group.order}`}
          group={group}
          selectedElements={sel}
          onSelectElement={handleSelect}
          actions={p3.actions}
          multiplyType={p3.multiplyType}
          layout3D={p3.layout3D}
          nodeScale={p3.nodeScale}
          autoRotate={p3.autoRotate}
          showLabels={p3.showLabels}
          locked={config.locked}
          faceFill={p3.faceFill}
          pathHighlight={p3.pathHighlight ?? null}
        />
      )
    }

    if (view === 'cycle') {
      const cyvp = viewParams as CycleViewParams
      return (
        <CycleView
          key={`cycle-${group.symbol}-${group.order}-${cyvp.showMaximalCycles ? 'max' : 'all'}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          showMaximalCycles={cyvp.showMaximalCycles}
          nodeRadius={cyvp.nodeRadius}
          showLabels={false}
          showCycleLabels={cyvp.showCycleLabels}
          locked={config.locked}
          onSelect={handleSelect}
          onHover={handleHover}
        />
      )
    }

    if (view === 'table') {
      const tvp = viewParams as TableViewParams
      return (
        <TableView
          key={`table-${group.symbol}-${group.order}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          strategy={tvp.strategy}
          cellSize={tvp.cellSize}
          onStrategyChange={s => updateViewParams({ strategy: s })}
          onLayoutSize={setTableLayoutSize}
          onSelect={handleSelect}
          onHover={() => {}}
        />
      )
    }

    if (view === 'heatmap') {
      // 热力图独立窗口：无文字、纯色块；不设最小尺寸，颜色密度呈现宏观结构
      const tvp = viewParams as TableViewParams
      return (
        <TableView
          key={`heatmap-${group.symbol}-${group.order}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          strategy={tvp.strategy}
          cellSize={tvp.cellSize}
          showHeatmap
          onStrategyChange={s => updateViewParams({ strategy: s })}
          onSelect={handleSelect}
          onHover={() => {}}
        />
      )
    }

    if (view === 'sublattice') {
      // 子群格：内核自测绘图区像素并据此自动降级 LOD，故不传 viewBoxSize
      const slp = viewParams as SublatticeViewParams
      return (
        <SublatticeScene
          key={`sublattice-${group.symbol}-${group.order}`}
          group={group}
          canvasTransform={ct}
          labelDetail={slp.labelDetail}
          mergeConjugates={slp.mergeConjugates}
          nodeScale={slp.nodeScale}
          showSeriesPanel={slp.showSeriesPanel}
        />
      )
    }

    if (view === 'cosetstrip') {
      // 窗口缺省：节点常驻标签关闭（读元素靠悬停就地气泡）、顶部 H-Cayley 小圈关闭
      // （省空间给条带区）；两开关都在参数面板可开回主画布观感。
      return (
        <CosetStripScene
          key={`cosetstrip-${group.symbol}-${group.order}-${csSubgroup?.key ?? 'none'}`}
          group={group}
          selectedElements={sel}
          canvasTransform={ct}
          viewBoxSize={vbSize}
          cosetElementMap={csElementMap}
          cosetColors={csColors}
          cosetHighlightSet={csHighlight}
          showLabels={cosetStripVp.showLabels ?? false}
          showSubgroupCayley={cosetStripVp.showSubgroupCayley ?? false}
          noCosetsText={csOpts.length === 0 ? COSETSTRIP_NO_LOCAL_SUBGROUPS : undefined}
          onSelect={handleSelect}
          onHover={handleHover}
        />
      )
    }

    if (view === 'action') {
      // 窗口缺省：节点常驻标签 + 顶部轨道 chips 区关闭（读元素靠悬停就地气泡，
      // 与 homo/cosetstrip 窗口一致），参数面板 Show labels 可开回主画布观感。
      // 编辑态渲染编辑器（不吃窗口 ct）；conjugation/regular 显示态吃窗口 ct。
      const effKind = actionEdit ? 'custom' : actionKind
      return (
        <ActionScene
          key={`action-${group.symbol}-${group.order}-${effKind}`}
          group={group}
          kind={effKind}
          computation={actionComputation}
          editing={!!actionEdit}
          setSize={actionEdit ? actionEdit.setSize : (actionVp.setSize ?? null)}
          arrows={actionEdit ? actionEdit.arrows : (actionVp.arrows ?? [])}
          error={actionEdit ? actionEdit.error : null}
          onAddArrow={(from, to, genId) => setActionEdit(prev => prev ? { ...prev, arrows: arrowListAdd(prev.arrows, from, to, genId ?? null), error: null } : prev)}
          onBindArrow={(from, to, genId) => setActionEdit(prev => prev ? { ...prev, arrows: arrowListBind(prev.arrows, from, to, genId), error: null } : prev)}
          onRemoveArrow={(from, genId, to) => setActionEdit(prev => prev ? { ...prev, arrows: arrowListRemove(prev.arrows, from, genId ?? null, to) } : prev)}
          onReplaceGenArrows={(genId, pairs) => setActionEdit(prev => prev ? { ...prev, arrows: arrowListReplaceGen(prev.arrows, genId, pairs), error: null } : prev)}
          selectedElement={actionSel}
          onSelectedElementChange={setActionSel}
          hoveredElement={actionHoverId}
          onHoverElementChange={setActionHoverId}
          showLabels={actionVp.showLabels ?? false}
          onHover={handleHover}
          canvasTransform={ct}
          viewBoxSize={vbSize}
        />
      )
    }

    if (view === 'symmetry') {
      // 对称性视图：3D 相机自管理（不吃窗口 ct/zoom）；unsupported 群由 SymmetryViewScene 内部渲染提示 overlay
      const symVp = viewParams as SymmetryViewParams
      return (
        <SymmetryViewScene
          key={`symmetry-${group.symbol}-${group.order}`}
          group={group}
          dark={viewWindowTheme === 'dark'}
          variant={symVp.variant}
          showAction={symVp.showAction}
          actionElementId={symVp.actionElementId ?? null}
          rotateSpeed={symVp.rotateSpeed}
          // 窗口标题栏已显示群名，场景内图注默认关闭（避免「标题一个群名、场景又一个群名+几何」重复）
          showFigureTitle={symVp.showFigureTitle ?? false}
          locked={config.locked}
          hintOnIdle={false}
          replaySignal={symReplay}
          onHint={msg => setSymHintText(msg)}
        />
      )
    }

    if (view !== 'set') return <div style={{ color: 'var(--text-dim)', padding: 24, textAlign: 'center' }}>View "{view}" coming soon</div>

    const svp = viewParams as SetViewParams
    const sp: SetViewProps = {
      group,
      selectedElements: sel,
      canvasTransform: ct,
      viewBoxSize: vbSize,
      nodeRadius: svp.nodeRadius,
      gap: svp.gap,
      columns: svp.columns,
      showLabels: svp.showLabels,
      onSelect: handleSelect,
      onHover: handleHover,
    }
    return (
      <SetView
        key={`set-${group.symbol}-${group.order}`}
        {...sp}
      />
    )
  }
