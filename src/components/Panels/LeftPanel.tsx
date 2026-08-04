import { GroupPanel } from './GroupPanel'
import { ViewPanel } from './ViewPanel'
import { OperationsPanel } from './OperationsPanel'
import { HomomorphismPanel } from './HomomorphismPanel'
import { SemidirectProductPanel } from './SemidirectProductPanel'

export function LeftPanel() {
  return (
    <div className="left-panel">
      <GroupPanel />
      <SemidirectProductPanel />
      <ViewPanel />
      <OperationsPanel />
      <HomomorphismPanel />
    </div>
  )
}
