'use client'

import { useCallback } from 'react'

export function useAnnouncer() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById('a11y-announcer')
    if (announcer) {
      announcer.setAttribute('aria-live', priority)
      announcer.textContent = ''
      // Small timeout ensures screen readers detect the change
      setTimeout(() => {
        announcer.textContent = message
      }, 50)
    }
  }, [])

  return { announce }
}
