import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { CosetStripScene } from './CosetStripScene'

// ─── context 组装壳（主画布 / 老浮动窗口零改动）─────────────────────────
// FGVE 打包期 Scene 已拆至 CosetStripScene.tsx（纯渲染内核，仅依赖 i18n），
// 本壳（读 useGroup/useHover context）是主应用宿主专用，不随 react 包入包。
export function CosetStripView() {
  const {
    currentGroup,
    selectedElements,
    selectElement,
    canvasTransform,
    cosetElementMap,
    cosetColors,
    cosetHighlightSet,
    viewBoxSize,
    subsets,
  } = useGroup()
  const { setHoverElement } = useHover()
  const subsetMap = useMemo(
    () => (subsets ?? []).map(({ elementIds, color }) => ({ elementIds, color })),
    [subsets]
  )
  return (
    <CosetStripScene
      group={currentGroup}
      selectedElements={selectedElements}
      canvasTransform={canvasTransform}
      viewBoxSize={viewBoxSize}
      cosetElementMap={cosetElementMap}
      cosetColors={cosetColors}
      cosetHighlightSet={cosetHighlightSet}
      subsets={subsetMap}
      showLabels={true}
      showSubgroupCayley={true}
      onSelect={selectElement}
      onHover={setHoverElement}
    />
  )
}
