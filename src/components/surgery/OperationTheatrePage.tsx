'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Loader2, Pencil, Trash2, Syringe, CalendarDays, Clock, AlertTriangle, Users, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, isToday } from 'date-fns'

interface OT {
  id: string; name: string; type: string; floor: string | null
  status: string; branchId: string | null; _count?: { surgeries: number }
}

interface Surgery {
  id: string; surgeryId: string; patientId: string; doctorId: string; otId: string | null
  type: string; category: string; anesthesiaType: string | null
  status: string; scheduledDate: string | null; scheduledTime: string | null
  startTime: string | null; endTime: string | null; diagnosis: string | null
  procedure: string | null; notes: string | null
  patient?: { patientId: string; name: string; phone: string }
  doctor?: { name: string; specialization: string }
  ot?: { name: string; type: string }
  surgicalTeam: string | null
  createdAt: string
}

const OT_STATUSES = ['Available', 'In-Use', 'Maintenance', 'Closed']
const SURGERY_STATUSES = ['Scheduled', 'In-Progress', 'Completed', 'Cancelled', 'Postponed']
const SURGERY_TYPES = ['Emergency', 'Planned', 'Day-Care']
const SURGERY_CATEGORIES = ['Major', 'Minor', 'Micro']

export function OperationTheatrePage() {
  const { toast } = useToast()
  const [tab, setTab] = useState('theatres')
  const [theatres, setTheatres] = useState<OT[]>([])
  const [surgeries, setSurgeries] = useState<Surgery[]>([])
  const [loading, setLoading] = useState(true)
  const [otDialogOpen, setOtDialogOpen] = useState(false)
  const [surgeryDialogOpen, setSurgeryDialogOpen] = useState(false)
  const [editingOt, setEditingOt] = useState<OT | null>(null)
  const [editingSurgery, setEditingSurgery] = useState<Surgery | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // OT form
  const [otName, setOtName] = useState('')
  const [otType, setOtType] = useState('General')
  const [otFloor, setOtFloor] = useState('')
  const [otStatus, setOtStatus] = useState('Available')

  // Surgery form
  const [surgPatientId, setSurgPatientId] = useState('')
  const [surgDoctorId, setSurgDoctorId] = useState('')
  const [surgOtId, setSurgOtId] = useState('')
  const [surgType, setSurgType] = useState('Planned')
  const [surgCategory, setSurgCategory] = useState('Minor')
  const [surgAnesthesia, setSurgAnesthesia] = useState('')
  const [surgDate, setSurgDate] = useState('')
  const [surgTime, setSurgTime] = useState('')
  const [surgDiagnosis, setSurgDiagnosis] = useState('')
  const [surgProcedure, setSurgProcedure] = useState('')
  const [surgNotes, setSurgNotes] = useState('')
  const [surgTeam, setSurgTeam] = useState<{ name: string; role: string }[]>([])
  const [teamMemberName, setTeamMemberName] = useState('')
  const [teamMemberRole, setTeamMemberRole] = useState('')
  const [conflictWarning, setConflictWarning] = useState('')

  const fetchTheatres = async () => {
    try {
      const res = await apiGet<{ data: OT[] }>('/operation-theatres')
      setTheatres(res.data)
    } catch { toast({ title: 'Error', description: 'Failed to load theatres', variant: 'destructive' }) }
  }

  const fetchSurgeries = async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
      const res = await apiGet<{ data: Surgery[] }>(`/surgeries${params}`)
      setSurgeries(res.data)
    } catch { toast({ title: 'Error', description: 'Failed to load surgeries', variant: 'destructive' }) }
  }

  const load = async () => {
    setLoading(true)
    await Promise.all([fetchTheatres(), fetchSurgeries()])
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

  const resetOtForm = () => {
    setOtName(''); setOtType('General'); setOtFloor(''); setOtStatus('Available')
    setEditingOt(null)
  }

  const resetSurgeryForm = () => {
    setSurgPatientId(''); setSurgDoctorId(''); setSurgOtId(''); setSurgType('Planned')
    setSurgCategory('Minor'); setSurgAnesthesia(''); setSurgDate(''); setSurgTime('')
    setSurgDiagnosis(''); setSurgProcedure(''); setSurgNotes('')
    setSurgTeam([]); setTeamMemberName(''); setTeamMemberRole('')
    setConflictWarning('')
    setEditingSurgery(null)
  }

  const handleSaveOt = async () => {
    if (!otName.trim()) { toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const payload = { name: otName.trim(), type: otType, floor: otFloor || null, status: editingOt ? otStatus : undefined }
      if (editingOt) {
        await apiPut(`/operation-theatres/${editingOt.id}`, payload)
        toast({ title: 'Theatre Updated' })
      } else {
        await apiPost('/operation-theatres', payload)
        toast({ title: 'Theatre Created' })
      }
      setOtDialogOpen(false); resetOtForm(); fetchTheatres()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to save', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleSaveSurgery = async () => {
    if (!surgPatientId || !surgDoctorId) {
      toast({ title: 'Error', description: 'Patient and Doctor are required', variant: 'destructive' }); return
    }
    setSaving(true)
    try {
      // Conflict check: same OT, same date, non-cancelled surgery
      if (surgOtId && surgDate) {
        const conflict = surgeries.find(s =>
          s.otId === surgOtId && s.scheduledDate === surgDate && s.status !== 'Cancelled' && s.status !== 'Completed' &&
          (editingSurgery ? s.id !== editingSurgery.id : true)
        )
        if (conflict) {
          setConflictWarning(`⚠ ${conflict.ot?.name || 'This theatre'} already has a ${conflict.type} surgery (${conflict.scheduledTime || 'time TBD'}) on ${surgDate}.`)
          if (!window.confirm(`Conflict: "${conflict.ot?.name || 'This theatre'}" is already booked on ${surgDate}${conflict.scheduledTime ? ` at ${conflict.scheduledTime}` : ''}. Schedule anyway?`)) {
            setSaving(false); return
          }
        } else {
          setConflictWarning('')
        }
      }

      const payload: Record<string, unknown> = {
        patientId: surgPatientId, doctorId: surgDoctorId, type: surgType, category: surgCategory,
        anesthesiaType: surgAnesthesia || null, scheduledDate: surgDate || null, scheduledTime: surgTime || null,
        diagnosis: surgDiagnosis || null, procedure: surgProcedure || null, notes: surgNotes || null,
      }
      if (surgOtId) payload.otId = surgOtId
      if (surgTeam.length > 0) payload.surgicalTeam = JSON.stringify(surgTeam)

      if (editingSurgery) {
        await apiPut(`/surgeries/${editingSurgery.id}`, payload)
        toast({ title: 'Surgery Updated' })
      } else {
        await apiPost('/surgeries', payload)
        toast({ title: 'Surgery Created' })
      }
      setSurgeryDialogOpen(false); resetSurgeryForm(); fetchSurgeries()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to save', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (surgery: Surgery, newStatus: string) => {
    try {
      await apiPut(`/surgeries/${surgery.id}`, {
        status: newStatus,
        startTime: newStatus === 'In-Progress' ? new Date().toISOString() : undefined,
        endTime: newStatus === 'Completed' ? new Date().toISOString() : undefined,
      })
      toast({ title: `Surgery ${newStatus}` })
      fetchSurgeries()
    } catch { toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' }) }
  }

  const handleDeleteOt = async (id: string) => {
    if (!confirm('Delete this operation theatre?')) return
    try {
      await apiDelete(`/operation-theatres/${id}`)
      toast({ title: 'Theatre Deleted' }); fetchTheatres()
    } catch { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }) }
  }

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      Available: 'bg-emerald-100 text-emerald-700', 'In-Use': 'bg-blue-100 text-blue-700',
      Maintenance: 'bg-amber-100 text-amber-700', Closed: 'bg-red-100 text-red-700',
      Scheduled: 'bg-blue-100 text-blue-700', 'In-Progress': 'bg-amber-100 text-amber-700',
      Completed: 'bg-emerald-100 text-emerald-700', Cancelled: 'bg-red-100 text-red-700',
      Postponed: 'bg-purple-100 text-purple-700',
    }
    return <Badge className={colors[s] || ''} variant="secondary">{s}</Badge>
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="theatres"><Syringe className="mr-2 size-4" />Theatres</TabsTrigger>
            <TabsTrigger value="surgeries"><CalendarDays className="mr-2 size-4" />Surgeries</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays className="mr-2 size-4" />Calendar</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="theatres" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {theatres.filter(t => t.status === 'Available').length > 0 && (
                <Badge variant="outline" className="text-emerald-600">
                  {theatres.filter(t => t.status === 'Available').length} Available
                </Badge>
              )}
              {theatres.filter(t => t.status === 'In-Use').length > 0 && (
                <Badge variant="outline" className="text-blue-600">
                  {theatres.filter(t => t.status === 'In-Use').length} In Use
                </Badge>
              )}
            </div>
            <Button onClick={() => { resetOtForm(); setOtDialogOpen(true) }}>
              <Plus className="mr-2 size-4" />Add Theatre
            </Button>
          </div>

          {loading ? <Skeleton className="h-48" /> : theatres.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No operation theatres configured.</CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {theatres.map(ot => (
                <Card key={ot.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{ot.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{ot.type}{ot.floor ? ` · Floor ${ot.floor}` : ''}</p>
                      </div>
                      {statusBadge(ot.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{ot._count?.surgeries || 0} surgeries</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="size-7"
                          onClick={() => { setEditingOt(ot); setOtName(ot.name); setOtType(ot.type); setOtFloor(ot.floor || ''); setOtStatus(ot.status); setOtDialogOpen(true) }}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7"
                          onClick={() => handleDeleteOt(ot.id)}>
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="surgeries" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {SURGERY_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { resetSurgeryForm(); setSurgeryDialogOpen(true) }}>
              <Plus className="mr-2 size-4" />Schedule Surgery
            </Button>
          </div>

          {loading ? <Skeleton className="h-48" /> : surgeries.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No surgeries scheduled.</CardContent></Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Theatre</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surgeries.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{s.patient?.name || s.patientId}</div>
                        <div className="text-xs text-muted-foreground">{s.patient?.patientId}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{s.doctor?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{s.doctor?.specialization}</div>
                      </TableCell>
                      <TableCell>{s.ot?.name || '—'}</TableCell>
                      <TableCell>
                        <div className="text-sm">{s.scheduledDate || '—'}</div>
                        {s.scheduledTime && <div className="text-xs text-muted-foreground">{s.scheduledTime}</div>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.type}</Badge>
                      </TableCell>
                      <TableCell>
                        {s.surgicalTeam ? <Badge variant="outline" className="gap-1"><Users className="size-3" />Team</Badge> : '—'}
                      </TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Select value="" onValueChange={(v) => v && handleStatusChange(s, v)}>
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue placeholder="Update Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {SURGERY_STATUSES.filter(st => st !== s.status).map(st => (
                                <SelectItem key={st} value={st}>{st}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="calendar" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Surgery Calendar</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-medium min-w-32 text-center">{format(calendarDate, 'MMMM yyyy')}</span>
              <Button variant="outline" size="icon" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}>
                <ChevronRight className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCalendarDate(new Date())}>Today</Button>
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="grid grid-cols-7 border-b bg-muted/50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            {(() => {
              const monthStart = startOfMonth(calendarDate)
              const monthEnd = endOfMonth(calendarDate)
              const calStart = startOfWeek(monthStart)
              const calEnd = endOfWeek(monthEnd)
              const days = eachDayOfInterval({ start: calStart, end: calEnd })
              const weeks: Date[][] = []
              for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
              return weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
                  {week.map((day, di) => {
                    const dayStr = format(day, 'yyyy-MM-dd')
                    const daySurgeries = surgeries.filter(s => s.scheduledDate === dayStr)
                    const inMonth = isSameMonth(day, calendarDate)
                    const today = isToday(day)
                    const selected = selectedDay && isSameDay(day, selectedDay)
                    return (
                      <button
                        key={di}
                        onClick={() => setSelectedDay(selected && isSameDay(day, selectedDay) ? null : day)}
                        className={`min-h-20 p-1.5 border-r last:border-r-0 text-left transition-colors hover:bg-accent/50
                          ${inMonth ? '' : 'text-muted-foreground/40'}
                          ${today ? 'bg-accent' : ''}
                          ${selected ? 'ring-2 ring-inset ring-primary' : ''}`}
                      >
                        <span className={`text-xs font-medium ${today ? 'text-primary' : ''}`}>{format(day, 'd')}</span>
                        <div className="mt-1 space-y-0.5">
                          {daySurgeries.slice(0, 3).map(s => (
                            <div key={s.id} className={`text-[10px] leading-tight px-1 rounded truncate
                              ${s.status === 'Scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : ''}
                              ${s.status === 'In-Progress' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : ''}
                              ${s.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : ''}`}>
                              {s.doctor?.name?.split(' ').pop() || '—'}: {s.type}
                            </div>
                          ))}
                          {daySurgeries.length > 3 && (
                            <div className="text-[10px] text-muted-foreground px-1">+{daySurgeries.length - 3} more</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))
            })()}
          </div>

          {/* Selected day surgery list */}
          {selectedDay && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">{format(selectedDay, 'EEEE, MMMM d, yyyy')}</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                {(() => {
                  const dayStr = format(selectedDay, 'yyyy-MM-dd')
                  const daySurgeries = surgeries.filter(s => s.scheduledDate === dayStr)
                  if (daySurgeries.length === 0) {
                    return <p className="text-sm text-muted-foreground py-4 text-center">No surgeries scheduled for this day.</p>
                  }
                  return (
                    <div className="space-y-2">
                      {daySurgeries.map(s => (
                        <div key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div className="flex items-center gap-3">
                            <div className={`size-2 rounded-full
                              ${s.status === 'Scheduled' ? 'bg-blue-500' : ''}
                              ${s.status === 'In-Progress' ? 'bg-amber-500' : ''}
                              ${s.status === 'Completed' ? 'bg-emerald-500' : ''}
                              ${s.status === 'Cancelled' ? 'bg-red-500' : ''}
                              ${s.status === 'Postponed' ? 'bg-purple-500' : ''}`} />
                            <div>
                              <div className="text-sm font-medium">{s.patient?.name || s.patientId}</div>
                              <div className="text-xs text-muted-foreground">
                                {s.scheduledTime || '—'} · {s.doctor?.name || '—'}
                                {s.ot ? ` · ${s.ot.name}` : ''}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className={`text-xs
                            ${s.status === 'Scheduled' ? 'bg-blue-100 text-blue-700' : ''}
                            ${s.status === 'In-Progress' ? 'bg-amber-100 text-amber-700' : ''}
                            ${s.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : ''}
                            ${s.status === 'Cancelled' ? 'bg-red-100 text-red-700' : ''}
                            ${s.status === 'Postponed' ? 'bg-purple-100 text-purple-700' : ''}`}>
                            {s.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* OT Dialog */}
      <Dialog open={otDialogOpen} onOpenChange={(o) => { if (!o) resetOtForm(); setOtDialogOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingOt ? 'Edit Theatre' : 'Add Operation Theatre'}</DialogTitle>
            <DialogDescription>{editingOt ? 'Update theatre details.' : 'Register a new operation theatre.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Theatre Name *</Label>
              <Input value={otName} onChange={e => setOtName(e.target.value)} placeholder="e.g. OT-1, Main Operation Theatre" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={otType} onValueChange={setOtType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['General', 'Cardiac', 'Ortho', 'Neuro', 'ENT', 'Ophthalmic', 'Laparoscopic'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Input value={otFloor} onChange={e => setOtFloor(e.target.value)} placeholder="e.g. 2" />
              </div>
            </div>
            {editingOt && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={otStatus} onValueChange={setOtStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOtDialogOpen(false); resetOtForm() }}>Cancel</Button>
            <Button onClick={handleSaveOt} disabled={saving || !otName.trim()}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingOt ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Surgery Dialog */}
      <Dialog open={surgeryDialogOpen} onOpenChange={(o) => { if (!o) resetSurgeryForm(); setSurgeryDialogOpen(o) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSurgery ? 'Update Surgery' : 'Schedule Surgery'}</DialogTitle>
            <DialogDescription>Enter surgery details and assign resources.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Patient ID *</Label>
                <Input value={surgPatientId} onChange={e => setSurgPatientId(e.target.value)} placeholder="Patient ID" />
              </div>
              <div className="space-y-2">
                <Label>Doctor ID *</Label>
                <Input value={surgDoctorId} onChange={e => setSurgDoctorId(e.target.value)} placeholder="Doctor ID" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Operation Theatre</Label>
              <Select value={surgOtId} onValueChange={setSurgOtId}>
                <SelectTrigger><SelectValue placeholder="Select theatre" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {theatres.filter(t => t.status === 'Available').map(ot => (
                    <SelectItem key={ot.id} value={ot.id}>{ot.name} ({ot.type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={surgType} onValueChange={setSurgType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SURGERY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={surgCategory} onValueChange={setSurgCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SURGERY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={surgDate} onChange={e => setSurgDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input type="time" value={surgTime} onChange={e => setSurgTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Anesthesia Type</Label>
              <Input value={surgAnesthesia} onChange={e => setSurgAnesthesia(e.target.value)} placeholder="e.g. General, Spinal, Local" />
            </div>
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea value={surgDiagnosis} onChange={e => setSurgDiagnosis(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Procedure</Label>
              <Textarea value={surgProcedure} onChange={e => setSurgProcedure(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={surgNotes} onChange={e => setSurgNotes(e.target.value)} rows={2} />
            </div>

            {/* Conflict Warning */}
            {conflictWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <span>{conflictWarning}</span>
              </div>
            )}

            {/* Surgical Team */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="size-4" /> Surgical Team (optional)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={teamMemberName}
                  onChange={e => setTeamMemberName(e.target.value)}
                  placeholder="Name"
                  className="flex-1"
                />
                <Input
                  value={teamMemberRole}
                  onChange={e => setTeamMemberRole(e.target.value)}
                  placeholder="Role"
                  className="w-28"
                />
                <Button
                  variant="outline" size="sm"
                  onClick={() => {
                    if (teamMemberName.trim() && teamMemberRole.trim()) {
                      setSurgTeam([...surgTeam, { name: teamMemberName.trim(), role: teamMemberRole.trim() }])
                      setTeamMemberName(''); setTeamMemberRole('')
                    }
                  }}
                >Add</Button>
              </div>
              {surgTeam.length > 0 && (
                <div className="space-y-1">
                  {surgTeam.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                      <span><span className="font-medium">{m.name}</span> — {m.role}</span>
                      <Button variant="ghost" size="icon" className="size-6" onClick={() => setSurgTeam(surgTeam.filter((_, i) => i !== idx))}>
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSurgeryDialogOpen(false); resetSurgeryForm() }}>Cancel</Button>
            <Button onClick={handleSaveSurgery} disabled={saving || !surgPatientId || !surgDoctorId}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingSurgery ? 'Update' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
