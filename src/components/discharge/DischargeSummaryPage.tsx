'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  ClipboardCheck,
  Calendar,
  User,
  Stethoscope,
  Search,
  Plus,
  Eye,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Activity,
  Pill,
  Filter,
  X,
  Trash2,
  HeartPulse,
  Syringe,
  Utensils,
  Footprints,
  FileWarning,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
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

const CONDTIONS = ['Recovered', 'Improved', 'Stable', 'Referred', 'DAMA', 'Expired']

interface DischargeSummary {
  id: string
  summaryId: string
  patientId: string
  visitId: string
  admissionDate: string
  dischargeDate: string
  admittingDoctor: string
  diagnosis: string
  diagnosisDetails: string | null
  treatmentSummary: string | null
  procedurePerformed: string | null
  dischargeMedications: string | null
  followUpAdvice: string | null
  followUpDays: number | null
  followUpDoctor: string | null
  dietAdvice: string | null
  activityAdvice: string | null
  additionalInstructions: string | null
  conditionAtDischarge: string
  status: string
  createdAt: string
  patient: { id: string; patientId: string; name: string } | null
  doctor: { id: string; doctorId: string; name: string } | null
}

interface IPDVisit {
  id: string
  visitId: string
  patientId: string
  admissionDate: string
  patient: { id: string; patientId: string; name: string } | null
}

