'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, type SingleResponse, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
import {
  UserCheck,
  CalendarDays,
  IndianRupee,
  FlaskConical,
  FileText,
  CreditCard,
  Eye,
  LogIn,
  UserPlus,
  Loader2,
  X,
  Phone,
  Mail,
  Lock,
  ChevronLeft,
  Stethoscope,
  AlertCircle,
  RefreshCw,
  Smartphone,
  Banknote,
  ChevronRight,
  ChevronDown,
  Clock,
  Syringe,
  Activity,
  Pill,
  Search,
  Hospital,
  Shield,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const PORTAL_TOKEN_KEY = 'medibill-portal-token'
const PORTAL_PATIENT_KEY = 'medibill-portal-patient'

interface PortalPatient {
  id: string
  patientId: string
  name: string
  email: string
  phone: string
}

interface PortalAppointment {
  id: string
  aptId: string
  date: string
  time: string
  status: string
  type: string
  doctor: { name: string; specialization: string } | null
}

interface PortalInvoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  status: string
  createdAt: string
}

interface PortalLabResult {
  id: string
  testName: string
  testDate: string
  result: string
  normalRange: string
  status: string
  notes: string | null
}

interface PortalPrescription {
  id: string
  prescriptionId: string
  date: string
  diagnosis: string | null
  doctor: { name: string; specialization: string } | null
  medicines: string | null
}

interface PortalBilling {
  invoices: PortalInvoice[]
  totalDue: number
  totalBalance: number
}

const SHIFT_TYPES = ['Morning', 'Evening', 'Night'] as const

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    Scheduled: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    Cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    Pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    Overdue: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    Normal: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    Abnormal: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  }
  return styles[status] ?? 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400'
}

