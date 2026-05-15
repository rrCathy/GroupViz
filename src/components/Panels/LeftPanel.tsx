import { useGroup } from '../../context/useGroup'
import { GroupCreationPanel } from './GroupCreationPanel'
import { ViewModePanel } from './ViewModePanel'
import { DirectProductPanel } from './DirectProductPanel'
import { CayleySettingsPanel } from './CayleySettingsPanel'
import { OperationsPanel } from './OperationsPanel'

export function LeftPanel() {
  const { currentView } = useGroup()

  return (
    <div className="left-panel">
      <GroupCreationPanel />
      <ViewModePanel />
      <DirectProductPanel />
      {(currentView === 'cayley' || currentView === '3d') && (
        <CayleySettingsPanel />
      )}
      <OperationsPanel />
    </div>
  )
}
