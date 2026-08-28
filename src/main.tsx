import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.tsx'
import TestPage from './components/TestPage.tsx'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTestPage ? <TestPage /> : <App />}
  </StrictMode>,
)
