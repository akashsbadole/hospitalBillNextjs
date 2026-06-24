'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Plus,
  Edit,
  Trash2,
  X,
  FlaskConical,
  RefreshCw,
  Search as SearchIcon,
  Loader2,
  AlertCircle,
  Clock,
  FileCheck,
  FileText,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  CircleDot,
  CheckCircle2,
  ClipboardCheck,
  IndianRupee,
  Beaker,
} from 'lucide-react'

// ==================== TYPES ====================

interface LabTestCatalog {
  id: string
  testId: string
  name: string
  category: string
  description?: string
  normalRange?: string
  unit?: string
  price: number
  gstRate: number
  hsnCode?: string
  status: string
  createdAt: string
  updatedAt: string
  _count?: { orders: number }
}

interface LabTestOrder {
  id: string
  orderId: string
  visitId: string
  patientId: string
  testId: string
  doctorId?: string
  status: string
  orderedAt: string
  completedAt?: string
  results?: string
  notes?: string
  reportUrl?: string
  createdAt: string
  updatedAt: string
  patient: { id: string; patientId: string; name: string; phone: string }
  test: { id: string; testId: string; name: string; category: string; normalRange?: string; unit?: string }
  doctor?: { id: string; doctorId: string; name: string; specialization: string }
  visit: { id: string; visitId: string; visitType: string; department: string }
  parsedResults?: LabResult[]
}

interface LabResult {
  parameter: string
  value: string
  unit?: string
  normalRange?: string
  isAbnormal: boolean
}

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string
}

interface Doctor {
  id: string
  doctorId: string
  name: string
  specialization: string
}

interface Visit {
  id: string
  visitId: string
  visitType: string
  department: string
  createdAt: string
  patient?: { name: string }
}

// ==================== CONSTANTS ====================

const ORDER_STATUS_OPTIONS = ['All', 'Ordered', 'Sample Collected', 'Processing', 'Completed', 'Reported'] as const
const TEST_CATEGORIES = ['Hematology', 'Biochemistry', 'Microbiology', 'Radiology', 'Pathology'] as const
const GST_RATES = [0, 5, 12, 18, 28] as const

function getOrderStatusBadge(status: string) {
  switch (status) {
    case 'Ordered': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    case 'Sample Collected': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
    case 'Processing': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'Completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
    case 'Reported': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
  }
}

function getCategoryBadge(category: string) {
  switch (category) {
    case 'Hematology': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    case 'Biochemistry': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    case 'Microbiology': return 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
    case 'Radiology': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    case 'Pathology': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
  }
}

// ==================== MAIN COMPONENT ====================

