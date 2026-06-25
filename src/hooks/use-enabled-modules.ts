import { useState, useEffect, useCallback } from 'react'

export interface EnabledModule {
  moduleKey: string
  label: string
  section: string
  icon: string | null
}

export function useEnabledModules() {
  const [modules, setModules] = useState<EnabledModule[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/modules/enabled')
      if (res.ok) {
        const json = await res.json()
        setModules(json.data || [])
      }
    } catch {
      // silent fail - modules default to enabled
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const isEnabled = useCallback(
    (moduleKey: string): boolean => {
      return modules.some((m) => m.moduleKey === moduleKey)
    },
    [modules]
  )

  return { modules, loading, isEnabled, refresh }
}
