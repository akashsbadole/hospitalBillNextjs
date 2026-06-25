'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  DollarSign,
  Clock,
  CalendarDays,
  UserCheck,
  Users,
  Filter,
  Plus,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search as SearchIcon,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Ban,
  Calendar,
  Sunrise,
  Sunset,
  ClipboardList,
  Briefcase,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ==================== TYPES ====================

type PayrollStatus = 'Draft' | 'Calculated' | 'Approved' | 'Paid' | 'Cancelled'

interface PayrollRecord {
  id: string
  payrollId: string
  staffId: string
  staffName: string
  role: string
  month: number
  year: number
  basic: number
  hra: number
  conveyance: number
  medicalAllowance: number
  specialAllowance: number
  bonus: number
  grossEarnings: number
  pf: number
  esi: number
  professionalTax: number
  incomeTax: number
  otherDeductions: number
  totalDeductions: number
  netPay: number
  status: PayrollStatus
  createdAt: string
  updatedAt: string
}

interface AttendanceRecord {
  id: string
  staffId: string
  staffName: string
  date: string
  checkIn: string | null
  checkOut: string | null
  hoursWorked: number | null
  status: string
}

interface ShiftRecord {
  id: string
  name: string
  startTime: string
  endTime: string
  daysOfWeek: string[]
  gracePeriod: number
  active: boolean
}

interface LeaveRecord {
  id: string
  leaveId: string
  staffId: string
  staffName: string
  type: string
  fromDate: string
  toDate: string
  totalDays: number
  reason: string | null
  status: string
  createdAt: string
}

interface StaffOption {
  id: string
  staffId: string
  name: string
  role: string
}

// ==================== HELPERS ====================

