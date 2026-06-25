'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { apiGet, apiPost, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Eye,
  Printer,
  Download,
  Send,
  X,
  FileText,
  CalendarDays,
  Activity,
  Pill,
  Stethoscope,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search as SearchIcon,
  ClipboardList,
  TrendingUp,
  BarChart3,
  Users,
} from 'lucide-react'

// ==================== TYPES ====================

interface MedicineNote {
  medicine: string
  dosage?: string
  frequency?: string
  duration?: string
  medicineId?: string
}

interface MedicineSearchResult {
  id: string
  medicineId: string
  name: string
  category: string | null
  sellingPrice: number
  stock: number
}

interface PatientOption {
  id: string
  patientId: string
  name: string
  phone?: string
  age?: number | null
  gender?: string | null
}

interface DoctorOption {
  id: string
  doctorId: string
  name: string
  specialization: string
  _count?: { appointments: number }
}

interface Prescription {
  id: string
  prescriptionId: string
  patientId: string
  doctorId: string
  date: string
  diagnosis: string | null
  notes: string | null
  followUpDays?: number | null
  patient: { id: string; patientId: string; name: string; phone: string | null; age?: number | null; gender?: string | null } | null
  doctor: { id: string; doctorId: string; name: string; specialization: string } | null
  createdAt: string
  updatedAt: string
}

// ==================== PRESCRIPTION TEMPLATES ====================

interface PrescriptionTemplate {
  id: string
  name: string
  description: string
  icon: string
  diagnosis: string
  medicines: MedicineNote[]
  notes: string
  followUpDays: number
}

const PRESCRIPTION_TEMPLATES: PrescriptionTemplate[] = [
  {
    id: 'fever-cold',
    name: 'Fever & Cold',
    description: 'Common cold and fever management',
    icon: '🤒',
    diagnosis: 'Acute Upper Respiratory Tract Infection / Viral Fever',
    medicines: [
      { medicine: 'Paracetamol 500mg', dosage: '500mg', frequency: '3 times daily', duration: '5 days' },
      { medicine: 'Cetirizine 10mg', dosage: '10mg', frequency: 'Once at night', duration: '5 days' },
    ],
    notes: 'Steam inhalation 2-3 times daily. Warm salt water gargling. Adequate fluid intake. Rest.',
    followUpDays: 5,
  },
  {
    id: 'diabetes',
    name: 'Diabetes Management',
    description: 'Type 2 diabetes routine management',
    icon: '💊',
    diagnosis: 'Type 2 Diabetes Mellitus',
    medicines: [
      { medicine: 'Metformin 500mg', dosage: '500mg', frequency: 'Twice daily (morning & evening after meals)', duration: '30 days' },
      { medicine: 'Glimepiride 2mg', dosage: '2mg', frequency: 'Once in the morning before breakfast', duration: '30 days' },
    ],
    notes: 'Regular exercise (30 min walk daily). Low carbohydrate diet. Monitor blood sugar fasting & post-prandial. Avoid sweets and sugary drinks.',
    followUpDays: 30,
  },
  {
    id: 'hypertension',
    name: 'Hypertension',
    description: 'Blood pressure management',
    icon: '❤️',
    diagnosis: 'Essential Hypertension',
    medicines: [
      { medicine: 'Amlodipine 5mg', dosage: '5mg', frequency: 'Once daily (morning)', duration: '30 days' },
      { medicine: 'Telmisartan 40mg', dosage: '40mg', frequency: 'Once daily (morning)', duration: '30 days' },
    ],
    notes: 'Low salt diet (less than 5g/day). Regular exercise. Reduce stress. Monitor BP daily. Avoid smoking and alcohol.',
    followUpDays: 15,
  },
  {
    id: 'infection',
    name: 'Infection',
    description: 'Bacterial infection with antibiotics',
    icon: '🦠',
    diagnosis: 'Bacterial Infection',
    medicines: [
      { medicine: 'Amoxicillin 500mg', dosage: '500mg', frequency: '3 times daily for 5 days', duration: '5 days' },
      { medicine: 'Probiotics', dosage: '1 capsule', frequency: 'Once daily (after antibiotic)', duration: '7 days' },
    ],
    notes: 'Complete the full course of antibiotics. Take probiotics to maintain gut flora. Report if no improvement in 48 hours.',
    followUpDays: 7,
  },
  {
    id: 'pain-relief',
    name: 'Pain Relief',
    description: 'Pain management and gastric protection',
    icon: '💪',
    diagnosis: 'Musculoskeletal Pain / Headache',
    medicines: [
      { medicine: 'Ibuprofen 400mg', dosage: '400mg', frequency: '3 times daily after food', duration: '5 days' },
      { medicine: 'Pantoprazole 40mg', dosage: '40mg', frequency: 'Once daily in the morning (empty stomach)', duration: '5 days' },
    ],
    notes: 'Do not take Ibuprofen on empty stomach. Apply warm compress if applicable. Rest the affected area. Avoid heavy lifting.',
    followUpDays: 7,
  },
  {
    id: 'allergy',
    name: 'Allergy',
    description: 'Allergic rhinitis management',
    icon: '🤧',
    diagnosis: 'Allergic Rhinitis / Allergic Conjunctivitis',
    medicines: [
      { medicine: 'Montelukast 10mg', dosage: '10mg', frequency: 'Once at night', duration: '14 days' },
      { medicine: 'Levocetirizine 5mg', dosage: '5mg', frequency: 'Once in the morning', duration: '14 days' },
    ],
    notes: 'Avoid known allergens. Keep windows closed during pollen season. Use saline nasal spray. Clean bedding regularly.',
    followUpDays: 14,
  },
]

