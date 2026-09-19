import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { useTranslation } from '../../i18n/useTranslation'
import { SylowScene } from './SylowScene'

// ─── SylowView 主画布壳（阶段 2 批次八 props 化） ─────────────────────────
// 全部状态/操作来自全局 Provider（GroupContext + HoverContext），组装后喂给
// SylowScene 纯 props 内核；签名不变、行为零变化。受控 ViewWindow / 包消费端
// 直接渲染 SylowScene（自持选中与视口）。
// 不传 theme → 继承应用全局主题变量（--sylow-*），外观与 props 化前逐像素一致。

export function SylowView() {
  const { currentGroup, selectedElements, selectElement, canvasTransform, viewBoxSize } = useGroup()
  const { setHoverElement } = useHover()
  const { t } = useTranslation()

  if (!currentGroup) {
    return (
      <div className="view-empty">
        <p>{t('canvas.noGroup')}</p>
      </div>
    )
  }

  return (
    <SylowScene
      group={currentGroup}
      selectedElements={selectedElements}
      onSelect={selectElement}
      onHover={setHoverElement}
      canvasTransform={canvasTransform}
      viewBoxSize={viewBoxSize}
    />
  )
}
