import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useSceneState } from '../hooks/useSceneState'
import type { SceneState } from '../hooks/useSceneState'
import { SetView } from '../components/Canvas/SetView'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createSymmetricGroup } from '../core/groups/SymmetricGroup'
import type { Group } from '../core/types'

const c6 = createCyclicGroup(6)
const s3 = createSymmetricGroup(3)

/**
 * ⚠️ 本文件兼作 `react-hooks/refs` 的**静态回归守卫**。
 *
 * React Compiler 的 `react-hooks/refs` 规则会把「顶层返回了 ref 写入函数 / 含
 * RefObject」的 hook 整体判为 ref 载体，此后宿主每次 `s.xxx` 读取都会报
 * 「Cannot access refs during render」。所以下面所有 `s.xxx` 用法（以及 Probe 里的
 * `<div {...s.hostProps}>`）本身就是断言：**只要 useSceneState 的返回体顶层再次出现
 * ref 载体，`npm run lint` 立刻红** —— 不需要额外写用例复现。
 * 运行时守卫见文末「返回体形状」一节的显式断言。
 */

/** 探针：把 hook 的各项能力接到 DOM 上断言 */
function Probe({ group, locked }: { group: Group | null; locked?: boolean }) {
  const s = useSceneState(group, { locked })
  return (
    <div {...s.hostProps} data-testid="host">
      <SetView group={group} {...s.sceneProps} />
      <span data-testid="vb">{s.viewBoxSize.width}x{s.viewBoxSize.height}</span>
      <span data-testid="scale">{s.canvasTransform.scale}</span>
      <span data-testid="tx">{s.canvasTransform.x}</span>
      <span data-testid="sel">{[...s.selectedElements].join(',')}</span>
      <span data-testid="hover">{s.hovered?.label ?? ''}</span>
      <button data-testid="pick" onClick={() => group && s.select(group.elements[1].id, false)}>pick</button>
      <button data-testid="add" onClick={() => group && s.select(group.elements[2].id, true)}>add</button>
      <button data-testid="clear" onClick={s.clearSelection}>clear</button>
      <button data-testid="reset" onClick={s.resetTransform}>reset</button>
      <button data-testid="zoom2" onClick={() => s.zoomBy(2)}>zoom2</button>
      <button
        data-testid="hover-on"
        onClick={() => group && s.sceneProps.onHover(group.elements[1], { x: 20, y: 30 })}
      >hoverOn</button>
      <button data-testid="hover-off" onClick={() => s.sceneProps.onHover(null)}>hoverOff</button>
      <button
        data-testid="node-set"
        onClick={() => group && s.onNodePositionChange(group.elements[1].id, 7, 9)}
      >nodeSet</button>
      <span data-testid="node">{group ? JSON.stringify(s.getNodePosition(group.elements[1].id) ?? null) : ''}</span>
      {s.hoverBubble}
    </div>
  )
}

let rectSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  // happy-dom 的 getBoundingClientRect 默认全 0 → 量出 1x1；这里给一个真实尺寸
  rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 400, height: 300, top: 0, left: 0, right: 400, bottom: 300, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect)
})
afterEach(() => {
  rectSpy.mockRestore()
})

describe('useSceneState · 四件套', () => {
  it('ResizeObserver 量出的尺寸直接喂给 Scene，无需宿主自算 viewBoxSize', () => {
    render(<Probe group={c6} />)
    expect(screen.getByTestId('vb').textContent).toBe('400x300')
    // Scene 真的按这个尺寸渲染了
    const svg = document.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 400 300')
  })

  it('sceneProps 可直接 spread（选中 / 变换 / 尺寸 / 回调齐备）', () => {
    const { container } = render(<Probe group={c6} />)
    // C₆ 六个节点渲染出来 → selectedElements + viewBoxSize 已被 Scene 正确消费
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(6)
  })

  it('viewBoxSize 兜底值可配（首帧 / SSR）', () => {
    function Probe2() {
      const s = useSceneState(c6, { fallbackViewBoxSize: { width: 123, height: 45 } })
      return <span data-testid="vb2">{s.viewBoxSize.width}x{s.viewBoxSize.height}</span>
    }
    render(<Probe2 />)
    // 有 ResizeObserver 时立即被实测值覆盖；无则保持兜底
    expect(screen.getByTestId('vb2').textContent).toMatch(/123x45|400x300/)
  })
})

