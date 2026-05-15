import { useContext } from 'react'
import { ThemeContext, ThemeProvider } from './ThemeContext'

export function useTheme() {
  return useContext(ThemeContext)
}

export { ThemeProvider }
export type { Theme } from './ThemeContext'
