/**
 * SceneWindow — @groupviz/react 通用窗口壳容器（FGVE「壳能力参数化」）。
 *
 * 定位：ViewWindow（主应用浮动窗壳）与「裸 Scene 直渲」之间的中间形态。壳只管
 * 窗口 chrome，children 渲任意 packaged Scene（消费端自持 Scene props，本组件
 * 零 Scene 耦合）。两个层次控制壳能力：
 *
 *   shell: 'none'   → 裸内容容器（等同 Frame 直嵌，不带任何 chrome）
 *          'chrome' → 标题栏 + 能力按钮 + 拖拽/resize + ⚙ View Config 面板 + persist
 *   capabilities:    chrome 形态下逐项露/藏内容；不传 = 全开，显式 false 关闭该项。
 *
 * 零 context / i18n / zod 依赖：主题用 theme prop（颜色自含 hex，不读 CSS 变量），
 * 按钮图标 + 英文 title（与主应用 FloatingViewWindow 一致），持久化 minimal
 * localStorage（try/catch 宽容，不引 utils/persistence 的 zod 校验链）。
 *
 * 约定：parent 需 position:relative；chrome 窗口 absolute 定位可拖可缩；shell:'none'
 * 时返回普通块级容器（不脱离文档流）。
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { Group } from '../../core/types'

export type SceneWindowTheme = 'dark' | 'light'

/** 窗口级 config（行为开关；Scene 级参数由消费端以 Scene props 直传，不经此壳） */
export interface SceneWindowConfig {
  /** 📌 锁定窗口移动（拖拽禁用） */
  locked?: boolean
  /** 标题栏 info 区显示群符号/阶/名 */
  showInfo?: boolean
  /** 8 向 resize 手柄 */
  resizable?: boolean
  /** 定位用 fixed（视口固定）而非 absolute */
  viewportFixed?: boolean
  /** 标题栏整组隐藏（插图等专注阅读场景） */
  showControls?: boolean
}

/** chrome 内容裁剪位；缺省全开。false 关某项 */
export interface SceneWindowCaps {
  /** 标题栏本体（含 info 区） */
  titlebar?: boolean
  /** 标题栏拖拽移动（需 titlebar 且 locked=false） */
  drag?: boolean
  /** resize 手柄（8 向） */
  resize?: boolean
  /** 📌 锁定移动按钮 */
  lockMove?: boolean
  /** i 信息开关按钮 */
  toggleInfo?: boolean
  /** ⚙ View Config 面板（窗口 config 编辑） */
  params?: boolean
  /** × 关闭按钮（触发 onClose） */
  close?: boolean
  /** storageKey 持久化（位置/尺寸/config） */
  persist?: boolean
}

interface SceneWindowProps {
  /** 标题栏主文案；缺省回退 group.symbol */
  title?: string
  /** 标题/信息兜底源 */
  group?: Group | null
  /** 窗口主题（背景/边框/文字配色）；缺省 'dark' */
  theme?: SceneWindowTheme
  /** 'chrome' 浮动窗壳（缺省）/ 'none' 裸内容容器 */
  shell?: 'none' | 'chrome'
  /** chrome 内容裁剪；不传全开 */
  capabilities?: SceneWindowCaps
  /** 窗口 config（受控传入或非受控初值） */
  config?: SceneWindowConfig
  onConfigChange?: (c: SceneWindowConfig) => void
  /** 持久化键（cap.persist 且给键才读写 localStorage，键空间 gv-sw-*） */
  storageKey?: string
  defaultPosition?: { x: number; y: number }
  defaultSize?: { width: number; height: number }
  onClose?: () => void
  /** 任意 packaged Scene（或任意内容） */
  children: ReactNode
}

const TBAR_H = 32
const MIN_W = 220
const MIN_H = 160
const PARAMS_W = 208
const PARAMS_GAP = 8
let _swZ = 5000

const DEFAULT_POS = { x: 12, y: 12 }
const DEFAULT_SIZE = { width: 440, height: 320 }
const DEFAULT_CFG: Required<SceneWindowConfig> = {
  locked: false, showInfo: false, resizable: true, viewportFixed: false, showControls: true,
}

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const RESIZE_CURSORS: Record<ResizeDir, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
}
const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

