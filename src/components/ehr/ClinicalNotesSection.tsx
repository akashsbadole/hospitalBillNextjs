'use client'

import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Loader2, Pencil, Trash2, FileText, X } from 'lucide-react'

interface ClinicalNote {
  id: string
  patientId: string
  visitId: string | null
  noteType: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  icdCodes: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy?: { name: string }
  visit?: { visitType: string; stage: string } | null
}

interface Props {
  patientId: string
}

const NOTE_TYPES = ['SOAP', 'Progress', 'Procedure', 'Consult', 'Discharge']

export function ClinicalNotesSection({ patientId }: Props) {
  const { toast } = useToast()
  const [notes, setNotes] = useState<ClinicalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null)
  const [saving, setSaving] = useState(false)

  const [noteType, setNoteType] = useState('SOAP')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [icdCodeInput, setIcdCodeInput] = useState('')
  const [icdCodes, setIcdCodes] = useState<{ code: string; description: string }[]>([])

  const fetchNotes = async () => {
    try {
      const res = await apiGet<{ data: ClinicalNote[] }>(`/clinical-notes?patientId=${patientId}`)
      setNotes(res.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => { fetchNotes() }, [patientId])

  const resetForm = () => {
    setNoteType('SOAP'); setSubjective(''); setObjective(''); setAssessment(''); setPlan('')
    setIcdCodes([]); setIcdCodeInput(''); setEditingNote(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        patientId,
        noteType,
        subjective: subjective || null,
        objective: objective || null,
        assessment: assessment || null,
        plan: plan || null,
        icdCodes: icdCodes.length > 0 ? JSON.stringify(icdCodes) : null,
      }
      if (editingNote) {
        await apiPut(`/clinical-notes/${editingNote.id}`, payload)
        toast({ title: 'Clinical note updated' })
      } else {
        await apiPost('/clinical-notes', payload)
        toast({ title: 'Clinical note created' })
      }
      setDialogOpen(false); resetForm(); fetchNotes()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to save', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this clinical note?')) return
    try {
      await apiDelete(`/clinical-notes/${id}`)
      toast({ title: 'Clinical note deleted' }); fetchNotes()
    } catch { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }) }
  }

  const addIcdCode = () => {
    if (!icdCodeInput.trim()) return
    const parts = icdCodeInput.split(/\s{2,}|\t+/)
    setIcdCodes([...icdCodes, { code: parts[0].trim(), description: parts.slice(1).join(' ') || '' }])
    setIcdCodeInput('')
  }

  const noteTypeBadge = (t: string) => {
    const colors: Record<string, string> = {
      SOAP: 'bg-blue-100 text-blue-700', Progress: 'bg-emerald-100 text-emerald-700',
      Procedure: 'bg-purple-100 text-purple-700', Consult: 'bg-amber-100 text-amber-700',
      Discharge: 'bg-rose-100 text-rose-700',
    }
    return <Badge className={colors[t] || ''} variant="secondary">{t}</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="size-4" /> Clinical Notes
        </h3>
        <Button onClick={() => { resetForm(); setDialogOpen(true) }}>
          <Plus className="mr-2 size-4" /> New Note
        </Button>
      </div>

      {loading ? <Skeleton className="h-32" /> : notes.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No clinical notes recorded.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notes.map(note => {
            const codes = note.icdCodes ? JSON.parse(note.icdCodes) : []
            return (
              <Card key={note.id}>
                <CardHeader className="pb-2 py-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {noteTypeBadge(note.noteType)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString()} by {note.createdBy?.name || '—'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7"
                        onClick={() => {
                          setEditingNote(note)
                          setNoteType(note.noteType)
                          setSubjective(note.subjective || '')
                          setObjective(note.objective || '')
                          setAssessment(note.assessment || '')
                          setPlan(note.plan || '')
                          setIcdCodes(codes)
                          setDialogOpen(true)
                        }}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7"
                        onClick={() => handleDelete(note.id)}>
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 pt-0 space-y-2 text-sm">
                  {note.subjective && (
                    <div><span className="font-semibold text-blue-600">S:</span> {note.subjective}</div>
                  )}
                  {note.objective && (
                    <div><span className="font-semibold text-emerald-600">O:</span> {note.objective}</div>
                  )}
                  {note.assessment && (
                    <div><span className="font-semibold text-amber-600">A:</span> {note.assessment}</div>
                  )}
                  {note.plan && (
                    <div><span className="font-semibold text-purple-600">P:</span> {note.plan}</div>
                  )}
                  {codes.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {codes.map((c: { code: string; description: string }, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{c.code} {c.description}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o) }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? 'Edit Clinical Note' : 'New Clinical Note'} — SOAP Format</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Note Type</Label>
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-blue-600 font-semibold">S — Subjective</Label>
              <Textarea value={subjective} onChange={e => setSubjective(e.target.value)}
                placeholder="Patient's symptoms, history of present illness, chief complaint..."
                rows={3} />
            </div>
            <div className="space-y-2">
              <Label className="text-emerald-600 font-semibold">O — Objective</Label>
              <Textarea value={objective} onChange={e => setObjective(e.target.value)}
                placeholder="Vital signs, physical exam findings, lab/imaging results..."
                rows={3} />
            </div>
            <div className="space-y-2">
              <Label className="text-amber-600 font-semibold">A — Assessment</Label>
              <Textarea value={assessment} onChange={e => setAssessment(e.target.value)}
                placeholder="Diagnosis, differential diagnosis, clinical impression..."
                rows={3} />
            </div>
            <div className="space-y-2">
              <Label className="text-purple-600 font-semibold">P — Plan</Label>
              <Textarea value={plan} onChange={e => setPlan(e.target.value)}
                placeholder="Treatment plan, medications, follow-up, referrals, tests to order..."
                rows={3} />
            </div>

            <div className="space-y-2">
              <Label>ICD-10 Codes (optional)</Label>
              <div className="flex gap-2">
                <Input value={icdCodeInput} onChange={e => setIcdCodeInput(e.target.value)}
                  placeholder='e.g. "E11.9  Type 2 diabetes without complications"'
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIcdCode() } }} />
                <Button variant="outline" onClick={addIcdCode} type="button">Add</Button>
              </div>
              {icdCodes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {icdCodes.map((c, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {c.code} {c.description}
                      <button onClick={() => setIcdCodes(icdCodes.filter((_, j) => j !== i))}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingNote ? 'Update' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
