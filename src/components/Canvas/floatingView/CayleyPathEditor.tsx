// ── 凯莱图路径高亮编辑器（自 FloatingViewWindow.tsx 拆出，纯搬家）──
import { useState } from 'react'
import type { CayleyPathHighlight } from '../../../core/types/viewConfig'
import { segBtn, MINI_BTN } from './styles'

const PATH_COLORS = ['#ffd93d', '#ff6b6b', '#4ecdc4', '#a78bfa', '#f97316']

/**
 * 凯莱图路径高亮编辑器（VCL）。
 * 两种输入：Elements（元素引用序列，相邻须有边）/ Word（生成元单词，从单位元连续作用）。
 * 本地 text 态避免逐键回写打断输入；`resetKey`（群符号）变化时从 value 重新同步。
 */
export function CayleyPathEditor({
  value, onChange, resetKey,
}: {
  value: CayleyPathHighlight | null
  onChange: (next: CayleyPathHighlight | null) => void
  resetKey: string
}) {
  // 本地 text 态：用「渲染期 key 校正」同步换群（resetKey 变化）时的外部值，
  // 避免在 effect 里同步 setState（React Compiler 会判为级联渲染）
  const externalText = (value?.elements ?? value?.word ?? []).join(' ')
  const [state, setState] = useState<{ key: string; text: string }>({ key: resetKey, text: externalText })
  if (state.key !== resetKey) {
    setState({ key: resetKey, text: externalText })
  }
  const text = state.key === resetKey ? state.text : externalText
  const setText = (t: string) => setState({ key: resetKey, text: t })

  const mode: 'elements' | 'word' = value?.word && !value?.elements ? 'word' : 'elements'

  const commit = (t: string, m: 'elements' | 'word', patch?: Partial<CayleyPathHighlight>) => {
    const tokens = t.split(/[\s,]+/).filter(Boolean)
    if (tokens.length === 0) {
      onChange(null)
      return
    }
    onChange({
      ...(value ?? {}),
      elements: m === 'elements' ? tokens : undefined,
      word: m === 'word' ? tokens : undefined,
      ...patch,
    })
  }

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 600 }}>Path highlight</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{mode}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        <button style={segBtn(mode === 'elements')} onClick={() => commit(text, 'elements')}>Elements</button>
        <button style={segBtn(mode === 'word')} onClick={() => commit(text, 'word')}>Word</button>
      </div>
      <input
        value={text}
        placeholder={mode === 'word' ? 'generators, e.g.  a a b' : 'refs, e.g.  e (12) (123)'}
        onChange={e => {
          setText(e.target.value)
          commit(e.target.value, mode)
        }}
        style={{
          width: '100%', background: 'var(--bg-primary)', color: 'var(--text-secondary)',
          border: '1px solid var(--border-primary)', borderRadius: 4, padding: '2px 4px', marginBottom: 4,
        }}
      />
      {value && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!value.animate} onChange={e => commit(text, mode, { animate: e.target.checked })} />Animate
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!value.showOrder} onChange={e => commit(text, mode, { showOrder: e.target.checked })} />Order
            </label>
            <label title="淡化其余边，只留路径醒目" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
              <input type="checkbox" checked={value.dimOthers !== false} onChange={e => commit(text, mode, { dimOthers: e.target.checked })} />Dim others
            </label>
            {mode === 'word' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!value.closed} onChange={e => commit(text, mode, { closed: e.target.checked })} />Closed
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {PATH_COLORS.map(c => (
              <button
                key={c}
                title={c}
                onClick={() => commit(text, mode, { color: c })}
                style={{
                  width: 16, height: 16, borderRadius: 4, background: c, cursor: 'pointer', padding: 0,
                  border: (value.color ?? '#ffd93d') === c ? '2px solid var(--text-primary)' : '1px solid var(--border-primary)',
                }}
              />
            ))}
            <button style={MINI_BTN} onClick={() => { setText(''); onChange(null) }}>Clear</button>
          </div>
        </>
      )}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
        {mode === 'word'
          ? 'Word = generators applied from identity (shows the walk close up)'
          : 'Elements = refs joined by existing edges (unconnected pairs highlight nodes only)'}
      </div>
    </div>
  )
}
