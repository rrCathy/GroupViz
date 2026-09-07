import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.tsx'
import TestPage from './components/TestPage.tsx'
import TestPage2 from './components/TestPage2.tsx'
import { ThemeProvider } from './theme/useTheme'
import { I18nProvider } from './i18n/I18nContext'

// Suppress THREE.Clock deprecation warning
const originalWarn = console.warn
console.warn = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('THREE.Clock')) {
    return
  }
  originalWarn.apply(console, args)
}

const params = new URLSearchParams(window.location.search)
const isTestPage = params.get('test') === '1' || params.get('page') === 'test'
const isTestPage2 = params.get('test') === '2' || params.get('page') === 'test2'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {/* 测试页不经 App，需自带 I18nProvider，否则 t() 回落成原始 key */}
      {isTestPage ? <I18nProvider><TestPage /></I18nProvider>
        : isTestPage2 ? <I18nProvider><TestPage2 /></I18nProvider>
          : <App />}
    </ThemeProvider>
  </StrictMode>,
)
