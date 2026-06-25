'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Loader2, Pencil, Trash2, Activity, X } from 'lucide-react'

interface Problem {
  id: string
  patientId: string
  problem: string
  icdCode: string | null
  status: string
  onsetDate: string | null
  resolvedDate: string | null
  notes: string | null
  createdAt: string
  createdBy?: { name: string }
}

interface Props { patientId: string }

const STATUSES = ['Active', 'Resolved', 'Inactive']

export function ProblemListSection({ patientId }: Props) {
  const { toast } = useToast()
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Problem | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  const [problem, setProblem] = useState('')
  const [icdCode, setIcdCode] = useState('')
  const [status, setStatus] = useState('Active')
  const [onsetDate, setOnsetDate] = useState('')
  const [notes, setNotes] = useState('')

  const fetch = async () => {
    try {
      const res = await apiGet<{ data: Problem[] }>(`/problem-list?patientId=${patientId}&status=${filter}`)
      setProblems(res.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [patientId, filter])

  const resetForm = () => {
    setProblem(''); setIcdCode(''); setStatus('Active'); setOnsetDate(''); setNotes(''); setEditing(null)
  }

  const handleSave = async () => {
    if (!problem.trim()) { toast({ title: 'Error', description: 'Problem is required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const payload = { problem: problem.trim(), icdCode: icdCode || null, status, onsetDate: onsetDate || null, notes: notes || null, patientId }
      if (editing) {
        await apiPut(`/problem-list/${editing.id}`, payload)
        toast({ title: 'Problem updated' })
      } else {
        await apiPost('/problem-list', payload)
        toast({ title: 'Problem added' })
      }
      setDialogOpen(false); resetForm(); fetch()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to save', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this problem?')) return
    try { await apiDelete(`/problem-list/${id}`); toast({ title: 'Problem deleted' }); fetch() }
    catch { toast({ title: 'Error', variant: 'destructive' }) }
  }

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      Active: 'bg-red-100 text-red-700', Resolved: 'bg-emerald-100 text-emerald-700',
      Inactive: 'bg-gray-100 text-gray-600',
    }
    return <Badge className={colors[s] || ''} variant="secondary">{s}</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="size-4" /> Problem List
        </h3>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
            <Plus className="mr-1 size-3.5" /> Add
          </Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-24" /> : problems.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No problems recorded.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {problems.map(p => (
            <div key={p.id} className="flex items-start justify-between rounded-lg border px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{p.problem}</span>
                  {statusBadge(p.status)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {p.icdCode && <span className="font-mono">{p.icdCode}</span>}
                  {p.onsetDate && <span> · Onset: {p.onsetDate}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button variant="ghost" size="icon" className="size-7"
                  onClick={() => { setEditing(p); setProblem(p.problem); setIcdCode(p.icdCode || ''); setStatus(p.status); setOnsetDate(p.onsetDate || ''); setNotes(p.notes || ''); setDialogOpen(true) }}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Problem' : 'Add Problem'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Problem / Diagnosis *</Label>
              <Input value={problem} onChange={e => setProblem(e.target.value)} placeholder="e.g. Type 2 Diabetes" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ICD-10 Code</Label>
                <Input value={icdCode} onChange={e => setIcdCode(e.target.value)} placeholder="e.g. E11.9" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Onset Date</Label>
              <Input type="date" value={onsetDate} onChange={e => setOnsetDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !problem.trim()}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
