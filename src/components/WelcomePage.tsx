import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from '../i18n/useTranslation'

const SPONSOR_LINKS = [
  { label: 'PayPal', url: 'https://paypal.me/rrCathy314', color: '#f6c23e' },
  { label: 'Ko-fi', url: 'https://ko-fi.com/rrcathy314', color: '#ff5e5b' },
  { label: '爱发电', url: 'https://afdian.com/a/rrCathy314', color: '#946ce6' },
]
import { renderTex } from '../utils/texify'
import { createS3 } from '../core/groups/SymmetricGroup'
import { createCyclicGroup } from '../core/groups/CyclicGroup'
import { createDihedralGroup } from '../core/groups/DihedralGroup'
import { createAlternatingGroup } from '../core/groups/AlternatingGroup'
import { createKleinFour, createQuaternion } from '../core/groups/SpecialGroup'
import { createZ4xZ2, createZ2xZ2xZ2, createZ3xZ3 } from '../core/groups/SmallGroups'
import type { Group, GroupElement } from '../core/types'
import { texify } from '../utils/texify'

const FEATURES = [
  { icon: 'G', tex: '|H| \\mid |G|', key: 'welcome.feature.subgroups' },
  { icon: 'C', tex: '\\Gamma(G,C)', key: 'welcome.feature.cayley' },
  { icon: 'S', tex: 'S_n,\\ D_n,\\ A_n,\\ Q_8', key: 'welcome.feature.multigroup' },
  { icon: 'M', tex: 'g \\cdot h = k', key: 'welcome.feature.table' },
  { icon: '3', tex: '\\mathbb{R}^3', key: 'welcome.feature.3d' },
  { icon: 'P', tex: '\\text{Tetrahedron}', key: 'welcome.feature.symmetry' },
]

const GROUPS = ['S₃', 'Zₙ', 'Dₙ', 'Aₙ', 'V₄', 'Q₈', 'Z₄×Z₂', 'Z₂³', 'Z₃×Z₃']

const FLOATING_SYMBOLS = ['G', '∀', '∃', '→', '≅', '≤', '⊲', '×', '∗', 'ℤ', '∘', '↻']

const PREVIEW_STYLES = ['ring', 'generators', 'orders'] as const
type PreviewStyle = typeof PREVIEW_STYLES[number]

function randomStyle(): PreviewStyle {
  return PREVIEW_STYLES[Math.floor(Math.random() * PREVIEW_STYLES.length)]
}

function createGroupBySymbol(symbol: string): Group | null {
  switch (symbol) {
    case 'S₃': return createS3()
    case 'Zₙ': return createCyclicGroup(3)
    case 'Dₙ': return createDihedralGroup(4)
    case 'Aₙ': return createAlternatingGroup(4)
    case 'V₄': return createKleinFour()
    case 'Q₈': return createQuaternion()
    case 'Z₄×Z₂': return createZ4xZ2()
    case 'Z₂³': return createZ2xZ2xZ2()
    case 'Z₃×Z₃': return createZ3xZ3()
    default: return null
  }
}

function computeElementOrder(group: Group, element: GroupElement): number {
  if (element.id === group.identity.id) return 1
  let current = element
  let order = 1
  for (let i = 0; i < group.order; i++) {
    current = group.multiply(current, element)
    order++
    if (current.id === group.identity.id) return order
  }
  return 1
}

const ORDER_COLORS: Record<number, string> = {
  1: '#ffd93d',
  2: '#ff6b6b',
  3: '#4ecdc4',
  4: '#a78bfa',
  5: '#f97316',
  6: '#84cc16',
  8: '#38bdf8',
  10: '#eab308',
  12: '#ec4899',
}

function FloatingSymbol({ symbol, index }: { symbol: string; index: number }) {
  const delay = (index * 0.8) % 8
  const duration = 12 + (index % 7) * 3
  const left = 5 + (index * 8.3) % 90
  const size = 14 + (index % 4) * 8

  return (
    <span
      className="welcome-floating-symbol"
      style={{
        left: `${left}%`,
        fontSize: `${size}px`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
      }}
    >
      {symbol}
    </span>
  )
}

const POPUP_SIZE = 210
const CX = POPUP_SIZE / 2
const CY = POPUP_SIZE / 2
const RING_RADIUS = 68
const NODE_RADIUS = 13

function circularPosition(index: number, total: number, radius: number, cx: number, cy: number) {
  const angle = (index * 2 * Math.PI / total) - Math.PI / 2
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  }
}

function computeGeneratorArrows(group: Group): { targetId: string; color: string }[] {
  return group.generators.map((gen, i) => {
    const target = gen.apply(group.identity)
    return {
      targetId: target?.id ?? '',
      color: ['#ff6b6b', '#4ecdc4', '#ffd93d', '#a78bfa', '#f97316', '#84cc16'][i % 6],
    }
  }).filter(a => a.targetId)
}

