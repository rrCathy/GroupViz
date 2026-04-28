import { useState, useEffect } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { renderTex } from '../utils/texify'

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

interface WelcomePageProps {
  onEnter: () => void
}

export function WelcomePage({ onEnter }: WelcomePageProps) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const { t, lang, setLang } = useTranslation()

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(timer)
  }, [])

  const handleEnter = () => {
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
            <span key={g} className="welcome-group-chip">{g}</span>
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
    </div>
  )
}
