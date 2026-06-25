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
import { Plus, Loader2, Pencil, Trash2, Pill } from 'lucide-react'

interface Medication {
  id: string
  patientId: string
  medicationName: string
  strength: string | null
  dosageForm: string | null
  frequency: string | null
  route: string | null
  prescribedDate: string | null
  prescribedBy: string | null
  status: string
  notes: string | null
  createdAt: string
}

interface Props { patientId: string }

const STATUSES = ['Active', 'Discontinued', 'Completed', 'On Hold']
const DOSAGE_FORMS = ['Tablet', 'Capsule', 'Injection', 'Syrup', 'Cream', 'Drops', 'Inhaler', 'Powder', 'Topical']
const ROUTES = ['Oral', 'IV', 'IM', 'Subcutaneous', 'Topical', 'Inhalation', 'Rectal', 'Otic', 'Ophthalmic']
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 4 hours', 'Every 6 hours', 'Every 8 hours', 'Every 12 hours', 'As needed (PRN)', 'Weekly', 'Monthly']

export function MedicationListSection({ patientId }: Props) {
  const { toast } = useToast()
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Medication | null>(null)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('Active')

  const [medicationName, setMedicationName] = useState('')
  const [strength, setStrength] = useState('')
  const [dosageForm, setDosageForm] = useState('')
  const [frequency, setFrequency] = useState('')
  const [route, setRoute] = useState('')
  const [prescribedDate, setPrescribedDate] = useState('')
  const [prescribedBy, setPrescribedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState('Active')

  const fetch = async () => {
    try {
      const res = await apiGet<{ data: Medication[] }>(`/active-medications?patientId=${patientId}&status=${filter}`)
      setMedications(res.data)
    } catch { /* silent */ } finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [patientId, filter])

  const resetForm = () => {
    setMedicationName(''); setStrength(''); setDosageForm(''); setFrequency(''); setRoute('')
    setPrescribedDate(''); setPrescribedBy(''); setNotes(''); setStatus('Active'); setEditing(null)
  }

  const handleSave = async () => {
    if (!medicationName.trim()) { toast({ title: 'Error', description: 'Medication name is required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const payload = {
        medicationName: medicationName.trim(), strength: strength || null, dosageForm: dosageForm || null,
        frequency: frequency || null, route: route || null, prescribedDate: prescribedDate || null,
        prescribedBy: prescribedBy || null, notes: notes || null, patientId,
      }
      if (editing) {
        await apiPut(`/active-medications/${editing.id}`, { ...payload, status })
        toast({ title: 'Medication updated' })
      } else {
        await apiPost('/active-medications', payload)
        toast({ title: 'Medication added' })
      }
      setDialogOpen(false); resetForm(); fetch()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to save', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this medication?')) return
    try { await apiDelete(`/active-medications/${id}`); toast({ title: 'Medication deleted' }); fetch() }
    catch { toast({ title: 'Error', variant: 'destructive' }) }
  }

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      Active: 'bg-emerald-100 text-emerald-700', Discontinued: 'bg-red-100 text-red-700',
      Completed: 'bg-blue-100 text-blue-700', 'On Hold': 'bg-amber-100 text-amber-700',
    }
    return <Badge className={colors[s] || ''} variant="secondary">{s}</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Pill className="size-4" /> Active Medications
        </h3>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true) }}>
            <Plus className="mr-1 size-3.5" /> Add
          </Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-24" /> : medications.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">No medications recorded.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {medications.map(m => (
            <div key={m.id} className="flex items-start justify-between rounded-lg border px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{m.medicationName}</span>
                  {m.strength && <span className="text-xs text-muted-foreground">{m.strength}</span>}
                  {statusBadge(m.status)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                  {m.dosageForm && <span>{m.dosageForm}</span>}
                  {m.frequency && <span>· {m.frequency}</span>}
                  {m.route && <span>· {m.route}</span>}
                  {m.prescribedBy && <span>· Prescribed by {m.prescribedBy}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0 ml-2">
                <Button variant="ghost" size="icon" className="size-7"
                  onClick={() => {
                    setEditing(m); setMedicationName(m.medicationName); setStrength(m.strength || '')
                    setDosageForm(m.dosageForm || ''); setFrequency(m.frequency || ''); setRoute(m.route || '')
                    setPrescribedDate(m.prescribedDate || ''); setPrescribedBy(m.prescribedBy || '')
                    setNotes(m.notes || ''); setStatus(m.status); setDialogOpen(true)
                  }}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(m.id)}>
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
            <DialogTitle>{editing ? 'Edit Medication' : 'Add Medication'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Medication Name *</Label>
              <Input value={medicationName} onChange={e => setMedicationName(e.target.value)} placeholder="e.g. Metformin" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Strength</Label>
                <Input value={strength} onChange={e => setStrength(e.target.value)} placeholder="e.g. 500 mg" />
              </div>
              <div className="space-y-2">
                <Label>Dosage Form</Label>
                <Select value={dosageForm} onValueChange={setDosageForm}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {DOSAGE_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Route</Label>
                <Select value={route} onValueChange={setRoute}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prescribed Date</Label>
                <Input type="date" value={prescribedDate} onChange={e => setPrescribedDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Prescribed By</Label>
                <Input value={prescribedBy} onChange={e => setPrescribedBy(e.target.value)} placeholder="Doctor name" />
              </div>
            </div>
            {editing && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !medicationName.trim()}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
