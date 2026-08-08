import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { useTheme } from '../theme/useTheme'

const SPONSOR_LINKS = [
  { label: 'PayPal', url: 'https://paypal.me/rrCathy314', color: '#f6c23e' },
  { label: 'Ko-fi', url: 'https://ko-fi.com/rrcathy314', color: '#ff5e5b' },
  { label: '爱发电', url: 'https://afdian.com/a/rrCathy314', color: '#946ce6' },
]

const DONE_FEATURES = [
  'welcome.item.subgroups',
  'welcome.item.cayley',
  'welcome.item.table',
  'welcome.item.build',
  'welcome.item.homomorphism',
  'welcome.item.presentation',
]

const SOON_FEATURES = [
  'welcome.soon.education',
  'welcome.soon.freegroup',
  'welcome.soon.dlc',
]

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
  const { theme, toggleTheme } = useTheme()
  const [sponsorOpen, setSponsorOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(timer)
  }, [])

  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = () => {
    setLeaving(true)
    enterTimerRef.current = setTimeout(onEnter, 600)
  }

  useEffect(() => {
    return () => {
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    }
  }, [])

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

      <button
        className="welcome-theme-toggle"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
      >
        {theme === 'dark' ? '\u2600' : '\u263E'}
      </button>

      <a
        className="welcome-github-btn"
        href="https://github.com/rrCathy/GroupViz"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub repository"
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
          aria-label="Sponsor links"
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

        <div className="welcome-sections">
          <section className="welcome-section">
            <h2 className="welcome-section-title">{t('welcome.section.done')}</h2>
            <ul className="welcome-feature-list">
              {DONE_FEATURES.map((key) => (
                <li key={key} className="welcome-feature-row done">
                  <span className="welcome-feature-mark">✓</span>
                  <span className="welcome-feature-text">{t(key)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="welcome-section">
            <h2 className="welcome-section-title">{t('welcome.section.soon')}</h2>
            <ul className="welcome-feature-list">
              {SOON_FEATURES.map((key) => (
                <li key={key} className="welcome-feature-row soon">
                  <span className="welcome-feature-mark">○</span>
                  <span className="welcome-feature-text">{t(key)}</span>
                </li>
              ))}
            </ul>
          </section>
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