function WelcomePreviewPopup({ data, onClose }: { data: PopupData; onClose: () => void }) {
  const { group, style, chipRect } = data
  const n = group.elements.length
  const popupRef = useRef<HTMLDivElement>(null)
  const [animating, setAnimating] = useState(true)
  const identityId = group.identity.id

  useEffect(() => {
    const timer = setTimeout(() => setAnimating(false), 220)
    return () => clearTimeout(timer)
  }, [])

  const top = chipRect.top - POPUP_SIZE - 18
  const left = chipRect.left + chipRect.width / 2 - POPUP_SIZE / 2

  const genArrows = style === 'generators' ? computeGeneratorArrows(group) : []
  const showOrders = style === 'orders'

  const elementOrders = showOrders
    ? new Map(group.elements.map(el => [el.id, computeElementOrder(group, el)]))
    : null

  const positions = new Map(group.elements.map((el, i) =>
    [el.id, circularPosition(i, n, RING_RADIUS, CX, CY)]
  ))

  const getOrderColor = (order: number): string => {
    return ORDER_COLORS[order] ?? '#888'
  }

  return (
    <div className="welcome-preview-backdrop" onClick={onClose}>
      <div
        ref={popupRef}
        className={`welcome-preview-popup${animating ? ' preview-entering' : ''}`}
        style={{ position: 'fixed', top, left, width: POPUP_SIZE, height: POPUP_SIZE + 18 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="welcome-preview-circle">
          <svg viewBox={`0 0 ${POPUP_SIZE} ${POPUP_SIZE}`} width={POPUP_SIZE} height={POPUP_SIZE}>
            <defs>
              <radialGradient id="preview-bg-grad" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="#1e2040" />
                <stop offset="100%" stopColor="#0c0c1a" />
              </radialGradient>
              {genArrows.map((a, i) => (
                <marker key={`gm-${i}`} id={`gen-arrow-${i}`} markerWidth={7} markerHeight={6} refX={6} refY={3} orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill={a.color} />
                </marker>
              ))}
            </defs>

            <circle cx={CX} cy={CY} r={RING_RADIUS + NODE_RADIUS + 10} fill="url(#preview-bg-grad)" />
            <circle cx={CX} cy={CY} r={RING_RADIUS + NODE_RADIUS + 10} fill="none" stroke="#6366f1" strokeWidth="1.5" opacity="0.35" />

            {style === 'generators' && (
              <circle cx={CX} cy={CY} r={4} fill="#ffd93d" opacity="0.8" />
            )}

            {genArrows.map((arrow, ai) => {
              const tp = positions.get(arrow.targetId)
              if (!tp || arrow.targetId === identityId) return null
              const dx = tp.x - CX
              const dy = tp.y - CY
              const dist = Math.sqrt(dx * dx + dy * dy)
              const endX = tp.x - (dx / dist) * (NODE_RADIUS + 3)
              const endY = tp.y - (dy / dist) * (NODE_RADIUS + 3)
              return (
                <line
                  key={`gen-arrow-${ai}`}
                  x1={CX} y1={CY}
                  x2={endX} y2={endY}
                  stroke={arrow.color}
                  strokeWidth="1.6"
                  opacity="0.7"
                  markerEnd={`url(#gen-arrow-${ai})`}
                />
              )
            })}

            {group.elements.map((el) => {
              const pos = positions.get(el.id)
              if (!pos) return null
              const isIdentity = el.id === identityId

              const order = elementOrders?.get(el.id) ?? 0
              const orderColor = getOrderColor(order)

              let fill = '#1a1a2e'
              let stroke = '#4a4a7a'
              let strokeWidth = 1.2

              if (showOrders) {
                fill = isIdentity ? '#2a2a1a' : `${orderColor}18`
                stroke = orderColor
                strokeWidth = isIdentity ? 2 : 1.5
              } else if (isIdentity) {
                fill = '#2a2a1a'
                stroke = '#ffd93d'
                strokeWidth = 2
              }

              return (
                <g key={el.id}>
                  {showOrders && !isIdentity && (
                    <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS + 4} fill={`${orderColor}10`} stroke={orderColor} strokeWidth="0.8" opacity="0.5" />
                  )}
                  <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity="0.85" />
                  <foreignObject
                    x={pos.x - NODE_RADIUS}
                    y={pos.y - 11}
                    width={NODE_RADIUS * 2}
                    height={22}
                    style={{ pointerEvents: 'none' }}
                  >
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '100%', height: '100%', color: '#d0d0f0', fontSize: '10px',
                      }}
                      dangerouslySetInnerHTML={{ __html: renderTex(texify(el.label)) }}
                    />
                  </foreignObject>
                </g>
              )
            })}

            {style === 'orders' && (
              <text x={CX} y={CY - 4} textAnchor="middle" fill="#a78bfa" fontSize="14" fontWeight="bold" opacity="0.8">
                {group.symbol}
              </text>
            )}
            {style !== 'orders' && (
              <text x={CX} y={CY - 4} textAnchor="middle" fill="#a78bfa" fontSize="18" fontWeight="bold" opacity="0.9">
                {group.symbol}
              </text>
            )}
            <text x={CX} y={CY + 14} textAnchor="middle" fill="#666" fontSize="11" opacity="0.6">
              |G| = {group.order}
            </text>
          </svg>
        </div>
        <div className="welcome-preview-pointer" />
      </div>
    </div>
  )
}

