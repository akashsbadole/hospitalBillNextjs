'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Droplets,
  Shield,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Plus,
  CreditCard,
  Pill,
  Heart,
  Stethoscope,
  CheckCircle2,
  XCircle,
  Timer,
  Banknote,
  IndianRupee,
  AlertCircle,
  Activity,
  Eye,
  Loader2,
  LogOut,
  FlaskConical,
  Briefcase,
  Users,
  BadgeCheck,
} from 'lucide-react'
import { useNavigation } from '@/stores/navigation'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, ApiError, type SingleResponse, type PaginatedResponse } from '@/lib/api-client'
import { formatCurrency, cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { WorkflowStepper, StageBadge, type StageInfo } from '@/components/workflow/WorkflowStepper'
import { StartVisitDialog } from '@/components/workflow/StartVisitDialog'
import { EhrTab } from '@/components/ehr/EhrTab'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientData {
  id: string
  patientId: string
  name: string
  phone: string
  email?: string | null
  gender?: string | null
  bloodGroup?: string | null
  dateOfBirth?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  emergencyContact?: string | null
  emergencyPhone?: string | null
  insuranceProvider?: string | null
  insuranceNumber?: string | null
  aadhaarNumber?: string | null
  allergies?: string[] | null
  pastTreatments?: string[] | null
  maritalStatus?: string | null
  occupation?: string | null
  status: string
  createdAt: string
  updatedAt: string
  appointments?: Appointment[]
}

interface Appointment {
  id: string
  appointmentId: string
  aptId?: string
  doctorId: string
  doctorName?: string
  date: string
  time: string
  duration: number
  status: string
  type: string
  notes?: string | null
  specialization?: string | null
}

interface VisitRecord {
  id: string
  visitId: string
  stage: string
  status: string
  visitType?: string | null
  chiefComplaint?: string | null
  doctorName?: string | null
  temperature?: string | null
  bloodPressure?: string | null
  createdAt: string
  updatedAt: string | null
  stages: Array<{ stage: string; status: string; completedAt: string | null }>
  _count?: { analyses: number }
}

// Prescriptions from /api/prescriptions?patientId=
interface ApiPrescription {
  id: string
  prescriptionId: string
  patientId: string
  doctorId: string
  date: string
  diagnosis?: string | null
  notes?: string | null // JSON string from API
  patient: { id: string; patientId: string; name: string; phone: string }
  doctor: { id: string; doctorId: string; name: string; specialization: string }
}

// Invoices from /api/billing?patientId=
interface ApiInvoice {
  id: string
  invoiceNumber: string
  patientId: string
  date: string
  dueDate?: string | null
  status: string
  subtotal: number
  totalGst: number
  grandTotal: number
  discount: number
  paidAmount: number
  patient: { id: string; patientId: string; name: string; phone: string }
}

// Lab Test Orders
interface LabTestOrder {
  id: string
  orderId: string
  patientId: string
  visitId: string
  testId: string
  status: string
  orderedAt: string
  completedAt?: string | null
  notes?: string | null
  test?: { name: string; category: string; normalRange?: string | null } | null
  visit?: { visitId: string } | null
}

// Insurance Claims
interface InsuranceClaim {
  id: string
  claimId: string
  patientId: string
  policyNumber: string
  claimType: string
  status: string
  approvedAmount: number
  settledAmount: number
  submittedAt: string
  approvedAt?: string | null
  settledAt?: string | null
  remarks?: string | null
  insuranceCompany?: { name: string } | null
  invoice?: { invoiceNumber: string; grandTotal: number } | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PatientDetailPage() {
  const { pageParams, setCurrentPage } = useNavigation()
  const { toast } = useToast()
  const patientId = pageParams?.id as string | undefined

  // Patient data
  const [patient, setPatient] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Visits data
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [visitsLoading, setVisitsLoading] = useState(false)

  // Prescriptions data (fetched separately)
  const [prescriptions, setPrescriptions] = useState<ApiPrescription[]>([])
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false)

  // Billing data (fetched separately)
  const [invoices, setInvoices] = useState<ApiInvoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  // Lab test orders
  const [labOrders, setLabOrders] = useState<LabTestOrder[]>([])
  const [labOrdersLoading, setLabOrdersLoading] = useState(false)

  // Insurance claims
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [claimsLoading, setClaimsLoading] = useState(false)

  // Start Visit dialog
  const [startVisitOpen, setStartVisitOpen] = useState(false)

  // Quick discharge dialog
  const [dischargeVisit, setDischargeVisit] = useState<VisitRecord | null>(null)
  const [dischargeNotes, setDischargeNotes] = useState('')
  const [isDischarging, setIsDischarging] = useState(false)

  // ─── Fetch Patient ───────────────────────────────────────────────────────

  const fetchPatient = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    setNotFound(false)
    try {
      const res = await apiGet<SingleResponse<PatientData & { appointments: Appointment[] }>>(`/patients/${patientId}`)
      setPatient(res.data)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true)
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load patient details',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [patientId, toast])

  // ─── Fetch Visits ─────────────────────────────────────────────────────────

  const fetchVisits = useCallback(async () => {
    if (!patientId) return
    setVisitsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<VisitRecord>>('/patient-visits', { patientId, limit: 50 })
      setVisits(res.data)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load visit history',
        variant: 'destructive',
      })
    } finally {
      setVisitsLoading(false)
    }
  }, [patientId, toast])

  // ─── Fetch Prescriptions ─────────────────────────────────────────────────

  const fetchPrescriptions = useCallback(async () => {
    if (!patientId) return
    setPrescriptionsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<ApiPrescription>>('/prescriptions', { patientId, limit: 50 })
      setPrescriptions(res.data)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load prescriptions',
        variant: 'destructive',
      })
    } finally {
      setPrescriptionsLoading(false)
    }
  }, [patientId, toast])

  // ─── Fetch Invoices ───────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    if (!patientId) return
    setInvoicesLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<ApiInvoice>>('/billing', { patientId, limit: 50 })
      setInvoices(res.data)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load billing records',
        variant: 'destructive',
      })
    } finally {
      setInvoicesLoading(false)
    }
  }, [patientId, toast])

  // ─── Fetch Lab Test Orders ───────────────────────────────────────────────

  const fetchLabOrders = useCallback(async () => {
    if (!patientId) return
    setLabOrdersLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<LabTestOrder>>('/lab-tests/orders', { patientId, limit: 50 })
      setLabOrders(res.data)
    } catch {
      // silently fail - lab data is supplementary
    } finally {
      setLabOrdersLoading(false)
    }
  }, [patientId])

  // ─── Fetch Insurance Claims ──────────────────────────────────────────────

  const fetchClaims = useCallback(async () => {
    if (!patientId) return
    setClaimsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<InsuranceClaim>>('/insurance/claims', { patientId, limit: 50 })
      setClaims(res.data)
    } catch {
      // silently fail - claims data is supplementary
    } finally {
      setClaimsLoading(false)
    }
  }, [patientId])

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  useEffect(() => {
    fetchPatient()
  }, [fetchPatient])

  useEffect(() => {
    if (patientId) {
      fetchVisits()
      fetchPrescriptions()
      fetchInvoices()
      fetchLabOrders()
      fetchClaims()
    }
  }, [patientId, fetchVisits, fetchPrescriptions, fetchInvoices, fetchLabOrders, fetchClaims])

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Completed':
      case 'Paid':
      case 'Approved':
      case 'Settled':
      case 'Reported':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
            {status}
          </Badge>
        )
      case 'Scheduled':
      case 'Unpaid':
      case 'Submitted':
      case 'Ordered':
      case 'Processing':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">
            {status}
          </Badge>
        )
      case 'Cancelled':
      case 'Rejected':
      case 'Failed':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">
            {status}
          </Badge>
        )
      case 'Partially Paid':
      case 'Pre-Approved':
      case 'Sample Collected':
        return (
          <Badge className="bg-sky-100 text-sky-700 border-sky-200" variant="outline">
            {status}
          </Badge>
        )
      case 'Overdue':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200" variant="outline">
            {status}
          </Badge>
        )
      case 'No-Show':
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-200" variant="outline">
            {status}
          </Badge>
        )
      case 'Active':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
            {status}
          </Badge>
        )
      case 'Processed':
        return (
          <Badge className="bg-violet-100 text-violet-700 border-violet-200" variant="outline">
            {status}
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getAppointmentIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle2 className="size-4 text-emerald-600" />
      case 'Scheduled':
        return <Clock className="size-4 text-amber-600" />
      case 'Cancelled':
        return <XCircle className="size-4 text-red-500" />
      case 'No-Show':
        return <Timer className="size-4 text-gray-500" />
      default:
        return null
    }
  }

  // ─── Quick Discharge ──────────────────────────────────────────────────────

  const handleQuickDischarge = async () => {
    if (!dischargeVisit) return
    setIsDischarging(true)
    try {
      await apiPost(`/patient-visits/${dischargeVisit.id}/complete`, {
        dischargeNotes: dischargeNotes.trim() || undefined,
      })
      toast({
        title: 'Patient Discharged',
        description: `Visit ${dischargeVisit.visitId} has been completed and discharged.`,
      })
      setDischargeVisit(null)
      setDischargeNotes('')
      fetchVisits() // refresh visits list
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'Discharge Failed',
          description: err.message || 'Something went wrong.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsDischarging(false)
    }
  }

  // Parse prescription notes (JSON string)
  const parsePrescriptionNotes = (notes: string | null | undefined): Array<{ name: string; dosage: string; frequency: string; duration: string }> | null => {
    if (!notes) return null
    try {
      const parsed = JSON.parse(notes)
      if (Array.isArray(parsed)) return parsed
      return null
    } catch {
      return null
    }
  }

  // Visit type breakdown
  const visitTypeCounts = {
    OPD: visits.filter(v => v.visitType === 'OPD').length,
    IPD: visits.filter(v => v.visitType === 'IPD').length,
    Emergency: visits.filter(v => v.visitType === 'Emergency').length,
    'Follow-up': visits.filter(v => v.visitType === 'Follow-up').length,
  }

  const lastVisitDate = visits.length > 0
    ? new Date(Math.max(...visits.map(v => new Date(v.createdAt).getTime()))).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  // ─── Loading Skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-36" />
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  // ─── 404 ───────────────────────────────────────────────────────────────────

  if (notFound || !patient) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <AlertCircle className="size-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground">Patient not found</p>
        <Button
          variant="outline"
          onClick={() => setCurrentPage('patients')}
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Patients
        </Button>
      </div>
    )
  }

  const initials = patient.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const age = patient.dateOfBirth
    ? Math.floor(
        (Date.now() - new Date(patient.dateOfBirth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : null

  const appointments = patient.appointments || []

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        className="text-muted-foreground hover:text-foreground -ml-2"
        onClick={() => setCurrentPage('patients')}
      >
        <ArrowLeft className="size-4 mr-2" />
        Back to Patients
      </Button>

      {/* Patient Header Card */}
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="size-16 bg-emerald-100 text-emerald-700 text-lg font-bold shrink-0">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{patient.name}</h1>
                  <Badge
                    className={
                      patient.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }
                    variant="outline"
                  >
                    {patient.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{patient.patientId}</p>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {patient.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-3.5" />
                      {patient.phone}
                    </span>
                  )}
                  {patient.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5" />
                      {patient.email}
                    </span>
                  )}
                  {patient.city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {patient.city}, {patient.state}
                    </span>
                  )}
                  {!!age && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      {age} yrs
                    </span>
                  )}
                  {patient.bloodGroup && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {patient.bloodGroup}
                    </Badge>
                  )}
                  {patient.insuranceProvider && (
                    <span className="flex items-center gap-1.5">
                      <Shield className="size-3.5" />
                      Insured
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setStartVisitOpen(true)}
              >
                <Activity className="size-4" />
                Start Visit
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setCurrentPage('appointments', { prefillPatientId: patient.id })}
              >
                <Plus className="size-4" />
                New Appointment
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage('billing', { prefillPatientId: patient.id })}>
                <CreditCard className="size-4" />
                Create Invoice
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medical">Medical Records</TabsTrigger>
          <TabsTrigger value="ehr">EHR</TabsTrigger>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        {/* ═══════════════════ Overview Tab ═══════════════════ */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Personal Information */}
            <Card className="rounded-xl border shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="size-4 text-emerald-600" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow label="Full Name" value={patient.name} />
                <InfoRow
                  label="Date of Birth"
                  value={patient.dateOfBirth ? `${formatDate(patient.dateOfBirth)}${age ? ` (${age} yrs)` : ''}` : '—'}
                  icon={<Calendar className="size-3.5" />}
                />
                <InfoRow label="Gender" value={patient.gender || '—'} />
                <InfoRow
                  label="Blood Group"
                  value={patient.bloodGroup || '—'}
                  icon={<Droplets className="size-3.5 text-red-500" />}
                />
                {patient.maritalStatus && (
                  <InfoRow label="Marital Status" value={patient.maritalStatus} />
                )}
                {patient.occupation && (
                  <InfoRow label="Occupation" value={patient.occupation} icon={<Briefcase className="size-3.5" />} />
                )}
                <Separator />
                <InfoRow
                  label="Phone"
                  value={patient.phone}
                  icon={<Phone className="size-3.5" />}
                />
                <InfoRow
                  label="Email"
                  value={patient.email || '—'}
                  icon={<Mail className="size-3.5" />}
                />
                {patient.address && (
                  <InfoRow
                    label="Address"
                    value={`${patient.address}${patient.city ? `, ${patient.city}` : ''}${patient.state ? `, ${patient.state}` : ''}${patient.pincode ? ` - ${patient.pincode}` : ''}`}
                    icon={<MapPin className="size-3.5" />}
                  />
                )}
              </CardContent>
            </Card>

            {/* Emergency, Insurance & Quick Summary */}
            <div className="flex flex-col gap-4">
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Heart className="size-4 text-red-500" />
                    Emergency Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Contact Name" value={patient.emergencyContact || '—'} />
                  <InfoRow
                    label="Contact Phone"
                    value={patient.emergencyPhone || '—'}
                    icon={<Phone className="size-3.5" />}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="size-4 text-emerald-600" />
                    Insurance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow
                    label="Provider"
                    value={patient.insuranceProvider || 'No insurance'}
                  />
                  <InfoRow
                    label="Policy Number"
                    value={patient.insuranceNumber || '—'}
                  />
                  <InfoRow
                    label="Aadhaar Number"
                    value={patient.aadhaarNumber || '—'}
                  />
                </CardContent>
              </Card>

              {/* Quick Summary */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="size-4 text-emerald-600" />
                    Quick Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50 p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{visits.length}</p>
                      <p className="text-xs text-emerald-600">Total Visits</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <p className="text-2xl font-bold text-amber-700">{prescriptions.length}</p>
                      <p className="text-xs text-amber-600">Prescriptions</p>
                    </div>
                    <div className="rounded-lg bg-sky-50 p-3 text-center">
                      <p className="text-2xl font-bold text-sky-700">{invoices.length}</p>
                      <p className="text-xs text-sky-600">Invoices</p>
                    </div>
                    <div className="rounded-lg bg-violet-50 p-3 text-center">
                      <p className="text-2xl font-bold text-violet-700">{labOrders.length}</p>
                      <p className="text-xs text-violet-600">Lab Tests</p>
                    </div>
                  </div>
                  {patient.allergies && patient.allergies.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground mb-1.5">Known Allergies</p>
                      <div className="flex flex-wrap gap-1.5">
                        {patient.allergies.map((allergy, i) => (
                          <Badge
                            key={i}
                            className="bg-red-50 text-red-700 border-red-200 text-xs px-2 py-0"
                            variant="outline"
                          >
                            <AlertTriangle className="size-2.5 mr-1" />
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Registration Info */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="size-4 text-muted-foreground" />
                    Registration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Patient ID" value={patient.patientId} />
                  <InfoRow label="Registered On" value={formatDate(patient.createdAt)} />
                  <InfoRow label="Last Updated" value={formatDate(patient.updatedAt)} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════ Medical Records Tab ═══════════════════ */}
        <TabsContent value="medical">
          <div className="space-y-4">
            {/* Personal Info Card */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="size-4 text-emerald-600" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Full Name" value={patient.name} />
                  <InfoRow
                    label="Date of Birth"
                    value={patient.dateOfBirth ? `${formatDate(patient.dateOfBirth)}${age ? ` (${age} yrs)` : ''}` : '—'}
                    icon={<Calendar className="size-3.5" />}
                  />
                  <InfoRow label="Gender" value={patient.gender || '—'} />
                  <InfoRow
                    label="Blood Group"
                    value={patient.bloodGroup || '—'}
                    icon={<Droplets className="size-3.5 text-red-500" />}
                  />
                  {patient.maritalStatus && (
                    <InfoRow label="Marital Status" value={patient.maritalStatus} />
                  )}
                  {patient.occupation && (
                    <InfoRow label="Occupation" value={patient.occupation} icon={<Briefcase className="size-3.5" />} />
                  )}
                  <InfoRow label="Aadhaar" value={patient.aadhaarNumber || '—'} />
                </CardContent>
              </Card>

              {/* Contact Info Card */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Phone className="size-4 text-emerald-600" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow
                    label="Phone"
                    value={patient.phone}
                    icon={<Phone className="size-3.5" />}
                  />
                  <InfoRow
                    label="Email"
                    value={patient.email || '—'}
                    icon={<Mail className="size-3.5" />}
                  />
                  <InfoRow
                    label="Address"
                    value={[
                      patient.address,
                      patient.city,
                      patient.state,
                      patient.pincode,
                    ].filter(Boolean).join(', ') || '—'}
                    icon={<MapPin className="size-3.5" />}
                  />
                </CardContent>
              </Card>

              {/* Emergency Contact Card */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Heart className="size-4 text-red-500" />
                    Emergency Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Contact Name" value={patient.emergencyContact || '—'} />
                  <InfoRow
                    label="Contact Phone"
                    value={patient.emergencyPhone || '—'}
                    icon={<Phone className="size-3.5" />}
                  />
                </CardContent>
              </Card>

              {/* Insurance Card */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="size-4 text-emerald-600" />
                    Insurance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow
                    label="Provider"
                    value={patient.insuranceProvider || 'No insurance'}
                  />
                  <InfoRow
                    label="Policy Number"
                    value={patient.insuranceNumber || '—'}
                  />
                  {claims.length > 0 && (
                    <>
                      <Separator />
                      <InfoRow label="Total Claims" value={String(claims.length)} />
                      <InfoRow
                        label="Settled"
                        value={String(claims.filter(c => c.status === 'Settled').length)}
                      />
                      <InfoRow
                        label="Pending"
                        value={String(claims.filter(c => ['Submitted', 'Pre-Approved', 'Processing'].includes(c.status)).length)}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Allergies Card */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="size-4 text-amber-500" />
                    Allergies
                  </CardTitle>
                  <CardDescription>Known allergies and adverse reactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {patient.allergies && patient.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {patient.allergies.map((allergy, i) => (
                        <Badge
                          key={i}
                          className="bg-red-50 text-red-700 border-red-200 px-3 py-1"
                          variant="outline"
                        >
                          <AlertTriangle className="size-3 mr-1" />
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">No known allergies recorded.</p>
                  )}
                </CardContent>
              </Card>

              {/* Past Treatments Card */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Stethoscope className="size-4 text-emerald-600" />
                    Past Treatments
                  </CardTitle>
                  <CardDescription>Previous medical procedures and treatments</CardDescription>
                </CardHeader>
                <CardContent>
                  {patient.pastTreatments && patient.pastTreatments.length > 0 ? (
                    <div className="space-y-2">
                      {patient.pastTreatments.map((treatment, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3"
                        >
                          <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <FileText className="size-3.5" />
                          </div>
                          <p className="text-sm text-foreground">{treatment}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">No past treatments recorded.</p>
                  )}
                </CardContent>
              </Card>

              {/* Visit Summary Card */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="size-4 text-emerald-600" />
                    Visit Summary
                  </CardTitle>
                  <CardDescription>Patient visit statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{visits.length}</p>
                      <p className="text-xs text-muted-foreground">Total Visits</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{visits.filter(v => v.status === 'Active').length}</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3 text-center col-span-2 sm:col-span-1">
                      <p className="text-sm font-semibold text-foreground">{lastVisitDate || '—'}</p>
                      <p className="text-xs text-muted-foreground">Last Visit</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Visit Type Breakdown</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2">
                        <span className="text-sm font-bold text-emerald-700">{visitTypeCounts.OPD}</span>
                        <span className="text-xs text-emerald-600">OPD</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2">
                        <span className="text-sm font-bold text-amber-700">{visitTypeCounts.IPD}</span>
                        <span className="text-xs text-amber-600">IPD</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2">
                        <span className="text-sm font-bold text-red-700">{visitTypeCounts.Emergency}</span>
                        <span className="text-xs text-red-600">Emergency</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-md bg-sky-50 px-3 py-2">
                        <span className="text-sm font-bold text-sky-700">{visitTypeCounts['Follow-up']}</span>
                        <span className="text-xs text-sky-600">Follow-up</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lab Tests Card */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FlaskConical className="size-4 text-violet-600" />
                        Lab Tests
                      </CardTitle>
                      <CardDescription>
                        {labOrdersLoading ? 'Loading...' : `${labOrders.length} lab test orders`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {labOrdersLoading && (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                      ))}
                    </div>
                  )}
                  {!labOrdersLoading && labOrders.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No lab test orders on record.</p>
                  )}
                  {!labOrdersLoading && labOrders.length > 0 && (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2 pr-1">
                        {labOrders.map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-violet-600 shrink-0">
                                <FlaskConical className="size-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{order.test?.name || `Test ${order.testId}`}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(order.orderedAt), 'MMM d, yyyy')}
                                  {order.visit?.visitId && ` · ${order.visit.visitId}`}
                                </p>
                              </div>
                            </div>
                            {getStatusBadge(order.status)}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Insurance Claims Card */}
              <Card className="rounded-xl border shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BadgeCheck className="size-4 text-emerald-600" />
                        Insurance Claims
                      </CardTitle>
                      <CardDescription>
                        {claimsLoading ? 'Loading...' : `${claims.length} claims`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {claimsLoading && (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full rounded-lg" />
                      ))}
                    </div>
                  )}
                  {!claimsLoading && claims.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No insurance claims on record.</p>
                  )}
                  {!claimsLoading && claims.length > 0 && (
                    <ScrollArea className="max-h-64">
                      <div className="space-y-2 pr-1">
                        {claims.map((claim) => (
                          <div
                            key={claim.id}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                                <BadgeCheck className="size-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">{claim.claimId}</p>
                                <p className="text-xs text-muted-foreground">
                                  {claim.insuranceCompany?.name || 'Unknown'} · {claim.claimType}
                                  {claim.invoice?.invoiceNumber && ` · ${claim.invoice.invoiceNumber}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {claim.settledAmount > 0 && (
                                <span className="text-xs font-medium text-emerald-600">
                                  {formatCurrency(claim.settledAmount)}
                                </span>
                              )}
                              {getStatusBadge(claim.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════ EHR / EMR Tab ═══════════════════ */}
        <TabsContent value="ehr">
          <div className="py-2">
            {patientId && <EhrTab patientId={patientId} />}
          </div>
        </TabsContent>

        {/* ═══════════════════ Visits Tab ═══════════════════ */}
        <TabsContent value="visits">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="size-4 text-emerald-600" />
                    Visit History
                  </CardTitle>
                  <CardDescription>
                    {visits.length} total visits · {visits.filter(v => v.status === 'Active').length} active
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setStartVisitOpen(true)}
                >
                  <Plus className="size-4" />
                  Start New Visit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {visitsLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-5 w-20 rounded-full" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </div>
                          <Skeleton className="h-3 w-48" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              )}

              {!visitsLoading && visits.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
                  <Activity className="size-10 opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-medium">No visits on record</p>
                    <p className="text-xs mt-1">Start a new visit to begin tracking this patient&apos;s journey</p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => setStartVisitOpen(true)}
                  >
                    <Plus className="size-4 mr-1.5" />
                    Start First Visit
                  </Button>
                </div>
              )}

              {!visitsLoading && visits.length > 0 && (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-3 pr-1">
                    {visits.map((visit) => {
                      const stagesForStepper: StageInfo[] = visit.stages.map((s) => ({
                        stage: s.stage,
                        status: s.status as 'Pending' | 'Active' | 'Completed' | 'Skipped',
                        completedAt: s.completedAt ?? undefined,
                      }))

                      const isActive = visit.status === 'Active'
                      const isDischargeable = isActive && ['Paid', 'Billed', 'Prescribed'].includes(visit.stage)

                      return (
                        <div key={visit.id} className="rounded-lg border p-4 space-y-3">
                          {/* Visit Header */}
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                'flex size-9 items-center justify-center rounded-full shrink-0 mt-0.5',
                                isActive ? 'bg-emerald-100' : 'bg-gray-100'
                              )}>
                                {isActive
                                  ? <Activity className="size-4 text-emerald-600" />
                                  : <CheckCircle2 className="size-4 text-gray-500" />
                                }
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-mono text-xs text-muted-foreground">{visit.visitId}</p>
                                  <StageBadge stage={visit.stage} />
                                  {getStatusBadge(visit.status)}
                                  {visit.visitType && (
                                    <Badge variant="outline" className="text-xs bg-muted">
                                      {visit.visitType}
                                    </Badge>
                                  )}
                                </div>
                                {visit.chiefComplaint && (
                                  <p className="text-sm text-muted-foreground mt-0.5">{visit.chiefComplaint}</p>
                                )}
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Clock className="size-3" />
                                  {format(new Date(visit.createdAt), 'MMM d, yyyy h:mm a')}
                                  {visit.doctorName && (
                                    <> · <Stethoscope className="size-3" /> {visit.doctorName}</>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setCurrentPage('workflow', { visitDetailId: visit.id })}
                              >
                                <Eye className="size-3 mr-1" />
                                View Details
                              </Button>
                              {isDischargeable && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white"
                                  onClick={() => setDischargeVisit(visit)}
                                >
                                  <LogOut className="size-3 mr-1" />
                                  Quick Discharge
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Compact Workflow Stepper (dots view) */}
                          <WorkflowStepper
                            currentStage={visit.stage}
                            stages={stagesForStepper}
                            compact={true}
                          />
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Prescriptions Tab ═══════════════════ */}
        <TabsContent value="prescriptions">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Prescriptions</CardTitle>
                  <CardDescription>
                    {prescriptionsLoading ? 'Loading...' : `${prescriptions.length} prescriptions on record`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {prescriptionsLoading && (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-full" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <div className="ml-12 space-y-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-10 w-full rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!prescriptionsLoading && prescriptions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
                  <Pill className="size-10 opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-medium">No prescriptions on record</p>
                    <p className="text-xs mt-1">Prescriptions will appear here after doctor consultations</p>
                  </div>
                </div>
              )}

              {!prescriptionsLoading && prescriptions.length > 0 && (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-4 pr-1">
                    {prescriptions.map((rx) => {
                      const medicines = parsePrescriptionNotes(rx.notes)
                      return (
                        <div key={rx.id} className="rounded-lg border p-4 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                                <Pill className="size-4" />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-foreground text-sm">{rx.prescriptionId}</p>
                                  <Badge variant="outline" className="text-xs">
                                    {formatDate(rx.date)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {rx.doctor?.name || `Doctor ${rx.doctorId}`}
                                  {rx.doctor?.specialization && ` · ${rx.doctor.specialization}`}
                                </p>
                              </div>
                            </div>
                            {rx.diagnosis && (
                              <Badge className="bg-sky-100 text-sky-700 border-sky-200" variant="outline">
                                {rx.diagnosis}
                              </Badge>
                            )}
                          </div>
                          {medicines && medicines.length > 0 && (
                            <div className="ml-12">
                              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                                Medicines
                              </p>
                              <div className="space-y-2">
                                {medicines.map((med, i) => (
                                  <div
                                    key={i}
                                    className="flex flex-col gap-1 rounded-md bg-muted/50 p-2.5 text-sm"
                                  >
                                    <p className="font-medium text-foreground">{med.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {med.dosage} · {med.frequency} · {med.duration}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Billing Tab ═══════════════════ */}
        <TabsContent value="billing">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Invoice History</CardTitle>
                  <CardDescription>
                    {invoicesLoading ? 'Loading...' : `${invoices.length} total invoices`}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setCurrentPage('billing', { prefillPatientId: patient.id })}
                >
                  <Plus className="size-4" />
                  Create Invoice
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invoicesLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 rounded-lg border">
                      <Skeleton className="size-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ))}
                </div>
              )}

              {!invoicesLoading && invoices.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3">
                  <Banknote className="size-10 opacity-20" />
                  <div className="text-center">
                    <p className="text-sm font-medium">No invoices on record</p>
                    <p className="text-xs mt-1">Invoices will appear here after billing is created</p>
                  </div>
                </div>
              )}

              {!invoicesLoading && invoices.length > 0 && (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-3 pr-1">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 items-center justify-center rounded-full bg-muted shrink-0 mt-0.5">
                            <Banknote className="size-4 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground text-sm">{invoice.invoiceNumber}</p>
                              {getStatusBadge(invoice.status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Issued: {formatDate(invoice.date)}
                              {invoice.dueDate && ` · Due: ${formatDate(invoice.dueDate)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 sm:text-right">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {formatCurrency(invoice.grandTotal)}
                            </p>
                            {invoice.paidAmount > 0 && (
                              <p className="text-xs text-emerald-600">Paid: {formatCurrency(invoice.paidAmount)}</p>
                            )}
                            {invoice.paidAmount < invoice.grandTotal && (
                              <p className="text-xs text-red-600">
                                Balance: {formatCurrency(invoice.grandTotal - invoice.paidAmount)}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setCurrentPage('invoice-detail', { id: invoice.id })}
                          >
                            <Eye className="size-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* Billing Summary */}
                    <Separator />
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Billed</p>
                        <p className="text-lg font-bold text-foreground">
                          {formatCurrency(invoices.reduce((a, b) => a + b.grandTotal, 0))}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Total Paid</p>
                        <p className="text-lg font-bold text-emerald-600">
                          {formatCurrency(invoices.reduce((a, b) => a + b.paidAmount, 0))}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(
                            invoices.reduce((a, b) => a + b.grandTotal, 0) -
                              invoices.reduce((a, b) => a + b.paidAmount, 0)
                          )}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Overdue</p>
                        <p className="text-lg font-bold text-amber-600">
                          {formatCurrency(
                            invoices
                              .filter((i) => i.status === 'Overdue')
                              .reduce((a, b) => a + b.grandTotal - b.paidAmount, 0)
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ Appointments Tab ═══════════════════ */}
        <TabsContent value="appointments">
          <Card className="rounded-xl border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Appointment History</CardTitle>
                  <CardDescription>{appointments.length} total appointments</CardDescription>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setCurrentPage('appointments', { prefillPatientId: patient.id })}
                >
                  <Plus className="size-4" />
                  Book Appointment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No appointments on record.</p>
              ) : (
                <div className="space-y-3">
                  {appointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-muted shrink-0 mt-0.5">
                          {getAppointmentIcon(apt.status)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground text-sm">{apt.doctorName || `Doctor ${apt.doctorId}`}</p>
                            {getStatusBadge(apt.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {apt.specialization || ''} {apt.type ? `· ${apt.type}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(apt.date)} at {apt.time} · {apt.aptId}
                          </p>
                          {apt.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic">{apt.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════ Start Visit Dialog ═══════════════════ */}
      <StartVisitDialog
        open={startVisitOpen}
        onOpenChange={setStartVisitOpen}
        prefillPatientId={patient.id}
        onSuccess={() => fetchVisits()}
      />

      {/* ═══════════════════ Quick Discharge Dialog ═══════════════════ */}
      <Dialog open={!!dischargeVisit} onOpenChange={(open) => {
        if (!open) {
          setDischargeVisit(null)
          setDischargeNotes('')
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Quick Discharge
            </DialogTitle>
            <DialogDescription>
              Discharge visit {dischargeVisit?.visitId} for {patient.name}. This will skip all remaining workflow stages.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="discharge-notes">Discharge Notes</Label>
              <Textarea
                id="discharge-notes"
                placeholder="Add discharge instructions or summary..."
                value={dischargeNotes}
                onChange={(e) => setDischargeNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              <strong>Note:</strong> This will skip all remaining workflow stages (Lab, Prescription, Billing, Payment) and mark the visit as completed.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDischargeVisit(null); setDischargeNotes('') }} disabled={isDischarging}>
              Cancel
            </Button>
            <Button
              onClick={handleQuickDischarge}
              disabled={isDischarging}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isDischarging ? (
                <><Loader2 className="size-4 mr-2 animate-spin" />Discharging...</>
              ) : (
                <><CheckCircle2 className="size-4 mr-2" />Discharge Patient</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── InfoRow Sub-component ──────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right flex items-center gap-1.5">
        {icon}
        {value}
      </span>
    </div>
  )
}
