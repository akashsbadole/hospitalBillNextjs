'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, type SingleResponse, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Languages,
  Globe,
  Download,
  Upload,
  Plus,
  Check,
  X,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface Translation {
  id: string
  locale: string
  namespace: string
  key: string
  value: string
  createdAt: string
  updatedAt: string
}

interface TranslationStats {
  totalKeys: number
  translatedCount: number
  missingCount: number
  translatedPercent: number
}

const LOCALES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'es', label: 'Spanish', native: 'Español' },
  { code: 'fr', label: 'French', native: 'Français' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
]

const NAMESPACES = ['common', 'billing', 'patients', 'appointments', 'prescriptions', 'settings']

function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-4 items-center p-2">
      {Array.from({ length: cols }).map((_, j) => (
        <Skeleton key={j} className="h-4 flex-1" />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
      <Languages className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />Retry
      </Button>
    </div>
  )
}

export function I18nAdminPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedLocale, setSelectedLocale] = useState('en')
  const [selectedNamespace, setSelectedNamespace] = useState('common')

  const [translations, setTranslations] = useState<Translation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stats, setStats] = useState<TranslationStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState({ key: '', value: '' })
  const [addSubmitting, setAddSubmitting] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const fetchTranslations = useCallback(async (locale: string, namespace: string, search: string) => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { locale, namespace }
      if (search) params.search = search
      const res = await apiGet<PaginatedResponse<Translation>>('/i18n/translations', params)
      setTranslations(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load translations'
      setError(msg)
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchStats = useCallback(async (locale: string) => {
    setStatsLoading(true)
    try {
      const res = await apiGet<SingleResponse<TranslationStats>>('/i18n/stats', { locale })
      setStats(res.data)
    } catch {
      // Silently fail
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTranslations(selectedLocale, selectedNamespace, searchQuery)
  }, [selectedLocale, selectedNamespace, searchQuery, fetchTranslations])

  useEffect(() => {
    fetchStats(selectedLocale)
  }, [selectedLocale, fetchStats])

  const handleAddTranslation = async () => {
    if (!addForm.key || !addForm.value) {
      toast({ title: 'Validation Error', description: 'Key and value are required', variant: 'destructive' })
      return
    }
    setAddSubmitting(true)
    try {
      await apiPost<SingleResponse<Translation>>('/i18n/translations', {
        locale: selectedLocale,
        namespace: selectedNamespace,
        key: addForm.key,
        value: addForm.value,
      })
      toast({ title: 'Translation Added', description: `Key "${addForm.key}" created` })
      setAddDialogOpen(false)
      setAddForm({ key: '', value: '' })
      fetchTranslations(selectedLocale, selectedNamespace, searchQuery)
      fetchStats(selectedLocale)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to add translation', variant: 'destructive' })
    } finally {
      setAddSubmitting(false)
    }
  }

  const handleSaveEdit = async (id: string) => {
    if (!editingValue.trim()) {
      toast({ title: 'Validation Error', description: 'Value cannot be empty', variant: 'destructive' })
      return
    }
    try {
      await apiPut<SingleResponse<Translation>>(`/i18n/translations/${id}`, { value: editingValue })
      setEditingId(null)
      setEditingValue('')
      fetchTranslations(selectedLocale, selectedNamespace, searchQuery)
      fetchStats(selectedLocale)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to update translation', variant: 'destructive' })
    }
  }

  const handleDeleteTranslation = async (id: string) => {
    try {
      await apiDelete(`/i18n/translations/${id}`)
      toast({ title: 'Translation Deleted', description: 'Translation entry removed' })
      fetchTranslations(selectedLocale, selectedNamespace, searchQuery)
      fetchStats(selectedLocale)
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to delete translation', variant: 'destructive' })
    }
  }

  const handleExport = async () => {
    try {
      const res = await apiGet<PaginatedResponse<Translation>>('/i18n/translations', {
        locale: selectedLocale,
        namespace: selectedNamespace,
        limit: 10000,
      })
      const data: Record<string, string> = {}
      res.data.forEach((t) => { data[t.key] = t.value })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `i18n-${selectedLocale}-${selectedNamespace}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Export Complete', description: `Downloaded translations for ${selectedLocale}/${selectedNamespace}` })
    } catch (err) {
      toast({ title: 'Export Failed', description: err instanceof ApiError ? err.message : 'Could not export translations', variant: 'destructive' })
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const entries = Object.entries(data).map(([key, value]) => ({
        locale: selectedLocale,
        namespace: selectedNamespace,
        key,
        value: String(value),
      }))
      if (entries.length === 0) {
        toast({ title: 'Import Error', description: 'No entries found in file', variant: 'destructive' })
        return
      }
      await apiPost<{ imported: number }>('/i18n/translations/import', { translations: entries })
      toast({ title: 'Import Complete', description: `${entries.length} translations imported` })
      fetchTranslations(selectedLocale, selectedNamespace, searchQuery)
      fetchStats(selectedLocale)
    } catch (err) {
      toast({
        title: 'Import Failed',
        description: err instanceof ApiError ? err.message : 'Invalid JSON file',
        variant: 'destructive',
      })
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const startEditing = (translation: Translation) => {
    setEditingId(translation.id)
    setEditingValue(translation.value)
    setTimeout(() => {
      editInputRef.current?.focus()
    }, 50)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit(id)
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditingValue('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Translation Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage multi-language translations across all modules
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
              <Languages className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Keys</p>
              <p className="text-2xl font-bold text-foreground">
                {statsLoading ? <Skeleton className="h-7 w-16" /> : stats?.totalKeys ?? '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-100 text-green-600 shrink-0">
              <Check className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Translated %</p>
              <p className="text-2xl font-bold text-foreground">
                {statsLoading ? <Skeleton className="h-7 w-16" /> : stats ? `${stats.translatedPercent.toFixed(1)}%` : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shrink-0">
              <X className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Missing Translations</p>
              <p className="text-2xl font-bold text-foreground">
                {statsLoading ? <Skeleton className="h-7 w-16" /> : stats?.missingCount ?? '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedLocale} onValueChange={setSelectedLocale}>
            <SelectTrigger className="w-[160px]">
              <Globe className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{l.code.toUpperCase()}</span>
                    <span>{l.native}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
            {NAMESPACES.map((ns) => (
              <Button
                key={ns}
                variant={selectedNamespace === ns ? 'default' : 'ghost'}
                size="sm"
                className={`text-xs capitalize whitespace-nowrap ${
                  selectedNamespace === ns
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'hover:bg-transparent hover:text-foreground'
                }`}
                onClick={() => setSelectedNamespace(ns)}
              >
                {ns}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keys..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9 w-[180px]"
            />
          </div>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shrink-0">
                <Plus className="mr-2 h-4 w-4" />Add Translation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px]">
              <DialogHeader>
                <DialogTitle>Add Translation</DialogTitle>
                <DialogDescription>
                  Add a new translation for {selectedLocale.toUpperCase()} / {selectedNamespace}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Key</Label>
                  <Input
                    value={addForm.key}
                    onChange={(e) => setAddForm((p) => ({ ...p, key: e.target.value }))}
                    placeholder="e.g. greeting.welcome"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input
                    value={addForm.value}
                    onChange={(e) => setAddForm((p) => ({ ...p, value: e.target.value }))}
                    placeholder="Translation text"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddTranslation} disabled={addSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {addSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Translation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={4} />)}
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState message={error} onRetry={() => fetchTranslations(selectedLocale, selectedNamespace, searchQuery)} />
            </div>
          ) : translations.length === 0 ? (
            <EmptyState message={searchQuery ? 'No translations match your search' : 'No translations found. Add one to get started.'} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Key</TableHead>
                  <TableHead className="min-w-[200px]">English (en)</TableHead>
                  <TableHead className="min-w-[250px]">
                    Translation ({selectedLocale.toUpperCase()})
                  </TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {translations.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-foreground break-all">
                        {t.key}
                      </code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.key
                        .replace(/^[^.]+\./, '')
                        .replace(/\./g, ' ')
                        .replace(/([A-Z])/g, ' $1')
                        .trim()
                        .toLowerCase() || t.key}
                    </TableCell>
                    <TableCell>
                      {editingId === t.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            ref={editInputRef}
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => handleEditKeyDown(e, t.id)}
                            className="h-8 text-sm flex-1"
                          />
                          <Button variant="ghost" size="icon" className="size-7 text-green-600" onClick={() => handleSaveEdit(t.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => { setEditingId(null); setEditingValue('') }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 transition-colors min-h-[28px] flex items-center"
                          onClick={() => startEditing(t)}
                        >
                          {t.value || (
                            <span className="text-muted-foreground italic text-xs">Click to add translation</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600" onClick={() => handleDeleteTranslation(t.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
