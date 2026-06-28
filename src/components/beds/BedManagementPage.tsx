'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
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
  BedDouble,
  Building2,
  Edit,
  UserPlus,
  UserMinus,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search as SearchIcon,
  Filter,
} from 'lucide-react'

// ==================== TYPES ====================

interface WardSummary {
  id: string
  wardId: string
  name: string
  floor: number
  status: string
  createdAt: string
  updatedAt: string
  _count: {
    total: number
    available: number
    occupied: number
    maintenance: number
    reserved: number
  }
}

interface BedItem {
  id: string
  bedId: string
  wardId: string
  bedNumber: string
  bedType: string
  dailyRate: number
  status: string
  currentPatientId: string | null
  currentVisitId: string | null
  admittedAt: string | null
  createdAt: string
  updatedAt: string
  ward: { id: string; wardId: string; name: string; floor: number }
  currentPatient: { id: string; patientId: string; name: string; phone: string } | null
  currentVisit: { id: string; visitId: string; visitType: string; stage: string } | null
}

interface PatientOption {
  id: string
  patientId: string
  name: string
  phone: string
}

interface VisitOption {
  id: string
  visitId: string
  visitType: string
  stage: string
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  Available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Occupied: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Reserved: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
}

const BED_TYPE_COLORS: Record<string, string> = {
  Standard: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  Deluxe: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  Suite: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'ICU Bed': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Emergency: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
}

// ==================== COMPONENT ====================