const STATUS_STYLES: Record<PayrollStatus, string> = {
  Draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Calculated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Approved: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Paid: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const LEAVE_TYPE_STYLES: Record<string, string> = {
  Annual: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Sick: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Casual: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Maternity: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  Paternity: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  Unpaid: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const ATTENDANCE_STATUS_STYLES: Record<string, string> = {
  Present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Half_Day: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Late: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  Holiday: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Leave: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function StatusBadge({ status, styles }: { status: string; styles: Record<string, string> }) {
  return (
    <Badge variant="outline" className={styles[status] || 'bg-gray-100 text-gray-600'}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

// ==================== TAB 1: PAYROLL ====================

function PayrollTab() {
  const { toast } = useToast()

  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [monthFilter, setMonthFilter] = useState<string>((new Date().getMonth() + 1).toString())
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString())
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [staffSearch, setStaffSearch] = useState('')

  // Stats
  const [stats, setStats] = useState({ totalPayroll: 0, totalStaff: 0, pendingPayments: 0, paidThisMonth: 0 })
  const [loadingStats, setLoadingStats] = useState(true)

  // Dialogs
  const [generateOpen, setGenerateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PayrollRecord | null>(null)
  const [viewTarget, setViewTarget] = useState<PayrollRecord | null>(null)

  // Generate form
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [genMonth, setGenMonth] = useState((new Date().getMonth() + 1).toString())
  const [genYear, setGenYear] = useState(new Date().getFullYear().toString())
  const [basic, setBasic] = useState(0)
  const [hra, setHra] = useState(0)
  const [conveyance, setConveyance] = useState(0)
  const [medicalAllowance, setMedicalAllowance] = useState(0)
  const [specialAllowance, setSpecialAllowance] = useState(0)
  const [bonus, setBonus] = useState(0)
  const [pf, setPf] = useState(0)
  const [esi, setEsi] = useState(0)
  const [professionalTax, setProfessionalTax] = useState(0)
  const [incomeTax, setIncomeTax] = useState(0)
  const [otherDeductions, setOtherDeductions] = useState(0)

  const grossEarnings = basic + hra + conveyance + medicalAllowance + specialAllowance + bonus
  const totalDeductions = pf + esi + professionalTax + incomeTax + otherDeductions
  const netPay = Math.max(0, grossEarnings - totalDeductions)

  const limit = 20
  const abortRef = useRef<AbortController | null>(null)

  const fetchRecords = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setIsLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (monthFilter) params.month = parseInt(monthFilter)
      if (yearFilter) params.year = parseInt(yearFilter)
      if (statusFilter) params.status = statusFilter
      if (staffSearch) params.search = staffSearch

      const res = await apiGet<PaginatedResponse<PayrollRecord>>('/payroll', params)
      setRecords(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        setError(err.message)
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [page, monthFilter, yearFilter, statusFilter, staffSearch, toast])

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const [payrollRes, staffRes] = await Promise.all([
        apiGet<{ totalPayroll: number; pendingPayments: number; paidThisMonth: number }>('/payroll/stats'),
        apiGet<{ total: number }>('/staff', { limit: 1 }),
      ])
      setStats({
        totalPayroll: payrollRes.totalPayroll,
        totalStaff: staffRes.total,
        pendingPayments: payrollRes.pendingPayments,
        paidThisMonth: payrollRes.paidThisMonth,
      })
    } catch {
      // Stats non-critical
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    fetchRecords()
    fetchStats()
  }, [fetchRecords, fetchStats])

  const fetchStaff = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<StaffOption>>('/staff', { limit: 200 })
      setStaffOptions(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: 'Failed to load staff', variant: 'destructive' })
      }
    }
  }, [toast])

  useEffect(() => {
    if (generateOpen) fetchStaff()
  }, [generateOpen, fetchStaff])

  const resetGenerateForm = () => {
    setSelectedStaff('')
    setGenMonth((new Date().getMonth() + 1).toString())
    setGenYear(new Date().getFullYear().toString())
    setBasic(0)
    setHra(0)
    setConveyance(0)
    setMedicalAllowance(0)
    setSpecialAllowance(0)
    setBonus(0)
    setPf(0)
    setEsi(0)
    setProfessionalTax(0)
    setIncomeTax(0)
    setOtherDeductions(0)
  }

  const handleGenerate = async () => {
    if (!selectedStaff) return
    setIsSubmitting(true)
    try {
      await apiPost<SingleResponse<PayrollRecord>>('/payroll', {
        staffId: selectedStaff,
        month: parseInt(genMonth),
        year: parseInt(genYear),
        basic,
        hra,
        conveyance,
        medicalAllowance,
        specialAllowance,
        bonus,
        grossEarnings,
        pf,
        esi,
        professionalTax,
        incomeTax,
        otherDeductions,
        totalDeductions,
        netPay,
      })
      toast({ title: 'Success', description: 'Payroll record generated!' })
      setGenerateOpen(false)
      resetGenerateForm()
      fetchRecords()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (record: PayrollRecord, newStatus: PayrollStatus) => {
    try {
      await apiPut<SingleResponse<PayrollRecord>>(`/payroll/${record.id}/status`, { status: newStatus })
      toast({ title: 'Success', description: `Payroll ${newStatus.toLowerCase()} successfully!` })
      fetchRecords()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiDelete(`/payroll/${deleteTarget.id}`)
      toast({ title: 'Deleted', description: 'Payroll record deleted.' })
      setDeleteTarget(null)
      fetchRecords()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleApplyFilters = () => {
    setPage(1)
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingStats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-32 mt-1" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Payroll (This Month)</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalPayroll)}</div>
                <p className="text-xs text-muted-foreground mt-1">Current month total</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Staff</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalStaff}</div>
                <p className="text-xs text-muted-foreground mt-1">Active employees</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{stats.pendingPayments}</div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting payment</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Paid This Month</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidThisMonth)}</div>
                <p className="text-xs text-muted-foreground mt-1">Total paid this month</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Month</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Year</Label>
              <Input type="number" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Calculated">Calculated</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs font-medium text-muted-foreground">Search Staff</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full pl-9"
                />
              </div>
            </div>
            <Button variant="outline" onClick={handleApplyFilters}>
              <Filter className="mr-2 h-4 w-4" />
              Apply
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setGenerateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Generate Payroll
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Payroll Records</CardTitle>
              <CardDescription>{isLoading ? 'Loading...' : `${total} records found`}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center py-12 space-y-4">
              <AlertCircle className="h-12 w-12 text-red-400" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={fetchRecords}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-8" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payroll ID</TableHead>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Month/Year</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No payroll records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono text-xs">{rec.payrollId}</TableCell>
                        <TableCell className="font-medium">{rec.staffName}</TableCell>
                        <TableCell><span className="text-sm text-muted-foreground">{rec.role}</span></TableCell>
                        <TableCell>{MONTHS[rec.month - 1]} {rec.year}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatCurrency(rec.grossEarnings)}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-600">{formatCurrency(rec.totalDeductions)}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold text-emerald-600">{formatCurrency(rec.netPay)}</TableCell>
                        <TableCell><StatusBadge status={rec.status} styles={STATUS_STYLES} /></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewTarget(rec)}>
                                <Eye className="mr-2 h-4 w-4" />View
                              </DropdownMenuItem>
                              {(rec.status === 'Draft' || rec.status === 'Calculated') && (
                                <DropdownMenuItem onClick={() => handleStatusChange(rec, 'Approved')}>
                                  <CheckCircle2 className="mr-2 h-4 w-4 text-amber-500" />Approve
                                </DropdownMenuItem>
                              )}
                              {rec.status === 'Approved' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(rec, 'Paid')}>
                                  <DollarSign className="mr-2 h-4 w-4 text-green-500" />Pay
                                </DropdownMenuItem>
                              )}
                              {rec.status !== 'Paid' && rec.status !== 'Cancelled' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(rec, 'Cancelled')}>
                                  <XCircle className="mr-2 h-4 w-4 text-red-500" />Cancel
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(rec)}>
                                <Trash2 className="mr-2 h-4 w-4" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Payroll Dialog */}
      <Dialog open={generateOpen} onOpenChange={(open) => { if (!open) { setGenerateOpen(false); resetGenerateForm() } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Generate Payroll
            </DialogTitle>
            <DialogDescription>Create a new payroll record for a staff member</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Staff *</Label>
                <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} - {s.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={genMonth} onValueChange={setGenMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((name, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input type="number" value={genYear} onChange={(e) => setGenYear(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <h4 className="text-sm font-semibold">Earnings</h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Basic</Label>
                  <Input type="number" value={basic || ''} onChange={(e) => setBasic(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">HRA</Label>
                  <Input type="number" value={hra || ''} onChange={(e) => setHra(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Conveyance</Label>
                  <Input type="number" value={conveyance || ''} onChange={(e) => setConveyance(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Medical Allowance</Label>
                  <Input type="number" value={medicalAllowance || ''} onChange={(e) => setMedicalAllowance(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Special Allowance</Label>
                  <Input type="number" value={specialAllowance || ''} onChange={(e) => setSpecialAllowance(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bonus</Label>
                  <Input type="number" value={bonus || ''} onChange={(e) => setBonus(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <h4 className="text-sm font-semibold">Deductions</h4>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">PF</Label>
                  <Input type="number" value={pf || ''} onChange={(e) => setPf(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ESI</Label>
                  <Input type="number" value={esi || ''} onChange={(e) => setEsi(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Professional Tax</Label>
                  <Input type="number" value={professionalTax || ''} onChange={(e) => setProfessionalTax(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Income Tax</Label>
                  <Input type="number" value={incomeTax || ''} onChange={(e) => setIncomeTax(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Other Deductions</Label>
                  <Input type="number" value={otherDeductions || ''} onChange={(e) => setOtherDeductions(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-muted/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Gross Earnings:</span>
                <span className="font-semibold font-mono">{formatCurrency(grossEarnings)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Deductions:</span>
                <span className="font-semibold font-mono text-red-600">{formatCurrency(totalDeductions)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-base">
                <span className="font-bold">Net Pay:</span>
                <span className="font-bold font-mono text-emerald-600">{formatCurrency(netPay)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGenerateOpen(false); resetGenerateForm() }}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleGenerate} disabled={!selectedStaff || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generate Payroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Payroll Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-emerald-600" />
              Payroll Details
            </DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Payroll ID:</span><p className="font-mono font-semibold">{viewTarget.payrollId}</p></div>
                <div><span className="text-muted-foreground">Staff:</span><p className="font-semibold">{viewTarget.staffName}</p></div>
                <div><span className="text-muted-foreground">Role:</span><p>{viewTarget.role}</p></div>
                <div><span className="text-muted-foreground">Period:</span><p>{MONTHS[viewTarget.month - 1]} {viewTarget.year}</p></div>
              </div>
              <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span>Basic:</span><span className="font-mono">{formatCurrency(viewTarget.basic)}</span></div>
                <div className="flex justify-between"><span>HRA:</span><span className="font-mono">{formatCurrency(viewTarget.hra)}</span></div>
                <div className="flex justify-between"><span>Conveyance + Others:</span><span className="font-mono">{formatCurrency(viewTarget.conveyance + viewTarget.medicalAllowance + viewTarget.specialAllowance + viewTarget.bonus)}</span></div>
                <div className="border-t pt-1 flex justify-between font-semibold"><span>Gross Earnings:</span><span className="font-mono">{formatCurrency(viewTarget.grossEarnings)}</span></div>
              </div>
              <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span>PF:</span><span className="font-mono text-red-600">{formatCurrency(viewTarget.pf)}</span></div>
                <div className="flex justify-between"><span>ESI:</span><span className="font-mono text-red-600">{formatCurrency(viewTarget.esi)}</span></div>
                <div className="flex justify-between"><span>Professional Tax:</span><span className="font-mono text-red-600">{formatCurrency(viewTarget.professionalTax)}</span></div>
                <div className="flex justify-between"><span>Income Tax:</span><span className="font-mono text-red-600">{formatCurrency(viewTarget.incomeTax)}</span></div>
                <div className="border-t pt-1 flex justify-between font-semibold"><span>Total Deductions:</span><span className="font-mono text-red-600">{formatCurrency(viewTarget.totalDeductions)}</span></div>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 flex justify-between text-base font-bold">
                <span>Net Pay:</span>
                <span className="font-mono text-emerald-600">{formatCurrency(viewTarget.netPay)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <StatusBadge status={viewTarget.status} styles={STATUS_STYLES} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the payroll record for {deleteTarget?.staffName} ({deleteTarget?.payrollId}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==================== TAB 2: ATTENDANCE ====================

function AttendanceTab() {
  const { toast } = useToast()

  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [staffSearchFilter, setStaffSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [markOpen, setMarkOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Mark/Edit form
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [formStaff, setFormStaff] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formCheckIn, setFormCheckIn] = useState('09:00')
  const [formCheckOut, setFormCheckOut] = useState('18:00')
  const [formStatus, setFormStatus] = useState('Present')

  const limit = 20

  const fetchRecords = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (dateFilter) params.date = dateFilter
      if (staffSearchFilter) params.search = staffSearchFilter
      if (statusFilter) params.status = statusFilter

      const res = await apiGet<PaginatedResponse<AttendanceRecord>>('/attendance', params)
      setRecords(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        setError(err.message)
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [page, dateFilter, staffSearchFilter, statusFilter, toast])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const fetchStaff = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<StaffOption>>('/staff', { limit: 200 })
      setStaffOptions(res.data)
    } catch {
      // Ignore
    }
  }, [])

  useEffect(() => {
    if (markOpen || editTarget) fetchStaff()
  }, [markOpen, editTarget, fetchStaff])

  const resetForm = () => {
    setFormStaff('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormCheckIn('09:00')
    setFormCheckOut('18:00')
    setFormStatus('Present')
  }

  const handleSave = async () => {
    if (!formStaff) return
    setIsSubmitting(true)
    try {
      const body = {
        staffId: formStaff,
        date: formDate,
        checkIn: formCheckIn || null,
        checkOut: formCheckOut || null,
        status: formStatus,
      }
      if (editTarget) {
        await apiPut<SingleResponse<AttendanceRecord>>(`/attendance/${editTarget.id}`, body)
        toast({ title: 'Updated', description: 'Attendance record updated!' })
      } else {
        await apiPost<SingleResponse<AttendanceRecord>>('/attendance', body)
        toast({ title: 'Success', description: 'Attendance marked!' })
      }
      setMarkOpen(false)
      setEditTarget(null)
      resetForm()
      fetchRecords()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (rec: AttendanceRecord) => {
    setEditTarget(rec)
    setFormStaff(rec.staffId)
    setFormDate(rec.date)
    setFormCheckIn(rec.checkIn || '09:00')
    setFormCheckOut(rec.checkOut || '18:00')
    setFormStatus(rec.status)
    setMarkOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiDelete(`/attendance/${deleteTarget.id}`)
      toast({ title: 'Deleted', description: 'Attendance record deleted.' })
      setDeleteTarget(null)
      fetchRecords()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleMarkAllPresent = async () => {
    try {
      await apiPost('/attendance/bulk', {
        date: new Date().toISOString().split('T')[0],
        status: 'Present',
      })
      toast({ title: 'Success', description: 'All staff marked present for today!' })
      fetchRecords()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const calcHours = (checkIn: string | null, checkOut: string | null): string => {
    if (!checkIn || !checkOut) return '-'
    const [inH, inM] = checkIn.split(':').map(Number)
    const [outH, outM] = checkOut.split(':').map(Number)
    const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM)
    if (totalMinutes < 0) return '0h 0m'
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${h}h ${m}m`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Date</Label>
              <Input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setPage(1) }} className="w-44" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === '__all__' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Half_Day">Half Day</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Leave">Leave</SelectItem>
                  <SelectItem value="Holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs font-medium text-muted-foreground">Search Staff</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={staffSearchFilter}
                  onChange={(e) => { setStaffSearchFilter(e.target.value); setPage(1) }}
                  className="w-full pl-9"
                />
              </div>
            </div>
            <Button variant="outline" onClick={handleMarkAllPresent}>
              <UserCheck className="mr-2 h-4 w-4" />
              Mark All Present
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { resetForm(); setEditTarget(null); setMarkOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Mark Attendance
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Attendance Records</CardTitle>
              <CardDescription>{isLoading ? 'Loading...' : `${total} records`}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center py-12 space-y-4">
              <AlertCircle className="h-12 w-12 text-red-400" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={fetchRecords}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Hours Worked</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No attendance records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-medium">{rec.staffName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(rec.date)}</TableCell>
                        <TableCell>
                          {rec.checkIn ? (
                            <span className="inline-flex items-center gap-1 text-sm font-mono">
                              <Sunrise className="h-3.5 w-3.5 text-amber-500" />
                              {rec.checkIn}
                            </span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          {rec.checkOut ? (
                            <span className="inline-flex items-center gap-1 text-sm font-mono">
                              <Sunset className="h-3.5 w-3.5 text-blue-500" />
                              {rec.checkOut}
                            </span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{calcHours(rec.checkIn, rec.checkOut)}</TableCell>
                        <TableCell><StatusBadge status={rec.status} styles={ATTENDANCE_STATUS_STYLES} /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(rec)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteTarget(rec)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mark/Edit Attendance Dialog */}
      <Dialog open={markOpen} onOpenChange={(open) => { if (!open) { setMarkOpen(false); setEditTarget(null); resetForm() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editTarget ? <Eye className="h-5 w-5" /> : <Plus className="h-5 w-5 text-emerald-600" />}
              {editTarget ? 'Edit Attendance' : 'Mark Attendance'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff *</Label>
              <Select value={formStaff} onValueChange={setFormStaff}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} - {s.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check In (HH:MM)</Label>
                <Input type="time" value={formCheckIn} onChange={(e) => setFormCheckIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Check Out (HH:MM)</Label>
                <Input type="time" value={formCheckOut} onChange={(e) => setFormCheckOut(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Half_Day">Half Day</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                  <SelectItem value="Leave">Leave</SelectItem>
                  <SelectItem value="Holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMarkOpen(false); setEditTarget(null); resetForm() }}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={!formStaff || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editTarget ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendance Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the attendance record for {deleteTarget?.staffName} on {deleteTarget?.date}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==================== TAB 3: SHIFTS ====================

function ShiftsTab() {
  const { toast } = useToast()

  const [shifts, setShifts] = useState<ShiftRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ShiftRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShiftRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form
  const [formName, setFormName] = useState('')
  const [formStart, setFormStart] = useState('09:00')
  const [formEnd, setFormEnd] = useState('18:00')
  const [formDays, setFormDays] = useState<string[]>([])
  const [formGrace, setFormGrace] = useState(15)

  const fetchShifts = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiGet<{ data: ShiftRecord[] }>('/shifts')
      setShifts(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  const resetForm = () => {
    setFormName('')
    setFormStart('09:00')
    setFormEnd('18:00')
    setFormDays([])
    setFormGrace(15)
  }

  const handleOpenAdd = () => {
    resetForm()
    setEditTarget(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (shift: ShiftRecord) => {
    setEditTarget(shift)
    setFormName(shift.name)
    setFormStart(shift.startTime)
    setFormEnd(shift.endTime)
    setFormDays(shift.daysOfWeek || [])
    setFormGrace(shift.gracePeriod)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setIsSubmitting(true)
    try {
      const body = {
        name: formName.trim(),
        startTime: formStart,
        endTime: formEnd,
        daysOfWeek: formDays,
        gracePeriod: formGrace,
      }
      if (editTarget) {
        await apiPut<SingleResponse<ShiftRecord>>(`/shifts/${editTarget.id}`, body)
        toast({ title: 'Updated', description: 'Shift updated!' })
      } else {
        await apiPost<SingleResponse<ShiftRecord>>('/shifts', body)
        toast({ title: 'Created', description: 'Shift created!' })
      }
      setDialogOpen(false)
      resetForm()
      fetchShifts()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiDelete(`/shifts/${deleteTarget.id}`)
      toast({ title: 'Deleted', description: 'Shift deleted.' })
      setDeleteTarget(null)
      fetchShifts()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleToggleActive = async (shift: ShiftRecord) => {
    try {
      await apiPut<SingleResponse<ShiftRecord>>(`/shifts/${shift.id}`, { active: !shift.active })
      toast({ title: shift.active ? 'Deactivated' : 'Activated', description: `Shift "${shift.name}" ${shift.active ? 'deactivated' : 'activated'}.` })
      fetchShifts()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const toggleDay = (day: string) => {
    setFormDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day])
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Shift Management</h3>
          <p className="text-sm text-muted-foreground">{shifts.length} shift(s) configured</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Shift
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {shifts.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-30" />
              <p>No shifts configured yet.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shift Name</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Days of Week</TableHead>
                    <TableHead>Grace Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.name}</TableCell>
                      <TableCell className="font-mono text-sm">{shift.startTime}</TableCell>
                      <TableCell className="font-mono text-sm">{shift.endTime}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {DAYS_OF_WEEK.map((day) => (
                            <span
                              key={day}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                (shift.daysOfWeek || []).includes(day)
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
                              }`}
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{shift.gracePeriod} min</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={shift.active}
                            onCheckedChange={() => handleToggleActive(shift)}
                          />
                          <Badge variant="outline" className={shift.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                            {shift.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(shift)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteTarget(shift)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Shift Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editTarget ? <Eye className="h-5 w-5" /> : <Plus className="h-5 w-5 text-emerald-600" />}
              {editTarget ? 'Edit Shift' : 'Add Shift'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Shift Name *</Label>
              <Input placeholder="e.g., Morning Shift" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map((day) => (
                  <label key={day} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={formDays.includes(day)}
                      onCheckedChange={() => toggleDay(day)}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Grace Period (minutes)</Label>
              <Input type="number" min={0} max={120} value={formGrace} onChange={(e) => setFormGrace(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={!formName.trim() || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editTarget ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the shift "{deleteTarget?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==================== TAB 4: LEAVES ====================

function LeavesTab() {
  const { toast } = useToast()

  const [records, setRecords] = useState<LeaveRecord[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [staffFilter, setStaffFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Dialogs
  const [applyOpen, setApplyOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [formStaff, setFormStaff] = useState('')
  const [formType, setFormType] = useState('Annual')
  const [formFrom, setFormFrom] = useState(new Date().toISOString().split('T')[0])
  const [formTo, setFormTo] = useState(new Date().toISOString().split('T')[0])
  const [formReason, setFormReason] = useState('')

  // Leave balance
  const [leaveBalance, setLeaveBalance] = useState<Record<string, { used: number; total: number }>>({})
  const [balanceStaff, setBalanceStaff] = useState('')

  const limit = 20

  const totalDays = formFrom && formTo
    ? Math.max(1, Math.ceil((new Date(formTo + 'T00:00:00').getTime() - new Date(formFrom + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1)
    : 1

  const fetchRecords = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (staffFilter) params.staffId = staffFilter
      if (statusFilter) params.status = statusFilter
      if (dateFrom) params.fromDate = dateFrom
      if (dateTo) params.toDate = dateTo

      const res = await apiGet<PaginatedResponse<LeaveRecord>>('/leaves', params)
      setRecords(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        setError(err.message)
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [page, staffFilter, statusFilter, dateFrom, dateTo, toast])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const fetchStaff = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<StaffOption>>('/staff', { limit: 200 })
      setStaffOptions(res.data)
    } catch {
      // Ignore
    }
  }, [])

  const fetchBalance = useCallback(async (staffId: string) => {
    if (!staffId) {
      setLeaveBalance({})
      return
    }
    try {
      const res = await apiGet<Record<string, { used: number; total: number }>>(`/leaves/balance/${staffId}`)
      setLeaveBalance(res)
    } catch {
      setLeaveBalance({})
    }
  }, [])

  useEffect(() => {
    if (applyOpen) fetchStaff()
  }, [applyOpen, fetchStaff])

  useEffect(() => {
    if (formStaff && formStaff !== balanceStaff) {
      setBalanceStaff(formStaff)
      fetchBalance(formStaff)
    }
  }, [formStaff, balanceStaff, fetchBalance])

  const resetForm = () => {
    setFormStaff('')
    setFormType('Annual')
    setFormFrom(new Date().toISOString().split('T')[0])
    setFormTo(new Date().toISOString().split('T')[0])
    setFormReason('')
    setLeaveBalance({})
    setBalanceStaff('')
  }

  const handleApply = async () => {
    if (!formStaff || !formFrom || !formTo) return
    setIsSubmitting(true)
    try {
      await apiPost<SingleResponse<LeaveRecord>>('/leaves', {
        staffId: formStaff,
        type: formType,
        fromDate: formFrom,
        toDate: formTo,
        totalDays,
        reason: formReason || undefined,
      })
      toast({ title: 'Success', description: 'Leave application submitted!' })
      setApplyOpen(false)
      resetForm()
      fetchRecords()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStatusChange = async (record: LeaveRecord, newStatus: string) => {
    try {
      await apiPut<SingleResponse<LeaveRecord>>(`/leaves/${record.id}/status`, { status: newStatus })
      toast({ title: 'Success', description: `Leave ${newStatus.toLowerCase()}!` })
      fetchRecords()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">From Date</Label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">To Date</Label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="w-40" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === '__all__' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <Label className="text-xs font-medium text-muted-foreground">Staff</Label>
              <Select value={staffFilter} onValueChange={(v) => { setStaffFilter(v === '__all__' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Staff</SelectItem>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { resetForm(); setApplyOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Apply Leave
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Balance Card */}
      {staffFilter && leaveBalance && Object.keys(leaveBalance).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-emerald-600" />
              Leave Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(leaveBalance).map(([type, bal]) => (
                <div key={type} className="rounded-lg border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{type}: </span>
                  <span className="font-semibold">{bal.total - bal.used}/{bal.total}</span>
                  <span className="text-xs text-muted-foreground ml-1">used {bal.used}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Leave Applications</CardTitle>
              <CardDescription>{isLoading ? 'Loading...' : `${total} records`}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center py-12 space-y-4">
              <AlertCircle className="h-12 w-12 text-red-400" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={fetchRecords}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave ID</TableHead>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>From → To</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No leave records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((rec) => (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono text-xs">{rec.leaveId}</TableCell>
                        <TableCell className="font-medium">{rec.staffName}</TableCell>
                        <TableCell><StatusBadge status={rec.type} styles={LEAVE_TYPE_STYLES} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(rec.fromDate)} → {formatDate(rec.toDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono">{rec.totalDays}d</Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={rec.status} styles={{
                            Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                            Approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                            Rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
                            Cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                          }} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {rec.status === 'Pending' && (
                              <>
                                <Button variant="ghost" size="sm" className="h-8 text-green-600" onClick={() => handleStatusChange(rec, 'Approved')}>
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Approve
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 text-red-600" onClick={() => handleStatusChange(rec, 'Rejected')}>
                                  <XCircle className="mr-1 h-3.5 w-3.5" />Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Apply Leave Dialog */}
      <Dialog open={applyOpen} onOpenChange={(open) => { if (!open) { setApplyOpen(false); resetForm() } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Apply for Leave
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Staff *</Label>
              <Select value={formStaff} onValueChange={setFormStaff}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} - {s.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Annual">Annual</SelectItem>
                  <SelectItem value="Sick">Sick</SelectItem>
                  <SelectItem value="Casual">Casual</SelectItem>
                  <SelectItem value="Maternity">Maternity</SelectItem>
                  <SelectItem value="Paternity">Paternity</SelectItem>
                  <SelectItem value="Unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Date *</Label>
                <Input type="date" value={formFrom} onChange={(e) => setFormFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>To Date *</Label>
                <Input type="date" value={formTo} onChange={(e) => setFormTo(e.target.value)} />
              </div>
            </div>
            {formFrom && formTo && (
              <div className="rounded-lg bg-muted/30 p-2 text-sm text-center">
                Total Days: <span className="font-bold font-mono">{totalDays}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                placeholder="Enter reason for leave..."
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                rows={3}
              />
            </div>

            {leaveBalance && Object.keys(leaveBalance).length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Leave Balance</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(leaveBalance).map(([type, bal]) => (
                    <Badge key={type} variant="outline" className="text-[11px]">
                      {type}: {bal.total - bal.used}/{bal.total}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApplyOpen(false); resetForm() }}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApply} disabled={!formStaff || !formFrom || !formTo || isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export function PayrollPage() {
  const { toast } = useToast()

  const fetchStaffForFilters = useCallback(async () => {
    try {
      return await apiGet<PaginatedResponse<StaffOption>>('/staff', { limit: 200 })
    } catch {
      return null
    }
  }, [])

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])

  useEffect(() => {
    fetchStaffForFilters().then((res) => {
      if (res) setStaffOptions(res.data)
    })
  }, [fetchStaffForFilters])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payroll Management</h2>
          <p className="text-muted-foreground">Manage staff payroll, attendance, shifts, and leaves</p>
        </div>
      </div>

      <Tabs defaultValue="payroll" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="payroll" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Payroll</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="shifts" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Shifts</span>
          </TabsTrigger>
          <TabsTrigger value="leaves" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Leaves</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="mt-0">
          <PayrollTab />
        </TabsContent>

        <TabsContent value="attendance" className="mt-0">
          <AttendanceTab />
        </TabsContent>

        <TabsContent value="shifts" className="mt-0">
          <ShiftsTab />
        </TabsContent>

        <TabsContent value="leaves" className="mt-0">
          <LeavesTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