export function LabTestsPage() {
  const [activeTab, setActiveTab] = useState('orders')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="orders">Lab Orders</TabsTrigger>
          <TabsTrigger value="catalog">Test Catalog</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-6">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="catalog" className="mt-6">
          <CatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ==================== ORDERS TAB ====================

function OrdersTab() {
  const { toast } = useToast()

  // Data state
  const [orders, setOrders] = useState<LabTestOrder[]>([])
  const [catalog, setCatalog] = useState<LabTestCatalog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  // Filters
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<LabTestOrder | null>(null)

  // Loading
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Add Order form
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [patientSearching, setPatientSearching] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedTest, setSelectedTest] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [selectedVisit, setSelectedVisit] = useState('')
  const [doctorList, setDoctorList] = useState<Doctor[]>([])
  const [visitList, setVisitList] = useState<Visit[]>([])

  // Results form
  const [resultRows, setResultRows] = useState<LabResult[]>([
    { parameter: '', value: '', unit: '', normalRange: '', isAbnormal: false },
  ])
  const [resultNotes, setResultNotes] = useState('')

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, processing: 0, completed: 0, reported: 0 })

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = { page, limit }
      if (statusFilter !== 'All') params.status = statusFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await apiGet<PaginatedResponse<LabTestOrder>>('/lab-tests/orders', params)
      setOrders(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)

      // Calculate stats
      setStats({
        total: res.total,
        pending: res.data.filter((o) => ['Ordered', 'Sample Collected'].includes(o.status)).length,
        processing: res.data.filter((o) => o.status === 'Processing').length,
        completed: res.data.filter((o) => o.status === 'Completed').length,
        reported: res.data.filter((o) => o.status === 'Reported').length,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch lab orders',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, searchQuery, toast])

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<LabTestCatalog>>('/lab-tests/catalog', { limit: 100, status: 'Active' })
      setCatalog(res.data)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    fetchCatalog()
  }, [fetchCatalog])

  // Patient search
  useEffect(() => {
    if (patientSearch.trim().length < 2) {
      setPatientResults([])
      return
    }
    const timer = setTimeout(async () => {
      setPatientSearching(true)
      try {
        const res = await apiGet<PaginatedResponse<Patient>>('/patients', { search: patientSearch.trim(), limit: 10 })
        setPatientResults(res.data)
      } catch {
        setPatientResults([])
      } finally {
        setPatientSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch])

  // Fetch doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await apiGet<PaginatedResponse<Doctor>>('/doctors', { limit: 100 })
        setDoctorList(res.data)
      } catch {
        // silent
      }
    }
    fetchDoctors()
  }, [])

  // Fetch visits when patient is selected
  useEffect(() => {
    if (!selectedPatient) {
      setVisitList([])
      setSelectedVisit('')
      return
    }
    const fetchVisits = async () => {
      try {
        const res = await apiGet<PaginatedResponse<Visit>>('/patient-visits', { patientId: selectedPatient.id, limit: 20 })
        setVisitList(res.data)
      } catch {
        setVisitList([])
      }
    }
    fetchVisits()
  }, [selectedPatient])

  const handleAddOrder = async () => {
    if (!selectedPatient || !selectedTest || !selectedVisit) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        visitId: selectedVisit,
        patientId: selectedPatient.id,
        testId: selectedTest,
      }
      if (selectedDoctor) body.doctorId = selectedDoctor

      await apiPost<SingleResponse<LabTestOrder>>('/lab-tests/orders', body)
      toast({ title: 'Order Created', description: 'Lab test order has been placed successfully.' })
      setAddDialogOpen(false)
      resetAddForm()
      fetchOrders()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create order',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openResultsDialog = (order: LabTestOrder) => {
    setSelectedOrder(order)
    // Pre-fill result rows from existing results if any
    if (order.parsedResults && order.parsedResults.length > 0) {
      setResultRows(order.parsedResults)
    } else {
      setResultRows([{ parameter: '', value: '', unit: order.test.unit || '', normalRange: order.test.normalRange || '', isAbnormal: false }])
    }
    setResultNotes(order.notes || '')
    setResultsDialogOpen(true)
  }

  const handleRecordResults = async () => {
    if (!selectedOrder) return
    // Filter out empty rows
    const validRows = resultRows.filter((r) => r.parameter.trim() && r.value.trim())
    if (validRows.length === 0) {
      toast({ title: 'Validation Error', description: 'Please add at least one result parameter.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await apiPut<SingleResponse<LabTestOrder>>(`/lab-tests/orders/${selectedOrder.id}`, {
        status: 'Reported',
        results: validRows,
        notes: resultNotes || undefined,
      })
      toast({ title: 'Results Recorded', description: 'Lab results have been saved and order marked as Reported.' })
      setResultsDialogOpen(false)
      fetchOrders()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to record results',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const addResultRow = () => {
    setResultRows([...resultRows, { parameter: '', value: '', unit: '', normalRange: '', isAbnormal: false }])
  }

  const removeResultRow = (index: number) => {
    setResultRows(resultRows.filter((_, i) => i !== index))
  }

  const updateResultRow = (index: number, field: keyof LabResult, value: string | boolean) => {
    const updated = [...resultRows]
    updated[index] = { ...updated[index], [field]: value }
    setResultRows(updated)
  }

  const resetAddForm = () => {
    setPatientSearch('')
    setPatientResults([])
    setSelectedPatient(null)
    setSelectedTest('')
    setSelectedDoctor('')
    setSelectedVisit('')
    setVisitList([])
  }

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await apiPut<SingleResponse<LabTestOrder>>(`/lab-tests/orders/${orderId}`, { status: newStatus })
      toast({ title: 'Status Updated', description: `Order status updated to ${newStatus}.` })
      fetchOrders()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.processing}</p>
              <p className="text-xs text-muted-foreground">Processing</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CircleDot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.reported}</p>
              <p className="text-xs text-muted-foreground">Reported</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters + Actions */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {ORDER_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {TEST_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchOrders}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
        </div>
      </Card>

      {/* Orders Table (Desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Test Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ordered Date</TableHead>
                <TableHead>Completed Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No lab orders found</p>
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.patient.name}</p>
                        <p className="text-xs text-muted-foreground">{order.patient.patientId}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{order.test.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getCategoryBadge(order.test.category)}>
                        {order.test.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{order.doctor?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getOrderStatusBadge(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(order.orderedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {order.completedAt
                        ? new Date(order.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {order.status === 'Ordered' && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleUpdateStatus(order.id, 'Sample Collected')}>
                            Collect
                          </Button>
                        )}
                        {order.status === 'Sample Collected' && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleUpdateStatus(order.id, 'Processing')}>
                            Process
                          </Button>
                        )}
                        {order.status === 'Processing' && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleUpdateStatus(order.id, 'Completed')}>
                            Complete
                          </Button>
                        )}
                        {['Completed', 'Processing'].includes(order.status) && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600" onClick={() => openResultsDialog(order)}>
                            <FileCheck className="h-3.5 w-3.5 mr-1" />
                            Record
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Orders Cards (Mobile) */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-36 w-full" /></Card>
          ))
        ) : orders.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <FlaskConical className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No lab orders found</p>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{order.orderId}</p>
                  <p className="font-medium">{order.patient.name}</p>
                  <p className="text-sm text-muted-foreground">{order.test.name}</p>
                </div>
                <Badge variant="secondary" className={getOrderStatusBadge(order.status)}>
                  {order.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <Badge variant="secondary" className={getCategoryBadge(order.test.category)}>
                    {order.test.category}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Doctor</p>
                  <p>{order.doctor?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ordered</p>
                  <p>{new Date(order.orderedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p>{order.completedAt ? new Date(order.completedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                {order.status === 'Ordered' && (
                  <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(order.id, 'Sample Collected')}>
                    Collect
                  </Button>
                )}
                {order.status === 'Sample Collected' && (
                  <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(order.id, 'Processing')}>
                    Process
                  </Button>
                )}
                {order.status === 'Processing' && (
                  <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(order.id, 'Completed')}>
                    Complete
                  </Button>
                )}
                {['Completed', 'Processing'].includes(order.status) && (
                  <Button size="sm" onClick={() => openResultsDialog(order)}>
                    <FileCheck className="h-3.5 w-3.5 mr-1" />
                    Record
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && orders.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} orders)
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Order Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetAddForm() }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Lab Test Order</DialogTitle>
            <DialogDescription>Place a new lab test order for a patient.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Patient Search */}
            <div className="space-y-2">
              <Label>Patient *</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between p-2.5 border rounded-lg bg-emerald-50 dark:bg-emerald-950">
                  <div>
                    <p className="font-medium text-sm">{selectedPatient.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedPatient.patientId} • {selectedPatient.phone}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedPatient(null); setPatientSearch('') }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search patient..."
                    className="pl-9"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                  {patientSearching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                </div>
              )}
              {patientResults.length > 0 && !selectedPatient && (
                <div className="border rounded-lg max-h-40 overflow-y-auto">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between border-b last:border-b-0"
                      onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatientResults([]) }}
                    >
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.patientId} • {p.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Visit Select */}
            <div className="space-y-2">
              <Label>Visit *</Label>
              <Select value={selectedVisit} onValueChange={setSelectedVisit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select visit" />
                </SelectTrigger>
                <SelectContent>
                  {visitList.length === 0 && (
                    <SelectItem value="none" disabled>No visits found</SelectItem>
                  )}
                  {visitList.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.visitId} — {v.visitType} ({v.department})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Test Select */}
            <div className="space-y-2">
              <Label>Test *</Label>
              <Select value={selectedTest} onValueChange={setSelectedTest}>
                <SelectTrigger>
                  <SelectValue placeholder="Select test" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Doctor Select (Optional) */}
            <div className="space-y-2">
              <Label>Doctor (Optional)</Label>
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctorList.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {d.specialization}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddOrder} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Results Dialog */}
      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Lab Results</DialogTitle>
            <DialogDescription>
              {selectedOrder && (
                <>{selectedOrder.test.name} — {selectedOrder.patient.name} ({selectedOrder.patient.patientId})</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Result Rows */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Test Results</Label>
                <Button variant="outline" size="sm" onClick={addResultRow}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Parameter
                </Button>
              </div>

              {/* Header for result rows */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                <div className="col-span-3">Parameter</div>
                <div className="col-span-2">Value</div>
                <div className="col-span-2">Unit</div>
                <div className="col-span-2">Normal Range</div>
                <div className="col-span-2">Abnormal?</div>
                <div className="col-span-1" />
              </div>

              {resultRows.map((row, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <div className="sm:col-span-3">
                    <Input
                      placeholder="Parameter name"
                      value={row.parameter}
                      onChange={(e) => updateResultRow(index, 'parameter', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Value"
                      value={row.value}
                      onChange={(e) => updateResultRow(index, 'value', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Unit"
                      value={row.unit}
                      onChange={(e) => updateResultRow(index, 'unit', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="Normal range"
                      value={row.normalRange}
                      onChange={(e) => updateResultRow(index, 'normalRange', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <Checkbox
                      checked={row.isAbnormal}
                      onCheckedChange={(checked) => updateResultRow(index, 'isAbnormal', !!checked)}
                    />
                    <span className="text-xs text-muted-foreground">Abnormal</span>
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    {resultRows.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeResultRow(index)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes or observations..."
                value={resultNotes}
                onChange={(e) => setResultNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResultsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordResults} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Results
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== CATALOG TAB ====================

function CatalogTab() {
  const { toast } = useToast()

  // Data
  const [tests, setTests] = useState<LabTestCatalog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 10

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Dialogs
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTest, setSelectedTest] = useState<LabTestCatalog | null>(null)

  // Loading
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Test form
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('Hematology')
  const [formDescription, setFormDescription] = useState('')
  const [formNormalRange, setFormNormalRange] = useState('')
  const [formUnit, setFormUnit] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formGstRate, setFormGstRate] = useState('5')
  const [formHsnCode, setFormHsnCode] = useState('')

  // Category stats
  const [categoryStats, setCategoryStats] = useState<Record<string, number>>({})

  const fetchTests = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = { page, limit }
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (categoryFilter !== 'all') params.category = categoryFilter

      const res = await apiGet<PaginatedResponse<LabTestCatalog>>('/lab-tests/catalog', params)
      setTests(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)

      // Calculate category breakdown
      const stats: Record<string, number> = {}
      res.data.forEach((t) => {
        stats[t.category] = (stats[t.category] || 0) + 1
      })
      setCategoryStats(stats)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to fetch tests',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery, categoryFilter, toast])

  useEffect(() => {
    fetchTests()
  }, [fetchTests])

  const resetTestForm = () => {
    setFormName('')
    setFormCategory('Hematology')
    setFormDescription('')
    setFormNormalRange('')
    setFormUnit('')
    setFormPrice('')
    setFormGstRate('5')
    setFormHsnCode('')
  }

  const handleAddTest = async () => {
    if (!formName.trim()) {
      toast({ title: 'Validation Error', description: 'Test name is required.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        category: formCategory,
        price: parseFloat(formPrice) || 0,
        gstRate: parseFloat(formGstRate) || 5,
      }
      if (formDescription.trim()) body.description = formDescription.trim()
      if (formNormalRange.trim()) body.normalRange = formNormalRange.trim()
      if (formUnit.trim()) body.unit = formUnit.trim()
      if (formHsnCode.trim()) body.hsnCode = formHsnCode.trim()

      await apiPost<SingleResponse<LabTestCatalog>>('/lab-tests/catalog', body)
      toast({ title: 'Test Added', description: `${formName} has been added to the catalog.` })
      setAddDialogOpen(false)
      resetTestForm()
      fetchTests()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add test',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = (test: LabTestCatalog) => {
    setSelectedTest(test)
    setFormName(test.name)
    setFormCategory(test.category)
    setFormDescription(test.description || '')
    setFormNormalRange(test.normalRange || '')
    setFormUnit(test.unit || '')
    setFormPrice(String(test.price))
    setFormGstRate(String(test.gstRate))
    setFormHsnCode(test.hsnCode || '')
    setEditDialogOpen(true)
  }

  const handleEditTest = async () => {
    if (!selectedTest || !formName.trim()) {
      toast({ title: 'Validation Error', description: 'Test name is required.', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        category: formCategory,
        price: parseFloat(formPrice) || 0,
        gstRate: parseFloat(formGstRate) || 5,
      }
      if (formDescription.trim()) body.description = formDescription.trim()
      if (formNormalRange.trim()) body.normalRange = formNormalRange.trim()
      if (formUnit.trim()) body.unit = formUnit.trim()
      if (formHsnCode.trim()) body.hsnCode = formHsnCode.trim()

      await apiPut<SingleResponse<LabTestCatalog>>(`/lab-tests/catalog/${selectedTest.id}`, body)
      toast({ title: 'Test Updated', description: `${formName} has been updated.` })
      setEditDialogOpen(false)
      fetchTests()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update test',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteDialog = (test: LabTestCatalog) => {
    setSelectedTest(test)
    setDeleteDialogOpen(true)
  }

  const handleDeleteTest = async () => {
    if (!selectedTest) return
    setSubmitting(true)
    try {
      await apiDelete(`/lab-tests/catalog/${selectedTest.id}`)
      toast({ title: 'Test Deactivated', description: `${selectedTest.name} has been deactivated.` })
      setDeleteDialogOpen(false)
      fetchTests()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to deactivate test',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-3 md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Beaker className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-bold">{total}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
          </div>
        </Card>
        {TEST_CATEGORIES.map((cat) => (
          <Card key={cat} className="p-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={getCategoryBadge(cat)}>
                {cat.slice(0, 3)}
              </Badge>
              <div>
                <p className="text-lg font-bold">{categoryStats[cat] || 0}</p>
                <p className="text-[10px] text-muted-foreground">{cat}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters + Actions */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0 sm:max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tests..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {TEST_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchTests}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Test
            </Button>
          </div>
        </div>
      </Card>

      {/* Catalog Table (Desktop) */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Normal Range</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>HSN Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : tests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <Beaker className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No tests found in catalog</p>
                  </TableCell>
                </TableRow>
              ) : (
                tests.map((test) => (
                  <TableRow key={test.id}>
                    <TableCell className="font-mono text-xs">{test.testId}</TableCell>
                    <TableCell className="font-medium">{test.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getCategoryBadge(test.category)}>
                        {test.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{test.normalRange || '—'}</TableCell>
                    <TableCell className="text-sm">{test.unit || '—'}</TableCell>
                    <TableCell className="font-medium">₹{test.price.toLocaleString('en-IN')}</TableCell>
                    <TableCell className="text-sm">{test.gstRate}%</TableCell>
                    <TableCell className="font-mono text-xs">{test.hsnCode || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={test.status === 'Active' ? 'default' : 'secondary'} className={
                        test.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
                      }>
                        {test.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(test)} title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => openDeleteDialog(test)} title="Deactivate">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Catalog Cards (Mobile) */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-32 w-full" /></Card>
          ))
        ) : tests.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <Beaker className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No tests found in catalog</p>
          </Card>
        ) : (
          tests.map((test) => (
            <Card key={test.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{test.testId}</p>
                  <p className="font-medium">{test.name}</p>
                </div>
                <Badge variant="secondary" className={getCategoryBadge(test.category)}>
                  {test.category}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Normal Range</p>
                  <p>{test.normalRange || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Unit</p>
                  <p>{test.unit || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Price</p>
                  <p className="font-medium">₹{test.price.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">GST</p>
                  <p>{test.gstRate}%</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <Badge variant={test.status === 'Active' ? 'default' : 'secondary'} className={
                  test.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300'
                }>
                  {test.status}
                </Badge>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(test)}>
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-600" onClick={() => openDeleteDialog(test)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loading && tests.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({total} tests)
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Test Form Dialog (Add/Edit) */}
      <Dialog
        open={addDialogOpen || editDialogOpen}
        onOpenChange={(open) => {
          if (open) return
          setAddDialogOpen(false)
          setEditDialogOpen(false)
          resetTestForm()
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialogOpen ? 'Edit Lab Test' : 'Add Lab Test'}</DialogTitle>
            <DialogDescription>
              {editDialogOpen ? 'Update test details.' : 'Add a new test to the lab catalog.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Test Name *</Label>
              <Input placeholder="e.g., Complete Blood Count" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEST_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Test description..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Normal Range</Label>
                <Input placeholder="e.g., 70-100 mg/dL" value={formNormalRange} onChange={(e) => setFormNormalRange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input placeholder="e.g., mg/dL" value={formUnit} onChange={(e) => setFormUnit(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Price (₹)</Label>
                <Input type="number" placeholder="0" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>GST Rate (%)</Label>
                <Select value={formGstRate} onValueChange={setFormGstRate}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_RATES.map((r) => (
                      <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>HSN Code</Label>
              <Input placeholder="e.g., 0013" value={formHsnCode} onChange={(e) => setFormHsnCode(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); setEditDialogOpen(false); resetTestForm() }}>Cancel</Button>
            <Button onClick={editDialogOpen ? handleEditTest : handleAddTest} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editDialogOpen ? 'Update' : 'Add'} Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Test</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {selectedTest?.name}? This will mark it as inactive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTest} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
