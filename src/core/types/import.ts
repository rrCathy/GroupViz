/**
 * GAP 导入群的响应契约（纯类型，零 UI 依赖）。
 *
 * 从 src/utils/api 下沉到 core，使 core/groups/importGroup 的
 * createGroupFromImport 无需引用 utils。后端 /api/compute/import-group
 * 的响应形状与此一致（src/utils/api 经 re-export 复用此类型）。
 */
export interface ApiImportGroup {
  gap_expr: string
  order: number
  table: number[][]
  gens: number[]
  idents: string[]
  structure: string
  elapsed_ms?: number
}
