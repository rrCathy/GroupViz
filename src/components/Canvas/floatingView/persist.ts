// ── ViewWindow 几何/配置/参数持久化（自 FloatingViewWindow.tsx 拆出，纯搬家）──
import { z } from 'zod'
import { loadVersionedJson, saveVersionedJson } from '../../../utils/persistence'
import { decorationsSchemaV1 } from '../../../core/types/decorations'

const VW_PERSIST_SCHEMA = z.object({
  position: z.object({ x: z.number(), y: z.number() }),
  size: z.object({ width: z.number().min(200), height: z.number().min(150) }),
  config: z.object({
    locked: z.boolean().optional(),
    zoomLocked: z.boolean().optional(),
    showInfo: z.boolean().optional(),
    viewportFixed: z.boolean().optional(),
    resizable: z.boolean().optional(),
    showControls: z.boolean().optional(),
    showZoomSlider: z.boolean().optional(),
    actionLocked: z.boolean().optional(),
  }),
  viewParams: z.record(z.string(), z.unknown()),
  /** VCL Decorations（DEC-2）：图上注释，随窗口持久化；缺省 = 无（旧存档兼容） */
  decorations: decorationsSchemaV1.optional(),
})

export function loadVwPersist(key: string) {
  return loadVersionedJson(`gv-vw-${key}`, VW_PERSIST_SCHEMA)
}

export function saveVwPersist(key: string, data: z.infer<typeof VW_PERSIST_SCHEMA>) {
  saveVersionedJson(`gv-vw-${key}`, data)
}
