import { useGroup } from '../../context/useGroup'
import { useTranslation } from '../../i18n/useTranslation'
import { useTheme } from '../../theme/useTheme'
import { SymmetryViewScene } from './SymmetryViewScene'

/** 主画布适配器：从全局 Provider 组装 SymmetryViewScene 所需 props（保留原行为不变）。 */
export function SymmetryView() {
  const {
    currentGroup, symmetryShowAction, symmetryRotateSpeed, symmetryVariant, symmetryActionElementId, setHintMessage,
    symmetryCompose, symmetryApplyNonce, symmetryResetNonce, symmetryBeltRestoreNonce, setSymmetryPose, setSymmetryBelt,
    symmetryCenterOn,
  } = useGroup()
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
      compose={symmetryCompose}
      // 应用信号走 replaySignal 通道：叠加模式下自增即把元素旋转左乘到当前姿态
      replaySignal={symmetryApplyNonce}
      resetSignal={symmetryResetNonce}
      onHint={setHintMessage}
      onPoseChange={setSymmetryPose}
      onBeltChange={setSymmetryBelt}
      beltRestoreSignal={symmetryBeltRestoreNonce}
      centerOn={symmetryCenterOn}
    />
  )
}
