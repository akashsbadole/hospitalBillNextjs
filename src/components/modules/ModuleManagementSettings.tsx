'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Shield, ToggleLeft, ToggleRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

type ModuleSection = 'main' | 'operations' | 'admin'

interface ModuleItem {
  id: string
  moduleKey: string
  label: string
  description: string | null
  icon: string | null
  section: ModuleSection
  enabled: boolean
  isCore: boolean
  updatedAt: string
}

const SECTION_LABELS: Record<ModuleSection, string> = {
  main: 'Main',
  operations: 'Operations',
  admin: 'Admin',
}

const SECTION_ORDER: ModuleSection[] = ['main', 'operations', 'admin']

const TOTAL_MODULES = 44

export function ModuleManagementSettings() {
  const { toast } = useToast()
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadModules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/modules')
      if (!res.ok) throw new Error('Failed to load modules')
      const json = await res.json()
      setModules(json.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadModules()
  }, [loadModules])

  const handleToggle = async (mod: ModuleItem) => {
    if (mod.isCore) return
    setToggling(mod.id)
    try {
      const res = await fetch('/api/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mod.id, enabled: !mod.enabled }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to toggle')
      }
      const json = await res.json()
      setModules((prev) => prev.map((m) => (m.id === json.data.id ? json.data : m)))
      toast({
        title: json.data.enabled ? 'Module Enabled' : 'Module Disabled',
        description: `"${json.data.label}" is now ${json.data.enabled ? 'enabled' : 'disabled'}.`,
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to toggle module',
        variant: 'destructive',
      })
    } finally {
      setToggling(null)
    }
  }

  const groupedModules = SECTION_ORDER
    .map((section) => ({
      section,
      label: SECTION_LABELS[section],
      items: modules.filter((m) => m.section === section),
    }))
    .filter((g) => g.items.length > 0)

  const enabledCount = modules.filter((m) => m.enabled).length
  const disabledCount = modules.filter((m) => !m.enabled).length

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-red-600">
          <AlertCircle className="h-8 w-8 mb-3" />
          <p className="font-medium">Failed to load modules</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={loadModules}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (modules.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Shield className="h-10 w-10 mb-3 opacity-50" />
          <p className="font-medium">No modules registered</p>
          <p className="text-sm">Run database seed to initialize module settings</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Enable or disable system modules. Disabled modules are hidden from the sidebar and their API routes return 403.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            {enabledCount} Enabled
          </Badge>
          {disabledCount > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {disabledCount} Disabled
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={loadModules} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {groupedModules.map((group) => (
        <Card key={group.section}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="divide-y">
              {group.items.map((mod) => (
                <div
                  key={mod.id}
                  className={cn(
                    'flex items-center justify-between py-3 transition-opacity',
                    !mod.enabled && 'opacity-60'
                  )}
                >
                  <div className="space-y-0.5 min-w-0 flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{mod.label}</p>
                      <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                        {mod.moduleKey}
                      </code>
                      {mod.isCore && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">Core</Badge>
                      )}
                    </div>
                    {mod.description && (
                      <p className="text-xs text-muted-foreground">{mod.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] h-5 px-1.5 font-semibold',
                        mod.enabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                      )}
                    >
                      {mod.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Switch
                      checked={mod.enabled}
                      disabled={mod.isCore || toggling === mod.id}
                      onCheckedChange={() => handleToggle(mod)}
                    />
                    {toggling === mod.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
