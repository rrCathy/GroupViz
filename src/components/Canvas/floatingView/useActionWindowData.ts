// ── action 窗口数据派生 + custom 箭头编辑流（B2 自 ViewWindow.tsx 抽出，逻辑未动）──
import { useMemo, useCallback } from 'react'
import type { Group, ViewMode, GroupActionComputation } from '../../../core/types'
import type { ActionViewParams } from '../../../core/types/viewConfig'
import { buildActionComputation } from '../../../core/algebra/actions'
import type { ActionEditState, ViewParams, ViewParamsPatch } from './types'

export function useActionWindowData({
  view, group, viewParams, updateViewParams, actionEdit, setActionEdit, setActionSel,
}: {
  view: ViewMode
  group?: Group | null
  viewParams: ViewParams
  updateViewParams: (p: ViewParamsPatch) => void
  actionEdit: ActionEditState | null
  setActionEdit: React.Dispatch<React.SetStateAction<ActionEditState | null>>
  setActionSel: React.Dispatch<React.SetStateAction<number | null>>
}) {

  // ── action 窗口数据派生（自包含，不依赖主应用 GroupActionContext） ──────
  // conjugation/regular：buildActionComputation 直算；custom：viewParams 里的
  // 已验证箭头自算（坏值/换群失效 → computation 为 null，渲染 noAction，
  // 参数面板 Edit arrows 重新进入编辑）。编辑态（actionEdit 非空）时不算。
  const actionVp = viewParams as ActionViewParams
  const actionKind = actionVp.actionKind ?? 'conjugation'
  const actionComputation = useMemo<GroupActionComputation | null>(() => {
    if (view !== 'action' || !group || actionEdit) return null
    if (actionKind === 'custom') {
      // 空 arrows = 平凡作用（全部不动点），同样合法可显示
      if (!actionVp.setSize || !actionVp.arrows) return null
      const r = buildActionComputation(group, { kind: 'custom', setSize: actionVp.setSize }, actionVp.arrows)
      return r.computation && r.computation.isHomomorphism ? r.computation : null
    }
    if (actionKind !== 'conjugation' && actionKind !== 'regular') return null
    return buildActionComputation(group, { kind: actionKind }).computation ?? null
  }, [view, group, actionKind, actionVp.setSize, actionVp.arrows, actionEdit])
  // custom 编辑流：进入编辑（从已验证态/缺省继承）、箭头操作（纯变换直接改编辑态）、
  // 完成并验证（通过才写回 viewParams 持久化）、取消（丢弃编辑态）
  const startOrEditCustom = useCallback(() => {
    if (!group) return
    setActionEdit({ setSize: actionVp.setSize ?? 6, arrows: actionVp.arrows ?? [], error: null })
    updateViewParams({ actionKind: 'custom' })
    // setActionEdit 为透出的 useState setter（引用稳定）
  }, [group, actionVp.setSize, actionVp.arrows, updateViewParams, setActionEdit])
  const verifyAndSaveCustom = useCallback(() => {
    if (!group || !actionEdit) return
    const r = buildActionComputation(group, { kind: 'custom', setSize: actionEdit.setSize }, actionEdit.arrows)
    if (r.error) { setActionEdit({ ...actionEdit, error: r.error }); return }
    if (r.computation && !r.computation.isHomomorphism && r.computation.violation) {
      const v = r.computation.violation
      setActionEdit({ ...actionEdit, error: { generatorId: v.a, from: v.x, to: -1, g: v.g, type: 'homomorphism' } })
      return
    }
    updateViewParams({ actionKind: 'custom', setSize: actionEdit.setSize, arrows: actionEdit.arrows })
    setActionEdit(null)
    setActionSel(null)
  }, [group, actionEdit, updateViewParams, setActionEdit, setActionSel])

  return { actionVp, actionKind, actionComputation, startOrEditCustom, verifyAndSaveCustom }
}
