import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import { SymmetryViewScene } from './SymmetryViewScene'

/** 主画布适配器：从全局 Provider 组装 SymmetryViewScene 所需 props（保留原行为不变）。 */
export function SymmetryView() {
  const { currentGroup, symmetryShowAction, symmetryRotateSpeed, symmetryVariant, symmetryActionElementId, setHintMessage } = useGroup()
  const { t } = useTranslation()
  const { theme } = useTheme()
  if (!currentGroup) return <div className="view-empty"><p>{t('canvas.noGroupCreate')}</p></div>
  return (
    <SymmetryViewScene
      group={currentGroup}
      dark={theme === 'dark'}
      variant={symmetryVariant}
      showAction={symmetryShowAction}
      actionElementId={symmetryActionElementId}
      rotateSpeed={symmetryRotateSpeed}
      onHint={setHintMessage}
    />
  )
}
