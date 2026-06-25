'use client'

import { useState, useRef } from 'react'
import { Upload, Download, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { apiPost, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface ImportResult {
  success: number
  errors: { row: number; message: string }[]
}

interface ImportCsvDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  importUrl: string
  templateHeaders: string[]
  onSuccess: () => void
}

export function ImportCsvDialog({ open, onOpenChange, title, importUrl, templateHeaders, onSuccess }: ImportCsvDialogProps) {
  const { toast } = useToast()
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      setResult(null)
    }
    reader.readAsText(file)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    if (!csvText.trim()) {
      toast({ title: 'No data', description: 'Paste CSV data or upload a file first.', variant: 'destructive' })
      return
    }
    setImporting(true)
    setResult(null)
    try {
      const res = await apiPost<{ result: ImportResult }>(importUrl, { csv: csvText })
      setResult(res.result)
      if (res.result.errors.length === 0) {
        toast({ title: 'Import Complete', description: `${res.result.success} records imported successfully.` })
        onSuccess()
      } else {
        toast({
          title: 'Import with Errors',
          description: `${res.result.success} imported, ${res.result.errors.length} errors.`,
          variant: 'default',
        })
      }
    } catch (err) {
      toast({ title: 'Import Failed', description: err instanceof ApiError ? err.message : 'Unknown error', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const csv = templateHeaders.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClose = () => {
    if (!importing) {
      setCsvText('')
      setResult(null)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import {title}</DialogTitle>
          <DialogDescription>
            Upload a CSV file or paste CSV data. Use the template to ensure correct column headers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 size-4" /> Download Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 size-4" /> Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          <Textarea
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setResult(null) }}
            placeholder="Paste CSV data here..."
            className="min-h-[200px] font-mono text-sm"
          />

          {result && (
            <div className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <span className="font-medium">{result.success} records imported</span>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="size-4" /> {result.errors.length} errors
                  </p>
                  <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1">
                    {result.errors.map((err, i) => (
                      <p key={i}>Row {err.row}: {err.message}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose} disabled={importing}>Close</Button>
          <Button onClick={handleImport} disabled={importing || !csvText.trim()}>
            {importing && <Loader2 className="mr-2 size-4 animate-spin" />}
            Import CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