describe('useSceneState · 选中语义', () => {
  it('非追加 → 单选替换；追加 → 切换成员', () => {
    render(<Probe group={c6} />)
    expect(screen.getByTestId('sel').textContent).toBe('')
    fireEvent.click(screen.getByTestId('pick'))
    expect(screen.getByTestId('sel').textContent).toBe(c6.elements[1].id)
    fireEvent.click(screen.getByTestId('add'))
    expect(screen.getByTestId('sel').textContent).toBe(`${c6.elements[1].id},${c6.elements[2].id}`)
    // 再点一次同一元素 → 追加语义下取消选中
    fireEvent.click(screen.getByTestId('add'))
    expect(screen.getByTestId('sel').textContent).toBe(c6.elements[1].id)
    fireEvent.click(screen.getByTestId('clear'))
    expect(screen.getByTestId('sel').textContent).toBe('')
  })
})

describe('useSceneState · 平移 / 缩放', () => {
  it('拖拽平移更新 canvasTransform', () => {
    render(<Probe group={c6} />)
    const host = screen.getByTestId('host')
    fireEvent.mouseDown(host, { clientX: 10, clientY: 10, button: 0 })
    fireEvent.mouseMove(host, { clientX: 60, clientY: 35 })
    expect(screen.getByTestId('tx').textContent).toBe('50')
    fireEvent.mouseUp(host)
    fireEvent.mouseMove(host, { clientX: 999, clientY: 999 })
    // 抬起后继续移动不再平移
    expect(screen.getByTestId('tx').textContent).toBe('50')
  })

  it('滚轮缩放改变 scale', () => {
    render(<Probe group={c6} />)
    expect(screen.getByTestId('scale').textContent).toBe('1')
    fireEvent.wheel(screen.getByTestId('host'), { deltaY: 100, clientX: 200, clientY: 150 })
    expect(screen.getByTestId('scale').textContent).toBe('0.9')
    fireEvent.wheel(screen.getByTestId('host'), { deltaY: -100, clientX: 200, clientY: 150 })
    expect(Number(screen.getByTestId('scale').textContent)).toBeCloseTo(0.99, 5)
  })

  it('滚轮事件不带指针坐标时退回容器中心，且不会把变换写成 NaN', () => {
    render(<Probe group={c6} />)
    fireEvent.wheel(screen.getByTestId('host'), { deltaY: 100 })
    expect(screen.getByTestId('scale').textContent).toBe('0.9')
    const tx = Number(screen.getByTestId('tx').textContent)
    expect(Number.isFinite(tx)).toBe(true)
    // 中心锚定不变量：锚点（viewBox 中心 200）在变换前后落在同一屏幕位置
    expect(tx + 200 * 0.9).toBeCloseTo(200, 5)
  })

  it('zoomBy 以倍数缩放；resetTransform 复位', () => {
    render(<Probe group={c6} />)
    fireEvent.click(screen.getByTestId('zoom2'))
    expect(screen.getByTestId('scale').textContent).toBe('2')
    fireEvent.click(screen.getByTestId('reset'))
    expect(screen.getByTestId('scale').textContent).toBe('1')
    expect(screen.getByTestId('tx').textContent).toBe('0')
  })

  it('locked 时禁用平移与缩放', () => {
    render(<Probe group={c6} locked />)
    const host = screen.getByTestId('host')
    fireEvent.mouseDown(host, { clientX: 0, clientY: 0, button: 0 })
    fireEvent.mouseMove(host, { clientX: 80, clientY: 80 })
    fireEvent.wheel(host, { deltaY: 100 })
    expect(screen.getByTestId('tx').textContent).toBe('0')
    expect(screen.getByTestId('scale').textContent).toBe('1')
  })

  it('中键拖动不平移（只认左键）', () => {
    render(<Probe group={c6} />)
    const host = screen.getByTestId('host')
    fireEvent.mouseDown(host, { clientX: 0, clientY: 0, button: 1 })
    fireEvent.mouseMove(host, { clientX: 40, clientY: 0 })
    expect(screen.getByTestId('tx').textContent).toBe('0')
  })
})

