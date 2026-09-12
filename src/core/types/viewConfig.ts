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
  /** 该作用元素的边长倍率；缺省 1（原始布局）。0.3–3。
   *  固定几何布局经「长度约束松弛」后处理，力导向布局作为弹簧静止长度倍率 */
  lengthScale?: number
}

/** 凯莱图路径高亮（VCL）：元素序列 或 生成元单词，二选一 */
export interface CayleyPathHighlight {
  /** 元素引用序列（id/label/value/循环记号）；相邻两项须由某条已启用作用边相连 */
  elements?: string[]
  /** 生成元单词（元素引用序列，视为连续作用）；从 `start`（缺省单位元）出发累乘。
   *  与 `elements` 同时给出时 `elements` 优先 */
  word?: string[]
  /** `word` 模式的起点（元素引用）；缺省单位元 */
  start?: string
  /** 高亮颜色；缺省金色 #ffd93d */
  color?: string
  /** 高亮线宽；缺省 5 */
  width?: number
  /** 是否沿路径逐步点亮（进入即播放） */
  animate?: boolean
  /** 是否在节点上标出经过次序（① ② ③ …）；**悬停该节点时显示**（不常显，避免遮挡） */
  showOrder?: boolean
  /** `word` 模式：是否闭合（末元素回单位元，用于展示关系式如 a²=e） */
  closed?: boolean
  /** 高亮路径时**淡化其余边**（只留路径上的边醒目；缺省 true = 用户期望的「只显示路径」效果） */
  dimOthers?: boolean
}

export const cayleyPathHighlightSchema = z.object({
  elements: z.array(z.string()).max(240).optional(),
  word: z.array(z.string()).max(240).optional(),
  start: z.string().optional(),
  color: z.string().optional(),
  width: z.number().min(0.5).max(20).optional(),
  animate: z.boolean().optional(),
  showOrder: z.boolean().optional(),
  closed: z.boolean().optional(),
  dimOthers: z.boolean().optional(),
})

/** 动态力导向微调（`forceDirected === true` 时生效） */
export interface CayleyForceParams {
  /** 斥力倍率；缺省 1（0.2–3）。越大节点越散、越不易纠缠（1/d²，3.5×理想间距外淡出） */
  repulsion?: number
  /** 弹簧静止长度倍率（连线距离）；缺省 1（0.2–3）。与逐生成元 lengthScale 相乘 */
  linkScale?: number
  /** 向心力倍率；缺省 1（0–3）。已按群阶归一：对环状布局的向心收缩恒 ≈2.7% 半径，
   *  大群不会被压塌（越大整图越收拢成团） */
  gravity?: number
  /** 速度保留率 0.5–0.95；缺省 0.75（越大越"飘"、越小越"黏"越稳） */
  damping?: number
  /** 连线刚度倍率 0.4–3；缺省 1（越大越"硬"：拖拽时局部形状越不易走样）。
   *  拖拽中自动 ×2.5、松手恢复；也影响均衡密度与 Re-settle 结果 */
  stiffness?: number
  /** 自增即「回到给定形状」（重置拖拽塑性记忆 + 重新投影到力平衡态；
   *  对齐 SymmetryView.replaySignal 语义。拖拽探索出的新形状被清除） */
  settleSignal?: number
}

export const cayleyForceParamsSchema = z.object({
  repulsion: z.number().min(0.2).max(3).optional(),
  linkScale: z.number().min(0.2).max(3).optional(),
  gravity: z.number().min(0).max(3).optional(),
  damping: z.number().min(0.5).max(0.95).optional(),
  stiffness: z.number().min(0.4).max(3).optional(),
  settleSignal: z.number().optional(),
})

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
  /** 边弯曲度倍率；缺省 1（自适应弧，约 min(dist*0.08, 18)）。**0 = 笔直**；2 = 更弯。
   *  平行边（同一对节点间多条作用边）按作用序号自动左右分开，避免笔直时重叠 */
  edgeCurvature?: number
  /** 路径高亮（VCL）；null/缺省 = 不高亮 */
  pathHighlight?: CayleyPathHighlight | null
  /** 动态力导向**开关**（在**当前选定形状**之上启用，不是一种新形状）：让静图"活"起来。
   *  开启后节点持续可拖拽 + 实时受力；初始位置取所选形状的静态布局，平滑过渡到力平衡态。
   *  缺省 false（保持静态图，零行为变化） */
  forceDirected?: boolean
  /** 力导向微调（`forceDirected === true` 时生效） */
  force?: CayleyForceParams
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
        lengthScale: z.number().min(0.2).max(3).optional(),
      }),
    )
    .max(240)
    .optional(),
  nodeRadius: z.number().min(8).max(120).optional(),
  showLabels: z.boolean().optional(),
  edgeCurvature: z.number().min(0).max(3).optional(),
  pathHighlight: cayleyPathHighlightSchema.nullable().optional(),
  forceDirected: z.boolean().optional(),
  force: cayleyForceParamsSchema.optional(),
})

export interface Cayley3DFaceFillParams {
  /** 面填充总开关（保留 subgroup 选择但临时不显示）；缺省 true */
  enabled?: boolean
  /** 选中的子群 H（元素 id 升序）；空/缺失 = 不显示面 */
  subgroup?: string[]
  /** 逐面颜色覆盖：key = 陪集元素 id 升序 join(',') → hex 颜色 */
  faceColors?: Record<string, string>
  /** 面透明度 0.15–0.9；缺省 0.45 */
  opacity?: number
}

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
  /** 子群陪集面填充（面 = 某真子群单个陪集在布局中占满的平面凸多边形） */
  faceFill?: Cayley3DFaceFillParams
  /** 路径高亮（VCL）；null/缺省 = 不高亮。与 2D 同一套解析（core.resolveCayleyPath）与视觉语义 */
  pathHighlight?: CayleyPathHighlight | null
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
        lengthScale: z.number().min(0.2).max(3).optional(),
      }),
    )
    .max(240)
    .optional(),
  nodeScale: z.number().min(0.5).max(2).optional(),
  autoRotate: z.boolean().optional(),
  showLabels: z.boolean().optional(),
  pathHighlight: cayleyPathHighlightSchema.nullable().optional(),
  faceFill: z
    .object({
      enabled: z.boolean().optional(),
      subgroup: z.array(z.string()).min(1).max(240).optional(),
      faceColors: z.record(z.string(), z.string()).optional(),
      opacity: z.number().min(0.15).max(0.9).optional(),
    })
    .optional(),
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