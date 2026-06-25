'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { apiGet, apiPost, apiPut, apiDelete, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useNavigation } from '@/stores/navigation'
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
  Tent,
  Users,
  Stethoscope,
  HeartPulse,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Trash2,
  Upload,
  Download,
  Activity,
  Thermometer,
  Droplets,
  Syringe,
} from 'lucide-react'

type CampStatus = 'Planned' | 'In-Progress' | 'Completed' | 'Cancelled'
type CampType = 'General' | 'Eye' | 'Dental' | 'Cardiac' | 'Diabetes' | 'Multi-Specialty'
type ScreeningResult = 'Normal' | 'Abnormal' | 'Referred' | 'Emergency'

interface Camp {
  id: string
  campId: string
  name: string
  description: string | null
  campDate: string
  startTime: string | null
  endTime: string | null
  location: string | null
  address: string | null
  city: string | null
  state: string | null
  organizer: string | null
  contactPerson: string | null
  contactPhone: string | null
  campType: CampType
  expectedCount: number
  actualCount: number
  status: CampStatus
  createdAt: string
  updatedAt: string
}

interface CampRegistration {
  id: string
  regId: string
  campId: string
  patientId: string | null
  patientName: string
  age: number | null
  gender: string | null
  phone: string | null
  address: string | null
  bpSystolic: number | null
  bpDiastolic: number | null
  pulse: number | null
  temperature: number | null
  spO2: number | null
  bloodSugar: number | null
  weight: number | null
  height: number | null
  screeningResult: ScreeningResult
  referredTo: string | null
  findings: string | null
  medicinesGiven: string | null
  followUpNeeded: boolean
  createdAt: string
}

