import { z } from 'zod'
import {
  CAYLEY_SHAPES_2D,
  LATTICE_LABEL_DETAILS,
  LAYOUTS_3D,
  type CayleyShape2D,
  type LatticeLabelDetail,
  type Layout3D,
  type MultiplyType,
} from './view'

export interface ViewWindowConfig {
  /** 锁定窗口移动与缩放（标题栏拖拽 + 内容平移/缩放 + 窗口 resize 全部禁用） */
  locked?: boolean
  /** 单独锁定内容缩放/平移（仅禁用 viewport 内的缩放与拖拽平移） */
  zoomLocked?: boolean
  /** 是否在标题栏旁显示群信息 */
  showInfo?: boolean
  /** 是否固定到视口（position:fixed）。缺省 false=随页面滚动（position:absolute） */
  viewportFixed?: boolean
  /** 是否允许用户拖拽调整窗口尺寸。缺省 true；false 时隐藏 8 个 resize 手柄（移动不受影响，用 locked 全禁） */
  resizable?: boolean
  /** 是否显示标题栏右侧的窗口控件按钮（锁移动/锁缩放/信息/参数/关闭）。缺省 true；false 供博客插图等专注阅读场景 */
  showControls?: boolean
  /** 是否显示底部缩放滑杆浮层。缺省 true；false 时 Ctrl+滚轮缩放仍可用 */
  showZoomSlider?: boolean
  /** 固定 symmetry 视图的演示元素（true 时 ⚙ 面板 Action element 列表变只读、隐藏 Reset，
   *  演示元素由 viewParams.actionElementId 决定且不可切换；⟳ Replay 仍可用）。缺省 false */
  actionLocked?: boolean
}

export const viewWindowConfigSchema = z.object({
  locked: z.boolean().optional(),
  zoomLocked: z.boolean().optional(),
  showInfo: z.boolean().optional(),
  viewportFixed: z.boolean().optional(),
  resizable: z.boolean().optional(),
  showControls: z.boolean().optional(),
  showZoomSlider: z.boolean().optional(),
})

export interface SetViewParams {
  nodeRadius?: number
  gap?: number
  columns?: number
  showLabels?: boolean
}

export const setViewParamsSchema = z.object({
  nodeRadius: z.number().min(8).max(120).optional(),
  gap: z.number().min(0).max(100).optional(),
  columns: z.number().min(0).max(50).optional(),
  showLabels: z.boolean().optional(),
})

export interface CayleyActionParam {
  /** 作用元素 id（广义凯莱图：任意群元素，不限于生成元）；不在群中的条目在渲染层被过滤 */
  elementId: string
  /** 是否画该元素的边；缺省 true */
  enabled?: boolean
  /** 边颜色（hex）；缺省按序号取 COLOR_PALETTE */
  color?: string
}

export interface CayleyViewParams {
  /** 2D 布局形状；缺省 getDefaultShape2D(group)（按群自动）。群不支持的形状渲染层自然回退 circular */
  shape2D?: CayleyShape2D
  /** 边的乘法方向；缺省 'right'（右乘 a·c） */
  multiplyType?: MultiplyType
  /** 作用边元素集合；缺省 = 群生成元集合 */
  actions?: CayleyActionParam[]
  /** 节点半径；缺省 28（与主视图一致） */
  nodeRadius?: number
  /** 是否显示节点标签；缺省 true（>60 阶沿用主视图自适应规则）。嵌入小窗（ViewWindow）传 false 彻底不显示节点标签、读元素靠悬停就地气泡 */
  showLabels?: boolean
}

export const cayleyViewParamsSchema = z.object({
  shape2D: z.enum(CAYLEY_SHAPES_2D).optional(),
  multiplyType: z.enum(['right', 'left']).optional(),
  actions: z
    .array(
      z.object({
        elementId: z.string(),
        enabled: z.boolean().optional(),
        color: z.string().optional(),
      }),
    )
    .max(240)
    .optional(),
  nodeRadius: z.number().min(8).max(120).optional(),
  showLabels: z.boolean().optional(),
})

