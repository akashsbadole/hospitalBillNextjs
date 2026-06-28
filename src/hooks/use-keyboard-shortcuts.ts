'use client'

import { useEffect, useCallback, useState } from 'react'
import { useNavigation } from '@/stores/navigation'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts(extraShortcuts: Shortcut[] = []) {
  const { setCurrentPage } = useNavigation()
  const [showHelp, setShowHelp] = useState(false)

  const allShortcuts: Shortcut[] = [
    { key: '?', description: 'Show keyboard shortcuts', action: () => setShowHelp(s => !s) },
    { key: '1', ctrl: true, description: 'Go to Dashboard', action: () => setCurrentPage('dashboard') },
    { key: '2', ctrl: true, description: 'Go to Patients', action: () => setCurrentPage('patients') },
    { key: '3', ctrl: true, description: 'Go to Appointments', action: () => setCurrentPage('appointments') },
    { key: '4', ctrl: true, description: 'Go to Billing', action: () => setCurrentPage('billing') },
    { key: '5', ctrl: true, description: 'Go to Payments', action: () => setCurrentPage('payments') },
    { key: '6', ctrl: true, description: 'Go to Inventory', action: () => setCurrentPage('inventory') },
    { key: '7', ctrl: true, description: 'Go to Reports', action: () => setCurrentPage('reports') },
    { key: '8', ctrl: true, description: 'Go to Settings', action: () => setCurrentPage('settings') },
    { key: 'g', ctrl: true, description: 'Focus global search', action: () => {
      const searchInput = document.querySelector<HTMLInputElement>('[data-global-search]')
      searchInput?.focus()
    }},
    ...extraShortcuts,
  ]

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const shortcut of allShortcuts) {
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true
      const shiftMatch = shortcut.shift ? e.shiftKey : true
      const altMatch = shortcut.alt ? e.altKey : true
      const keyMatch = e.key === shortcut.key

      if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
        e.preventDefault()
        shortcut.action()
        return
      }
    }
  }, [allShortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { showHelp, setShowHelp, shortcuts: allShortcuts }
}
