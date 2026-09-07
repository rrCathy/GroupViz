import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { ActionScene } from './ActionScene'

// ─── ActionView 主画布壳（批次六 props 化） ─────────────────────────────
// 全部状态/操作来自全局 Provider（GroupActionContext + core），组装后喂给
// ActionScene 纯 props 内核；签名不变、行为零变化。受控 ViewWindow 直接渲染
// ActionScene（自算 computation，不经此壳）。

export function ActionView() {
  const {
    currentGroup, actionComputation, actionEditing,
    canvasTransform, viewBoxSize,
    actionKind, actionPrime,
    actionHoverElement, setActionHoverElement,
    actionSelectedElement, setActionSelectedElement,
    actionSetSize, actionArrows, actionError,
    addArrow, bindArrow, removeArrow, replaceGenArrows,
    selectElement,
  } = useGroup()
  const { t } = useTranslation()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  return (
    <ActionScene
      group={currentGroup}
      kind={actionKind ?? 'custom'}
      computation={actionComputation}
      editing={actionEditing}
      setSize={actionSetSize}
      arrows={actionArrows}
      error={actionError}
      onAddArrow={addArrow}
      onBindArrow={bindArrow}
      onRemoveArrow={removeArrow}
      onReplaceGenArrows={replaceGenArrows}
      selectedElement={actionSelectedElement}
      onSelectedElementChange={setActionSelectedElement}
      hoveredElement={actionHoverElement}
      onHoverElementChange={setActionHoverElement}
      onSetElementSelect={id => selectElement(id, false)}
      showLabels={true}
      canvasTransform={canvasTransform}
      viewBoxSize={viewBoxSize}
      prime={actionPrime}
    />
  )
}
