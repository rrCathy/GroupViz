import { useMemo } from 'react'

import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { CycleView, type CycleViewProps } from './CycleView'

/** 从全局 Provider 组装 CycleView 所需 props 的适配器（保留原行为）。 */
export function CycleViewFromContext() {
  const {
    currentGroup,
    selectedElements,
    canvasTransform,
    viewBoxSize,
    subsets,
    selfInverseElementId,
    cosetElementMap,
    cosetHighlightSet,
    cosetColors,
    showMaximalCycles,
    selectElement,
    getNodePosition,
    setNodePosition,
  } = useGroup()
  const { setHoverElement } = useHover()

  const subsetMap = useMemo(
    () => (subsets ?? []).map(({ elementIds, color }) => ({ elementIds, color })),
    [subsets]
  )

  const props: CycleViewProps = {
    group: currentGroup,
    selectedElements,
    canvasTransform,
    viewBoxSize,
    showMaximalCycles,
    subsets: subsetMap,
    selfInverseElementId,
    cosetElementMap,
    cosetHighlightSet,
    cosetColors,
    getNodePosition,
    onNodePositionChange: setNodePosition,
    onSelect: selectElement,
    onHover: setHoverElement,
  }
  return <CycleView {...props} />
}
