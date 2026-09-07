import { useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { Cayley3DScene } from './Cayley3DScene'

/** 主应用入口（context 组装壳）：从全局 Provider 组装 Cayley3DScene 所需 props（保留原行为） */
export function Cayley3DView() {
  const {
    currentGroup, selectedElements, selectElement,
    cayleyActions, cayleyMultiplyType, cayleyShape3D, subsets
  } = useGroup()

  const subsetHighlights = useMemo(
    () => (subsets ?? []).map(({ elementIds, color }) => ({ elementIds, color })),
    [subsets],
  )

  return (
    <Cayley3DScene
      group={currentGroup}
      selectedElements={selectedElements}
      onSelectElement={selectElement}
      actions={cayleyActions}
      multiplyType={cayleyMultiplyType}
      layout3D={cayleyShape3D}
      subsetHighlights={subsetHighlights}
    />
  )
}
