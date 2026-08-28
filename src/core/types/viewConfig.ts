import { z } from 'zod'
import { CAYLEY_SHAPES_2D, type CayleyShape2D, type MultiplyType } from './view'

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
}

export const viewWindowConfigSchema = z.object({
  locked: z.boolean().optional(),
  zoomLocked: z.boolean().optional(),
  showInfo: z.boolean().optional(),
  viewportFixed: z.boolean().optional(),
  resizable: z.boolean().optional(),
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
  /** 是否显示节点标签；缺省 true（>60 阶沿用主视图自适应规则） */
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