// ── 受控 ViewWindow 的共享类型（B2 自 ViewWindow.tsx 抽出，逻辑未动）──
import type { Group, Homomorphism, GroupActionArrow } from '../../../core/types'
import type {
  ViewWindowConfig, SetViewParams, CayleyViewParams, Cayley3DViewParams, CycleViewParams,
  TableViewParams, SublatticeViewParams, CosetStripViewParams, SymmetryViewParams,
  HomomorphismViewParams, ActionViewParams,
} from '../../../core/types/viewConfig'
import type { CustomArrowError } from '../../../core/algebra/actions'

/** 各视图参数联合（受控 ViewWindow 的 viewParams prop 类型） */
export type ViewParams = SetViewParams | CayleyViewParams | Cayley3DViewParams | CycleViewParams | TableViewParams | SublatticeViewParams | CosetStripViewParams | SymmetryViewParams | HomomorphismViewParams | ActionViewParams

/** updateViewParams 的补丁类型（按 view 判别，同一时刻只属于一种视图） */
export type ViewParamsPatch = Partial<SetViewParams> | Partial<CayleyViewParams> | Partial<Cayley3DViewParams> | Partial<CycleViewParams> | Partial<TableViewParams> | Partial<SublatticeViewParams> | Partial<CosetStripViewParams> | Partial<SymmetryViewParams> | Partial<HomomorphismViewParams> | Partial<ActionViewParams>

/** action 视图 custom 箭头编辑态（不持久化：viewParams 只存已验证结果） */
export interface ActionEditState {
  setSize: number
  arrows: GroupActionArrow[]
  error: CustomArrowError | null
}

export interface ViewWindowProps {
  view: import('../../../core/types').ViewMode
  /** 展示群；同态视图（view==='homomorphism'）可省略，改由 homomorphism prop 提供双群 */
  group?: Group | null
  /** 同态视图双群输入（source+target+mapping 打包）。view==='homomorphism' 时优先于 group（group 可为 null） */
  homomorphism?: Homomorphism | null
  title?: string
  storageKey?: string
  config?: ViewWindowConfig
  onConfigChange?: (c: ViewWindowConfig) => void
  viewParams?: ViewParams
  onViewParamsChange?: (p: ViewParams) => void
  defaultPosition?: { x: number; y: number }
  defaultSize?: { width: number; height: number }
  onClose?: () => void
}