// ── 主题色板（不读 CSS 变量，保证包消费端与主应用全局主题解耦） ──
const PALETTES: Record<SceneWindowTheme, {
  tbarBg: string; tbarBorder: string; tbarText: string; dim: string; contentBg: string;
  panelBg: string; panelBorder: string; panelText: string; accent: string;
}> = {
  dark: {
    tbarBg: '#131c2b', tbarBorder: '#24324a', tbarText: '#94a3b8', dim: '#64748b',
    contentBg: '#0b1220', panelBg: '#111c2b', panelBorder: '#24324a', panelText: '#cbd5e1',
    accent: '#4ecdc4',
  },
  light: {
    tbarBg: '#eef2f7', tbarBorder: '#d0d9e4', tbarText: '#475569', dim: '#8fa0b3',
    contentBg: '#f8fafc', panelBg: '#ffffff', panelBorder: '#d0d9e4', panelText: '#334155',
    accent: '#0e7490',
  },
}

/** 打包键 → 规范解析（宽容：损坏/缺字段一律回退，不抛） */
function loadSw<T>(key: string, schema: (raw: Record<string, unknown>) => T | null): T | null {
  try {
    const raw = localStorage.getItem(`gv-sw-${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return schema(parsed)
  } catch {
    return null
  }
}
function saveSw(key: string, data: unknown) {
  try {
    localStorage.setItem(`gv-sw-${key}`, JSON.stringify(data))
  } catch {
    /* 隐私模式/配额：静默 */
  }
}

function mergeCfg(base: SceneWindowConfig, extra?: SceneWindowConfig): SceneWindowConfig {
  return extra ? { ...base, ...extra } : base
}

/** 一次读持久化三件套（宽容：缺/坏字段回 undefined，不抛） */
function readPersist(key?: string, enabled = true): { pos?: { x: number; y: number }; size?: { width: number; height: number }; cfg?: SceneWindowConfig } | null {
  if (!key || !enabled) return null
  return loadSw(key, raw => {
    const p = raw.pos as { x?: number; y?: number } | undefined
    const s = raw.size as { width?: number; height?: number } | undefined
    const rc = raw.config as Record<string, unknown> | undefined
    return {
      pos: p && typeof p.x === 'number' && typeof p.y === 'number' ? { x: p.x, y: p.y } : undefined,
      size: s && typeof s.width === 'number' && typeof s.height === 'number'
        ? { width: Math.max(MIN_W, s.width), height: Math.max(MIN_H, s.height) } : undefined,
      cfg: rc && typeof rc === 'object' ? (rc as SceneWindowConfig) : undefined,
    }
  })
}

/** 页面级辅助：stable 空对象引用 */
const EMPTY = {}

export function SceneWindow({
  title,
  group,
  theme = 'dark',
  shell = 'chrome',
  capabilities,
  config: configProp,
  onConfigChange,
  storageKey,
  defaultPosition,
  defaultSize,
  onClose,
  children,
}: SceneWindowProps) {
  const P = PALETTES[theme]
  // ── 窗口 state（非受控）：config + 几何(pos+size)；persist 全在 lazy init 合并，effect 只写不读 ──
  const persistOn = !!storageKey && capabilities?.persist !== false
  const [cfg, setCfg] = useState<SceneWindowConfig>(() => {
    const c: SceneWindowConfig = { ...DEFAULT_CFG, ...(configProp ?? EMPTY) }
    const saved = readPersist(storageKey, persistOn)
    return saved?.cfg ? mergeCfg(c, saved.cfg) : c
  })
  const updateConfig = useCallback((patch: SceneWindowConfig) => {
    setCfg(prev => {
      const next = mergeCfg(prev, patch)
      onConfigChange?.(next)
      return next
    })
  }, [onConfigChange])

  const [geom, setGeom] = useState(() => {
    const saved = readPersist(storageKey, persistOn)
    return {
      pos: saved?.pos ?? defaultPosition ?? DEFAULT_POS,
      size: saved?.size ?? defaultSize ?? DEFAULT_SIZE,
    }
  })
  const { pos, size } = geom

  // 持久化写：几何 + config（cap.persist 且 storageKey）
  useEffect(() => {
    if (persistOn) saveSw(storageKey as string, { pos, size, config: cfg })
  }, [pos, size, cfg, storageKey, persistOn])

  // 置顶（mousedown 时 bring front）
  const [z, setZ] = useState(() => ++_swZ)
  const bringFront = useCallback(() => setZ(++_swZ), [])

  const [paramsOpen, setParamsOpen] = useState(false)

  // 拖拽（标题栏）
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if (cfg.locked) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    bringFront()
    const start = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y }
    const move = (ev: MouseEvent) => {
      setGeom(g => ({ ...g, pos: { x: start.ox + ev.clientX - start.mx, y: start.oy + ev.clientY - start.my } }))
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [cfg.locked, pos, bringFront])

  // resize（8 向手柄）
  const onResizeStart = useCallback((dir: ResizeDir) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    bringFront()
    const start = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y, ow: size.width, oh: size.height }
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - start.mx
      const dy = ev.clientY - start.my
      let { x, y, width, height } = { x: start.ox, y: start.oy, width: start.ow, height: start.oh }
      if (dir.includes('e')) width = Math.max(MIN_W, start.ow + dx)
      if (dir.includes('s')) height = Math.max(MIN_H, start.oh + dy)
      if (dir.includes('w')) { width = Math.max(MIN_W, start.ow - dx); x = start.ox + (start.ow - width) }
      if (dir.includes('n')) { height = Math.max(MIN_H, start.oh - dy); y = start.oy + (start.oh - height) }
      setGeom({ pos: { x, y }, size: { width, height } })
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [pos, size, bringFront])

  // ── shell:'none'：裸内容容器（块级，不脱离文档流，无 chrome） ──
  if (shell === 'none') {
    return (
      <div data-testid="sw-none" style={{ width: '100%', height: '100%', minHeight: 160, background: P.contentBg, overflow: 'hidden', position: 'relative' }}>
        {children}
      </div>
    )
  }

  // ── shell:'chrome' ──
  const caps = {
    titlebar: true, drag: true, resize: true, lockMove: true, toggleInfo: true,
    params: true, close: true, persist: true,
    ...(capabilities ?? EMPTY),
  } as Required<SceneWindowCaps>
  const showControls = cfg.showControls !== false
  const titleText = title ?? (group ? group.symbol : 'View')
  const infoText = cfg.showInfo && group
    ? `${group.symbol} · |G|=${group.order} · ${group.name ?? ''}`
    : ''
  const btnBase: CSSProperties = {
    background: 'none', border: 'none', color: P.dim, cursor: 'pointer',
    fontSize: 14, padding: '2px 5px', lineHeight: 1, borderRadius: 4,
  }
  const tglBtn = (on: boolean, color: string): CSSProperties => ({ ...btnBase, color: on ? color : P.dim })

  return (
    <div
      data-testid="sw-chrome"
      style={{ position: cfg.viewportFixed ? 'fixed' : 'absolute', left: pos.x, top: pos.y, zIndex: z }}
      onMouseDown={bringFront}
    >
      {/* 窗身（overflow hidden 收内容；⚙ 面板在 wrapper 外侧不被裁） */}
      <div style={{ width: size.width, background: P.contentBg, border: `1px solid ${P.tbarBorder}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 10px 34px rgba(0,0,0,0.30)' }}>
      {/* titlebar */}
      {caps.titlebar && showControls && (
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 6px 0 10px', height: TBAR_H, background: P.tbarBg,
            borderBottom: `1px solid ${P.tbarBorder}`, cursor: caps.drag && !cfg.locked ? 'grab' : 'default',
            fontSize: 13, color: P.tbarText, userSelect: 'none', flexShrink: 0, gap: 4,
          }}
          onMouseDown={caps.drag ? onDragStart : undefined}
        >
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titleText}
            {infoText && <span style={{ fontWeight: 400, fontSize: 11, color: P.dim, marginLeft: 8 }}>{infoText}</span>}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {caps.lockMove && (
              <button title="Lock move" style={tglBtn(!!cfg.locked, '#f97316')}
                onClick={() => updateConfig({ locked: !cfg.locked })}>
                {cfg.locked ? '📌' : '📍'}
              </button>
            )}
            {caps.toggleInfo && (
              <button title="Toggle info" style={tglBtn(!!cfg.showInfo, '#84cc16')}
                onClick={() => updateConfig({ showInfo: !cfg.showInfo })}>i</button>
            )}
            {caps.params && (
              <button title="Parameters" style={tglBtn(paramsOpen, '#a78bfa')}
                onClick={() => { bringFront(); setParamsOpen(o => !o) }}>⚙</button>
            )}
            {caps.close && (
              <button title="Close" style={btnBase}
                onClick={onClose}
                onMouseEnter={e => (e.currentTarget.style.color = '#f44')}
                onMouseLeave={e => (e.currentTarget.style.color = P.dim)}>×</button>
            )}
          </div>
        </div>
      )}

      {/* content viewport */}
      <div style={{ position: 'relative', height: size.height - (caps.titlebar && showControls ? TBAR_H : 0), overflow: 'hidden', background: P.contentBg }}>
        {children}
        {/* resize handles */}
        {caps.resize && cfg.resizable !== false && RESIZE_DIRS.map(dir => {
          const s = 8
          const c = 20
          const base: CSSProperties = { position: 'absolute', zIndex: 10, cursor: RESIZE_CURSORS[dir], background: 'transparent' }
          const rect: CSSProperties = (() => {
            switch (dir) {
              case 'n': return { top: 0, left: s, right: s, height: s }
              case 's': return { bottom: 0, left: s, right: s, height: s }
              case 'e': return { right: 0, top: s, bottom: s, width: s }
              case 'w': return { left: 0, top: s, bottom: s, width: s }
              case 'ne': return { top: 0, right: 0, width: c, height: c }
              case 'nw': return { top: 0, left: 0, width: c, height: c }
              case 'se': return { bottom: 0, right: 0, width: c, height: c }
              case 'sw': return { bottom: 0, left: 0, width: c, height: c }
            }
          })()
          return <div key={dir} style={{ ...base, ...rect }} onMouseDown={onResizeStart(dir)} />
        })}
      </div>
      </div>{/* /窗身 */}

      {/* ⚙ View Config panel（窗口外侧，不遮内容） */}
      {paramsOpen && caps.params && (
        <div
          style={{
            position: cfg.viewportFixed ? 'fixed' : 'absolute',
            left: size.width + PARAMS_GAP, top: 0, width: PARAMS_W,
            maxHeight: size.height, overflowY: 'auto', zIndex: z + 1,
            background: P.panelBg, border: `1px solid ${P.panelBorder}`, borderRadius: 6,
            boxShadow: '0 8px 32px rgba(0,0,0,0.28)', padding: '8px 10px',
            fontSize: 12, color: P.panelText,
          }}
          onMouseDown={bringFront}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>View Config</div>
          {caps.lockMove && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <input type="checkbox" checked={!!cfg.locked} onChange={e => updateConfig({ locked: e.target.checked })} style={{ accentColor: P.accent }} />
              Lock move
            </label>
          )}
          {caps.toggleInfo && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <input type="checkbox" checked={!!cfg.showInfo} onChange={e => updateConfig({ showInfo: e.target.checked })} style={{ accentColor: P.accent }} />
              Show info
            </label>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={!!cfg.viewportFixed} onChange={e => updateConfig({ viewportFixed: e.target.checked })} style={{ accentColor: P.accent }} />
            Fixed to viewport
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={cfg.showControls !== false} onChange={e => updateConfig({ showControls: e.target.checked })} style={{ accentColor: P.accent }} />
            Show controls
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <input type="checkbox" checked={cfg.resizable !== false} onChange={e => updateConfig({ resizable: e.target.checked })} style={{ accentColor: P.accent }} />
            Resizable
          </label>
          {/* 说明：Scene 级参数不经本壳，由宿主以 Scene props 直传 */}
          <div style={{ marginTop: 6, fontSize: 10, color: P.dim, lineHeight: 1.5 }}>
            Scene props are controlled by the host (embed your own &lt;Scene …/&gt; as children).
          </div>
        </div>
      )}
    </div>
  )
}

export type { SceneWindowProps }
