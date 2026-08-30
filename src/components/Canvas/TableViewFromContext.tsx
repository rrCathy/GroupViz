import { useGroup } from '../../context/useGroup'
import { useHover } from '../../context/core/HoverContext'
import { TableView, type TableViewProps } from './TableView'

/** 从全局 Provider 组装 TableView 所需 props 的适配器（保留原行为）。 */
export function TableViewFromContext() {
  const {
    currentGroup,
    selectedElements,
    selectElement,
    viewBoxSize,
    canvasTransform,
    forceShowLargeGroupViews,
    setForceShowLargeGroupForView,
    subsets,
    cosetElementMap,
    cosetColors,
    cosetData,
    cosetType,
    showAllCosets,
    showHeatmap,
  } = useGroup()
  const { setHoverElement } = useHover()

  const props: TableViewProps = {
    group: currentGroup,
    selectedElements,
    canvasTransform,
    viewBoxSize,
    subsets,
    cosetElementMap,
    cosetColors,
    cosetData,
    cosetType,
    showAllCosets,
    forceShowLargeGroup: forceShowLargeGroupViews.has('table'),
    onForceShowLargeGroup: allow => setForceShowLargeGroupForView('table', allow),
    showHeatmap,
    onSelect: selectElement,
    onHover: setHoverElement,
  }
  return <TableView {...props} />
}