describe('useSceneState · 悬停气泡', () => {
  it('onHover 带来元素与锚点 → 内建气泡出现；清空后消失', () => {
    render(<Probe group={c6} />)
    expect(screen.queryByTestId('scene-hover-bubble')).toBeNull()
    fireEvent.click(screen.getByTestId('hover-on'))
    expect(screen.getByTestId('hover').textContent).toBe(c6.elements[1].label)
    expect(screen.getByTestId('scene-hover-bubble')).toBeTruthy()
    fireEvent.click(screen.getByTestId('hover-off'))
    expect(screen.queryByTestId('scene-hover-bubble')).toBeNull()
    expect(screen.getByTestId('hover').textContent).toBe('')
  })

  it('renderHoverBubble 可自绘并覆盖内建气泡', () => {
    function Probe3() {
      const s = useSceneState(c6, {
        renderHoverBubble: (el) => <span data-testid="my-bubble">custom:{el.label}</span>,
      })
      return (
        <div {...s.hostProps}>
          <button data-testid="h" onClick={() => s.sceneProps.onHover(c6.elements[1], { x: 1, y: 1 })}>h</button>
          {s.hoverBubble}
        </div>
      )
    }
    render(<Probe3 />)
    fireEvent.click(screen.getByTestId('h'))
    expect(screen.getByTestId('my-bubble').textContent).toBe(`custom:${c6.elements[1].label}`)
    expect(screen.queryByTestId('scene-hover-bubble')).toBeNull()
  })
})

describe('useSceneState · 共享节点位置与会话态', () => {
  it('onNodePositionChange / getNodePosition 往返', () => {
    render(<Probe group={c6} />)
    expect(screen.getByTestId('node').textContent).toBe('null')
    fireEvent.click(screen.getByTestId('node-set'))
    expect(screen.getByTestId('node').textContent).toBe('{"x":7,"y":9}')
  })

  it('换群清空悬停 / 选中 / 节点位置', () => {
    const { rerender } = render(<Probe group={c6} />)
    fireEvent.click(screen.getByTestId('pick'))
    fireEvent.click(screen.getByTestId('hover-on'))
    fireEvent.click(screen.getByTestId('node-set'))
    expect(screen.getByTestId('sel').textContent).not.toBe('')
    act(() => { rerender(<Probe group={s3} />) })
    expect(screen.getByTestId('sel').textContent).toBe('')
    expect(screen.getByTestId('hover').textContent).toBe('')
    expect(screen.getByTestId('node').textContent).toBe('null')
  })
})

describe('useSceneState · 返回体形状', () => {
  /** 用 spy 捕获返回体：不能在组件里给外层 `let` 赋值（react-hooks/globals） */
  function captureBundle() {
    const onBundle = vi.fn()
    function Probe5() {
      const s = useSceneState(c6)
      useEffect(() => { onBundle(s) })
      return <div {...s.hostProps} data-testid="p5-host" />
    }
    render(<Probe5 />)
    return onBundle.mock.calls[onBundle.mock.calls.length - 1][0] as SceneState
  }

  it('hostProps.ref 是回调 ref → getHostElement() 返回宿主节点', () => {
    const api = captureBundle()
    expect(typeof api.hostProps.ref).toBe('function')
    expect(api.getHostElement()).toBe(screen.getByTestId('p5-host'))
  })

  it('返回体顶层不得出现 ref 载体（否则宿主所有 s.xxx 都会被 react-hooks/refs 判违规）', () => {
    const api = captureBundle()
    expect('hostRef' in api).toBe(false)
    for (const [key, value] of Object.entries(api)) {
      const isRefLike = !!value && typeof value === 'object' && 'current' in (value as object)
      expect(isRefLike, `SceneState.${key} 不应该是 ref 对象（会污染 react-hooks/refs）`).toBe(false)
    }
  })
})

describe('useSceneState · 受控选中', () => {
  it('传 selectedElements 即受控，变更走回调', () => {
    const onChange = vi.fn()
    const controlled = new Set<string>()
    function Probe4() {
      const s = useSceneState(c6, { selectedElements: controlled, onSelectionChange: onChange })
      return (
        <button data-testid="p4" onClick={() => s.select(c6.elements[1].id, false)}>
          {[...s.selectedElements].join(',')}
        </button>
      )
    }
    render(<Probe4 />)
    fireEvent.click(screen.getByTestId('p4'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect([...onChange.mock.calls[0][0]]).toEqual([c6.elements[1].id])
    // 受控：自身不持有状态，仍显示外部传入的空集
    expect(screen.getByTestId('p4').textContent).toBe('')
  })
})