export interface Cayley3DViewParams {
  /** 3D 布局形状；缺省 getDefaultLayout3D(group)（按群自动） */
  layout3D?: Layout3D
  /** 边的乘法方向；缺省 'right'（右乘 a·c） */
  multiplyType?: MultiplyType
  /** 作用边元素集合；缺省 = 群生成元集合 */
  actions?: CayleyActionParam[]
  /** 节点球缩放 0.5–2.0；缺省 1（基础球半径 0.42、选中/hover 0.55 × scale） */
  nodeScale?: number
  /** 缺省 false；prop 优先，窗口内 ▶ 按钮本地态兜底 */
  autoRotate?: boolean
  /** 是否显示 hover/选中 Html 标签；缺省 true */
  showLabels?: boolean
}

export const cayley3DViewParamsSchema = z.object({
  layout3D: z.enum(LAYOUTS_3D).optional(),
  multiplyType: z.enum(['right', 'left']).optional(),
  actions: z
    .array(
      z.object({
        elementId: z.string(),
        enabled: z.boolean().optional(),
        color: z.string().optional(),
      }),
    )
    .max(240)
    .optional(),
  nodeScale: z.number().min(0.5).max(2).optional(),
  autoRotate: z.boolean().optional(),
  showLabels: z.boolean().optional(),
})

export interface CycleViewParams {
  /** 仅显示极大循环（缺省 false，显示全部循环子群） */
  showMaximalCycles?: boolean
  /** 节点半径；缺省 24（与主视图循环图一致） */
  nodeRadius?: number
  /** 是否显示节点标签；缺省 true（>60 阶沿用主视图自适应规则） */
  showLabels?: boolean
  /** 是否显示每个循环的 ⟨g⟩ ≅ Z_n 标注；缺省 true */
  showCycleLabels?: boolean
}

export const cycleViewParamsSchema = z.object({
  showMaximalCycles: z.boolean().optional(),
  nodeRadius: z.number().min(8).max(80).optional(),
  showLabels: z.boolean().optional(),
  showCycleLabels: z.boolean().optional(),
})

/** 大群（>16 阶）乘法表展示策略 */
export type TableStrategy = 'subgroup' | 'random' | 'full'

export interface TableViewParams {
  /** 大群（>16 阶）展示策略；缺省 'subgroup'（≤16 阶始终全表） */
  strategy?: TableStrategy
  /** 单元格尺寸；缺省 50 */
  cellSize?: number
}

export const tableViewParamsSchema = z.object({
  strategy: z.enum(['subgroup', 'random', 'full']).optional(),
  cellSize: z.number().min(20).max(120).optional(),
})

export interface SublatticeViewParams {
  /** 名片细节档；缺省 'auto'（按窗口尺寸与缩放在三档间自动降级） */
  labelDetail?: LatticeLabelDetail
  /** 共轭子群合并为轨道节点（×n 角标，n = |G : N_G(H)|）；缺省 false */
  mergeConjugates?: boolean
  /** 名片与层距的世界单位乘子；缺省 1 */
  nodeScale?: number
  /** 底部子群列面板；缺省 false（小窗里细节改由 caption 行承载） */
  showSeriesPanel?: boolean
}

export const sublatticeViewParamsSchema = z.object({
  labelDetail: z.enum(LATTICE_LABEL_DETAILS).optional(),
  mergeConjugates: z.boolean().optional(),
  nodeScale: z.number().min(0.6).max(1.6).optional(),
  showSeriesPanel: z.boolean().optional(),
})

export interface CosetStripViewParams {
  /** 子群 H 的元素 id（升序）；缺省 = listCosetStripSubgroups 首候选（index 最小者）。
   *  换群后失效（不再是 G 的真子群）由渲染层校验并回退默认候选 */
  subgroup?: string[]
  /** 展示左/右陪集族；缺省 'left'（与主应用 cosetType 默认一致） */
  cosetType?: 'left' | 'right'
  /** 是否显示节点常驻标签；缺省 false（嵌入窗口读元素靠悬停就地气泡，与 set/cayley 窗口一致） */
  showLabels?: boolean
  /** 是否在 H 条带上方画 H 自身的 Cayley 小圈；缺省 false（主画布大视口才默认显示，窗口内省空间） */
  showSubgroupCayley?: boolean
}

