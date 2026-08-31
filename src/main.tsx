import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.tsx'
import TestPage from './components/TestPage.tsx'
import TestPage2 from './components/TestPage2.tsx'
import { ThemeProvider } from './theme/useTheme'

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
      {isTestPage ? <TestPage /> : isTestPage2 ? <TestPage2 /> : <App />}
    </ThemeProvider>
  </StrictMode>,
)
