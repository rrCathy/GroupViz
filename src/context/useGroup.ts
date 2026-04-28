import { useContext } from 'react'
import { GroupContext } from './GroupContext'

export function useGroup() {
  const context = useContext(GroupContext)
  if (!context) {
    throw new Error('useGroup must be used within GroupProvider')
  }
  return context
}