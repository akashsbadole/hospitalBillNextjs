'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Plus,
  Truck,
  Phone,
  MapPin,
  Clock,
  CheckCircle,
  Edit,
  Trash2,
  Loader2,
  RefreshCw,
  Filter,
  Search,
  Ambulance,
} from 'lucide-react'

interface AmbulanceItem {
  id: string
  ambulanceId: string
  vehicleNumber: string
  driverName: string
  driverPhone: string
  driverLicense: string | null
  type: string
  status: string
  latitude: number | null
  longitude: number | null
  lastLocationAt: string | null
  equipment: string | null
  hospitalBranch: string | null
  insuranceValidUntil: string | null
  fitnessValidUntil: string | null
  createdAt: string
  updatedAt: string
}

interface DispatchItem {
  id: string
  dispatchId: string
  ambulanceId: string
  patientId: string | null
  pickupAddress: string | null
  destination: string | null
  dispatchType: string
  status: string
  dispatchedAt: string
  arrivedAt: string | null
  patientAboardAt: string | null
  destinationAt: string | null
  completedAt: string | null
  distanceKm: number | null
  fare: number
  paymentStatus: string
  notes: string | null
  branchId: string | null
  createdAt: string
  updatedAt: string
  ambulance: {
    id: string
    ambulanceId: string
    vehicleNumber: string
    driverName: string
    driverPhone: string
    type: string
    status: string
  }
  patient: {
    id: string
    patientId: string
    name: string
    phone: string
  } | null
}

const AMBULANCE_STATUS_COLORS: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'On-Duty': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Out-of-Service': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const AMBULANCE_TYPE_COLORS: Record<string, string> = {
  Basic: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  Advanced: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  ICU: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Mortuary: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
}

const DISPATCH_STATUS_COLORS: Record<string, string> = {
  Dispatched: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Arrived: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Patient-Aboard': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'At-Destination': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Waived: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
}

const DISPATCH_STEPS = ['Dispatched', 'Arrived', 'Patient-Aboard', 'At-Destination', 'Completed']

