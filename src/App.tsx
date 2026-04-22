import { useEffect } from 'react'
import { GroupProvider, useGroup } from './context/GroupContext'
import { createS3 } from './core/groups/SymmetricGroup'
import { LeftPanel } from './components/Panels/LeftPanel'
import { RightPanel } from './components/Panels/RightPanel'
import { GroupCanvas } from './components/Canvas/GroupCanvas'
import './App.css'

function AppContent() {
  const { setCurrentGroup, selectNextElement, selectPrevElement } = useGroup()
  
  useEffect(() => {
    setCurrentGroup(createS3())
  }, [setCurrentGroup])
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        selectNextElement()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        selectPrevElement()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectNextElement, selectPrevElement])
  
  return (
    <div className="app-layout">
      <aside className="left-sidebar">
        <LeftPanel />
      </aside>
      
      <main className="main-canvas">
        <GroupCanvas />
      </main>
      
      <aside className="right-sidebar">
        <RightPanel />
      </aside>
    </div>
  )
}

function App() {
  return (
    <GroupProvider>
      <div className="app">
        <header className="app-header">
          <h1>GroupViz - 群论可视化</h1>
        </header>
        <AppContent />
      </div>
    </GroupProvider>
  )
}

export default App