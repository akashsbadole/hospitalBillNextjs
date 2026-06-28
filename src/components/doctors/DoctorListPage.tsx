'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Stethoscope,
  UserCheck,
  Plus,
  Eye,
  Pencil,
  Search,
  Phone,
  Clock,
  IndianRupee,
  MoreVertical,
  Users,
  UserCog,
  Trash2,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiDelete, ApiError, type PaginatedResponse, type SingleResponse } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { AddDoctorDialog } from './AddDoctorDialog'
import { AddStaffDialog } from './AddStaffDialog'

// ==================== TYPES ====================

interface Doctor {
  id: string
  doctorId: string
  name: string
  email?: string | null
  phone: string
  specialization: string
  qualification?: string | null
  experience?: number | null
  consultationFee: number
  bio?: string | null
  status: string
  createdAt: string
}

interface Staff {
  id: string
  staffId: string
  name: string
  email?: string | null
  phone: string
  role: string
  status: string
}

// ==================== HELPERS ====================

const DOCTOR_COLORS = [
  'bg-emerald-600', 'bg-teal-600', 'bg-cyan-600', 'bg-rose-600',
  'bg-amber-600', 'bg-violet-600', 'bg-pink-600', 'bg-orange-600',
]

function getInitials(name: string): string {
  return name
    .replace('Dr. ', '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const ROLE_COLORS: Record<string, string> = {
  Admin: 'bg-violet-100 text-violet-700 border-violet-200',
  Receptionist: 'bg-sky-100 text-sky-700 border-sky-200',
  Accountant: 'bg-amber-100 text-amber-700 border-amber-200',
  Pharmacist: 'bg-teal-100 text-teal-700 border-teal-200',
  'Lab Technician': 'bg-rose-100 text-rose-700 border-rose-200',
  Nurse: 'bg-pink-100 text-pink-700 border-pink-200',
}

function getStaffAvatarColor(role: string): string {
  const colors: Record<string, string> = {
    Admin: '#7c3aed',
    Receptionist: '#0284c7',
    Accountant: '#d97706',
    Pharmacist: '#0d9488',
    'Lab Technician': '#e11d48',
    Nurse: '#db2777',
  }
  return colors[role] || '#6b7280'
}

// ==================== COMPONENT ====================

export function DoctorListPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('doctors')
  const [doctorSearch, setDoctorSearch] = useState('')
  const [staffSearch, setStaffSearch] = useState('')
  const [addDoctorOpen, setAddDoctorOpen] = useState(false)
  const [addStaffOpen, setAddStaffOpen] = useState(false)

  // Doctors state
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loadingDoctors, setLoadingDoctors] = useState(true)
  const [deleteDoctorTarget, setDeleteDoctorTarget] = useState<Doctor | null>(null)
  const [deletingDoctor, setDeletingDoctor] = useState(false)
  const debouncedDoctorSearch = useRef('')
  const doctorSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Staff state
  const [staff, setStaff] = useState<Staff[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const debouncedStaffSearch = useRef('')
  const staffSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchDoctors = useCallback(async (search: string) => {
    setLoadingDoctors(true)
    try {
      const params: Record<string, string | number> = { limit: 100 }
      if (search) params.search = search
      const res = await apiGet<PaginatedResponse<Doctor>>('/doctors', params)
      setDoctors(res.data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoadingDoctors(false)
    }
  }, [toast])

  const fetchStaff = useCallback(async (search: string) => {
    setLoadingStaff(true)
    try {
      const params: Record<string, string | number> = { limit: 100 }
      if (search) params.search = search
      const res = await apiGet<PaginatedResponse<Staff>>('/staff', params)
      setStaff(res.data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoadingStaff(false)
    }
  }, [toast])

   
  useEffect(() => {
    fetchDoctors(debouncedDoctorSearch.current)
    fetchStaff(debouncedStaffSearch.current)
  }, [fetchDoctors, fetchStaff])

  const handleDoctorSearchChange = (value: string) => {
    setDoctorSearch(value)
    if (doctorSearchTimeout.current) clearTimeout(doctorSearchTimeout.current)
    doctorSearchTimeout.current = setTimeout(() => {
      debouncedDoctorSearch.current = value
      fetchDoctors(value)
    }, 300)
  }

  const handleStaffSearchChange = (value: string) => {
    setStaffSearch(value)
    if (staffSearchTimeout.current) clearTimeout(staffSearchTimeout.current)
    staffSearchTimeout.current = setTimeout(() => {
      debouncedStaffSearch.current = value
      fetchStaff(value)
    }, 300)
  }

  const handleDeleteDoctor = async () => {
    if (!deleteDoctorTarget) return
    setDeletingDoctor(true)
    try {
      await apiDelete<SingleResponse<Doctor>>(`/doctors/${deleteDoctorTarget.id}`)
      toast({ title: 'Doctor Deleted', description: `${deleteDoctorTarget.name} has been removed.` })
      setDeleteDoctorTarget(null)
      fetchDoctors(debouncedDoctorSearch.current)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' })
      }
    } finally {
      setDeletingDoctor(false)
    }
  }

  const handleDoctorSuccess = () => {
    setAddDoctorOpen(false)
    fetchDoctors(debouncedDoctorSearch.current)
  }

  const handleStaffSuccess = () => {
    setAddStaffOpen(false)
    fetchStaff(debouncedStaffSearch.current)
  }

  const activeDoctors = doctors.filter((d) => d.status === 'Active')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="doctors" className="gap-1.5">
              <Stethoscope className="size-4" />
              Doctors
            </TabsTrigger>
            <TabsTrigger value="staff" className="gap-1.5">
              <UserCog className="size-4" />
              Staff
            </TabsTrigger>
          </TabsList>

          {activeTab === 'doctors' && (
            <Button onClick={() => setAddDoctorOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4" />
              Add Doctor
            </Button>
          )}
          {activeTab === 'staff' && (
            <Button onClick={() => setAddStaffOpen(true)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="size-4" />
              Add Staff
            </Button>
          )}
        </div>

        {/* ==================== DOCTORS TAB ==================== */}
        <TabsContent value="doctors">
          {/* Stats Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="py-4">
              <CardContent className="flex items-center gap-4 px-5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                  <Stethoscope className="size-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loadingDoctors ? <Loader2 className="size-6 animate-spin" /> : doctors.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Doctors</p>
                </div>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent className="flex items-center gap-4 px-5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-100">
                  <UserCheck className="size-6 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{activeDoctors.length}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </CardContent>
            </Card>
            <Card className="py-4">
              <CardContent className="flex items-center gap-4 px-5">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-cyan-100">
                  <Users className="size-6 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loadingStaff ? <Loader2 className="size-6 animate-spin" /> : staff.length}</p>
                  <p className="text-sm text-muted-foreground">Total Staff</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative mt-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search doctors by name or specialization..."
              className="pl-9"
              value={doctorSearch}
              onChange={(e) => handleDoctorSearchChange(e.target.value)}
            />
          </div>

          {/* Doctor Cards Grid */}
          {loadingDoctors ? (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                <Stethoscope className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No doctors found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {doctors.map((doctor, idx) => (
                <DoctorCard key={doctor.id} doctor={doctor} color={DOCTOR_COLORS[idx % DOCTOR_COLORS.length]} onDelete={() => setDeleteDoctorTarget(doctor)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ==================== STAFF TAB ==================== */}
        <TabsContent value="staff">
          {/* Search */}
          <div className="relative mt-2 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search staff by name or role..."
              className="pl-9"
              value={staffSearch}
              onChange={(e) => handleStaffSearchChange(e.target.value)}
            />
          </div>

          {/* Staff Table */}
          {loadingStaff ? (
            <div className="mt-4 rounded-xl border p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
                <Users className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No staff found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search criteria</p>
            </div>
          ) : (
            <Card className="mt-4 py-0 gap-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">Phone</TableHead>
                    <TableHead className="hidden lg:table-cell">Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-mono text-sm text-muted-foreground">{member.staffId}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: getStaffAvatarColor(member.role) }}
                          >
                            {getInitials(member.name)}
                          </div>
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_COLORS[member.role] || ''}>
                          {member.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{member.phone}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{member.email || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            member.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : 'bg-gray-100 text-gray-500 border-gray-200'
                          }
                          variant="outline"
                        >
                          {member.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2">
                              <Eye className="size-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2">
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddDoctorDialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen} onSuccess={handleDoctorSuccess} />
      <AddStaffDialog open={addStaffOpen} onOpenChange={setAddStaffOpen} onSuccess={handleStaffSuccess} />

      {/* Delete Doctor Confirmation */}
      <AlertDialog open={!!deleteDoctorTarget} onOpenChange={(open) => !open && setDeleteDoctorTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDoctorTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDoctor}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDoctor}
              disabled={deletingDoctor}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingDoctor && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==================== DOCTOR CARD ====================

function DoctorCard({ doctor, color, onDelete }: { doctor: Doctor; color: string; onDelete: () => void }) {
  return (
    <Card className="group relative overflow-hidden py-0 gap-0 transition-all duration-200 hover:shadow-md hover:border-emerald-200">
      <div className={`h-1 ${color}`} />
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${color}`}>
            {getInitials(doctor.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground leading-tight">{doctor.name}</h3>
                <p className="mt-0.5 text-sm font-medium text-emerald-600">{doctor.specialization}</p>
              </div>
              <Badge
                className={
                  doctor.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0'
                    : 'bg-gray-100 text-gray-500 border-gray-200 shrink-0'
                }
                variant="outline"
              >
                {doctor.status}
              </Badge>
            </div>
            {doctor.qualification && (
              <p className="mt-1.5 text-sm text-muted-foreground">{doctor.qualification}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {doctor.experience != null && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {doctor.experience} years exp
                </span>
              )}
              <span className="flex items-center gap-1">
                <IndianRupee className="size-3" />
                {formatCurrency(doctor.consultationFee)}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="size-3" />
                {doctor.phone}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t pt-4">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5">
            <Eye className="size-3.5" />
            View
          </Button>
          <Button variant="outline" size="sm" className="flex-1 gap-1.5">
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