export function AmbulanceManagementPage() {
  const { toast } = useToast()

  const [ambulances, setAmbulances] = useState<AmbulanceItem[]>([])
  const [dispatches, setDispatches] = useState<DispatchItem[]>([])
  const [loadingAmb, setLoadingAmb] = useState(true)
  const [loadingDisp, setLoadingDisp] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [filterAmbStatus, setFilterAmbStatus] = useState('')
  const [filterDispStatus, setFilterDispStatus] = useState('')
  const [filterDispType, setFilterDispType] = useState('')

  const [showAddAmbulance, setShowAddAmbulance] = useState(false)
  const [showEditAmbulance, setShowEditAmbulance] = useState(false)
  const [showDeleteAmbulance, setShowDeleteAmbulance] = useState(false)
  const [showCreateDispatch, setShowCreateDispatch] = useState(false)

  const [editAmbData, setEditAmbData] = useState<AmbulanceItem | null>(null)
  const [deleteAmbId, setDeleteAmbId] = useState<string>('')

  const [newAmb, setNewAmb] = useState({
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    driverLicense: '',
    type: 'Basic',
    equipment: '',
    hospitalBranch: '',
  })

  const [editAmb, setEditAmb] = useState({
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    driverLicense: '',
    type: 'Basic',
    status: 'Available',
    equipment: '',
    hospitalBranch: '',
  })

  const [newDispatch, setNewDispatch] = useState({
    ambulanceId: '',
    patientName: '',
    patientPhone: '',
    pickupAddress: '',
    destination: '',
    dispatchType: 'Emergency',
    notes: '',
  })

  const [selectedDispatch, setSelectedDispatch] = useState<DispatchItem | null>(null)
  const [showTimeline, setShowTimeline] = useState(false)

  const fetchAmbulances = useCallback(async () => {
    setLoadingAmb(true)
    try {
      const params: Record<string, string> = {}
      if (filterAmbStatus) params.status = filterAmbStatus
      const res = await apiGet<{ data: AmbulanceItem[] }>('/ambulance', params)
      setAmbulances(res.data)
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast({ title: 'Error', description: 'Failed to fetch ambulances', variant: 'destructive' })
      }
    } finally {
      setLoadingAmb(false)
    }
  }, [filterAmbStatus, toast])

  const fetchDispatches = useCallback(async () => {
    setLoadingDisp(true)
    try {
      const params: Record<string, string> = {}
      if (filterDispStatus) params.status = filterDispStatus
      if (filterDispType) params.dispatchType = filterDispType
      const res = await apiGet<{ data: DispatchItem[] }>('/ambulance/dispatch', params)
      setDispatches(res.data)
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast({ title: 'Error', description: 'Failed to fetch dispatches', variant: 'destructive' })
      }
    } finally {
      setLoadingDisp(false)
    }
  }, [filterDispStatus, filterDispType, toast])

  useEffect(() => { fetchAmbulances() }, [fetchAmbulances])
  useEffect(() => { fetchDispatches() }, [fetchDispatches])

  const handleCreateAmbulance = async () => {
    if (!newAmb.vehicleNumber.trim() || !newAmb.driverName.trim() || !newAmb.driverPhone.trim()) return
    setActionLoading(true)
    try {
      await apiPost('/ambulance', {
        ...newAmb,
        driverLicense: newAmb.driverLicense || undefined,
        equipment: newAmb.equipment || undefined,
        hospitalBranch: newAmb.hospitalBranch || undefined,
      })
      toast({ title: 'Ambulance added', description: `${newAmb.vehicleNumber} has been registered.` })
      setShowAddAmbulance(false)
      setNewAmb({ vehicleNumber: '', driverName: '', driverPhone: '', driverLicense: '', type: 'Basic', equipment: '', hospitalBranch: '' })
      fetchAmbulances()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to add ambulance', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const openEditDialog = (amb: AmbulanceItem) => {
    setEditAmbData(amb)
    setEditAmb({
      vehicleNumber: amb.vehicleNumber,
      driverName: amb.driverName,
      driverPhone: amb.driverPhone,
      driverLicense: amb.driverLicense || '',
      type: amb.type,
      status: amb.status,
      equipment: amb.equipment || '',
      hospitalBranch: amb.hospitalBranch || '',
    })
    setShowEditAmbulance(true)
  }

  const handleEditAmbulance = async () => {
    if (!editAmbData) return
    setActionLoading(true)
    try {
      await apiPut(`/ambulance/${editAmbData.id}`, {
        vehicleNumber: editAmb.vehicleNumber,
        driverName: editAmb.driverName,
        driverPhone: editAmb.driverPhone,
        driverLicense: editAmb.driverLicense || undefined,
        type: editAmb.type,
        status: editAmb.status,
        equipment: editAmb.equipment || undefined,
        hospitalBranch: editAmb.hospitalBranch || undefined,
      })
      toast({ title: 'Ambulance updated', description: `${editAmb.vehicleNumber} updated.` })
      setShowEditAmbulance(false)
      setEditAmbData(null)
      fetchAmbulances()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to update ambulance', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteAmbulance = async () => {
    if (!deleteAmbId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/ambulance/${deleteAmbId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to delete' }))
        throw new Error(err.error || 'Failed to delete')
      }
      toast({ title: 'Ambulance removed' })
      setShowDeleteAmbulance(false)
      setDeleteAmbId('')
      fetchAmbulances()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to delete ambulance', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateDispatch = async () => {
    if (!newDispatch.ambulanceId || !newDispatch.pickupAddress.trim()) return
    setActionLoading(true)
    try {
      await apiPost('/ambulance/dispatch', {
        ambulanceId: newDispatch.ambulanceId,
        pickupAddress: newDispatch.pickupAddress.trim(),
        destination: newDispatch.destination.trim() || undefined,
        dispatchType: newDispatch.dispatchType,
        notes: newDispatch.notes.trim() || undefined,
      })
      toast({ title: 'Dispatch created', description: 'Ambulance has been dispatched.' })
      setShowCreateDispatch(false)
      setNewDispatch({ ambulanceId: '', patientName: '', patientPhone: '', pickupAddress: '', destination: '', dispatchType: 'Emergency', notes: '' })
      fetchDispatches()
      fetchAmbulances()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to create dispatch', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdvanceStatus = async (dispatch: DispatchItem) => {
    const currentIdx = DISPATCH_STEPS.indexOf(dispatch.status)
    if (currentIdx < 0 || currentIdx >= DISPATCH_STEPS.length - 1) return
    const nextStatus = DISPATCH_STEPS[currentIdx + 1]
    setActionLoading(true)
    try {
      await apiPut(`/ambulance/dispatch/${dispatch.id}`, { status: nextStatus })
      toast({ title: 'Status updated', description: `Dispatch is now "${nextStatus}".` })
      fetchDispatches()
      fetchAmbulances()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to update dispatch', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelDispatch = async (dispatch: DispatchItem) => {
    if (dispatch.status === 'Completed' || dispatch.status === 'Cancelled') return
    setActionLoading(true)
    try {
      await apiPut(`/ambulance/dispatch/${dispatch.id}`, { status: 'Cancelled' })
      toast({ title: 'Dispatch cancelled' })
      fetchDispatches()
      fetchAmbulances()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to cancel dispatch', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const openTimeline = (dispatch: DispatchItem) => {
    setSelectedDispatch(dispatch)
    setShowTimeline(true)
  }

  const availableAmbulances = ambulances.filter((a) => a.status === 'Available')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ambulance Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage ambulance fleet and dispatch operations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchAmbulances(); fetchDispatches() }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900/40">
                <Truck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ambulances.length}</p>
                <p className="text-xs text-muted-foreground">Total Ambulances</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{ambulances.filter((a) => a.status === 'Available').length}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <Ambulance className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{ambulances.filter((a) => a.status === 'On-Duty').length}</p>
                <p className="text-xs text-muted-foreground">On Duty</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dispatches.length}</p>
                <p className="text-xs text-muted-foreground">Total Dispatches</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="ambulances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ambulances" className="flex items-center gap-2">
            <Truck className="h-4 w-4" /> Ambulances
          </TabsTrigger>
          <TabsTrigger value="dispatches" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Dispatches
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════ AMBULANCES TAB ═══════════════ */}
        <TabsContent value="ambulances" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterAmbStatus} onValueChange={(v) => setFilterAmbStatus(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="On-Duty">On-Duty</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Out-of-Service">Out-of-Service</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => setShowAddAmbulance(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Ambulance
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ambulance Fleet ({ambulances.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAmb ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : ambulances.length === 0 ? (
                <div className="p-8 text-center">
                  <Truck className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No ambulances registered yet.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Vehicle</TableHead>
                        <TableHead className="text-xs">Driver</TableHead>
                        <TableHead className="text-xs">Contact</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Branch</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ambulances.map((amb) => (
                        <TableRow key={amb.id}>
                          <TableCell className="text-xs font-mono font-semibold">{amb.vehicleNumber}</TableCell>
                          <TableCell className="text-xs">
                            <div>
                              <p className="font-medium">{amb.driverName}</p>
                              <p className="text-muted-foreground">{amb.ambulanceId}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              {amb.driverPhone}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${AMBULANCE_TYPE_COLORS[amb.type] || ''}`}>
                              {amb.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${AMBULANCE_STATUS_COLORS[amb.status] || ''}`}>
                              {amb.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {amb.hospitalBranch || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(amb)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => { setDeleteAmbId(amb.id); setShowDeleteAmbulance(true) }}
                                title="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════ DISPATCHES TAB ═══════════════ */}
        <TabsContent value="dispatches" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterDispStatus} onValueChange={(v) => setFilterDispStatus(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Dispatched">Dispatched</SelectItem>
                  <SelectItem value="Arrived">Arrived</SelectItem>
                  <SelectItem value="Patient-Aboard">Patient-Aboard</SelectItem>
                  <SelectItem value="At-Destination">At-Destination</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterDispType} onValueChange={(v) => setFilterDispType(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[150px] h-9 text-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Discharge">Discharge</SelectItem>
                  <SelectItem value="Event">Event</SelectItem>
                </SelectContent>
              </Select>
              {(filterDispStatus || filterDispType) && (
                <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setFilterDispStatus(''); setFilterDispType('') }}>
                  Clear
                </Button>
              )}
            </div>
            <Button size="sm" onClick={() => setShowCreateDispatch(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Dispatch
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dispatch Records ({dispatches.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingDisp ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : dispatches.length === 0 ? (
                <div className="p-8 text-center">
                  <MapPin className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No dispatches recorded yet.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Dispatch ID</TableHead>
                        <TableHead className="text-xs">Vehicle</TableHead>
                        <TableHead className="text-xs">Driver</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Pickup</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Payment</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dispatches.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs font-mono">{d.dispatchId}</TableCell>
                          <TableCell className="text-xs">
                            <p className="font-medium">{d.ambulance.vehicleNumber}</p>
                          </TableCell>
                          <TableCell className="text-xs">{d.ambulance.driverName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {d.dispatchType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">
                            {d.pickupAddress || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${DISPATCH_STATUS_COLORS[d.status] || ''}`}>
                              {d.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${PAYMENT_STATUS_COLORS[d.paymentStatus] || ''}`}>
                              {d.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openTimeline(d)}
                                title="View Timeline"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                              {d.status !== 'Completed' && d.status !== 'Cancelled' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-emerald-600 hover:text-emerald-700"
                                    onClick={() => handleAdvanceStatus(d)}
                                    title={`Advance to next stage`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    {DISPATCH_STEPS[DISPATCH_STEPS.indexOf(d.status) + 1] && `→ ${DISPATCH_STEPS[DISPATCH_STEPS.indexOf(d.status) + 1]}`}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700"
                                    onClick={() => handleCancelDispatch(d)}
                                    title="Cancel"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════ ADD AMBULANCE DIALOG ═══════ */}
      <Dialog open={showAddAmbulance} onOpenChange={setShowAddAmbulance}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Ambulance</DialogTitle>
            <DialogDescription>Register a new ambulance vehicle</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="amb-vehicle">Vehicle Number *</Label>
              <Input id="amb-vehicle" placeholder="e.g., MH-01-AB-1234" value={newAmb.vehicleNumber} onChange={(e) => setNewAmb({ ...newAmb, vehicleNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amb-driver">Driver Name *</Label>
                <Input id="amb-driver" placeholder="Driver name" value={newAmb.driverName} onChange={(e) => setNewAmb({ ...newAmb, driverName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amb-phone">Driver Phone *</Label>
                <Input id="amb-phone" placeholder="Phone number" value={newAmb.driverPhone} onChange={(e) => setNewAmb({ ...newAmb, driverPhone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amb-license">Driver License</Label>
              <Input id="amb-license" placeholder="License number" value={newAmb.driverLicense} onChange={(e) => setNewAmb({ ...newAmb, driverLicense: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newAmb.type} onValueChange={(v) => setNewAmb({ ...newAmb, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                    <SelectItem value="ICU">ICU</SelectItem>
                    <SelectItem value="Mortuary">Mortuary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amb-branch">Hospital Branch</Label>
                <Input id="amb-branch" placeholder="Base location" value={newAmb.hospitalBranch} onChange={(e) => setNewAmb({ ...newAmb, hospitalBranch: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amb-equipment">Equipment (JSON)</Label>
              <Input id="amb-equipment" placeholder='e.g., ["Stretcher","O2","Defibrillator"]' value={newAmb.equipment} onChange={(e) => setNewAmb({ ...newAmb, equipment: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAmbulance(false)}>Cancel</Button>
            <Button onClick={handleCreateAmbulance} disabled={!newAmb.vehicleNumber.trim() || !newAmb.driverName.trim() || !newAmb.driverPhone.trim() || actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Ambulance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ EDIT AMBULANCE DIALOG ═══════ */}
      <Dialog open={showEditAmbulance} onOpenChange={setShowEditAmbulance}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Ambulance</DialogTitle>
            <DialogDescription>Update ambulance details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-vehicle">Vehicle Number *</Label>
              <Input id="edit-vehicle" value={editAmb.vehicleNumber} onChange={(e) => setEditAmb({ ...editAmb, vehicleNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-driver">Driver Name *</Label>
                <Input id="edit-driver" value={editAmb.driverName} onChange={(e) => setEditAmb({ ...editAmb, driverName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Driver Phone *</Label>
                <Input id="edit-phone" value={editAmb.driverPhone} onChange={(e) => setEditAmb({ ...editAmb, driverPhone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-license">Driver License</Label>
              <Input id="edit-license" value={editAmb.driverLicense} onChange={(e) => setEditAmb({ ...editAmb, driverLicense: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={editAmb.type} onValueChange={(v) => setEditAmb({ ...editAmb, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Basic">Basic</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                    <SelectItem value="ICU">ICU</SelectItem>
                    <SelectItem value="Mortuary">Mortuary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editAmb.status} onValueChange={(v) => setEditAmb({ ...editAmb, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="On-Duty">On-Duty</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Out-of-Service">Out-of-Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAmbulance(false)}>Cancel</Button>
            <Button onClick={handleEditAmbulance} disabled={!editAmb.vehicleNumber.trim() || !editAmb.driverName.trim() || !editAmb.driverPhone.trim() || actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ DELETE AMBULANCE CONFIRMATION ═══════ */}
      <AlertDialog open={showDeleteAmbulance} onOpenChange={setShowDeleteAmbulance}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Ambulance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this ambulance? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAmbulance} disabled={actionLoading} className="bg-red-600 hover:bg-red-700">
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════ CREATE DISPATCH DIALOG ═══════ */}
      <Dialog open={showCreateDispatch} onOpenChange={setShowCreateDispatch}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Dispatch</DialogTitle>
            <DialogDescription>Dispatch an ambulance to a location</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Ambulance *</Label>
              <Select value={newDispatch.ambulanceId} onValueChange={(v) => setNewDispatch({ ...newDispatch, ambulanceId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={availableAmbulances.length === 0 ? 'No available ambulances' : 'Select ambulance'} />
                </SelectTrigger>
                <SelectContent>
                  {availableAmbulances.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.vehicleNumber} — {a.driverName} ({a.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableAmbulances.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">No ambulances currently available.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Dispatch Type</Label>
              <Select value={newDispatch.dispatchType} onValueChange={(v) => setNewDispatch({ ...newDispatch, dispatchType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                  <SelectItem value="Discharge">Discharge</SelectItem>
                  <SelectItem value="Event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disp-pickup">Pickup Address *</Label>
              <Textarea id="disp-pickup" placeholder="Enter pickup location" value={newDispatch.pickupAddress} onChange={(e) => setNewDispatch({ ...newDispatch, pickupAddress: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disp-dest">Destination</Label>
              <Input id="disp-dest" placeholder="Hospital or destination" value={newDispatch.destination} onChange={(e) => setNewDispatch({ ...newDispatch, destination: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disp-notes">Notes</Label>
              <Textarea id="disp-notes" placeholder="Additional instructions" value={newDispatch.notes} onChange={(e) => setNewDispatch({ ...newDispatch, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDispatch(false)}>Cancel</Button>
            <Button onClick={handleCreateDispatch} disabled={!newDispatch.ambulanceId || !newDispatch.pickupAddress.trim() || actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ TIMELINE DIALOG ═══════ */}
      <Dialog open={showTimeline} onOpenChange={setShowTimeline}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Dispatch Timeline</DialogTitle>
            <DialogDescription>
              {selectedDispatch && `${selectedDispatch.dispatchId} — ${selectedDispatch.ambulance.vehicleNumber}`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedDispatch && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Vehicle:</span>
                    <p className="font-medium">{selectedDispatch.ambulance.vehicleNumber}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Driver:</span>
                    <p className="font-medium">{selectedDispatch.ambulance.driverName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Type:</span>
                    <p className="font-medium">{selectedDispatch.dispatchType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payment:</span>
                    <Badge variant="secondary" className={`text-[10px] ${PAYMENT_STATUS_COLORS[selectedDispatch.paymentStatus] || ''}`}>
                      {selectedDispatch.paymentStatus}
                    </Badge>
                  </div>
                  {selectedDispatch.fare > 0 && (
                    <div>
                      <span className="text-muted-foreground">Fare:</span>
                      <p className="font-medium">₹{selectedDispatch.fare}</p>
                    </div>
                  )}
                </div>

                {selectedDispatch.pickupAddress && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <span className="text-muted-foreground text-xs">Pickup:</span>
                      <p>{selectedDispatch.pickupAddress}</p>
                    </div>
                  </div>
                )}
                {selectedDispatch.destination && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div>
                      <span className="text-muted-foreground text-xs">Destination:</span>
                      <p>{selectedDispatch.destination}</p>
                    </div>
                  </div>
                )}
                {selectedDispatch.notes && (
                  <p className="text-sm text-muted-foreground italic">{selectedDispatch.notes}</p>
                )}

                <div className="relative mt-4">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-5">
                    {DISPATCH_STEPS.map((step) => {
                      const timeMap: Record<string, string | null> = {
                        Dispatched: selectedDispatch.dispatchedAt,
                        Arrived: selectedDispatch.arrivedAt,
                        'Patient-Aboard': selectedDispatch.patientAboardAt,
                        'At-Destination': selectedDispatch.destinationAt,
                        Completed: selectedDispatch.completedAt,
                      }
                      const isReached = selectedDispatch.status === 'Cancelled'
                        ? step === 'Dispatched'
                        : DISPATCH_STEPS.indexOf(selectedDispatch.status) >= DISPATCH_STEPS.indexOf(step)
                      const isCancelled = step === 'Completed' && selectedDispatch.status === 'Cancelled'
                      const ts = timeMap[step]

                      return (
                        <div key={step} className="flex items-start gap-4 ml-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 z-10 ${
                            isReached && !isCancelled
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                              : isCancelled
                                ? 'border-red-300 bg-red-50 dark:bg-red-950'
                                : 'border-muted bg-background'
                          }`}>
                            {isReached && !isCancelled ? (
                              <CheckCircle className="h-4 w-4 text-emerald-600" />
                            ) : isCancelled ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">○</span>
                            )}
                          </div>
                          <div className="pt-1">
                            <p className={`text-sm font-medium ${isReached && !isCancelled ? 'text-emerald-700 dark:text-emerald-300' : isCancelled ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>
                              {step}
                            </p>
                            {ts && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {selectedDispatch.status === 'Cancelled' && (
                      <div className="flex items-start gap-4 ml-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-red-500 bg-red-50 dark:bg-red-950 z-10">
                          <span className="text-xs font-bold text-red-600">✕</span>
                        </div>
                        <div className="pt-1">
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">Cancelled</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeline(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
