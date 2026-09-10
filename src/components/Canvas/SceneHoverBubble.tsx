import type { CSSProperties } from 'react'
import { elementOrder } from '../../core/algebra/elementOrder'
import type { Group, GroupElement } from '../../core/types'

/**
 * SceneHoverBubble —— 悬停就地气泡（默认实现）。
 *
 * 配合 `useSceneState().hoverBubble` 使用；也可在自建宿主里独立渲染。
 * 配色读 `theme.css` 的自定义属性（经 `data-theme` 作用域），因此天然跟随视图主题，
 * 不写死颜色；未引入 `theme.css` 时由内联兜底色保证可读。
 *
 * 定位：`anchor` 是元素在容器内的屏幕坐标（Scene 的 `onHover` 第二参），
 * 气泡默认浮在锚点正上方居中。`anchor` 为空（如表格视图不提供锚点）时不渲染。
 */
export interface SceneHoverBubbleProps {
  element: GroupElement | null
  anchor?: { x: number; y: number } | null
  /** 缺省 `'dark'`（与 `theme.css` 默认块一致） */
  theme?: 'dark' | 'light'
  /** 传入则在气泡里补一行「阶 = n」（元素阶是排名第一的高频信息） */
  group?: Group | null
  /** 相对锚点的额外偏移；缺省 `{ x: 0, y: -14 }` */
  offset?: { x: number; y: number }
}

export function SceneHoverBubble({
  element,
  anchor,
  theme = 'dark',
  group,
  offset,
}: SceneHoverBubbleProps) {
  if (!element || !anchor) return null

  const dx = offset?.x ?? 0
  const dy = offset?.y ?? -14
  const order = group ? elementOrder(group, element) : null

  const box: CSSProperties = {
    position: 'absolute',
    left: anchor.x + dx,
    top: anchor.y + dy,
    transform: 'translate(-50%, -100%)',
    pointerEvents: 'none',
    zIndex: 20,
    padding: '5px 9px',
    borderRadius: 6,
    border: '1px solid var(--border-primary, #2d2d4a)',
    background: 'var(--bg-tooltip, rgba(21,21,37,0.95))',
    color: 'var(--text-primary, #e0e0e0)',
    fontSize: 12,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
  }

  const dim: CSSProperties = { color: 'var(--text-dim, #888888)', fontSize: 10 }

  return (
    <div data-theme={theme} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div data-testid="scene-hover-bubble" style={box}>
        <div style={{ fontWeight: 600 }}>{element.label}</div>
        {(order !== null || element.id !== element.label) && (
          <div style={dim}>
            {element.id !== element.label && <span>{element.id}</span>}
            {order !== null && (
              <span>{element.id !== element.label ? ' · ' : ''}阶 {order}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
