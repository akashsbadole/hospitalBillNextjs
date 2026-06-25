'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useNavigation } from '@/stores/navigation'
import {
  HeartPulse,
  ClipboardList,
  Droplets,
  Search,
  Plus,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Thermometer,
  Wind,
  Syringe,
  Activity,
  AlertTriangle,
  User,
  Stethoscope,
  Filter,
  Pill,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Gauge,
  Bed,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface IPDPatient {
  id: string
  visitId: string
  patient: { id: string; patientId: string; name: string } | null
  bed?: { bedNumber: string; wardName: string } | null
}

interface VitalSign {
  id: string
  recordedAt: string
  bpSystolic: number
  bpDiastolic: number
  pulse: number
  temperature: number
  spo2: number
  rr: number
  bloodSugar: number | null
  painScore: number | null
  notes: string | null
  recordedBy: string | null
}

interface NursingNote {
  id: string
  date: string
  shift: string
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
  recordedBy: string | null
  createdAt: string
}

interface IntakeOutput {
  id: string
  time: string
  type: string
  category: string
  amount: number
  notes: string | null
  recordedBy: string | null
  createdAt: string
}

interface IntakeOutputSummary {
  totalIntake: number
  totalOutput: number
  balance: number
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function TrendSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 80
  const height = 24
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="inline-block shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={points.split(' ').pop()?.split(',')[1] ?? height} r="2.5" fill={color} />
    </svg>
  )
}

