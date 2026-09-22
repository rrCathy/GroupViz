// ── ViewWindow 工具栏与按钮样式（纯搬家）──
import { TBAR_H } from './geometry'

export const TBAR_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 6px 0 10px', height: TBAR_H,
  background: 'var(--bg-interactive)', borderBottom: '1px solid var(--border-primary)',
  cursor: 'grab', fontSize: '13px', color: 'var(--text-secondary)',
  userSelect: 'none', flexShrink: 0, gap: 4,
}

export const BTN_STYLE: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer',
  fontSize: '14px', padding: '2px 5px', lineHeight: 1, borderRadius: 4,
}

export function tglBtn(on: boolean, color: string): React.CSSProperties {
  return { ...BTN_STYLE, color: on ? color : 'var(--text-dim)' }
}

// 分段按钮（左右乘切换）
export function segBtn(on: boolean): React.CSSProperties {
  return {
    ...BTN_STYLE, flex: 1, padding: '3px 6px', fontSize: 11,
    border: '1px solid var(--border-primary)', borderRadius: 4,
    background: on ? 'var(--bg-interactive)' : 'none',
    color: on ? 'var(--text-secondary)' : 'var(--text-dim)',
  }
}

export const MINI_BTN: React.CSSProperties = {
  ...BTN_STYLE, fontSize: 10, padding: '2px 10px',
  border: '1px solid var(--border-primary)', borderRadius: 4,
  background: 'var(--bg-interactive)', color: 'var(--text-secondary)',
}
