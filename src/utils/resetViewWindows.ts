import { removeAllStoredKeys } from './persistence'

/** Broadcast event name: every ViewWindow resets itself to defaults. */
export const VIEWWINDOW_RESET_EVENT = 'gv-vw-reset-all'

/** One-click reset ALL ViewWindows: clear gv-vw-* persistence + broadcast reset. */
export function resetAllViewWindows(): void {
  if (typeof window === 'undefined') return
  removeAllStoredKeys('gv-vw-')
  window.dispatchEvent(new Event(VIEWWINDOW_RESET_EVENT))
}