export function PatientPortalPage() {
  const { toast } = useToast()

  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [patient, setPatient] = useState<PortalPatient | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)

  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [regPatientId, setRegPatientId] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regLoading, setRegLoading] = useState(false)

  const [appointments, setAppointments] = useState<PortalAppointment[]>([])
  const [apptLoading, setApptLoading] = useState(true)
  const [billing, setBilling] = useState<PortalBilling | null>(null)
  const [billLoading, setBillLoading] = useState(true)
  const [labResults, setLabResults] = useState<PortalLabResult[]>([])
  const [labLoading, setLabLoading] = useState(true)
  const [prescriptions, setPrescriptions] = useState<PortalPrescription[]>([])
  const [rxLoading, setRxLoading] = useState(true)

  const [selectedInvoice, setSelectedInvoice] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('UPI')
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem(PORTAL_TOKEN_KEY)
    const patientData = localStorage.getItem(PORTAL_PATIENT_KEY)
    if (token && patientData) {
      try {
        setPatient(JSON.parse(patientData))
        setIsLoggedIn(true)
      } catch {
        localStorage.removeItem(PORTAL_TOKEN_KEY)
        localStorage.removeItem(PORTAL_PATIENT_KEY)
      }
    }
    setLoading(false)
  }, [])

  const fetchDashboardData = useCallback(async () => {
    setApptLoading(true)
    setBillLoading(true)
    setLabLoading(true)
    setRxLoading(true)
    try {
      const [apptRes, billRes, labRes, rxRes] = await Promise.all([
        apiGet<PaginatedResponse<PortalAppointment>>('/portal/appointments').catch(() => null),
        apiGet<SingleResponse<PortalBilling>>('/portal/billing').catch(() => null),
        apiGet<PaginatedResponse<PortalLabResult>>('/portal/lab-results').catch(() => null),
        apiGet<PaginatedResponse<PortalPrescription>>('/portal/prescriptions').catch(() => null),
      ])
      if (apptRes) setAppointments(apptRes.data)
      if (billRes) setBilling(billRes.data)
      if (labRes) setLabResults(labRes.data)
      if (rxRes) setPrescriptions(rxRes.data)
    } catch {
      toast({ title: 'Error', description: 'Failed to load portal data', variant: 'destructive' })
    } finally {
      setApptLoading(false)
      setBillLoading(false)
      setLabLoading(false)
      setRxLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (isLoggedIn) fetchDashboardData()
  }, [isLoggedIn, fetchDashboardData])

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      toast({ title: 'Validation', description: 'Please enter email/phone and password', variant: 'destructive' })
      return
    }
    setLoginLoading(true)
    try {
      const res = await apiPost<SingleResponse<{ token: string; patient: PortalPatient }>>('/portal/auth', {
        identifier: loginEmail,
        password: loginPassword,
      })
      localStorage.setItem(PORTAL_TOKEN_KEY, res.data.token)
      localStorage.setItem(PORTAL_PATIENT_KEY, JSON.stringify(res.data.patient))
      setPatient(res.data.patient)
      setIsLoggedIn(true)
      toast({ title: 'Welcome', description: `Logged in as ${res.data.patient.name}` })
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Login Failed', description: err.message, variant: 'destructive' })
      } else {
        toast({ title: 'Login Failed', description: 'Invalid credentials. Please try again.', variant: 'destructive' })
      }
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!regPatientId || !regEmail || !regPhone || !regPassword) {
      toast({ title: 'Validation', description: 'Please fill all registration fields', variant: 'destructive' })
      return
    }
    setRegLoading(true)
    try {
      await apiPost('/portal/register', {
        patientId: regPatientId,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
      })
      toast({ title: 'Registration Successful', description: 'You can now log in with your credentials.' })
      setShowRegister(false)
      setRegPatientId('')
      setRegEmail('')
      setRegPhone('')
      setRegPassword('')
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Registration Failed', description: err.message, variant: 'destructive' })
      } else {
        toast({ title: 'Registration Failed', description: 'Could not register. Please try again.', variant: 'destructive' })
      }
    } finally {
      setRegLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(PORTAL_TOKEN_KEY)
    localStorage.removeItem(PORTAL_PATIENT_KEY)
    setPatient(null)
    setIsLoggedIn(false)
    setAppointments([])
    setBilling(null)
    setLabResults([])
    setPrescriptions([])
    toast({ title: 'Logged Out', description: 'You have been logged out successfully.' })
  }

  const handlePay = async () => {
    if (!selectedInvoice || !payAmount || !payMethod) {
      toast({ title: 'Validation', description: 'Please select invoice, enter amount, and choose payment method', variant: 'destructive' })
      return
    }
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Validation', description: 'Please enter a valid amount', variant: 'destructive' })
      return
    }
    setPayLoading(true)
    try {
      await apiPost('/portal/pay', {
        invoiceId: selectedInvoice,
        amount,
        method: payMethod,
      })
      toast({ title: 'Payment Successful', description: `Payment of ${formatCurrency(amount)} completed.` })
      setPayDialogOpen(false)
      setSelectedInvoice('')
      setPayAmount('')
      setPayMethod('UPI')
      fetchDashboardData()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Payment Failed', description: err.message, variant: 'destructive' })
      } else {
        toast({ title: 'Payment Failed', description: 'Could not process payment.', variant: 'destructive' })
      }
    } finally {
      setPayLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] px-4">
        <Card className="w-full max-w-md rounded-xl border shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950">
                <Hospital className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <CardTitle className="text-xl font-bold">MediBill Patient Portal</CardTitle>
            <CardDescription>
              {showRegister ? 'Create your portal account' : 'Login to access your health records'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!showRegister ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email or Phone</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      placeholder="you@example.com or phone number"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-9"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-9"
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                  </div>
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleLogin}
                  disabled={loginLoading}
                >
                  {loginLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <LogIn className="h-4 w-4 mr-2" />
                  Login
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowRegister(true)}
                    className="text-sm text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                  >
                    Don't have an account? Register here
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reg-patientId">Patient ID</Label>
                  <div className="relative">
                    <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-patientId"
                      placeholder="Your hospital patient ID"
                      value={regPatientId}
                      onChange={(e) => setRegPatientId(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="your@email.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-phone"
                      placeholder="+91 9876543210"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="Create a strong password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleRegister}
                  disabled={regLoading}
                >
                  {regLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <UserPlus className="h-4 w-4 mr-2" />
                  Register
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowRegister(false)}
                    className="text-sm text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                  >
                    Already have an account? Login here
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedInvoiceData = billing?.invoices.find((inv) => inv.id === selectedInvoice)
  const invoices = billing?.invoices ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950">
              <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Patient Portal</h1>
              <p className="text-sm text-muted-foreground">Welcome, {patient?.name}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {patient?.patientId}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-600 hover:text-red-700">
            <X className="h-4 w-4 mr-1.5" />
            Logout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          const el = document.getElementById('portal-appointments')
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-sky-100 dark:bg-sky-950 shrink-0">
                <CalendarDays className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Appointments</p>
                <p className="text-xl font-bold">{apptLoading ? '...' : appointments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          const el = document.getElementById('portal-billing')
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950 shrink-0">
                <IndianRupee className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Due</p>
                <p className="text-xl font-bold">{billLoading ? '...' : formatCurrency(billing?.totalDue ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          const el = document.getElementById('portal-lab')
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-950 shrink-0">
                <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Lab Reports</p>
                <p className="text-xl font-bold">{labLoading ? '...' : labResults.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          const el = document.getElementById('portal-prescriptions')
          if (el) el.scrollIntoView({ behavior: 'smooth' })
        }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 shrink-0">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Prescriptions</p>
                <p className="text-xl font-bold">{rxLoading ? '...' : prescriptions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div id="portal-appointments">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-sky-600" />
                <div>
                  <CardTitle className="text-base font-semibold">Upcoming Appointments</CardTitle>
                  <CardDescription>Your scheduled visits</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {apptLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CalendarDays className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No appointments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium">{formatDate(apt.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {apt.time}
                          </div>
                        </TableCell>
                        <TableCell>{apt.doctor?.name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{apt.doctor?.specialization ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{apt.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadge(apt.status)}>{apt.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div id="portal-billing">
        <Card className="rounded-xl border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-amber-600" />
                <div>
                  <CardTitle className="text-base font-semibold">Billing Summary</CardTitle>
                  <CardDescription>Your invoices and payment details</CardDescription>
                </div>
              </div>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                size="sm"
                onClick={() => setPayDialogOpen(true)}
              >
                <CreditCard className="h-4 w-4 mr-1.5" />
                Pay Online
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {billLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : billing && invoices.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total Due</p>
                    <p className="text-xl font-bold text-amber-600">{formatCurrency(billing.totalDue)}</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Balance Amount</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(billing.totalBalance)}</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Invoices</p>
                    <p className="text-xl font-bold">{invoices.length}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                          <TableCell>{formatDate(inv.createdAt)}</TableCell>
                          <TableCell>{formatCurrency(inv.totalAmount)}</TableCell>
                          <TableCell>{formatCurrency(inv.paidAmount)}</TableCell>
                          <TableCell className={inv.balanceAmount > 0 ? 'text-red-600 font-medium' : ''}>
                            {formatCurrency(inv.balanceAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusBadge(inv.status)}>{inv.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <IndianRupee className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No billing records found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div id="portal-lab">
          <Card className="rounded-xl border shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-600" />
                <div>
                  <CardTitle className="text-base font-semibold">Lab Results</CardTitle>
                  <CardDescription>Recent test reports</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {labLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : labResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FlaskConical className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No lab results</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Result</TableHead>
                        <TableHead>Range</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {labResults.map((lab) => (
                        <TableRow key={lab.id}>
                          <TableCell className="font-medium">{lab.testName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(lab.testDate)}</TableCell>
                          <TableCell className="font-mono text-sm">{lab.result}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lab.normalRange}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusBadge(lab.status)}>{lab.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div id="portal-prescriptions">
          <Card className="rounded-xl border shadow-sm h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                <div>
                  <CardTitle className="text-base font-semibold">Prescriptions</CardTitle>
                  <CardDescription>Recent prescriptions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rxLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No prescriptions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Diagnosis</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prescriptions.map((rx) => (
                        <TableRow key={rx.id}>
                          <TableCell>{formatDate(rx.date)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                              {rx.doctor?.name ?? '—'}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{rx.diagnosis ?? '—'}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              Pay Online
            </DialogTitle>
            <DialogDescription>Select an invoice and make a payment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Invoice</Label>
              <Select value={selectedInvoice} onValueChange={(v) => {
                setSelectedInvoice(v)
                const inv = invoices.find((i) => i.id === v)
                if (inv) setPayAmount(String(inv.balanceAmount))
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.filter((inv) => inv.balanceAmount > 0).map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {formatCurrency(inv.balanceAmount)} due
                    </SelectItem>
                  ))}
                  {invoices.filter((inv) => inv.balanceAmount > 0).length === 0 && (
                    <SelectItem value="__none__" disabled>No pending invoices</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedInvoiceData && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice:</span><span className="font-mono">{selectedInvoiceData.invoiceNumber}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span>{formatCurrency(selectedInvoiceData.totalAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid:</span><span>{formatCurrency(selectedInvoiceData.paidAmount)}</span></div>
                <div className="flex justify-between font-semibold"><span>Balance Due:</span><span className="text-red-600">{formatCurrency(selectedInvoiceData.balanceAmount)}</span></div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount (₹)</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI">
                    <div className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> UPI</div>
                  </SelectItem>
                  <SelectItem value="Card">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Card</div>
                  </SelectItem>
                  <SelectItem value="Cash">
                    <div className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Cash</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePay}
              disabled={payLoading || !selectedInvoice || !payAmount}
            >
              {payLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CreditCard className="h-4 w-4 mr-2" />
              Pay {payAmount ? formatCurrency(parseFloat(payAmount)) : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