const CAMP_STATUS_CONFIG: Record<CampStatus, { className: string; icon: React.ElementType }> = {
  Planned: { className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800', icon: Calendar },
  'In-Progress': { className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800', icon: Activity },
  Completed: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', icon: CheckCircle2 },
  Cancelled: { className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800', icon: XCircle },
}

const SCREENING_CONFIG: Record<ScreeningResult, string> = {
  Normal: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  Abnormal: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  Referred: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  Emergency: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
}

const CAMP_TYPES: CampType[] = ['General', 'Eye', 'Dental', 'Cardiac', 'Diabetes', 'Multi-Specialty']

function CampStatusBadge({ status }: { status: CampStatus }) {
  const { className, icon: Icon } = CAMP_STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

function ScreeningBadge({ result }: { result: ScreeningResult }) {
  return (
    <Badge variant="outline" className={SCREENING_CONFIG[result]}>
      {result}
    </Badge>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function CampManagementPage() {
  const { toast } = useToast()
  const { setCurrentPage } = useNavigation()

  const [activeTab, setActiveTab] = useState('camps')
  const [camps, setCamps] = useState<Camp[]>([])
  const [campsLoading, setCampsLoading] = useState(true)
  const [campsError, setCampsError] = useState<string | null>(null)
  const [campsPage, setCampsPage] = useState(1)
  const [campsTotal, setCampsTotal] = useState(0)
  const [campsTotalPages, setCampsTotalPages] = useState(1)
  const limit = 20

  const [selectedCamp, setSelectedCamp] = useState<Camp | null>(null)
  const [campDialogOpen, setCampDialogOpen] = useState(false)
  const [editingCamp, setEditingCamp] = useState<Camp | null>(null)
  const [campSubmitting, setCampSubmitting] = useState(false)

  const [registrations, setRegistrations] = useState<CampRegistration[]>([])
  const [regLoading, setRegLoading] = useState(false)
  const [regPage, setRegPage] = useState(1)
  const [regTotal, setRegTotal] = useState(0)
  const [regTotalPages, setRegTotalPages] = useState(1)

  const [regDialogOpen, setRegDialogOpen] = useState(false)
  const [regSubmitting, setRegSubmitting] = useState(false)

  const [campName, setCampName] = useState('')
  const [campDescription, setCampDescription] = useState('')
  const [campDate, setCampDate] = useState(new Date().toISOString().split('T')[0])
  const [campStartTime, setCampStartTime] = useState('')
  const [campEndTime, setCampEndTime] = useState('')
  const [campLocation, setCampLocation] = useState('')
  const [campAddress, setCampAddress] = useState('')
  const [campCity, setCampCity] = useState('')
  const [campState, setCampState] = useState('')
  const [campOrganizer, setCampOrganizer] = useState('')
  const [campContactPerson, setCampContactPerson] = useState('')
  const [campContactPhone, setCampContactPhone] = useState('')
  const [campType, setCampType] = useState<CampType>('General')
  const [campExpectedCount, setCampExpectedCount] = useState('')

  const [regPatientMode, setRegPatientMode] = useState<'new' | 'existing'>('new')
  const [regPatientSearch, setRegPatientSearch] = useState('')
  const [regPatientResults, setRegPatientResults] = useState<Array<{ id: string; patientId: string; name: string; phone: string | null }>>([])
  const [regSelectedPatientId, setRegSelectedPatientId] = useState('')
  const [regPatientName, setRegPatientName] = useState('')
  const [regAge, setRegAge] = useState('')
  const [regGender, setRegGender] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regAddress, setRegAddress] = useState('')
  const [regBpSystolic, setRegBpSystolic] = useState('')
  const [regBpDiastolic, setRegBpDiastolic] = useState('')
  const [regPulse, setRegPulse] = useState('')
  const [regTemperature, setRegTemperature] = useState('')
  const [regSpO2, setRegSpO2] = useState('')
  const [regBloodSugar, setRegBloodSugar] = useState('')
  const [regWeight, setRegWeight] = useState('')
  const [regHeight, setRegHeight] = useState('')
  const [regScreeningResult, setRegScreeningResult] = useState<ScreeningResult>('Normal')
  const [regReferredTo, setRegReferredTo] = useState('')
  const [regFindings, setRegFindings] = useState('')
  const [regMedicinesGiven, setRegMedicinesGiven] = useState('')
  const [regFollowUp, setRegFollowUp] = useState(false)
  const [regShowPatientDropdown, setRegShowPatientDropdown] = useState(false)
  const regSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchCamps = useCallback(async () => {
    setCampsLoading(true)
    setCampsError(null)
    try {
      const res = await apiGet<PaginatedResponse<Camp>>('/camps', { page: campsPage, limit })
      setCamps(res.data)
      setCampsTotal(res.total)
      setCampsTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        setCampsError(err.message)
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setCampsLoading(false)
    }
  }, [campsPage, toast])

  useEffect(() => {
    if (activeTab === 'camps') fetchCamps()
  }, [fetchCamps, activeTab])

  const fetchRegistrations = useCallback(async () => {
    if (!selectedCamp) return
    setRegLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<CampRegistration>>(`/camps/${selectedCamp.id}/registrations`, { page: regPage, limit: 20 })
      setRegistrations(res.data)
      setRegTotal(res.total)
      setRegTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setRegLoading(false)
    }
  }, [selectedCamp, regPage, toast])

  useEffect(() => {
    if (activeTab === 'registrations' && selectedCamp) fetchRegistrations()
  }, [fetchRegistrations, activeTab])

  const stats = useMemo(() => {
    const upcoming = camps.filter((c) => c.status === 'Planned').length
    const completed = camps.filter((c) => c.status === 'Completed').length
    const totalReg = camps.reduce((sum, c) => sum + c.actualCount, 0)
    return { total: campsTotal, upcoming, completed, totalReg }
  }, [camps, campsTotal])

  const resetCampForm = () => {
    setCampName('')
    setCampDescription('')
    setCampDate(new Date().toISOString().split('T')[0])
    setCampStartTime('')
    setCampEndTime('')
    setCampLocation('')
    setCampAddress('')
    setCampCity('')
    setCampState('')
    setCampOrganizer('')
    setCampContactPerson('')
    setCampContactPhone('')
    setCampType('General')
    setCampExpectedCount('')
  }

  const handleOpenNewCamp = () => {
    setEditingCamp(null)
    resetCampForm()
    setCampDialogOpen(true)
  }

  const handleEditCamp = (camp: Camp) => {
    setEditingCamp(camp)
    setCampName(camp.name)
    setCampDescription(camp.description || '')
    setCampDate(camp.campDate.split('T')[0])
    setCampStartTime(camp.startTime || '')
    setCampEndTime(camp.endTime || '')
    setCampLocation(camp.location || '')
    setCampAddress(camp.address || '')
    setCampCity(camp.city || '')
    setCampState(camp.state || '')
    setCampOrganizer(camp.organizer || '')
    setCampContactPerson(camp.contactPerson || '')
    setCampContactPhone(camp.contactPhone || '')
    setCampType(camp.campType)
    setCampExpectedCount(String(camp.expectedCount))
    setCampDialogOpen(true)
  }

  const handleSubmitCamp = async () => {
    if (!campName || !campDate || !campType) {
      toast({ title: 'Error', description: 'Name, date, and type are required', variant: 'destructive' })
      return
    }
    setCampSubmitting(true)
    try {
      const payload = {
        name: campName,
        description: campDescription || undefined,
        campDate,
        startTime: campStartTime || undefined,
        endTime: campEndTime || undefined,
        location: campLocation || undefined,
        address: campAddress || undefined,
        city: campCity || undefined,
        state: campState || undefined,
        organizer: campOrganizer || undefined,
        contactPerson: campContactPerson || undefined,
        contactPhone: campContactPhone || undefined,
        campType,
        expectedCount: parseInt(campExpectedCount) || 0,
      }

      if (editingCamp) {
        await apiPut<SingleResponse<Camp>>(`/camps/${editingCamp.id}`, payload)
        toast({ title: 'Success', description: 'Camp updated successfully!' })
      } else {
        await apiPost<SingleResponse<Camp>>('/camps', payload)
        toast({ title: 'Success', description: 'Camp created successfully!' })
      }
      setCampDialogOpen(false)
      fetchCamps()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setCampSubmitting(false)
    }
  }

  const handleUpdateCampStatus = async (camp: Camp, status: CampStatus) => {
    try {
      await apiPut<SingleResponse<Camp>>(`/camps/${camp.id}`, { status })
      toast({ title: 'Success', description: `Camp status updated to ${status}` })
      fetchCamps()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleSelectCamp = (camp: Camp) => {
    setSelectedCamp(camp)
    setRegPage(1)
    setActiveTab('registrations')
  }

  const searchExistingPatients = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setRegPatientResults([])
      return
    }
    try {
      const res = await apiGet<PaginatedResponse<{ id: string; patientId: string; name: string; phone: string | null }>>('/patients', { search: q, limit: 10 })
      setRegPatientResults(res.data)
      setRegShowPatientDropdown(true)
    } catch {
      setRegPatientResults([])
    }
  }, [])

  const handleRegPatientSearchChange = (value: string) => {
    setRegPatientSearch(value)
    if (regSearchTimerRef.current) clearTimeout(regSearchTimerRef.current)
    regSearchTimerRef.current = setTimeout(() => searchExistingPatients(value), 300)
  }

  const selectRegPatient = (p: { id: string; name: string; phone: string | null }) => {
    setRegSelectedPatientId(p.id)
    setRegPatientName(p.name)
    setRegPatientSearch(p.name)
    setRegShowPatientDropdown(false)
  }

  const resetRegForm = () => {
    setRegPatientMode('new')
    setRegPatientSearch('')
    setRegSelectedPatientId('')
    setRegPatientName('')
    setRegAge('')
    setRegGender('')
    setRegPhone('')
    setRegAddress('')
    setRegBpSystolic('')
    setRegBpDiastolic('')
    setRegPulse('')
    setRegTemperature('')
    setRegSpO2('')
    setRegBloodSugar('')
    setRegWeight('')
    setRegHeight('')
    setRegScreeningResult('Normal')
    setRegReferredTo('')
    setRegFindings('')
    setRegMedicinesGiven('')
    setRegFollowUp(false)
  }

  const handleOpenRegister = () => {
    resetRegForm()
    setRegDialogOpen(true)
  }

  const handleSubmitRegistration = async () => {
    if (!regPatientName) {
      toast({ title: 'Error', description: 'Patient name is required', variant: 'destructive' })
      return
    }
    setRegSubmitting(true)
    try {
      await apiPost<SingleResponse<CampRegistration>>(`/camps/${selectedCamp!.id}/registrations`, {
        patientId: regSelectedPatientId || undefined,
        patientName: regPatientName,
        age: regAge ? parseInt(regAge) : null,
        gender: regGender || null,
        phone: regPhone || null,
        address: regAddress || null,
        bpSystolic: regBpSystolic ? parseInt(regBpSystolic) : null,
        bpDiastolic: regBpDiastolic ? parseInt(regBpDiastolic) : null,
        pulse: regPulse ? parseInt(regPulse) : null,
        temperature: regTemperature ? parseFloat(regTemperature) : null,
        spO2: regSpO2 ? parseInt(regSpO2) : null,
        bloodSugar: regBloodSugar ? parseInt(regBloodSugar) : null,
        weight: regWeight ? parseFloat(regWeight) : null,
        height: regHeight ? parseFloat(regHeight) : null,
        screeningResult: regScreeningResult,
        referredTo: regReferredTo || null,
        findings: regFindings || null,
        medicinesGiven: regMedicinesGiven || null,
        followUpNeeded: regFollowUp,
      })
      toast({ title: 'Success', description: 'Patient registered successfully!' })
      setRegDialogOpen(false)
      fetchRegistrations()
      fetchCamps()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setRegSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Camp Management</h1>
          <p className="text-sm text-muted-foreground">Manage health camps and patient registrations</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenNewCamp}>
          <Plus className="mr-2 h-4 w-4" />
          New Camp
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="camps" className="gap-1.5">
            <Tent className="h-4 w-4" />
            Camps
          </TabsTrigger>
          <TabsTrigger value="registrations" className="gap-1.5" disabled={!selectedCamp}>
            <Users className="h-4 w-4" />
            Registration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="camps">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {campsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-3 w-28" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Camps</CardTitle>
                    <Tent className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <p className="text-xs text-muted-foreground mt-1">All camps</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
                    <Calendar className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{stats.upcoming}</div>
                    <p className="text-xs text-muted-foreground mt-1">Planned camps</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
                    <p className="text-xs text-muted-foreground mt-1">Finished camps</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Registrations</CardTitle>
                    <Users className="h-4 w-4 text-violet-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-violet-600">{stats.totalReg}</div>
                    <p className="text-xs text-muted-foreground mt-1">Across all camps</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Camps</CardTitle>
              <CardDescription>
                {campsLoading ? 'Loading...' : `Showing ${camps.length} of ${campsTotal} camps`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campsError ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <AlertTriangle className="h-12 w-12 text-red-400" />
                  <p className="text-sm text-muted-foreground">{campsError}</p>
                  <Button variant="outline" onClick={() => fetchCamps()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : campsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[560px] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Camp ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-center">Count</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {camps.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            <Tent className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            No camps found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        camps.map((camp) => (
                          <TableRow key={camp.id}>
                            <TableCell className="font-mono text-xs">{camp.campId}</TableCell>
                            <TableCell>
                              <p className="font-medium">{camp.name}</p>
                              {camp.organizer && <p className="text-xs text-muted-foreground">{camp.organizer}</p>}
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {formatDate(camp.campDate)}
                              </div>
                              {camp.startTime && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  {camp.startTime}{camp.endTime ? ` - ${camp.endTime}` : ''}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{camp.location || '-'}</p>
                                {camp.city && <p className="text-xs text-muted-foreground">{camp.city}{camp.state ? `, ${camp.state}` : ''}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{camp.campType}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1 text-sm">
                                <span className="font-semibold">{camp.actualCount}</span>
                                <span className="text-muted-foreground">/</span>
                                <span className="text-muted-foreground">{camp.expectedCount}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <CampStatusBadge status={camp.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Registrations" onClick={() => handleSelectCamp(camp)}>
                                  <Users className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => handleEditCamp(camp)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {camp.status === 'Planned' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" title="Start Camp" onClick={() => handleUpdateCampStatus(camp, 'In-Progress')}>
                                    <Activity className="h-4 w-4" />
                                  </Button>
                                )}
                                {camp.status === 'In-Progress' && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Complete" onClick={() => handleUpdateCampStatus(camp, 'Completed')}>
                                    <CheckCircle2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {(camp.status === 'Planned' || camp.status === 'In-Progress') && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Cancel" onClick={() => handleUpdateCampStatus(camp, 'Cancelled')}>
                                    <XCircle className="h-4 w-4" />
                                  </Button>
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

              {campsTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {campsPage} of {campsTotalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={campsPage <= 1} onClick={() => setCampsPage(campsPage - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={campsPage >= campsTotalPages} onClick={() => setCampsPage(campsPage + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registrations">
          {selectedCamp ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Tent className="h-5 w-5 text-emerald-600" />
                        {selectedCamp.name} — Registrations
                      </CardTitle>
                      <CardDescription>
                        {formatDate(selectedCamp.campDate)} | {selectedCamp.campType}
                        {selectedCamp.location ? ` | ${selectedCamp.location}` : ''}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Upload className="mr-1.5 h-4 w-4" />
                        Import
                      </Button>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenRegister}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Register Patient
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  {regLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-6 w-20" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="max-h-[560px] overflow-y-auto rounded-md border">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead>Reg ID</TableHead>
                            <TableHead>Patient Name</TableHead>
                            <TableHead>Age</TableHead>
                            <TableHead>Gender</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>BP</TableHead>
                            <TableHead>Pulse</TableHead>
                            <TableHead>Temp</TableHead>
                            <TableHead>SpO₂</TableHead>
                            <TableHead>Blood Sugar</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {registrations.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                No registrations yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            registrations.map((reg) => (
                              <TableRow key={reg.id}>
                                <TableCell className="font-mono text-xs">{reg.regId}</TableCell>
                                <TableCell>
                                  <p className="font-medium text-sm">{reg.patientName}</p>
                                </TableCell>
                                <TableCell className="text-sm">{reg.age ?? '-'}</TableCell>
                                <TableCell className="text-sm">{reg.gender || '-'}</TableCell>
                                <TableCell className="text-sm font-mono">{reg.phone || '-'}</TableCell>
                                <TableCell className="text-sm">
                                  {reg.bpSystolic ? `${reg.bpSystolic}/${reg.bpDiastolic ?? '-'}` : '-'}
                                </TableCell>
                                <TableCell className="text-sm">{reg.pulse ?? '-'}</TableCell>
                                <TableCell className="text-sm">
                                  {reg.temperature ? `${reg.temperature}°F` : '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {reg.spO2 ? `${reg.spO2}%` : '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {reg.bloodSugar ? `${reg.bloodSugar} mg/dL` : '-'}
                                </TableCell>
                                <TableCell>
                                  <ScreeningBadge result={reg.screeningResult} />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" title="View Details">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {regTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">Page {regPage} of {regTotalPages}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={regPage <= 1} onClick={() => setRegPage(regPage - 1)}>Previous</Button>
                        <Button variant="outline" size="sm" disabled={regPage >= regTotalPages} onClick={() => setRegPage(regPage + 1)}>Next</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Tent className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                <p className="text-lg font-medium text-muted-foreground">Select a camp to view registrations</p>
                <p className="text-sm text-muted-foreground mt-1">Go to Camps tab and click on a camp</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={campDialogOpen} onOpenChange={(open) => { if (!open) setCampDialogOpen(false) }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tent className="h-5 w-5 text-emerald-600" />
              {editingCamp ? 'Edit Camp' : 'New Health Camp'}
            </DialogTitle>
            <DialogDescription>
              {editingCamp ? `Update details for ${editingCamp.name}` : 'Create a new health camp'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="camp-name">Camp Name *</Label>
                <Input id="camp-name" placeholder="e.g., Vision Camp 2025" value={campName} onChange={(e) => setCampName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-type">Camp Type *</Label>
                <Select value={campType} onValueChange={(v) => setCampType(v as CampType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="camp-description">Description</Label>
              <Textarea id="camp-description" placeholder="Camp description..." value={campDescription} onChange={(e) => setCampDescription(e.target.value)} rows={2} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="camp-date">Camp Date *</Label>
                <Input id="camp-date" type="date" value={campDate} onChange={(e) => setCampDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-start">Start Time</Label>
                <Input id="camp-start" type="time" value={campStartTime} onChange={(e) => setCampStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-end">End Time</Label>
                <Input id="camp-end" type="time" value={campEndTime} onChange={(e) => setCampEndTime(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="camp-location">Location</Label>
                <Input id="camp-location" placeholder="e.g., Community Hall" value={campLocation} onChange={(e) => setCampLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-address">Address</Label>
                <Input id="camp-address" placeholder="Street address" value={campAddress} onChange={(e) => setCampAddress(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="camp-city">City</Label>
                <Input id="camp-city" placeholder="City" value={campCity} onChange={(e) => setCampCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-state">State</Label>
                <Input id="camp-state" placeholder="State" value={campState} onChange={(e) => setCampState(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="camp-organizer">Organizer</Label>
                <Input id="camp-organizer" placeholder="Organization name" value={campOrganizer} onChange={(e) => setCampOrganizer(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-contact-person">Contact Person</Label>
                <Input id="camp-contact-person" placeholder="Contact name" value={campContactPerson} onChange={(e) => setCampContactPerson(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="camp-contact-phone">Contact Phone</Label>
                <Input id="camp-contact-phone" placeholder="Phone number" value={campContactPhone} onChange={(e) => setCampContactPhone(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="camp-expected">Expected Patient Count</Label>
              <Input id="camp-expected" type="number" placeholder="e.g., 200" value={campExpectedCount} onChange={(e) => setCampExpectedCount(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCampDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmitCamp}
              disabled={!campName || campSubmitting}
            >
              {campSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tent className="mr-2 h-4 w-4" />}
              {editingCamp ? 'Update Camp' : 'Create Camp'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regDialogOpen} onOpenChange={(open) => { if (!open) setRegDialogOpen(false) }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Register Patient — {selectedCamp?.name}
            </DialogTitle>
            <DialogDescription>Register a patient for this health camp screening</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={regPatientMode === 'new' ? 'default' : 'outline'}
                className={regPatientMode === 'new' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={() => setRegPatientMode('new')}
              >
                <User className="mr-1.5 h-3.5 w-3.5" />
                New Patient
              </Button>
              <Button
                size="sm"
                variant={regPatientMode === 'existing' ? 'default' : 'outline'}
                className={regPatientMode === 'existing' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                onClick={() => setRegPatientMode('existing')}
              >
                <Search className="mr-1.5 h-3.5 w-3.5" />
                Existing Patient
              </Button>
            </div>

            {regPatientMode === 'existing' ? (
              <div className="space-y-2">
                <Label>Search Patient</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or ID..."
                    value={regPatientSearch}
                    onChange={(e) => {
                      setRegPatientSearch(e.target.value)
                      handleRegPatientSearchChange(e.target.value)
                    }}
                    onFocus={() => regPatientResults.length > 0 && setRegShowPatientDropdown(true)}
                    onBlur={() => setTimeout(() => setRegShowPatientDropdown(false), 200)}
                    className="pl-9"
                  />
                  {regShowPatientDropdown && regPatientResults.length > 0 && (
                    <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
                      <CardContent className="p-2 max-h-48 overflow-y-auto">
                        {regPatientResults.map((p) => (
                          <button
                            key={p.id}
                            className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                            onMouseDown={() => selectRegPatient(p)}
                          >
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.patientId}{p.phone ? ` | ${p.phone}` : ''}</p>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reg-name">Patient Name *</Label>
                <Input id="reg-name" placeholder="Full name" value={regPatientName} onChange={(e) => setRegPatientName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-age">Age</Label>
                <Input id="reg-age" type="number" placeholder="Age" value={regAge} onChange={(e) => setRegAge(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-gender">Gender</Label>
                <Select value={regGender} onValueChange={setRegGender}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reg-phone">Phone</Label>
                <Input id="reg-phone" type="tel" placeholder="Phone number" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-address">Address</Label>
                <Input id="reg-address" placeholder="Address" value={regAddress} onChange={(e) => setRegAddress(e.target.value)} />
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-red-500" />
                Vitals
              </p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">BP Systolic</Label>
                  <Input placeholder="120" value={regBpSystolic} onChange={(e) => setRegBpSystolic(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">BP Diastolic</Label>
                  <Input placeholder="80" value={regBpDiastolic} onChange={(e) => setRegBpDiastolic(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pulse (bpm)</Label>
                  <Input placeholder="72" value={regPulse} onChange={(e) => setRegPulse(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Temp (°F)</Label>
                  <Input placeholder="98.6" value={regTemperature} onChange={(e) => setRegTemperature(e.target.value)} className="h-8" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">SpO₂ (%)</Label>
                  <Input placeholder="98" value={regSpO2} onChange={(e) => setRegSpO2(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Blood Sugar (mg/dL)</Label>
                  <Input placeholder="100" value={regBloodSugar} onChange={(e) => setRegBloodSugar(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Weight (kg)</Label>
                  <Input placeholder="70" value={regWeight} onChange={(e) => setRegWeight(e.target.value)} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Height (cm)</Label>
                  <Input placeholder="170" value={regHeight} onChange={(e) => setRegHeight(e.target.value)} className="h-8" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-blue-500" />
                Screening
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Screening Result</Label>
                  <Select value={regScreeningResult} onValueChange={(v) => setRegScreeningResult(v as ScreeningResult)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Normal">Normal</SelectItem>
                      <SelectItem value="Abnormal">Abnormal</SelectItem>
                      <SelectItem value="Referred">Referred</SelectItem>
                      <SelectItem value="Emergency">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-referred">Referred To</Label>
                  <Input id="reg-referred" placeholder="e.g., City Hospital" value={regReferredTo} onChange={(e) => setRegReferredTo(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-findings">Findings</Label>
                <Textarea id="reg-findings" placeholder="Screening findings..." value={regFindings} onChange={(e) => setRegFindings(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-medicines">Medicines Given</Label>
                <Input id="reg-medicines" placeholder="e.g., Paracetamol 500mg, Multivitamin" value={regMedicinesGiven} onChange={(e) => setRegMedicinesGiven(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={regFollowUp} onCheckedChange={(v) => setRegFollowUp(v === true)} />
                Follow-up needed
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmitRegistration}
              disabled={!regPatientName || regSubmitting}
            >
              {regSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              Register Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
