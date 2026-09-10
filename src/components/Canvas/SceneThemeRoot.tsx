import type { CSSProperties, ReactNode } from 'react'

/**
 * SceneThemeRoot —— 视图主题作用域（FGVE「主题统一」）。
 *
 * 问题：主应用把主题做成**全局 CSS 变量**（`src/index.css` 的 `:root` /
 * `[data-theme="light"]`）；`@groupviz/react` 里 3D 系 Scene 各自带 `theme` prop，
 * 而全部 2D Scene 没有——外部嵌入想「单独把某张图切成浅色」只能靠外层 div 隐式挂
 * `data-theme`，且各视图行为不一致（`dark` / `theme` / 无）。
 *
 * 方案：2D Scene 统一新增 `theme?: 'dark' | 'light'`，内部用本组件包一层。
 * **缺省不传 → 直接渲染 children（零额外 DOM）**，完全保留「跟随外层主题」的既有行为，
 * 因此主应用与既有宿主不受影响；显式传值时才注入 `data-theme` 作用域，
 * 让 `theme.css` 里的浅/深色变量块在该子树内生效。
 */
export type SceneTheme = 'dark' | 'light'

export interface SceneThemeRootProps {
  /** 缺省 `undefined`（不注入作用域，继承外层主题） */
  theme?: SceneTheme
  children: ReactNode
  /** 附加样式（与内建 `width/height:100%` 合并，内建在前） */
  style?: CSSProperties
  className?: string
}

export function SceneThemeRoot({ theme, children, style, className }: SceneThemeRootProps) {
  if (!theme) return <>{children}</>
  return (
    <div
      data-theme={theme}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-canvas, #0a0a14)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