export const cosetStripViewParamsSchema = z.object({
  subgroup: z.array(z.string()).min(1).max(240).optional(),
  cosetType: z.enum(['left', 'right']).optional(),
  showLabels: z.boolean().optional(),
  showSubgroupCayley: z.boolean().optional(),
})

export interface SymmetryViewParams {
  /** 对偶多面体（cube↔octahedron / icosahedron↔dodecahedron）；缺省 false（与主画布 toggle 一致）。
   *  prop 优先，未设置时场景内 toggle 按钮本地态兜底 */
  variant?: boolean
  /** 元素作用演示开关（对齐主画布 ViewPanel「显示元素操作」）；缺省 false */
  showAction?: boolean
  /** 动画倍速 0.2–5；缺省 1 */
  rotateSpeed?: number
  /** 演示元素 id（toggle 语义：点活跃元素回到恒等姿态）。换群后失效（非本群元素）由渲染层忽略。
   *  博客插图等静态场景注入该值，mount 即播放一次旋转并静止展示 */
  actionElementId?: string | null
  /** 顶部群名 + 几何描述标注；缺省 true（小窗可关） */
  showFigureTitle?: boolean
}

export const symmetryViewParamsSchema = z.object({
  variant: z.boolean().optional(),
  showAction: z.boolean().optional(),
  rotateSpeed: z.number().min(0.2).max(5).optional(),
  actionElementId: z.string().min(1).nullable().optional(),
  showFigureTitle: z.boolean().optional(),
})

export interface HomomorphismViewParams {
  /** 是否显示节点常驻标签；缺省 false（嵌入窗口读元素靠悬停就地气泡，与 set/cayley 窗口一致） */
  showLabels?: boolean
}

export const homomorphismViewParamsSchema = z.object({
  showLabels: z.boolean().optional(),
})

/** action 视图窗口参数（批次六 props 化）。窗口范围：conjugation / regular / custom 三来源；
 *  sylow / coset 不在窗口支持列表（renderContent 无分支） */
export interface ActionViewParams {
  /** 作用来源；缺省 'conjugation' */
  actionKind?: 'conjugation' | 'regular' | 'custom'
  /** custom 专用：|X|（1..20）；缺省 6 */
  setSize?: number
  /** custom 专用：已验证的箭头绑定列表（JSON 可序列化，随 viewParams 持久化）。
   *  换群后 generatorId 失效（非新群生成元）由渲染层回退编辑态 */
  arrows?: { generatorId: string | null; from: number; to: number }[]
  /** 是否显示节点常驻标签与顶部轨道 chips 区；缺省 false（嵌入窗口节点空圈 + 悬停就地气泡，
   *  与 homo/cosetstrip 窗口一致）。主画布壳始终 true */
  showLabels?: boolean
}

export const actionViewParamsSchema = z.object({
  actionKind: z.enum(['conjugation', 'regular', 'custom']).optional(),
  setSize: z.number().int().min(1).max(20).optional(),
  // 上限：|X|≤20 × 生成元（≤8）+ 未绑定箭头，200 足够宽松
  arrows: z
    .array(
      z.object({
        generatorId: z.string().nullable(),
        from: z.number().int().min(0).max(19),
        to: z.number().int().min(0).max(19),
      }),
    )
    .max(200)
    .optional(),
  showLabels: z.boolean().optional(),
})

export interface ViewWindowGeometry {
  position: { x: number; y: number }
  size: { width: number; height: number }
}

export interface ViewWindowPersistData {
  position: { x: number; y: number }
  size: { width: number; height: number }
  config: ViewWindowConfig
  viewParams: Record<string, unknown>
}

export const viewWindowPersistDataSchema = z.object({
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number(), height: z.number() }),
  config: viewWindowConfigSchema,
  viewParams: z.record(z.string(), z.unknown()),
})