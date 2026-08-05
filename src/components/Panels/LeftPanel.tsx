import { ViewPanel } from './ViewPanel'
import { OperationsPanel } from './OperationsPanel'
import { BasicGroupPanel } from './BasicGroupPanel'
import { DirectProductPanel } from './DirectProductPanel'
import { HomomorphismPanel } from './HomomorphismPanel'
import { SemidirectProductPanel } from './SemidirectProductPanel'
import { GroupActionPanel } from './GroupActionPanel'

export function LeftPanel() {
  return (
    <div className="left-panel">
      <ViewPanel />
      <OperationsPanel />
      <BasicGroupPanel />
      <DirectProductPanel />
      <HomomorphismPanel />
      <GroupActionPanel />
      <SemidirectProductPanel />
    </div>
  )
}