function VitalSignsTab({
  vitals,
  loading,
  onRecord,
  visitId,
}: {
  vitals: VitalSign[]
  loading: boolean
  onRecord: () => void
  visitId: string
}) {
  const getBpTrend = () => {
    if (vitals.length < 2) return []
    return vitals.slice(-7).map((v) => v.bpSystolic)
  }

  const getPulseTrend = () => {
    if (vitals.length < 2) return []
    return vitals.slice(-7).map((v) => v.pulse)
  }

  const bpTrend = getBpTrend()
  const pulseTrend = getPulseTrend()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-rose-600" />
          <h3 className="font-semibold text-base">Vital Signs</h3>
          {vitals.length > 0 && (
            <Badge variant="outline" className="text-xs">{vitals.length} records</Badge>
          )}
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" onClick={onRecord}>
          <Plus className="h-4 w-4 mr-1.5" />
          Record Vitals
        </Button>
      </div>

      {bpTrend.length >= 2 && (
        <div className="flex flex-wrap gap-4 text-sm p-3 rounded-lg border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">BP Trend (7):</span>
            <TrendSparkline values={bpTrend} color="#e11d48" />
            <span className="font-mono text-xs">{bpTrend[bpTrend.length - 1]}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">Pulse Trend (7):</span>
            <TrendSparkline values={pulseTrend} color="#2563eb" />
            <span className="font-mono text-xs">{pulseTrend[pulseTrend.length - 1]}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : vitals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <HeartPulse className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">No vital signs recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>BP (Sys/Dia)</TableHead>
                <TableHead>Pulse</TableHead>
                <TableHead>Temp</TableHead>
                <TableHead>SpO₂</TableHead>
                <TableHead>RR</TableHead>
                <TableHead>Blood Sugar</TableHead>
                <TableHead>Pain</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vitals.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(v.recordedAt)}</TableCell>
                  <TableCell className="font-mono text-sm">{v.bpSystolic}/{v.bpDiastolic}</TableCell>
                  <TableCell className="font-mono text-sm">{v.pulse}</TableCell>
                  <TableCell className="font-mono text-sm">{v.temperature.toFixed(1)}</TableCell>
                  <TableCell className="font-mono text-sm">{v.spo2}%</TableCell>
                  <TableCell className="font-mono text-sm">{v.rr}</TableCell>
                  <TableCell className="font-mono text-sm">{v.bloodSugar !== null ? v.bloodSugar : '—'}</TableCell>
                  <TableCell>
                    {v.painScore !== null ? (
                      <Badge variant={v.painScore > 5 ? 'destructive' : 'outline'} className="text-xs">
                        {v.painScore}/10
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">{v.notes || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.recordedBy || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function NursingNotesTab({
  notes,
  loading,
  shiftFilter,
  onShiftChange,
  onAddNote,
  visitId,
}: {
  notes: NursingNote[]
  loading: boolean
  shiftFilter: string
  onShiftChange: (v: string) => void
  onAddNote: () => void
  visitId: string
}) {
  const filtered = shiftFilter === 'all' ? notes : notes.filter((n) => n.shift === shiftFilter)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-sky-600" />
          <h3 className="font-semibold text-base">Nursing Notes</h3>
          {notes.length > 0 && (
            <Badge variant="outline" className="text-xs">{notes.length} notes</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={shiftFilter} onValueChange={onShiftChange}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Filter shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="Morning">Morning</SelectItem>
              <SelectItem value="Evening">Evening</SelectItem>
              <SelectItem value="Night">Night</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" onClick={onAddNote}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Note
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ClipboardList className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">{notes.length === 0 ? 'No nursing notes recorded yet' : 'No notes match the selected shift'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Subjective</TableHead>
                <TableHead>Objective</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDate(note.date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={note.shift === 'Morning' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300' : note.shift === 'Evening' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'}>
                      {note.shift}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">{note.subjective || '—'}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">{note.objective || '—'}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">{note.assessment || '—'}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">{note.plan || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{note.recordedBy || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function IntakeOutputTab({
  records,
  summary,
  loading,
  onRecord,
  visitId,
}: {
  records: IntakeOutput[]
  summary: IntakeOutputSummary | null
  loading: boolean
  onRecord: () => void
  visitId: string
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-cyan-600" />
          <h3 className="font-semibold text-base">Intake / Output</h3>
          {records.length > 0 && (
            <Badge variant="outline" className="text-xs">{records.length} records</Badge>
          )}
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" size="sm" onClick={onRecord}>
          <Plus className="h-4 w-4 mr-1.5" />
          Record
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-sky-600 dark:text-sky-400 mb-1">
              <ArrowDown className="h-4 w-4" />
              <span className="text-xs font-medium">Total Intake</span>
            </div>
            <p className="text-xl font-bold text-sky-700 dark:text-sky-300">{summary.totalIntake} ml</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20 p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 mb-1">
              <ArrowUp className="h-4 w-4" />
              <span className="text-xs font-medium">Total Output</span>
            </div>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{summary.totalOutput} ml</p>
          </div>
          <div className="rounded-lg border p-3 text-center" style={summary.balance >= 0 ? { borderColor: 'var(--emerald-200)', backgroundColor: 'var(--emerald-50)' } : { borderColor: 'var(--red-200)', backgroundColor: 'var(--red-50)' }}>
            <div className="flex items-center justify-center gap-1 mb-1" style={{ color: summary.balance >= 0 ? 'var(--emerald-600)' : 'var(--red-600)' }}>
              <Minus className="h-4 w-4" />
              <span className="text-xs font-medium">Balance</span>
            </div>
            <p className="text-xl font-bold" style={{ color: summary.balance >= 0 ? 'var(--emerald-700)' : 'var(--red-700)' }}>
              {summary.balance >= 0 ? '+' : ''}{summary.balance} ml
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Droplets className="h-8 w-8 mb-2 opacity-30" />
          <p className="text-sm">No intake/output records yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount (ml)</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(rec.time)}</TableCell>
                  <TableCell className="font-medium">{rec.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={rec.category === 'Intake' ? 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'}>
                      {rec.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">{rec.amount}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">{rec.notes || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{rec.recordedBy || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export function NursingChartingPage() {
  const { toast } = useToast()

  const [patients, setPatients] = useState<IPDPatient[]>([])
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<IPDPatient | null>(null)
  const [patientsLoading, setPatientsLoading] = useState(true)
  const [showPatientSearch, setShowPatientSearch] = useState(true)

  const [activeTab, setActiveTab] = useState('vitals')

  const [vitals, setVitals] = useState<VitalSign[]>([])
  const [vitalsLoading, setVitalsLoading] = useState(false)

  const [nursingNotes, setNursingNotes] = useState<NursingNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [shiftFilter, setShiftFilter] = useState('all')

  const [ioRecords, setIoRecords] = useState<IntakeOutput[]>([])
  const [ioSummary, setIoSummary] = useState<IntakeOutputSummary | null>(null)
  const [ioLoading, setIoLoading] = useState(false)

  const [vitalsDialogOpen, setVitalsDialogOpen] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [ioDialogOpen, setIoDialogOpen] = useState(false)

  const [vitalsSubmitting, setVitalsSubmitting] = useState(false)
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [ioSubmitting, setIoSubmitting] = useState(false)

  const [bpSystolic, setBpSystolic] = useState('120')
  const [bpDiastolic, setBpDiastolic] = useState('80')
  const [pulse, setPulse] = useState('72')
  const [temperature, setTemperature] = useState('37.0')
  const [spo2, setSpO2] = useState('98')
  const [rr, setRr] = useState('16')
  const [bloodSugar, setBloodSugar] = useState('')
  const [painScore, setPainScore] = useState('')
  const [vitalNotes, setVitalNotes] = useState('')

  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [noteShift, setNoteShift] = useState('Morning')
  const [noteSubjective, setNoteSubjective] = useState('')
  const [noteObjective, setNoteObjective] = useState('')
  const [noteAssessment, setNoteAssessment] = useState('')
  const [notePlan, setNotePlan] = useState('')

  const [ioType, setIoType] = useState('Oral')
  const [ioCategory, setIoCategory] = useState('Intake')
  const [ioAmount, setIoAmount] = useState('')
  const [ioTime, setIoTime] = useState(new Date().toISOString().slice(0, 16))
  const [ioNotes, setIoNotes] = useState('')

  const fetchPatients = useCallback(async (search: string) => {
    setPatientsLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 20 }
      if (search) params.search = search
      const res = await apiGet<PaginatedResponse<IPDPatient>>('/visits/ipd', params)
      setPatients(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setPatientsLoading(false)
    }
  }, [toast])

  const fetchVitals = useCallback(async (visitId: string) => {
    setVitalsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<VitalSign>>(`/visits/${visitId}/vitals`, { limit: 50 })
      setVitals(res.data)
    } catch {
      setVitals([])
    } finally {
      setVitalsLoading(false)
    }
  }, [])

  const fetchNursingNotes = useCallback(async (visitId: string) => {
    setNotesLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<NursingNote>>(`/visits/${visitId}/nursing-notes`, { limit: 50 })
      setNursingNotes(res.data)
    } catch {
      setNursingNotes([])
    } finally {
      setNotesLoading(false)
    }
  }, [])

  const fetchIoRecords = useCallback(async (visitId: string) => {
    setIoLoading(true)
    try {
      const [recRes, sumRes] = await Promise.all([
        apiGet<PaginatedResponse<IntakeOutput>>(`/visits/${visitId}/intake-output`, { limit: 50 }),
        apiGet<SingleResponse<IntakeOutputSummary>>(`/visits/${visitId}/intake-output/summary`).catch(() => null),
      ])
      setIoRecords(recRes.data)
      if (sumRes) setIoSummary(sumRes.data)
    } catch {
      setIoRecords([])
    } finally {
      setIoLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPatients('')
  }, [fetchPatients])

  useEffect(() => {
    if (selectedPatient) {
      fetchVitals(selectedPatient.id)
      fetchNursingNotes(selectedPatient.id)
      fetchIoRecords(selectedPatient.id)
      setShowPatientSearch(false)
    }
  }, [selectedPatient, fetchVitals, fetchNursingNotes, fetchIoRecords])

  const handlePatientSearch = (value: string) => {
    setPatientSearch(value)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearch) fetchPatients(patientSearch)
      else fetchPatients('')
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch, fetchPatients])

  const handleRecordVitals = async () => {
    if (!selectedPatient) return
    setVitalsSubmitting(true)
    try {
      await apiPost(`/visits/${selectedPatient.id}/vitals`, {
        bpSystolic: parseInt(bpSystolic),
        bpDiastolic: parseInt(bpDiastolic),
        pulse: parseInt(pulse),
        temperature: parseFloat(temperature),
        spo2: parseInt(spo2),
        rr: parseInt(rr),
        bloodSugar: bloodSugar ? parseFloat(bloodSugar) : null,
        painScore: painScore ? parseInt(painScore) : null,
        notes: vitalNotes || null,
      })
      toast({ title: 'Vitals Recorded', description: 'Vital signs saved successfully.' })
      setVitalsDialogOpen(false)
      resetVitalsForm()
      fetchVitals(selectedPatient.id)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setVitalsSubmitting(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedPatient) return
    setNoteSubmitting(true)
    try {
      await apiPost(`/visits/${selectedPatient.id}/nursing-notes`, {
        date: noteDate,
        shift: noteShift,
        subjective: noteSubjective || null,
        objective: noteObjective || null,
        assessment: noteAssessment || null,
        plan: notePlan || null,
      })
      toast({ title: 'Note Added', description: 'Nursing note saved successfully.' })
      setNoteDialogOpen(false)
      resetNoteForm()
      fetchNursingNotes(selectedPatient.id)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setNoteSubmitting(false)
    }
  }

  const handleRecordIo = async () => {
    if (!selectedPatient || !ioAmount) return
    setIoSubmitting(true)
    try {
      await apiPost(`/visits/${selectedPatient.id}/intake-output`, {
        time: ioTime,
        type: ioType,
        category: ioCategory,
        amount: parseFloat(ioAmount),
        notes: ioNotes || null,
      })
      toast({ title: 'Recorded', description: 'Intake/Output recorded successfully.' })
      setIoDialogOpen(false)
      resetIoForm()
      fetchIoRecords(selectedPatient.id)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIoSubmitting(false)
    }
  }

  const resetVitalsForm = () => {
    setBpSystolic('120')
    setBpDiastolic('80')
    setPulse('72')
    setTemperature('37.0')
    setSpO2('98')
    setRr('16')
    setBloodSugar('')
    setPainScore('')
    setVitalNotes('')
  }

  const resetNoteForm = () => {
    setNoteDate(new Date().toISOString().split('T')[0])
    setNoteShift('Morning')
    setNoteSubjective('')
    setNoteObjective('')
    setNoteAssessment('')
    setNotePlan('')
  }

  const resetIoForm = () => {
    setIoType('Oral')
    setIoCategory('Intake')
    setIoAmount('')
    setIoTime(new Date().toISOString().slice(0, 16))
    setIoNotes('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950">
            <HeartPulse className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nursing Charting</h1>
            <p className="text-sm text-muted-foreground">
              {selectedPatient
                ? `Charting for ${selectedPatient.patient?.name ?? 'Unknown'} (${selectedPatient.visitId})`
                : 'Select a patient to start charting'}
            </p>
          </div>
        </div>
        {selectedPatient && (
          <Button variant="outline" size="sm" onClick={() => {
            setSelectedPatient(null)
            setShowPatientSearch(true)
            setPatientSearch('')
          }}>
            <Search className="h-4 w-4 mr-1.5" />
            Change Patient
          </Button>
        )}
      </div>

      {showPatientSearch && (
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Select IPD Patient</CardTitle>
            <CardDescription>Search for an admitted patient to view or record charting data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name, ID, or visit ID..."
                value={patientSearch}
                onChange={(e) => handlePatientSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {patientsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : patients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bed className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No IPD patients found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPatient(p)}
                    className="flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                  >
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm font-bold shrink-0">
                      {(p.patient?.name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{p.patient?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{p.visitId}</p>
                      {p.bed && <p className="text-xs text-muted-foreground mt-0.5">{p.bed.wardName} — {p.bed.bedNumber}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedPatient && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm font-bold shrink-0">
            {(selectedPatient.patient?.name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{selectedPatient.patient?.name || 'Unknown'}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{selectedPatient.visitId}</span>
              {selectedPatient.bed && (
                <>
                  <span>·</span>
                  <span>{selectedPatient.bed.wardName} — {selectedPatient.bed.bedNumber}</span>
                </>
              )}
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
            IPD
          </Badge>
        </div>
      )}

      {selectedPatient && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vitals" className="flex items-center gap-1.5">
              <HeartPulse className="h-4 w-4" />
              <span className="hidden sm:inline">Vital Signs</span>
              <span className="sm:hidden">Vitals</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1.5">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Nursing Notes</span>
              <span className="sm:hidden">Notes</span>
            </TabsTrigger>
            <TabsTrigger value="io" className="flex items-center gap-1.5">
              <Droplets className="h-4 w-4" />
              <span className="hidden sm:inline">Intake / Output</span>
              <span className="sm:hidden">I/O</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vitals">
            <VitalSignsTab
              vitals={vitals}
              loading={vitalsLoading}
              onRecord={() => {
                resetVitalsForm()
                setVitalsDialogOpen(true)
              }}
              visitId={selectedPatient.id}
            />
          </TabsContent>

          <TabsContent value="notes">
            <NursingNotesTab
              notes={nursingNotes}
              loading={notesLoading}
              shiftFilter={shiftFilter}
              onShiftChange={setShiftFilter}
              onAddNote={() => {
                resetNoteForm()
                setNoteDialogOpen(true)
              }}
              visitId={selectedPatient.id}
            />
          </TabsContent>

          <TabsContent value="io">
            <IntakeOutputTab
              records={ioRecords}
              summary={ioSummary}
              loading={ioLoading}
              onRecord={() => {
                resetIoForm()
                setIoDialogOpen(true)
              }}
              visitId={selectedPatient.id}
            />
          </TabsContent>
        </Tabs>
      )}

      {!selectedPatient && !showPatientSearch && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <HeartPulse className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-lg font-medium">No patient selected</p>
          <p className="text-sm mt-1">Search and select an IPD patient to begin charting</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowPatientSearch(true)}>
            <Search className="h-4 w-4 mr-2" />
            Find Patient
          </Button>
        </div>
      )}

      <Dialog open={vitalsDialogOpen} onOpenChange={setVitalsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-rose-600" />
              Record Vital Signs
            </DialogTitle>
            <DialogDescription>Enter patient vital signs for {selectedPatient?.patient?.name || 'Unknown'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">BP Systolic</Label>
              <Input type="number" value={bpSystolic} onChange={(e) => setBpSystolic(e.target.value)} placeholder="120" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">BP Diastolic</Label>
              <Input type="number" value={bpDiastolic} onChange={(e) => setBpDiastolic(e.target.value)} placeholder="80" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pulse (bpm)</Label>
              <Input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)} placeholder="72" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Temperature (°C)</Label>
              <Input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="37.0" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SpO₂ (%)</Label>
              <Input type="number" value={spo2} onChange={(e) => setSpO2(e.target.value)} placeholder="98" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RR (breaths/min)</Label>
              <Input type="number" value={rr} onChange={(e) => setRr(e.target.value)} placeholder="16" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Blood Sugar (mg/dL)</Label>
              <Input type="number" value={bloodSugar} onChange={(e) => setBloodSugar(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pain Score (0-10)</Label>
              <Input type="number" min="0" max="10" value={painScore} onChange={(e) => setPainScore(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-3">
              <Label className="text-xs">Notes</Label>
              <Textarea value={vitalNotes} onChange={(e) => setVitalNotes(e.target.value)} placeholder="Any additional observations..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVitalsDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleRecordVitals} disabled={vitalsSubmitting}>
              {vitalsSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Vitals
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-sky-600" />
              Add Nursing Note (SOAP)
            </DialogTitle>
            <DialogDescription>Document a SOAP nursing note for {selectedPatient?.patient?.name || 'Unknown'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Shift</Label>
                <Select value={noteShift} onValueChange={setNoteShift}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Morning">Morning</SelectItem>
                    <SelectItem value="Evening">Evening</SelectItem>
                    <SelectItem value="Night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subjective</Label>
              <Textarea value={noteSubjective} onChange={(e) => setNoteSubjective(e.target.value)} placeholder="Patient's reported symptoms and concerns..." rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Objective</Label>
              <Textarea value={noteObjective} onChange={(e) => setNoteObjective(e.target.value)} placeholder="Measurable data - vitals, observations, assessments..." rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Assessment</Label>
              <Textarea value={noteAssessment} onChange={(e) => setNoteAssessment(e.target.value)} placeholder="Nursing assessment and clinical judgment..." rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Plan</Label>
              <Textarea value={notePlan} onChange={(e) => setNotePlan(e.target.value)} placeholder="Care plan, interventions, and follow-up actions..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleAddNote} disabled={noteSubmitting}>
              {noteSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ioDialogOpen} onOpenChange={setIoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-cyan-600" />
              Record Intake / Output
            </DialogTitle>
            <DialogDescription>Record fluid intake or output for {selectedPatient?.patient?.name || 'Unknown'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Date & Time</Label>
              <Input type="datetime-local" value={ioTime} onChange={(e) => setIoTime(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={ioType} onValueChange={setIoType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Oral">Oral</SelectItem>
                    <SelectItem value="IV">IV</SelectItem>
                    <SelectItem value="Urine">Urine</SelectItem>
                    <SelectItem value="Stool">Stool</SelectItem>
                    <SelectItem value="Drain">Drain</SelectItem>
                    <SelectItem value="NG">NG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={ioCategory} onValueChange={setIoCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Intake">Intake</SelectItem>
                    <SelectItem value="Output">Output</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (ml)</Label>
              <Input type="number" min="0" step="1" value={ioAmount} onChange={(e) => setIoAmount(e.target.value)} placeholder="e.g. 250" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={ioNotes} onChange={(e) => setIoNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIoDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleRecordIo} disabled={ioSubmitting || !ioAmount}>
              {ioSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
