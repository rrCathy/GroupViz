import { useMemo } from 'react'

import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { SetView, type SetViewProps } from './SetView'

/** 从全局 Provider 组装 SetView 所需 props 的适配器（保留原行为）。 */
export function SetViewFromContext() {
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
    selectElement,
  } = useGroup()
  const { setHoverElement } = useHover()

  const subsetMap = useMemo(
    () => (subsets ?? []).map(({ elementIds, color }) => ({ elementIds, color })),
    [subsets]
  )

  const props: SetViewProps = {
    group: currentGroup,
    selectedElements,
    canvasTransform,
    viewBoxSize,
    subsets: subsetMap,
    selfInverseElementId,
    cosetElementMap,
    cosetHighlightSet,
    cosetColors,
    onSelect: selectElement,
    onHover: setHoverElement,
  }
  return <SetView {...props} />
}