interface WelcomePageProps {
  onEnter: () => void
}

export function WelcomePage({ onEnter }: WelcomePageProps) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const { t, lang, setLang } = useTranslation()
  const [activeChip, setActiveChip] = useState<string | null>(null)
  const [popupData, setPopupData] = useState<PopupData | null>(null)
  const [sponsorOpen, setSponsorOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    return () => setPopupData(null)
  }, [])

  const handleGroupClick = useCallback((symbol: string, e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation()
    if (activeChip === symbol) {
      setActiveChip(null)
      setPopupData(null)
      return
    }

    const group = createGroupBySymbol(symbol)
    if (!group) return

    const rect = e.currentTarget.getBoundingClientRect()
    setActiveChip(symbol)
    setPopupData({
      group,
      style: randomStyle(),
      chipRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    })
  }, [activeChip])

  const closePopup = useCallback(() => {
    setActiveChip(null)
    setPopupData(null)
  }, [])

  const handleEnter = () => {
    setPopupData(null)
    setLeaving(true)
    setTimeout(onEnter, 600)
  }

  return (
    <div className={`welcome-page${visible ? ' welcome-visible' : ''}${leaving ? ' welcome-leaving' : ''}`}>
      <div className="welcome-bg">
        {FLOATING_SYMBOLS.map((s, i) => (
          <FloatingSymbol key={i} symbol={s} index={i} />
        ))}
      </div>

      <button
        className="welcome-lang-toggle"
        onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
      >
        {lang === 'zh' ? 'English' : '简体中文'}
      </button>

      <a
        className="welcome-github-btn"
        href="https://github.com/rrCathy/GroupViz"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </a>

      <div className="welcome-sponsor-wrap">
        {sponsorOpen && (
          <div className="welcome-sponsor-menu">
            {SPONSOR_LINKS.map((item) => (
              <a
                key={item.label}
                className="welcome-sponsor-item"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ borderLeftColor: item.color }}
              >
                <span className="welcome-sponsor-dot" style={{ background: item.color }} />
                {item.label}
              </a>
            ))}
          </div>
        )}
        <button
          className="welcome-sponsor-btn"
          onClick={() => setSponsorOpen(!sponsorOpen)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>

      <div className="welcome-content">
        <div className="welcome-hero">
          <div className="welcome-logo">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="25" stroke="#a78bfa" strokeWidth="2" opacity="0.6" />
              <circle cx="28" cy="28" r="18" stroke="#6366f1" strokeWidth="1.5" opacity="0.4" />
              <circle cx="16" cy="16" r="6" stroke="#4ecdc4" strokeWidth="1.5" fill="none" />
              <circle cx="40" cy="16" r="6" stroke="#ff6b6b" strokeWidth="1.5" fill="none" />
              <circle cx="16" cy="40" r="6" stroke="#ffd93d" strokeWidth="1.5" fill="none" />
              <circle cx="40" cy="40" r="6" stroke="#84cc16" strokeWidth="1.5" fill="none" />
              <line x1="20" y1="18" x2="24" y2="22" stroke="#a78bfa" strokeWidth="1" opacity="0.6" />
              <line x1="36" y1="18" x2="32" y2="22" stroke="#a78bfa" strokeWidth="1" opacity="0.6" />
              <line x1="20" y1="38" x2="24" y2="34" stroke="#a78bfa" strokeWidth="1" opacity="0.6" />
              <line x1="36" y1="38" x2="32" y2="34" stroke="#a78bfa" strokeWidth="1" opacity="0.6" />
              <circle cx="28" cy="28" r="3" fill="#a78bfa" />
            </svg>
          </div>

          <h1 className="welcome-title">
            Group<span className="welcome-viz">Viz</span>
          </h1>
          <div className="welcome-subtitle">{t('welcome.subtitle')}</div>
          <div className="welcome-version">{t('welcome.version')}</div>

          <p className="welcome-tagline">{t('welcome.tagline')}</p>
        </div>

        <div className="welcome-features">
          {FEATURES.map((f) => (
            <div key={f.key} className="welcome-feature-card">
              <div className="welcome-feature-icon">{f.icon}</div>
              <div
                className="welcome-feature-tex"
                dangerouslySetInnerHTML={{ __html: renderTex(f.tex) }}
              />
              <div className="welcome-feature-label">{t(f.key)}</div>
            </div>
          ))}
        </div>

        <div className="welcome-groups">
          {GROUPS.map((g) => (
            <span
              key={g}
              className={`welcome-group-chip${activeChip === g ? ' welcome-group-chip-active' : ''}`}
              onClick={(e) => handleGroupClick(g, e)}
              role="button"
              tabIndex={0}
            >
              {g}
            </span>
          ))}
        </div>

        <button className="welcome-enter-btn" onClick={handleEnter}>
          {t('welcome.enter')}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {popupData && (
        <WelcomePreviewPopup data={popupData} onClose={closePopup} />
      )}
    </div>
  )
}