interface MedicationRow {
  medicine: string
  dosage: string
  frequency: string
  duration: string
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parseMedications(medStr: string | null): MedicationRow[] {
  if (!medStr) return []
  try {
    const parsed = JSON.parse(medStr)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function ConditionBadge({ condition }: { condition: string }) {
  const styles: Record<string, string> = {
    Recovered: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    Improved: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
    Stable: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    Referred: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    DAMA: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
    Expired: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  }
  return (
    <Badge variant="outline" className={styles[condition] ?? 'bg-gray-100 text-gray-700 border-gray-200'}>
      {condition}
    </Badge>
  )
}

function ViewSummaryDialog({
  summary,
  open,
  onOpenChange,
  onPrint,
}: {
  summary: DischargeSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrint: () => void
}) {
  if (!summary) return null
  const meds = parseMedications(summary.dischargeMedications)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="hidden" />

        <div className="space-y-6">
          <div className="text-center border-b-2 border-emerald-600 pb-3">
            <h1 className="text-xl font-bold text-emerald-700">Discharge Summary</h1>
            <p className="text-xs text-muted-foreground">MediBill Pro Hospital</p>
          </div>

          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs font-mono">{summary.summaryId}</Badge>
            <ConditionBadge condition={summary.conditionAtDischarge} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Patient:</span>
                <span>{summary.patient?.name || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Patient ID:</span>
                <span>{summary.patient?.patientId || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Doctor:</span>
                <span>{summary.admittingDoctor || summary.doctor?.name || 'N/A'}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Admission:</span>
                <span>{formatDate(summary.admissionDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Discharge:</span>
                <span>{formatDate(summary.dischargeDate)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <Activity className="h-4 w-4 text-emerald-600" />
                Diagnosis
              </h3>
              <p className="text-sm">{summary.diagnosis}</p>
              {summary.diagnosisDetails && (
                <p className="text-sm text-muted-foreground mt-1">{summary.diagnosisDetails}</p>
              )}
            </div>

            {summary.treatmentSummary && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                  <HeartPulse className="h-4 w-4 text-emerald-600" />
                  Treatment Summary
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary.treatmentSummary}</p>
              </div>
            )}

            {summary.procedurePerformed && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                  <Syringe className="h-4 w-4 text-emerald-600" />
                  Procedure Performed
                </h3>
                <p className="text-sm text-muted-foreground">{summary.procedurePerformed}</p>
              </div>
            )}

            {meds.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Pill className="h-4 w-4 text-emerald-600" />
                  Discharge Medications
                </h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Dosage</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {meds.map((m, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{m.medicine}</TableCell>
                          <TableCell>{m.dosage || '-'}</TableCell>
                          <TableCell>{m.frequency || '-'}</TableCell>
                          <TableCell>{m.duration || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {summary.followUpAdvice && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    Follow-up Advice
                  </h3>
                  <p className="text-sm text-muted-foreground">{summary.followUpAdvice}</p>
                  {summary.followUpDays && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      Follow-up in {summary.followUpDays} days
                    </Badge>
                  )}
                  {summary.followUpDoctor && (
                    <p className="text-xs text-muted-foreground mt-1">With: {summary.followUpDoctor}</p>
                  )}
                </div>
              )}
              {summary.dietAdvice && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                    <Utensils className="h-4 w-4 text-emerald-600" />
                    Diet Advice
                  </h3>
                  <p className="text-sm text-muted-foreground">{summary.dietAdvice}</p>
                </div>
              )}
              {summary.activityAdvice && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                    <Footprints className="h-4 w-4 text-emerald-600" />
                    Activity Advice
                  </h3>
                  <p className="text-sm text-muted-foreground">{summary.activityAdvice}</p>
                </div>
              )}
            </div>

            {summary.additionalInstructions && (
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                  <FileWarning className="h-4 w-4 text-emerald-600" />
                  Additional Instructions
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summary.additionalInstructions}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center border-t pt-4 text-xs text-muted-foreground">
            <span>Generated: {formatDateTime(summary.createdAt)}</span>
            <span>{summary.doctor?.name || summary.admittingDoctor || 'Doctor'}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Summary
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ITEMS_PER_PAGE = 10

export function DischargeSummaryPage() {
  const { toast } = useToast()

  const [summaries, setSummaries] = useState<DischargeSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [viewSummary, setViewSummary] = useState<DischargeSummary | null>(null)

  const [patientSearch, setPatientSearch] = useState('')
  const [ipdVisits, setIpdVisits] = useState<IPDVisit[]>([])
  const [visitsLoading, setVisitsLoading] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<IPDVisit | null>(null)

  const [admissionDate, setAdmissionDate] = useState('')
  const [dischargeDate, setDischargeDate] = useState(new Date().toISOString().split('T')[0])
  const [admittingDoctor, setAdmittingDoctor] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [diagnosisDetails, setDiagnosisDetails] = useState('')
  const [treatmentSummary, setTreatmentSummary] = useState('')
  const [procedurePerformed, setProcedurePerformed] = useState('')
  const [medications, setMedications] = useState<MedicationRow[]>([])
  const [followUpAdvice, setFollowUpAdvice] = useState('')
  const [followUpDays, setFollowUpDays] = useState('7')
  const [followUpDoctor, setFollowUpDoctor] = useState('')
  const [dietAdvice, setDietAdvice] = useState('')
  const [activityAdvice, setActivityAdvice] = useState('')
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [condition, setCondition] = useState('Improved')
  const [submitting, setSubmitting] = useState(false)

  const fetchSummaries = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: ITEMS_PER_PAGE }
      if (search) params.search = search
      if (statusFilter !== 'all') params.status = statusFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      const res = await apiGet<PaginatedResponse<DischargeSummary>>('/discharge-summaries', params)
      setSummaries(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, dateFrom, dateTo, toast])

  const fetchIPDVisits = useCallback(async (q: string) => {
    setVisitsLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 20, status: 'Admitted' }
      if (q) params.search = q
      const res = await apiGet<PaginatedResponse<IPDVisit>>('/visits/ipd', params)
      setIpdVisits(res.data)
    } catch {
      setIpdVisits([])
    } finally {
      setVisitsLoading(false)
    }
  }, [])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSummaries()
  }, [fetchSummaries])

    
  useEffect(() => {
    if (createDialogOpen) // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIPDVisits('')
  }, [createDialogOpen, fetchIPDVisits])

   
  useEffect(() => {
    const timer = setTimeout(() => {
      if (createDialogOpen) fetchIPDVisits(patientSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch, createDialogOpen, fetchIPDVisits])

  const handleSelectVisit = (visit: IPDVisit) => {
    setSelectedVisit(visit)
    setAdmissionDate(visit.admissionDate.split('T')[0])
    setPatientSearch(visit.patient?.name ?? '')
  }

  const handleAddMedication = () => {
    setMedications([...medications, { medicine: '', dosage: '', frequency: '', duration: '' }])
  }

  const handleRemoveMedication = (index: number) => {
    if (medications.length > 1) {
      setMedications(medications.filter((_, i) => i !== index))
    }
  }

  const handleMedicationChange = (index: number, field: keyof MedicationRow, value: string) => {
    const updated = [...medications]
    updated[index] = { ...updated[index], [field]: value }
    setMedications(updated)
  }

  const resetForm = () => {
    setSelectedVisit(null)
    setPatientSearch('')
    setAdmissionDate('')
    setDischargeDate(new Date().toISOString().split('T')[0])
    setAdmittingDoctor('')
    setDiagnosis('')
    setDiagnosisDetails('')
    setTreatmentSummary('')
    setProcedurePerformed('')
    setMedications([])
    setFollowUpAdvice('')
    setFollowUpDays('7')
    setFollowUpDoctor('')
    setDietAdvice('')
    setActivityAdvice('')
    setAdditionalInstructions('')
    setCondition('Improved')
  }

  const handleCreate = async () => {
    if (!selectedVisit || !diagnosis || !condition) {
      toast({ title: 'Validation', description: 'Please select a visit, enter diagnosis, and condition at discharge', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const body = {
        visitId: selectedVisit.id,
        patientId: selectedVisit.patientId,
        admissionDate,
        dischargeDate,
        admittingDoctor: admittingDoctor || undefined,
        diagnosis,
        diagnosisDetails: diagnosisDetails || undefined,
        treatmentSummary: treatmentSummary || undefined,
        procedurePerformed: procedurePerformed || undefined,
        dischargeMedications: medications.filter((m) => m.medicine.trim()).length > 0
          ? JSON.stringify(medications.filter((m) => m.medicine.trim()))
          : undefined,
        followUpAdvice: followUpAdvice || undefined,
        followUpDays: followUpDays ? parseInt(followUpDays) : undefined,
        followUpDoctor: followUpDoctor || undefined,
        dietAdvice: dietAdvice || undefined,
        activityAdvice: activityAdvice || undefined,
        additionalInstructions: additionalInstructions || undefined,
        conditionAtDischarge: condition,
      }
      await apiPost<SingleResponse<DischargeSummary>>('/discharge-summaries', body)
      toast({ title: 'Success', description: 'Discharge summary created successfully!' })
      setCreateDialogOpen(false)
      resetForm()
      fetchSummaries()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)))
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-sky-100 dark:bg-sky-950">
            <ClipboardCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Discharge Summaries</h1>
            <p className="text-sm text-muted-foreground">Manage IPD discharge summaries</p>
          </div>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          onClick={() => {
            resetForm()
            setCreateDialogOpen(true)
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Discharge Summary
        </Button>
      </div>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient name, ID, or diagnosis..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="w-[140px]"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="w-[140px]"
                placeholder="To"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                  setDateFrom('')
                  setDateTo('')
                  setPage(1)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Summary ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Admission Date</TableHead>
                  <TableHead>Discharge Date</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : summaries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      <ClipboardCheck className="h-6 w-6 mx-auto mb-1 opacity-30" />
                      No discharge summaries found
                    </TableCell>
                  </TableRow>
                ) : (
                  summaries.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setViewSummary(s)}>
                      <TableCell className="font-mono text-xs">{s.summaryId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-xs font-bold dark:bg-sky-950 dark:text-sky-300">
                            {(s.patient?.name || '?').charAt(0)}
                          </div>
                          <span className="font-medium">{s.patient?.name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(s.admissionDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(s.dischargeDate)}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">{s.diagnosis}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.admittingDoctor || s.doctor?.name || '—'}</TableCell>
                      <TableCell><ConditionBadge condition={s.conditionAtDischarge} /></TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setViewSummary(s) }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
              </div>
            ) : summaries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ClipboardCheck className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No discharge summaries found</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {summaries.map((s) => (
                  <Card key={s.id} className="rounded-xl border shadow-sm cursor-pointer" onClick={() => setViewSummary(s)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-xs font-bold shrink-0">
                            {(s.patient?.name || '?').charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{s.patient?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground font-mono">{s.summaryId}</p>
                          </div>
                        </div>
                        <ConditionBadge condition={s.conditionAtDischarge} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div><span className="font-medium text-foreground">Admission:</span> {formatDate(s.admissionDate)}</div>
                        <div><span className="font-medium text-foreground">Discharge:</span> {formatDate(s.dischargeDate)}</div>
                        <div className="col-span-2 truncate"><span className="font-medium text-foreground">Diagnosis:</span> {s.diagnosis}</div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setViewSummary(s) }}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(page - 1)} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let p: number
              if (totalPages <= 5) p = i + 1
              else if (page <= 3) p = i + 1
              else if (page >= totalPages - 2) p = totalPages - 4 + i
              else p = page - 2 + i
              return (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className={p === page ? 'h-8 w-8 bg-emerald-600 hover:bg-emerald-700 text-white' : 'h-8 w-8'}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </Button>
              )
            })}
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setCreateDialogOpen(open) }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-600" />
              Create Discharge Summary
            </DialogTitle>
            <DialogDescription>Complete the discharge summary form for an IPD patient</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="rounded-lg border p-4 bg-muted/10">
              <h3 className="text-sm font-semibold mb-3">Patient & Visit</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Search IPD Patient</Label>
                  <Input
                    placeholder="Search by patient name or ID..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                </div>
                {visitsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading patients...
                  </div>
                ) : ipdVisits.length > 0 ? (
                  <div className="max-h-[120px] overflow-y-auto space-y-1">
                    {ipdVisits.filter((v) => !patientSearch || v.patient?.name?.toLowerCase().includes(patientSearch.toLowerCase()) || v.patient?.patientId?.toLowerCase().includes(patientSearch.toLowerCase())).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVisit(v)}
                        className={`w-full text-left flex items-center gap-2 p-2 rounded-md text-sm transition-colors ${selectedVisit?.id === v.id ? 'bg-emerald-50 border border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800' : 'hover:bg-muted border border-transparent'}`}
                      >
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{v.patient?.name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">{v.visitId}</span>
                        {selectedVisit?.id === v.id && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 ml-auto shrink-0" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No IPD visits found</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Admission Date</Label>
                <Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discharge Date</Label>
                <Input type="date" value={dischargeDate} onChange={(e) => setDischargeDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Admitting Doctor</Label>
                <Input placeholder="Doctor's name" value={admittingDoctor} onChange={(e) => setAdmittingDoctor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Condition at Discharge</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Diagnosis</Label>
              <Input placeholder="Primary diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Diagnosis Details</Label>
              <Textarea placeholder="Detailed diagnosis information..." value={diagnosisDetails} onChange={(e) => setDiagnosisDetails(e.target.value)} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Treatment Summary</Label>
              <Textarea placeholder="Summary of treatment provided during hospital stay..." value={treatmentSummary} onChange={(e) => setTreatmentSummary(e.target.value)} rows={3} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Procedure Performed</Label>
              <Textarea placeholder="Any procedures performed during the stay..." value={procedurePerformed} onChange={(e) => setProcedurePerformed(e.target.value)} rows={2} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Discharge Medications</Label>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddMedication}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Medicine
                </Button>
              </div>
              {medications.length === 0 ? (
                <p className="text-xs text-muted-foreground">No medications added. Click &quot;Add Medicine&quot; to prescribe.</p>
              ) : (
                <div className="space-y-2">
                  {medications.map((med, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg border bg-muted/10">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Medicine</Label>
                          <Input placeholder="Medicine name" value={med.medicine} onChange={(e) => handleMedicationChange(i, 'medicine', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Dosage</Label>
                          <Input placeholder="e.g. 500mg" value={med.dosage} onChange={(e) => handleMedicationChange(i, 'dosage', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Frequency</Label>
                          <Input placeholder="e.g. Twice daily" value={med.frequency} onChange={(e) => handleMedicationChange(i, 'frequency', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Duration</Label>
                          <Input placeholder="e.g. 7 days" value={med.duration} onChange={(e) => handleMedicationChange(i, 'duration', e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-5 text-red-500 hover:text-red-600" onClick={() => handleRemoveMedication(i)} disabled={medications.length <= 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Follow-up Advice</Label>
                <Textarea placeholder="Follow-up instructions..." value={followUpAdvice} onChange={(e) => setFollowUpAdvice(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Follow-up Days</Label>
                <Input type="number" min="0" value={followUpDays} onChange={(e) => setFollowUpDays(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Follow-up Doctor</Label>
                <Input placeholder="Doctor's name" value={followUpDoctor} onChange={(e) => setFollowUpDoctor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Diet Advice</Label>
                <Textarea placeholder="Dietary recommendations..." value={dietAdvice} onChange={(e) => setDietAdvice(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Activity Advice</Label>
                <Textarea placeholder="Activity restrictions and recommendations..." value={activityAdvice} onChange={(e) => setActivityAdvice(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Additional Instructions</Label>
                <Textarea placeholder="Any additional instructions for the patient..." value={additionalInstructions} onChange={(e) => setAdditionalInstructions(e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreate} disabled={submitting || !selectedVisit}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ViewSummaryDialog
        summary={viewSummary}
        open={!!viewSummary}
        onOpenChange={(open) => { if (!open) setViewSummary(null) }}
        onPrint={handlePrint}
      />
    </div>
  )
}
