import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
// 双包消费：core 纯算法 + react 视图组件 + 主题 css
import { Demo } from './Demo'
import '@groupviz/react/theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>
)
