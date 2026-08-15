/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { GroupElement } from '../../core/types'

interface HoverContextValue {
  hoverElement: GroupElement | null
  setHoverElement: (el: GroupElement | null) => void
}

const HoverContext = createContext<HoverContextValue>({
  hoverElement: null,
  setHoverElement: () => {},
})

export function HoverProvider({ children }: { children: ReactNode }) {
  const [hoverElement, setHoverElementState] = useState<GroupElement | null>(null)
  const setHoverElement = useCallback((el: GroupElement | null) => {
    setHoverElementState(el)
  }, [])

  return (
    <HoverContext.Provider value={{ hoverElement, setHoverElement }}>
      {children}
    </HoverContext.Provider>
  )
}

export function useHover() {
  return useContext(HoverContext)
}
