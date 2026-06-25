'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Users,
  UserPlus,
  Activity,
  ChevronLeft,
  ChevronRight,
  Phone,
  Filter,
  Trash2,
  Loader2,
  Download,
  CalendarDays,
  Shield,
  Droplets,
  UserCheck,
  X,
  Upload,
} from 'lucide-react'
import { useNavigation } from '@/stores/navigation'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiDelete, ApiError, type PaginatedResponse, type SingleResponse } from '@/lib/api-client'
import { BLOOD_GROUPS, GENDER_OPTIONS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { AddPatientDialog } from '@/components/patients/AddPatientDialog'
import { ImportCsvDialog } from '@/components/ImportCsvDialog'

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string
  email?: string | null
  gender?: string | null
  bloodGroup?: string | null
  insuranceProvider?: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface PatientStats {
  total: number
  activeThisMonth: number
  insured: number
}

const ITEMS_PER_PAGE = 8

export function PatientListPage() {
  const { setCurrentPage } = useNavigation()
  const { toast } = useToast()
  const [patients, setPatients] = useState<Patient[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [genderFilter, setGenderFilter] = useState<string>('all')
  const [bloodGroupFilter, setBloodGroupFilter] = useState<string>('all')
  const [insuranceFilter, setInsuranceFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPageNum] = useState(1)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [stats, setStats] = useState<PatientStats>({ total: 0, activeThisMonth: 0, insured: 0 })
  const [showFilters, setShowFilters] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  const fetchPatients = useCallback(async (
    page: number,
    searchQuery: string,
    status: string,
    gender: string,
    bloodGroup: string,
    insurance: string,
    dateFromVal: string,
    dateToVal: string
  ) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page,
        limit: ITEMS_PER_PAGE,
      }
      if (searchQuery) params.search = searchQuery
      if (status && status !== 'all') params.status = status
      if (gender && gender !== 'all') params.gender = gender
      if (bloodGroup && bloodGroup !== 'all') params.bloodGroup = bloodGroup
      if (insurance && insurance !== 'all') params.insurance = insurance
      if (dateFromVal) params.dateFrom = dateFromVal
      if (dateToVal) params.dateTo = dateToVal

      const res = await apiGet<PaginatedResponse<Patient>>('/patients', params)
      setPatients(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: 'Failed to load patients', variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchStats = useCallback(async () => {
    try {
      // Fetch total (no filters beyond limit 1 for count)
      const totalRes = await apiGet<PaginatedResponse<Patient>>('/patients', { limit: 1 })
      // Active this month
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const activeMonthRes = await apiGet<PaginatedResponse<Patient>>('/patients', { dateFrom: monthStart, limit: 1 })
      // Insured
      const insuredRes = await apiGet<PaginatedResponse<Patient>>('/patients', { insurance: 'Insured', limit: 1 })
      setStats({
        total: totalRes.total,
        activeThisMonth: activeMonthRes.total,
        insured: insuredRes.total,
      })
    } catch {
      // silently fail - stats are secondary
    }
  }, [])

  useEffect(() => {
    fetchPatients(currentPage, debouncedSearch, statusFilter, genderFilter, bloodGroupFilter, insuranceFilter, dateFrom, dateTo)
  }, [currentPage, debouncedSearch, statusFilter, genderFilter, bloodGroupFilter, insuranceFilter, dateFrom, dateTo, fetchPatients])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setCurrentPageNum(1)
    }, 300)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPageNum(1)
  }

  const handleGenderChange = (value: string) => {
    setGenderFilter(value)
    setCurrentPageNum(1)
  }

  const handleBloodGroupChange = (value: string) => {
    setBloodGroupFilter(value)
    setCurrentPageNum(1)
  }

  const handleInsuranceChange = (value: string) => {
    setInsuranceFilter(value)
    setCurrentPageNum(1)
  }

  const handleDateFromChange = (value: string) => {
    setDateFrom(value)
    setCurrentPageNum(1)
  }

  const handleDateToChange = (value: string) => {
    setDateTo(value)
    setCurrentPageNum(1)
  }

  const clearFilters = () => {
    setStatusFilter('all')
    setGenderFilter('all')
    setBloodGroupFilter('all')
    setInsuranceFilter('all')
    setDateFrom('')
    setDateTo('')
    setCurrentPageNum(1)
  }

  const hasActiveFilters = statusFilter !== 'all' || genderFilter !== 'all' || bloodGroupFilter !== 'all' || insuranceFilter !== 'all' || dateFrom || dateTo

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete<SingleResponse<Patient>>(`/patients/${deleteTarget.id}`)
      toast({ title: 'Patient Deleted', description: `${deleteTarget.name} has been removed.` })
      setDeleteTarget(null)
      fetchPatients(currentPage, debouncedSearch, statusFilter, genderFilter, bloodGroupFilter, insuranceFilter, dateFrom, dateTo)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Delete Failed', description: 'Could not delete patient', variant: 'destructive' })
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleAddSuccess = () => {
    setAddDialogOpen(false)
    setEditingPatient(undefined)
    fetchPatients(currentPage, debouncedSearch, statusFilter, genderFilter, bloodGroupFilter, insuranceFilter, dateFrom, dateTo)
    fetchStats()
  }

  const handlePageChange = (page: number) => {
    setCurrentPageNum(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Patients
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage patient records and information
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 size-4" />
            Import CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams()
              if (debouncedSearch) params.set('search', debouncedSearch)
              if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
              if (genderFilter && genderFilter !== 'all') params.set('gender', genderFilter)
              if (bloodGroupFilter && bloodGroupFilter !== 'all') params.set('bloodGroup', bloodGroupFilter)
              if (insuranceFilter && insuranceFilter !== 'all') params.set('insurance', insuranceFilter)
              if (dateFrom) params.set('dateFrom', dateFrom)
              if (dateTo) params.set('dateTo', dateTo)
              params.set('limit', '1000')
              window.open('/api/export/patients?' + params.toString(), '_blank')
            }}
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
          <Button
            onClick={() => {
              setEditingPatient(undefined)
              setAddDialogOpen(true)
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="size-4" />
            Add New Patient
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Patients</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600 shrink-0">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active This Month</p>
              <p className="text-2xl font-bold text-foreground">{stats.activeThisMonth}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm py-4">
          <CardContent className="flex items-center gap-4 px-4 py-0">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 shrink-0">
              <Shield className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Insured Patients</p>
              <p className="text-2xl font-bold text-foreground">{stats.insured}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, phone, or email..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-[140px]">
                  <Filter className="size-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="sm"
                className={showFilters ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="size-3.5 mr-1" />
                More Filters
                {hasActiveFilters && (
                  <span className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-white text-emerald-700 text-[10px] font-bold">
                    !
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Gender</label>
                  <Select
                    value={genderFilter}
                    onValueChange={handleGenderChange}
                  >
                    <SelectTrigger className="w-full">
                      <UserCheck className="size-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="All Genders" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Blood Group</label>
                  <Select
                    value={bloodGroupFilter}
                    onValueChange={handleBloodGroupChange}
                  >
                    <SelectTrigger className="w-full">
                      <Droplets className="size-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="All Groups" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {BLOOD_GROUPS.map((bg) => (
                        <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Insurance</label>
                  <Select
                    value={insuranceFilter}
                    onValueChange={handleInsuranceChange}
                  >
                    <SelectTrigger className="w-full">
                      <Shield className="size-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Insured">Insured</SelectItem>
                      <SelectItem value="Uninsured">Uninsured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Registered From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleDateFromChange(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[130px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Registered To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleDateToChange(e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  <X className="size-3.5 mr-1" />
                  Clear Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Table - Desktop */}
      <Card className="rounded-xl border shadow-sm hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Blood Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No patients found.
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((patient) => (
                  <TableRow
                    key={patient.id}
                    className="cursor-pointer"
                    onClick={() =>
                      setCurrentPage('patient-detail', { id: patient.id })
                    }
                  >
                    <TableCell className="font-medium text-foreground">
                      {patient.patientId}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold shrink-0">
                          {patient.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{patient.name}</p>
                          {patient.email && (
                            <p className="text-xs text-muted-foreground">{patient.email}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3.5" />
                        {patient.phone}
                      </div>
                    </TableCell>
                    <TableCell>{patient.gender || '—'}</TableCell>
                    <TableCell>
                      {patient.bloodGroup ? (
                        <Badge variant="outline" className="font-mono">
                          {patient.bloodGroup}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          patient.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : patient.status === 'Archived'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }
                        variant="outline"
                      >
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setCurrentPage('patient-detail', { id: patient.id })
                            }}
                          >
                            <Eye className="size-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingPatient(patient)
                              setAddDialogOpen(true)
                            }}
                          >
                            <Pencil className="size-4 mr-2" />
                            Edit Patient
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(patient)
                            }}
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Patient Cards - Mobile */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-xl border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))
        ) : patients.length === 0 ? (
          <Card className="rounded-xl border shadow-sm">
            <CardContent className="p-6 text-center text-muted-foreground">
              No patients found.
            </CardContent>
          </Card>
        ) : (
          patients.map((patient) => (
            <Card
              key={patient.id}
              className="rounded-xl border shadow-sm cursor-pointer hover:border-emerald-200 transition-colors"
              onClick={() =>
                setCurrentPage('patient-detail', { id: patient.id })
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold shrink-0">
                      {patient.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">{patient.patientId}</p>
                    </div>
                  </div>
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
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <p className="text-foreground">{patient.phone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Gender</p>
                    <p className="text-foreground">{patient.gender || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Blood Group</p>
                    <p className="text-foreground">{patient.bloodGroup || '—'}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentPage('patient-detail', { id: patient.id })
                    }}
                  >
                    <Eye className="size-3.5 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingPatient(patient)
                      setAddDialogOpen(true)
                    }}
                  >
                    <Pencil className="size-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(patient)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} patients
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Previous page</span>
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number
              if (totalPages <= 5) {
                page = i + 1
              } else if (currentPage <= 3) {
                page = i + 1
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i
              } else {
                page = currentPage - 2 + i
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? 'default' : 'outline'}
                  size="icon"
                  className={
                    page === currentPage
                      ? 'size-8 bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'size-8'
                  }
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
        </div>
      )}

      {/* Add/Edit Patient Dialog */}
      <AddPatientDialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) setEditingPatient(undefined)
        }}
        patient={editingPatient}
        onSuccess={handleAddSuccess}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportCsvDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Patients"
        importUrl="/api/import/patients"
        templateHeaders={['Name', 'Phone', 'Email', 'Date of Birth', 'Gender', 'Blood Group', 'Address', 'City', 'State', 'Pincode', 'Aadhaar Number', 'Emergency Contact', 'Emergency Phone', 'Insurance Provider', 'Insurance Number', 'Marital Status', 'Occupation', 'Allergies', 'Past Treatments', 'Status']}
        onSuccess={() => { fetchPatients(currentPage, debouncedSearch, statusFilter, genderFilter, bloodGroupFilter, insuranceFilter, dateFrom, dateTo).catch(() => {}) }}
      />
    </div>
  )
}
