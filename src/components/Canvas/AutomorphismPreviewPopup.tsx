/**
 * AutomorphismPreviewPopup — 自同构作用预览（主应用挂载壳）。
 *
 * 触发条件（与 props 化前一致）：当前群是 Aut(G)，且恰好选中一个自同构元素。
 *
 * 本文件只做两件事：
 *   ① 从全局 Provider 组装 props（群 / 选中集合 / 窗口主题）；
 *   ② 用 SceneWindow **在视图内嵌套一层预览窗**（标题栏 + 拖拽 + 8 向 resize +
 *      关闭 + 位置尺寸持久化），替代此前自绘的 fixed 浮层 —— 内容由
 *      `AutomorphismScene` 纯 props 内核渲染（与包消费端共用同一份实现）。
 *
 * 包消费端想把自己的 ViewWindow 里也嵌一个同样的预览窗，照抄本文件的组合即可
 * （见 docs/API.md §4.12）。
 */
import { useCallback, useMemo } from 'react'
import { useGroup } from '../../context/useGroup'
import { useTheme } from '../../theme/useTheme'
import { SceneWindow } from './SceneWindow'
import { AutomorphismScene } from './AutomorphismScene'

const PREVIEW_W = 380
const PREVIEW_H = 440

export function AutomorphismPreviewPopup() {
  const { currentGroup, selectedElements, clearSelection } = useGroup()
  const { viewWindowTheme } = useTheme()

  const parentSymbol = currentGroup?.automorphismParentSymbol ?? null
  const selectedId = selectedElements.size === 1 ? [...selectedElements][0] : null

  // 关闭 = 清空选中（与 props 化前一致）。窗口显隐完全由受控选中派生，不再维护
  // dismissed 标记：清空后重新选中同一个自同构同样会再现（原实现那段标记逻辑等价于此）。
  const handleClose = useCallback(() => clearSelection(), [clearSelection])

  // 首次出现时的默认落点：视口右下（之后由 SceneWindow 的持久化接管）
  const defaultPosition = useMemo(() => {
    if (typeof window === 'undefined') return { x: 24, y: 24 }
    return {
      x: Math.max(0, window.innerWidth - PREVIEW_W - 340),
      y: Math.max(0, window.innerHeight - PREVIEW_H - 80),
    }
  }, [])

  if (!parentSymbol || !selectedId) return null

  return (
    <SceneWindow
      title={`Aut(${parentSymbol})`}
      group={currentGroup}
      theme={viewWindowTheme}
      config={{ viewportFixed: true }}
      capabilities={{ toggleInfo: false, params: false }}
      storageKey="automorphism-preview"
      defaultPosition={defaultPosition}
      defaultSize={{ width: PREVIEW_W, height: PREVIEW_H }}
      onClose={handleClose}
    >
      <AutomorphismScene
        group={currentGroup}
        selectedElements={selectedElements}
        theme={viewWindowTheme}
      />
    </SceneWindow>
  )
}
