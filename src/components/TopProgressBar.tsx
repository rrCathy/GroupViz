import { useTranslation } from '../i18n/useTranslation'

/**
 * Top progress bar shown while heavy computations (backend fetch or local
 * fallback) run for more than 3 seconds. The 3s delay is handled entirely
 * in CSS (animation-delay runs on the compositor, so it keeps animating
 * even while the main thread is blocked by a synchronous fallback).
 */
export function TopProgressBar({ active }: { active: boolean }) {
  const { t } = useTranslation()
  return (
    <div
      className={`top-progress${active ? ' active' : ''}`}
      role="progressbar"
      aria-label={t('ui.computing')}
    >
      <div className="top-progress-bar" />
    </div>
  )
}