// ==================== HELPERS ====================

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function parseNotes(notesStr: string | null): MedicineNote[] {
  if (!notesStr) return []
  try {
    const parsed = JSON.parse(notesStr)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return d >= weekAgo
}

function generatePassword(length: number = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pass = ''
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}

// ==================== TEMPLATE DIALOG ====================

function TemplateDialog({
  open,
  onOpenChange,
  onSelectTemplate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTemplate: (template: PrescriptionTemplate) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            Quick Prescription Templates
          </DialogTitle>
          <DialogDescription>
            Select a template to pre-fill common prescriptions. You can edit details before saving.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PRESCRIPTION_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                onSelectTemplate(template)
                onOpenChange(false)
              }}
              className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-xl">{template.icon}</span>
                <span className="font-semibold text-sm">{template.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{template.description}</p>
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <p><span className="font-medium text-foreground">Diagnosis:</span> {template.diagnosis}</p>
                <p><span className="font-medium text-foreground">Medicines:</span> {template.medicines.map(m => m.medicine).join(', ')}</p>
              </div>
              <div className="flex items-center gap-1 mt-1">
                {template.medicines.map((m, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                    {m.dosage}
                  </Badge>
                ))}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==================== PRINT PRESCRIPTION DIALOG ====================

function PrintPrescriptionDialog({
  prescription,
  open,
  onOpenChange,
  clinicName,
  clinicAddress,
}: {
  prescription: Prescription
  open: boolean
  onOpenChange: (open: boolean) => void
  clinicName: string
  clinicAddress: string
}) {
  const meds = parseNotes(prescription.notes)

  const handlePrint = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl print:max-w-none print:p-0 print:shadow-none print:border-none print:bg-white">
        <DialogHeader className="hidden print:hidden">
          <DialogTitle>Print Prescription</DialogTitle>
        </DialogHeader>

        {/* Print Area */}
        <div id="printable-prescription" className="print-area space-y-0">
          {/* Header */}
          <div className="text-center border-b-2 border-emerald-600 pb-3 mb-4">
            <h1 className="text-xl font-bold text-emerald-700">{clinicName || 'MediBill Pro Hospital'}</h1>
            <p className="text-xs text-muted-foreground">{clinicAddress || '123 Healthcare Avenue, Medical District'}</p>
            <p className="text-xs text-muted-foreground">Phone: +91 98765 43210 | Email: info@hospital.com</p>
          </div>

          {/* Title */}
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold underline">PRESCRIPTION</h2>
          </div>

          {/* Patient & Doctor Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div className="space-y-1">
              <p><span className="font-semibold">Patient Name:</span> {prescription.patient?.name || 'N/A'}</p>
              <p><span className="font-semibold">Patient ID:</span> {prescription.patient?.patientId || 'N/A'}</p>
              <p><span className="font-semibold">Age/Gender:</span> {prescription.patient?.age || '-'} yrs / {prescription.patient?.gender || '-'}</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-semibold">Date:</span> {formatDate(prescription.date)}</p>
              <p><span className="font-semibold">Doctor:</span> {prescription.doctor?.name || 'N/A'}</p>
              <p><span className="font-semibold">Specialization:</span> {prescription.doctor?.specialization || 'N/A'}</p>
            </div>
          </div>

          {/* Diagnosis */}
          <div className="mb-4">
            <p className="font-semibold text-sm mb-1">Diagnosis:</p>
            <Badge variant="secondary" className="text-sm py-1 px-3">
              {prescription.diagnosis || 'Not specified'}
            </Badge>
          </div>

          {/* Medicines Table */}
          <div className="mb-4">
            <p className="font-semibold text-sm mb-2">Medicines:</p>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-emerald-50 dark:bg-emerald-950/30">
                    <TableHead className="font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Medicine</TableHead>
                    <TableHead className="font-semibold">Dosage</TableHead>
                    <TableHead className="font-semibold">Frequency</TableHead>
                    <TableHead className="font-semibold">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meds.length > 0 ? meds.map((med, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{med.medicine}</TableCell>
                      <TableCell className="font-mono text-sm">{med.dosage || '-'}</TableCell>
                      <TableCell>{med.frequency || '-'}</TableCell>
                      <TableCell>{med.duration || '-'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-4">No medicines recorded</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <p className="font-semibold text-sm mb-1">Notes / Instructions:</p>
            <div className="rounded border bg-muted/30 p-2 text-sm">
              {meds.length === 0 && typeof prescription.notes === 'string'
                ? prescription.notes
                : 'Follow dosage instructions carefully. Take medicines at prescribed times.'}
            </div>
          </div>

          {/* Follow-up */}
          <div className="mb-6">
            <p className="font-semibold text-sm mb-1">Follow-up:</p>
            <Badge variant="outline" className="text-sm py-1 px-3">
              <Clock className="mr-1.5 h-3.5 w-3.5" />
              Follow-up in {prescription.followUpDays || 7} days
            </Badge>
          </div>

          {/* Signature */}
          <div className="flex justify-between items-end mt-12 border-t pt-4">
            <p className="text-xs text-muted-foreground">Prescription ID: {prescription.prescriptionId}</p>
            <div className="text-center">
              <div className="w-40 border-b-2 border-emerald-600 mb-1" />
              <p className="text-sm font-medium">{prescription.doctor?.name || 'Doctor'}</p>
              <p className="text-xs text-muted-foreground">{prescription.doctor?.specialization || 'Physician'}</p>
              <p className="text-xs text-muted-foreground">{formatDate(prescription.date)}</p>
            </div>
          </div>
        </div>

        {/* Print Actions - hidden in print */}
        <DialogFooter className="print:hidden flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />Print Prescription
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== PRESCRIPTION STATS CARD ====================

function PrescriptionStatsCard({
  prescriptions,
  loading,
}: {
  prescriptions: Prescription[]
  loading: boolean
}) {
  const stats = useMemo(() => {
    if (loading || prescriptions.length === 0) {
      return { thisMonth: 0, topMedicines: [] as { name: string; count: number }[], perDoctor: [] as { name: string; count: number }[] }
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

    const thisMonthRx = prescriptions.filter(p => p.date >= monthStart)

    // Extract all medicines and count
    const medCounts: Record<string, number> = {}
    const docCounts: Record<string, number> = {}

    thisMonthRx.forEach(rx => {
      const meds = parseNotes(rx.notes)
      meds.forEach(m => {
        if (m.medicine) {
          // Extract base medicine name (first word or before dosage)
          const baseName = m.medicine.split(/[\s(]/)[0]
          medCounts[baseName] = (medCounts[baseName] || 0) + 1
        }
      })
      if (rx.doctor?.name) {
        const docName = rx.doctor.name.replace('Dr. ', '')
        docCounts[docName] = (docCounts[docName] || 0) + 1
      }
    })

    const topMedicines = Object.entries(medCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    const perDoctor = Object.entries(docCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return {
      thisMonth: thisMonthRx.length,
      topMedicines,
      perDoctor,
    }
  }, [prescriptions, loading])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Prescription Statistics
            </CardTitle>
            <CardDescription>This month&apos;s prescription analytics</CardDescription>
          </div>
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            <TrendingUp className="mr-1 h-3 w-3" />
            {stats.thisMonth} this month
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Top Medicines */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Pill className="h-3.5 w-3.5 text-emerald-600" />
              Most Prescribed Medicines
            </h4>
            {stats.topMedicines.length > 0 ? (
              <div className="space-y-2">
                {stats.topMedicines.map((med, idx) => (
                  <div key={med.name} className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-sm flex-1 truncate">{med.name}</span>
                    <Badge variant="outline" className="text-[10px]">{med.count}x</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No prescriptions this month</p>
            )}
          </div>

          {/* Prescriptions per Doctor */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
              Prescriptions per Doctor
            </h4>
            {stats.perDoctor.length > 0 ? (
              <div className="space-y-2">
                {stats.perDoctor.map((doc) => (
                  <div key={doc.name} className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px]">
                      <Stethoscope className="h-3 w-3" />
                    </div>
                    <span className="text-sm flex-1 truncate">{doc.name}</span>
                    <Badge variant="outline" className="text-[10px]">{doc.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No prescriptions this month</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== MAIN COMPONENT ====================

export function PrescriptionListPage() {
  const { toast } = useToast()

  // Data states
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Filter states
  const [page, setPage] = useState(1)
  const [doctorFilter, setDoctorFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailDialog, setDetailDialog] = useState<Prescription | null>(null)
  const [newPrescriptionOpen, setNewPrescriptionOpen] = useState(false)

  // New dialog states
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [printDialogRx, setPrintDialogRx] = useState<Prescription | null>(null)

  // Loading/error states
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string>('')

  // New prescription form state
  const [newPatient, setNewPatient] = useState('')
  const [newDoctor, setNewDoctor] = useState('')
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newDiagnosis, setNewDiagnosis] = useState('')
  const [newMedicines, setNewMedicines] = useState<MedicineNote[]>([
    { medicine: '', dosage: '', frequency: '', duration: '' },
  ])

  // Medicine search
  const [medicineSearchQuery, setMedicineSearchQuery] = useState('')
  const [medicineResults, setMedicineResults] = useState<MedicineSearchResult[]>([])
  const [medicineSearching, setMedicineSearching] = useState(false)
  const [activeMedicineIndex, setActiveMedicineIndex] = useState<number | null>(null)
  const [newNotes, setNewNotes] = useState('')
  const [followUpDays, setFollowUpDays] = useState<number>(7)

  // Dialog dropdown data
  const [patientOptions, setPatientOptions] = useState<PatientOption[]>([])
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [loadingDoctors, setLoadingDoctors] = useState(false)

  // Stats
  const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  // Clinic info for print
  const [clinicName, setClinicName] = useState('')
  const [clinicAddress, setClinicAddress] = useState('')

  // Fetch clinic settings for print
  const fetchClinicSettings = useCallback(async () => {
    try {
      const res = await apiGet<SingleResponse<{ clinicName: string; address: string | null; city: string | null; state: string | null }>>('/settings')
      setClinicName(res.data.clinicName || 'MediBill Pro Hospital')
      const parts = [res.data.address, res.data.city, res.data.state].filter(Boolean)
      setClinicAddress(parts.join(', ') || '123 Healthcare Avenue, Medical District')
    } catch {
      setClinicName('MediBill Pro Hospital')
      setClinicAddress('123 Healthcare Avenue, Medical District')
    }
  }, [])

  const limit = 20
  const abortRef = useRef<AbortController | null>(null)
  const patientSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch prescriptions
  const fetchPrescriptions = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setIsLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { page, limit: 1000 }
      if (doctorFilter) params.doctorId = doctorFilter
      if (dateFrom) params.fromDate = dateFrom
      if (dateTo) params.toDate = dateTo

      const res = await apiGet<PaginatedResponse<Prescription>>('/prescriptions', params)
      setPrescriptions(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)

      // Calculate stats from all data
      const todayStr = new Date().toISOString().split('T')[0]
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoStr = weekAgo.toISOString().split('T')[0]
      setStats({
        total: res.total,
        today: res.data.filter((p) => p.date === todayStr).length,
        thisWeek: res.data.filter((p) => p.date >= weekAgoStr).length,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        setError(err.message)
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
      setLoadingStats(false)
    }
  }, [page, doctorFilter, dateFrom, dateTo, toast])

  // Fetch stats separately (from all prescriptions)
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await apiGet<PaginatedResponse<Prescription>>('/prescriptions', { page: 1, limit: 1000 })
      const todayStr = new Date().toISOString().split('T')[0]
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoStr = weekAgo.toISOString().split('T')[0]
      setStats({
        total: res.total,
        today: res.data.filter((p) => p.date === todayStr).length,
        thisWeek: res.data.filter((p) => p.date >= weekAgoStr).length,
      })
    } catch {
      // Stats fetch is non-critical
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    fetchPrescriptions()
    fetchClinicSettings()
  }, [fetchPrescriptions, fetchClinicSettings])

  // Fetch doctors for dropdown
  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true)
    try {
      const res = await apiGet<PaginatedResponse<DoctorOption>>('/doctors', { limit: 100 })
      setDoctorOptions(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: 'Failed to load doctors', variant: 'destructive' })
      }
    } finally {
      setLoadingDoctors(false)
    }
  }, [toast])

  // Fetch patients with debounced search
  const fetchPatients = useCallback(async (search: string) => {
    setLoadingPatients(true)
    try {
      const params: Record<string, string | number> = { limit: 50 }
      if (search) params.search = search
      const res = await apiGet<PaginatedResponse<PatientOption>>('/patients', params)
      setPatientOptions(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: 'Failed to load patients', variant: 'destructive' })
      }
    } finally {
      setLoadingPatients(false)
    }
  }, [toast])

  useEffect(() => {
    if (newPrescriptionOpen) {
      fetchDoctors()
      fetchPatients('')
    }
  }, [newPrescriptionOpen, fetchDoctors, fetchPatients])

  // Debounced medicine search
  useEffect(() => {
    if (!medicineSearchQuery || activeMedicineIndex === null) {
      setMedicineResults([])
      setMedicineSearching(false)
      return
    }
    const timer = setTimeout(async () => {
      setMedicineSearching(true)
      try {
        const res = await apiGet<{ data: MedicineSearchResult[] }>(`/medicines/search?q=${encodeURIComponent(medicineSearchQuery)}`)
        setMedicineResults(res.data || [])
      } catch {
        setMedicineResults([])
      } finally {
        setMedicineSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [medicineSearchQuery, activeMedicineIndex])

  const handlePatientSearch = (value: string) => {
    setNewPatient(value)
    if (patientSearchTimerRef.current) clearTimeout(patientSearchTimerRef.current)
    patientSearchTimerRef.current = setTimeout(() => {
      fetchPatients(value)
    }, 300)
  }

  // Filter prescriptions client-side for search query
  const filteredPrescriptions = searchQuery
    ? prescriptions.filter((p) => {
        const q = searchQuery.toLowerCase()
        return (
          (p.patient?.name?.toLowerCase().includes(q)) ||
          (p.prescriptionId?.toLowerCase().includes(q)) ||
          (p.diagnosis?.toLowerCase().includes(q))
        )
      })
    : prescriptions

  // Medicine handlers
  const handleAddMedicine = () => {
    setNewMedicines([...newMedicines, { medicine: '', dosage: '', frequency: '', duration: '' }])
  }

  const handleRemoveMedicine = (index: number) => {
    if (newMedicines.length > 1) {
      setNewMedicines(newMedicines.filter((_, i) => i !== index))
    }
  }

  const handleMedicineChange = (index: number, field: keyof MedicineNote, value: string) => {
    const updated = [...newMedicines]
    updated[index] = { ...updated[index], [field]: value }
    setNewMedicines(updated)
  }

  // Template handler
  const handleSelectTemplate = useCallback(async (template: PrescriptionTemplate) => {
    setNewDiagnosis(template.diagnosis)
    setNewNotes(template.notes)
    setFollowUpDays(template.followUpDays)

    // Look up medicineIds from inventory for template medicines
    const medicinesWithIds: MedicineNote[] = await Promise.all(
      template.medicines.map(async (m) => {
        try {
          const searchRes = await apiGet<{ data: MedicineSearchResult[] }>(`/medicines/search?q=${encodeURIComponent(m.medicine)}`)
          const match = searchRes.data?.find((r) =>
            r.name.toLowerCase().includes(m.medicine.toLowerCase().split(/[\s(]/)[0].toLowerCase())
          )
          if (match) {
            return { ...m, medicineId: match.id }
          }
        } catch {
          // Ignore lookup failures
        }
        return { ...m }
      })
    )
    setNewMedicines(medicinesWithIds)

    if (!newPrescriptionOpen) {
      setNewPrescriptionOpen(true)
    }
    toast({ title: 'Template Applied', description: `"${template.name}" template applied. Edit details as needed.` })
  }, [newPrescriptionOpen, toast])

  // Submit prescription
  const handleSavePrescription = async () => {
    if (!newPatient || !newDoctor || newMedicines.every((m) => !m.medicine)) return
    setIsSubmitting(true)
    try {
      const body = {
        patientId: newPatient,
        doctorId: newDoctor,
        date: newDate,
        diagnosis: newDiagnosis || undefined,
        notes: newMedicines.filter((m) => m.medicine.trim()).map((m) => ({
          medicine: m.medicine,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          medicineId: m.medicineId || undefined,
        })),
        followUpDays: followUpDays || undefined,
      }
      await apiPost<SingleResponse<Prescription>>('/prescriptions', body)
      toast({ title: 'Success', description: 'Prescription created successfully!' })
      setNewPrescriptionOpen(false)
      resetForm()
      fetchPrescriptions()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setNewPatient('')
    setNewDoctor('')
    setNewDate(new Date().toISOString().split('T')[0])
    setNewDiagnosis('')
    setNewMedicines([{ medicine: '', dosage: '', frequency: '', duration: '' }])
    setNewNotes('')
    setFollowUpDays(7)
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loadingStats ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Prescriptions</CardTitle>
                <FileText className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground mt-1">All time records</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Today&apos;s Prescriptions</CardTitle>
                <CalendarDays className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.today} prescription{stats.today !== 1 ? 's' : ''} issued today
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
                <Activity className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats.thisWeek}</div>
                <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Prescription Statistics Card */}
      <PrescriptionStatsCard prescriptions={prescriptions} loading={loadingStats} />

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">From Date</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="w-full lg:w-40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">To Date</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="w-full lg:w-40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Doctor</label>
                <Select value={doctorFilter} onValueChange={(v) => { setDoctorFilter(v === '__all__' ? '' : v); setPage(1) }}>
                  <SelectTrigger className="w-full lg:w-56">
                    <SelectValue placeholder="All Doctors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Doctors</SelectItem>
                    {doctorOptions.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name} ({doc.specialization})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 lg:w-64">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patient, diagnosis..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9"
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setDoctorFilter('')
                setSearchQuery('')
                setPage(1)
              }}
              className="shrink-0"
            >
              <Filter className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prescriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Prescriptions</CardTitle>
              <CardDescription>
                {isLoading ? 'Loading...' : `Showing ${filteredPrescriptions.length} of ${total} records`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setTemplateDialogOpen(true)}
              >
                <ClipboardList className="mr-2 h-4 w-4" />
                Templates
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setNewPrescriptionOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Prescription
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <AlertCircle className="h-12 w-12 text-red-400" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={fetchPrescriptions}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Prescription ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No prescriptions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPrescriptions.map((rx) => {
                      const meds = parseNotes(rx.notes)
                      return (
                        <React.Fragment key={rx.id}>
                          <TableRow
                            className="cursor-pointer"
                            onClick={() => setExpandedId(expandedId === rx.id ? null : rx.id)}
                          >
                            <TableCell>
                              {expandedId === rx.id ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{rx.prescriptionId}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-300">
                                  {(rx.patient?.name || '?').charAt(0)}
                                </div>
                                <span className="font-medium">{rx.patient?.name || 'Unknown'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm">{rx.doctor?.name?.replace('Dr. ', '') || 'Unknown'}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{formatDate(rx.date)}</TableCell>
                            <TableCell>
                              <span className="text-sm line-clamp-1 max-w-[200px]">{rx.diagnosis || '-'}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPrintDialogRx(rx)
                                  }}
                                  title="Print Prescription"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setDetailDialog(rx)
                                  }}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedId === rx.id && (
                            <TableRow>
                              <TableCell colSpan={7} className="bg-muted/30 p-4">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground">Patient:</span>
                                      <span className="text-sm font-medium">{rx.patient?.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Stethoscope className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground">Doctor:</span>
                                      <span className="text-sm font-medium">{rx.doctor?.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Activity className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground">Diagnosis:</span>
                                      <span className="text-sm font-medium">{rx.diagnosis || 'N/A'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Pill className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground">Medicines:</span>
                                      <span className="text-sm font-medium">{meds.length}</span>
                                    </div>
                                  </div>

                                  {meds.length > 0 && (
                                    <div className="rounded-lg border">
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
                                          {meds.map((med, idx) => (
                                            <TableRow key={idx}>
                                              <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                  <Pill className="h-3.5 w-3.5 text-emerald-500" />
                                                  {med.medicine}
                                                </div>
                                              </TableCell>
                                              <TableCell>{med.dosage || '-'}</TableCell>
                                              <TableCell>{med.frequency || '-'}</TableCell>
                                              <TableCell>
                                                <Badge variant="outline" className="text-xs">
                                                  <Clock className="mr-1 h-3 w-3" />
                                                  {med.duration || '-'}
                                                </Badge>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  )}

                                  {meds.length === 0 && (
                                    <p className="text-sm text-muted-foreground italic">No medicines recorded</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template Dialog */}
      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* Print Prescription Dialog */}
      {printDialogRx && (
        <PrintPrescriptionDialog
          prescription={printDialogRx}
          open={!!printDialogRx}
          onOpenChange={(open) => !open && setPrintDialogRx(null)}
          clinicName={clinicName}
          clinicAddress={clinicAddress}
        />
      )}

      {/* Prescription Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Prescription Details
            </DialogTitle>
            <DialogDescription>Complete prescription information</DialogDescription>
          </DialogHeader>
          {detailDialog && (() => {
            const meds = parseNotes(detailDialog.notes)
            return (
              <div className="space-y-6">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 dark:bg-emerald-950/30 dark:border-emerald-800">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Prescription ID</p>
                      <p className="font-mono text-sm font-semibold">{detailDialog.prescriptionId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className="text-sm font-semibold">{formatDate(detailDialog.date)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Patient</p>
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-200 text-emerald-700 text-xs font-bold dark:bg-emerald-800">
                          {(detailDialog.patient?.name || '?').charAt(0)}
                        </div>
                        <p className="text-sm font-semibold">{detailDialog.patient?.name || 'Unknown'}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Doctor</p>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-emerald-600" />
                        <div>
                          <p className="text-sm font-semibold">{detailDialog.doctor?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{detailDialog.doctor?.specialization}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Diagnosis</h3>
                  <Badge variant="secondary" className="text-sm py-1 px-3">
                    <Activity className="mr-1.5 h-3.5 w-3.5" />
                    {detailDialog.diagnosis || 'Not specified'}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-3">Prescribed Medicines ({meds.length})</h3>
                  {meds.length > 0 ? (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Medicine Name</TableHead>
                            <TableHead>Dosage</TableHead>
                            <TableHead>Frequency</TableHead>
                            <TableHead>Duration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {meds.map((med, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Pill className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="font-medium">{med.medicine}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{med.dosage || '-'}</TableCell>
                              <TableCell>{med.frequency || '-'}</TableCell>
                              <TableCell><Badge variant="outline">{med.duration || '-'}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No medicines recorded</p>
                  )}
                </div>

                {detailDialog.followUpDays && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Follow-up</h3>
                    <Badge variant="outline" className="text-sm py-1 px-3">
                      <Clock className="mr-1.5 h-3.5 w-3.5" />
                      Follow-up in {detailDialog.followUpDays} days
                    </Badge>
                  </div>
                )}
              </div>
            )
          })()}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setDetailDialog(null)}>Close</Button>
            <Button variant="outline" onClick={() => { if (detailDialog) setPrintDialogRx(detailDialog); setDetailDialog(null) }}>
              <Printer className="mr-2 h-4 w-4" />Print
            </Button>
            <Button variant="outline"><Download className="mr-2 h-4 w-4" />Download PDF</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!detailDialog || sendingId === detailDialog.id}
              onClick={async () => {
                const rx = detailDialog
                if (!rx) return
                const meds = parseNotes(rx.notes)
                const phone = rx.patient?.phone?.replace(/[^0-9]/g, '')
                if (!phone) {
                  toast({ title: 'Error', description: 'Patient has no phone number', variant: 'destructive' })
                  return
                }
                const msg = `📋 Prescription from MediBill Pro

Patient: ${rx.patient?.name || 'Unknown'}
Doctor: Dr. ${rx.doctor?.name || 'Unknown'}
Prescription #: ${rx.prescriptionId}
Date: ${formatDate(rx.date)}
Medicines: ${meds.length} item(s)

Medicines:
${meds.map((m: MedicineNote, i: number) => `${i + 1}. ${m.medicine}${m.dosage ? ` - ${m.dosage}` : ''}${m.frequency ? `, ${m.frequency}` : ''}${m.duration ? `, ${m.duration}` : ''}`).join('\n')}

${rx.diagnosis ? `Diagnosis: ${rx.diagnosis}` : ''}
Please carry this prescription when visiting the pharmacy.`
                setSendingId(rx.id)
                try {
                  const { sendWhatsApp } = await import('@/lib/whatsapp-client')
                  await sendWhatsApp({
                    to: `+91${phone}`,
                    template: 'prescription',
                    entityType: 'Prescription',
                    entityId: rx.id,
                    messageBody: msg,
                    onSuccess: () => toast({ title: 'Sent!', description: `Prescription sent via WhatsApp to ${rx.patient?.name}` }),
                    onError: (err) => toast({ title: 'Failed', description: err, variant: 'destructive' }),
                  })
                } catch {
                  toast({ title: 'Error', description: 'Failed to send prescription', variant: 'destructive' })
                } finally {
                  setSendingId('')
                }
              }}
            >
              {detailDialog && sendingId === detailDialog.id ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" />Send to Patient</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Prescription Dialog */}
      <Dialog open={newPrescriptionOpen} onOpenChange={(open) => { if (!open) { setNewPrescriptionOpen(false); resetForm() } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              New Prescription
            </DialogTitle>
            <DialogDescription>Create a new prescription for a patient</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Template Quick Access Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewPrescriptionOpen(false)
                  setTimeout(() => setTemplateDialogOpen(true), 200)
                }}
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
              >
                <ClipboardList className="mr-1.5 h-3.5 w-3.5" />
                Load Template
              </Button>
              <span className="text-xs text-muted-foreground">Pre-fill from common templates</span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="patient-select">Patient *</Label>
                <Input
                  placeholder="Search patient by name..."
                  value={newPatient ? patientOptions.find(p => p.id === newPatient)?.name || newPatient : ''}
                  onChange={(e) => handlePatientSearch(e.target.value)}
                  onFocus={() => fetchPatients('')}
                />
                {loadingPatients && <p className="text-xs text-muted-foreground">Searching...</p>}
                {patientOptions.length > 0 && !loadingPatients && (
                  <div className="max-h-32 overflow-y-auto rounded-md border">
                    {patientOptions
                      .filter((p) => !newPatient || p.id === newPatient || p.name.toLowerCase().includes(newPatient.toLowerCase()))
                      .slice(0, 8)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-0 transition-colors ${newPatient === p.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}
                          onClick={() => { setNewPatient(p.id) }}
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">({p.patientId})</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor-select">Doctor *</Label>
                {loadingDoctors ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={newDoctor} onValueChange={setNewDoctor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctorOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} - {d.specialization}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rx-date">Date *</Label>
                <Input
                  id="rx-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="followup">Follow-up (days)</Label>
                <Input
                  id="followup"
                  type="number"
                  min={1}
                  max={365}
                  value={followUpDays}
                  onChange={(e) => setFollowUpDays(parseInt(e.target.value) || 7)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis *</Label>
              <Input
                id="diagnosis"
                placeholder="Enter diagnosis..."
                value={newDiagnosis}
                onChange={(e) => setNewDiagnosis(e.target.value)}
              />
            </div>

            {/* Dynamic Medicines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Medicines *</Label>
                <Button variant="outline" size="sm" onClick={handleAddMedicine}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Medicine
                </Button>
              </div>
              {newMedicines.map((med, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Medicine #{idx + 1}</span>
                    {newMedicines.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700"
                        onClick={() => handleRemoveMedicine(idx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 relative">
                      <Label className="text-xs">Medicine Name</Label>
                      <div className="relative">
                        <Input
                          placeholder="e.g., Paracetamol 500mg"
                          value={med.medicine}
                          onChange={(e) => {
                            handleMedicineChange(idx, 'medicine', e.target.value)
                            setMedicineSearchQuery(e.target.value)
                            setActiveMedicineIndex(idx)
                          }}
                          onFocus={() => {
                            setActiveMedicineIndex(idx)
                            setMedicineSearchQuery(med.medicine)
                          }}
                          onBlur={() => {
                            setTimeout(() => setActiveMedicineIndex(null), 200)
                          }}
                        />
                        {med.medicineId && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                        )}
                      </div>
                      {activeMedicineIndex === idx && medicineSearchQuery && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                          {medicineSearching ? (
                            <div className="flex items-center justify-center py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : medicineResults.length > 0 ? (
                            medicineResults.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 border-b last:border-0 transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  handleMedicineChange(idx, 'medicine', m.name)
                                  handleMedicineChange(idx, 'medicineId', m.id)
                                  setMedicineSearchQuery('')
                                  setActiveMedicineIndex(null)
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{m.name}</span>
                                  <Badge variant="outline" className="text-[10px]">{m.category || 'General'}</Badge>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                  <span>Stock: <span className={m.stock <= 0 ? 'text-red-500 font-medium' : 'font-medium'}>{m.stock}</span></span>
                                  <span>Price: ₹{m.sellingPrice}</span>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="px-3 py-2 text-xs text-muted-foreground">No matching medicines found</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Dosage</Label>
                      <Input
                        placeholder="e.g., 500mg"
                        value={med.dosage || ''}
                        onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Frequency</Label>
                      <Input
                        placeholder="e.g., Twice daily"
                        value={med.frequency || ''}
                        onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Duration</Label>
                      <Input
                        placeholder="e.g., 7 days"
                        value={med.duration || ''}
                        onChange={(e) => handleMedicineChange(idx, 'duration', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Enter any additional instructions..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setNewPrescriptionOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSavePrescription}
              disabled={!newPatient || !newDoctor || newMedicines.every((m) => !m.medicine) || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Save Prescription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area,
          .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  )
}