export function BedManagementPage() {
  const { toast } = useToast()

  // Data state
  const [wards, setWards] = useState<WardSummary[]>([])
  const [beds, setBeds] = useState<BedItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterWardId, setFilterWardId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterFloor, setFilterFloor] = useState<string>('')

  // Dialogs
  const [showAddWard, setShowAddWard] = useState(false)
  const [showAddBed, setShowAddBed] = useState(false)
  const [showAllocate, setShowAllocate] = useState(false)
  const [showRelease, setShowRelease] = useState(false)
  const [showEditBed, setShowEditBed] = useState(false)
  const [showDeleteWard, setShowDeleteWard] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Form state - Add Ward
  const [newWard, setNewWard] = useState({ name: '', floor: 1 })

  // Form state - Add Bed
  const [newBed, setNewBed] = useState({ wardId: '', bedNumber: '', bedType: 'Standard', dailyRate: 0 })

  // Edit bed
  const [editBedData, setEditBedData] = useState<BedItem | null>(null)
  const [editForm, setEditForm] = useState({ bedNumber: '', bedType: 'Standard', dailyRate: 0 })

  // Allocate
  const [allocateBedId, setAllocateBedId] = useState<string>('')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null)
  const [patientVisits, setPatientVisits] = useState<VisitOption[]>([])
  const [selectedVisitId, setSelectedVisitId] = useState<string>('')
  const [patientSearchLoading, setPatientSearchLoading] = useState(false)

  // Release
  const [releaseBed, setReleaseBed] = useState<BedItem | null>(null)

  // Delete ward
  const [deleteWardId, setDeleteWardId] = useState<string>('')

  // Fetch wards
  const fetchWards = useCallback(async () => {
    try {
      const res = await apiGet<{ data: WardSummary[] }>('/beds/wards')
      setWards(res.data)
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast({ title: 'Error', description: 'Failed to fetch wards', variant: 'destructive' })
      }
    }
  }, [toast])

  // Fetch beds
  const fetchBeds = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterWardId) params.wardId = filterWardId
      if (filterStatus) params.status = filterStatus
      if (filterFloor) params.floor = filterFloor
      const res = await apiGet<{ data: BedItem[] }>('/beds', params)
      setBeds(res.data)
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast({ title: 'Error', description: 'Failed to fetch beds', variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }, [filterWardId, filterStatus, filterFloor, toast])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWards()
  }, [fetchWards])

    
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBeds()
  }, [fetchBeds])

  // Patient search for allocation
  const searchPatients = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setPatientResults([])
      return
    }
    setPatientSearchLoading(true)
    try {
      const res = await apiGet<{ data: PatientOption[] }>('/patients', { search: query, limit: 10 })
      setPatientResults(res.data || [])
    } catch {
      setPatientResults([])
    } finally {
      setPatientSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(patientSearch), 400)
    return () => clearTimeout(timer)
  }, [patientSearch, searchPatients])

  // Fetch patient's active IPD visits
  const fetchPatientVisits = useCallback(async (patientId: string) => {
    try {
      const res = await apiGet<{ data: VisitOption[] }>('/patient-visits', {
        patientId,
        status: 'Active',
        visitType: 'IPD',
        limit: 50,
      })
      setPatientVisits(res.data || [])
      if (res.data && res.data.length > 0) {
        setSelectedVisitId(res.data[0].id)
      } else {
        setSelectedVisitId('')
      }
    } catch {
      setPatientVisits([])
      setSelectedVisitId('')
    }
  }, [])

  const handleSelectPatient = (patient: PatientOption) => {
    setSelectedPatient(patient)
    setPatientSearch('')
    setPatientResults([])
    fetchPatientVisits(patient.id)
  }

  // ── Actions ──────────────────────────────────────────────────

  const handleCreateWard = async () => {
    if (!newWard.name.trim()) return
    setActionLoading(true)
    try {
      await apiPost('/beds/wards', newWard)
      toast({ title: 'Ward created', description: `${newWard.name} ward has been added.` })
      setShowAddWard(false)
      setNewWard({ name: '', floor: 1 })
      fetchWards()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to create ward', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateBed = async () => {
    if (!newBed.wardId || !newBed.bedNumber.trim()) return
    setActionLoading(true)
    try {
      await apiPost('/beds', {
        wardId: newBed.wardId,
        bedNumber: newBed.bedNumber.trim(),
        bedType: newBed.bedType,
        dailyRate: newBed.dailyRate,
      })
      toast({ title: 'Bed created', description: `Bed ${newBed.bedNumber} has been added.` })
      setShowAddBed(false)
      setNewBed({ wardId: '', bedNumber: '', bedType: 'Standard', dailyRate: 0 })
      fetchBeds()
      fetchWards()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to create bed', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAllocate = async () => {
    if (!allocateBedId || !selectedPatient || !selectedVisitId) return
    setActionLoading(true)
    try {
      await apiPost('/beds/allocate', {
        patientId: selectedPatient.id,
        visitId: selectedVisitId,
        bedId: allocateBedId,
      })
      toast({ title: 'Bed allocated', description: `${selectedPatient.name} allocated to bed.` })
      setShowAllocate(false)
      setSelectedPatient(null)
      setSelectedVisitId('')
      setPatientVisits([])
      fetchBeds()
      fetchWards()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to allocate bed', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRelease = async () => {
    if (!releaseBed) return
    setActionLoading(true)
    try {
      const res = await apiPost<{ data: BedItem & { _releaseInfo?: { bedDays: number; totalAmount: number; dailyRate: number } } }>('/beds/release', { bedId: releaseBed.id })
      const info = res.data._releaseInfo
      toast({
        title: 'Bed released',
        description: info
          ? `${releaseBed.bedNumber} released. ${info.bedDays} day(s) × ₹${info.dailyRate} = ₹${info.totalAmount}`
          : `${releaseBed.bedNumber} has been released.`,
      })
      setShowRelease(false)
      setReleaseBed(null)
      fetchBeds()
      fetchWards()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to release bed', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditBed = async () => {
    if (!editBedData) return
    setActionLoading(true)
    try {
      await apiPut(`/beds/${editBedData.id}`, {
        bedNumber: editForm.bedNumber,
        bedType: editForm.bedType,
        dailyRate: editForm.dailyRate,
      })
      toast({ title: 'Bed updated', description: `Bed ${editForm.bedNumber} updated.` })
      setShowEditBed(false)
      setEditBedData(null)
      fetchBeds()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to update bed', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleMaintenance = async (bed: BedItem) => {
    setActionLoading(true)
    try {
      const newStatus = bed.status === 'Maintenance' ? 'Available' : 'Maintenance'
      await apiPut(`/beds/${bed.id}`, { status: newStatus })
      toast({
        title: newStatus === 'Maintenance' ? 'Bed under maintenance' : 'Bed available',
        description: `Bed ${bed.bedNumber} is now ${newStatus}.`,
      })
      fetchBeds()
      fetchWards()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to update bed status', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteWard = async () => {
    if (!deleteWardId) return
    setActionLoading(true)
    try {
      await apiDelete(`/beds/wards/${deleteWardId}`)
      toast({ title: 'Ward deleted', description: 'Ward has been removed.' })
      setShowDeleteWard(false)
      setDeleteWardId('')
      fetchWards()
      fetchBeds()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to delete ward', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const openEditDialog = (bed: BedItem) => {
    setEditBedData(bed)
    setEditForm({ bedNumber: bed.bedNumber, bedType: bed.bedType, dailyRate: bed.dailyRate })
    setShowEditBed(true)
  }

  const openAllocateDialog = (bed: BedItem) => {
    setAllocateBedId(bed.id)
    setSelectedPatient(null)
    setSelectedVisitId('')
    setPatientVisits([])
    setPatientSearch('')
    setShowAllocate(true)
  }

  const openReleaseDialog = (bed: BedItem) => {
    setReleaseBed(bed)
    setShowRelease(true)
  }

  // Computed
  const totalBeds = wards.reduce((sum, w) => sum + w._count.total, 0)
  const totalAvailable = wards.reduce((sum, w) => sum + w._count.available, 0)
  const totalOccupied = wards.reduce((sum, w) => sum + w._count.occupied, 0)
  const floors = [...new Set(wards.map((w) => w.floor))].sort()

  // ── RENDER ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bed Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage hospital wards, beds, and patient allocation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchWards(); fetchBeds() }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAddWard(true)}>
            <Building2 className="mr-2 h-4 w-4" /> Add Ward
          </Button>
          <Button size="sm" onClick={() => setShowAddBed(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Bed
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900/40">
                <BedDouble className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalBeds}</p>
                <p className="text-xs text-muted-foreground">Total Beds</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{totalAvailable}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{totalOccupied}</p>
                <p className="text-xs text-muted-foreground">Occupied</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{wards.length}</p>
                <p className="text-xs text-muted-foreground">Wards</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ward Overview Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Ward Overview</h2>
        {wards.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No wards created yet. Add your first ward to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {wards.map((ward) => {
              const pct = ward._count.total > 0 ? (ward._count.occupied / ward._count.total) * 100 : 0
              return (
                <Card key={ward.id} className="relative">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">{ward.name}</CardTitle>
                        <CardDescription className="text-xs">
                          Floor {ward.floor} · {ward.wardId}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className={STATUS_COLORS[ward.status] || ''}>
                        {ward.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{ward._count.total}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-emerald-600">{ward._count.available}</p>
                        <p className="text-[10px] text-muted-foreground">Available</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">{ward._count.occupied}</p>
                        <p className="text-[10px] text-muted-foreground">Occupied</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Occupancy</span>
                        <span>{Math.round(pct)}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => { setFilterWardId(ward.id); }}
                    >
                      View Beds
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters:
            </div>
            <Select value={filterWardId} onValueChange={(v) => setFilterWardId(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                <SelectValue placeholder="All Wards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Wards</SelectItem>
                {wards.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name} (F{w.floor})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[160px] h-9 text-sm">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Occupied">Occupied</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Reserved">Reserved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterFloor} onValueChange={(v) => setFilterFloor(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[130px] h-9 text-sm">
                <SelectValue placeholder="All Floors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                {floors.map((f) => (
                  <SelectItem key={f} value={String(f)}>Floor {f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterWardId || filterStatus || filterFloor) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => { setFilterWardId(''); setFilterStatus(''); setFilterFloor('') }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Beds Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Beds ({beds.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : beds.length === 0 ? (
            <div className="p-8 text-center">
              <BedDouble className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No beds found. Add beds to wards to get started.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Bed ID</TableHead>
                    <TableHead className="text-xs">Ward</TableHead>
                    <TableHead className="text-xs">Bed No.</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Daily Rate</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Patient</TableHead>
                    <TableHead className="text-xs">Admitted</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {beds.map((bed) => (
                    <TableRow key={bed.id}>
                      <TableCell className="text-xs font-mono">{bed.bedId}</TableCell>
                      <TableCell className="text-xs">
                        <div>
                          <p className="font-medium">{bed.ward.name}</p>
                          <p className="text-muted-foreground">F{bed.ward.floor}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">{bed.bedNumber}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] ${BED_TYPE_COLORS[bed.bedType] || ''}`}>
                          {bed.bedType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {bed.dailyRate > 0 ? formatCurrency(bed.dailyRate) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[bed.status] || ''}`}>
                          {bed.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {bed.currentPatient ? (
                          <div>
                            <p className="font-medium">{bed.currentPatient.name}</p>
                            <p className="text-muted-foreground">{bed.currentPatient.patientId}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {bed.admittedAt
                          ? new Date(bed.admittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {bed.status === 'Available' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              onClick={() => openAllocateDialog(bed)}
                              title="Allocate"
                            >
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}
                          {bed.status === 'Occupied' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                              onClick={() => openReleaseDialog(bed)}
                              title="Release"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                          {(bed.status === 'Available' || bed.status === 'Maintenance') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                              onClick={() => handleToggleMaintenance(bed)}
                              title={bed.status === 'Maintenance' ? 'Mark Available' : 'Set Maintenance'}
                            >
                              <Wrench className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(bed)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
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

      {/* ═══════ DIALOGS ═══════ */}

      {/* Add Ward Dialog */}
      <Dialog open={showAddWard} onOpenChange={setShowAddWard}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Ward</DialogTitle>
            <DialogDescription>Create a new hospital ward</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ward-name">Ward Name *</Label>
              <Input
                id="ward-name"
                placeholder="e.g., General, ICU, Private..."
                value={newWard.name}
                onChange={(e) => setNewWard({ ...newWard, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ward-floor">Floor</Label>
              <Input
                id="ward-floor"
                type="number"
                min={0}
                max={100}
                value={newWard.floor}
                onChange={(e) => setNewWard({ ...newWard, floor: parseInt(e.target.value, 10) || 1 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWard(false)}>Cancel</Button>
            <Button onClick={handleCreateWard} disabled={!newWard.name.trim() || actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Ward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Bed Dialog */}
      <Dialog open={showAddBed} onOpenChange={setShowAddBed}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bed</DialogTitle>
            <DialogDescription>Add a new bed to a ward</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Ward *</Label>
              <Select value={newBed.wardId} onValueChange={(v) => setNewBed({ ...newBed, wardId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {wards.filter((w) => w.status === 'Active').map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name} (Floor {w.floor})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bed-number">Bed Number *</Label>
              <Input
                id="bed-number"
                placeholder="e.g., 101, 102-A"
                value={newBed.bedNumber}
                onChange={(e) => setNewBed({ ...newBed, bedNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bed Type</Label>
              <Select value={newBed.bedType} onValueChange={(v) => setNewBed({ ...newBed, bedType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Deluxe">Deluxe</SelectItem>
                  <SelectItem value="Suite">Suite</SelectItem>
                  <SelectItem value="ICU Bed">ICU Bed</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="daily-rate">Daily Rate (₹)</Label>
              <Input
                id="daily-rate"
                type="number"
                min={0}
                step={100}
                placeholder="0"
                value={newBed.dailyRate || ''}
                onChange={(e) => setNewBed({ ...newBed, dailyRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBed(false)}>Cancel</Button>
            <Button onClick={handleCreateBed} disabled={!newBed.wardId || !newBed.bedNumber.trim() || actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Bed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Bed Dialog */}
      <Dialog open={showAllocate} onOpenChange={setShowAllocate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Bed</DialogTitle>
            <DialogDescription>Assign a patient to an available bed</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Patient Search */}
            <div className="space-y-2">
              <Label>Search Patient *</Label>
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Type patient name or ID..."
                  value={selectedPatient ? `${selectedPatient.name} (${selectedPatient.patientId})` : patientSearch}
                  onChange={(e) => {
                    if (selectedPatient) {
                      setSelectedPatient(null)
                      setPatientVisits([])
                    }
                    setPatientSearch(e.target.value)
                  }}
                  disabled={!!selectedPatient}
                />
                {patientSearchLoading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {/* Patient results dropdown */}
              {patientResults.length > 0 && !selectedPatient && (
                <div className="border rounded-md max-h-40 overflow-y-auto mt-1">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b last:border-0"
                      onClick={() => handleSelectPatient(p)}
                    >
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.patientId} · {p.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Visit Selection */}
            {selectedPatient && (
              <div className="space-y-2">
                <Label>Select IPD Visit *</Label>
                {patientVisits.length === 0 ? (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    No active IPD visits found for this patient.
                  </p>
                ) : (
                  <Select value={selectedVisitId} onValueChange={setSelectedVisitId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visit" />
                    </SelectTrigger>
                    <SelectContent>
                      {patientVisits.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.visitId} — {v.visitType} · Stage: {v.stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllocate(false)}>Cancel</Button>
            <Button
              onClick={handleAllocate}
              disabled={!selectedPatient || !selectedVisitId || actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Allocate Bed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Confirmation */}
      <AlertDialog open={showRelease} onOpenChange={setShowRelease}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release Bed</AlertDialogTitle>
            <AlertDialogDescription>
              {releaseBed && (
                <span>
                  Are you sure you want to release bed <strong>{releaseBed.bedNumber}</strong> ({releaseBed.bedId})?
                  {releaseBed.currentPatient && (
                    <span>
                      {' '}Patient <strong>{releaseBed.currentPatient.name}</strong> will be unassigned.
                    </span>
                  )}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRelease}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Release Bed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Bed Dialog */}
      <Dialog open={showEditBed} onOpenChange={setShowEditBed}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bed</DialogTitle>
            <DialogDescription>Update bed details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-bed-number">Bed Number *</Label>
              <Input
                id="edit-bed-number"
                value={editForm.bedNumber}
                onChange={(e) => setEditForm({ ...editForm, bedNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bed Type</Label>
              <Select value={editForm.bedType} onValueChange={(v) => setEditForm({ ...editForm, bedType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="Deluxe">Deluxe</SelectItem>
                  <SelectItem value="Suite">Suite</SelectItem>
                  <SelectItem value="ICU Bed">ICU Bed</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-daily-rate">Daily Rate (₹)</Label>
              <Input
                id="edit-daily-rate"
                type="number"
                min={0}
                step={100}
                value={editForm.dailyRate || ''}
                onChange={(e) => setEditForm({ ...editForm, dailyRate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBed(false)}>Cancel</Button>
            <Button onClick={handleEditBed} disabled={!editForm.bedNumber.trim() || actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Ward Confirmation */}
      <AlertDialog open={showDeleteWard} onOpenChange={setShowDeleteWard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ward</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ward? All non-occupied beds in this ward will also be deleted.
              If any beds are occupied, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWard}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Ward
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}