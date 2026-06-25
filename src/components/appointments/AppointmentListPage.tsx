'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { format, addDays, subDays, startOfDay, isToday } from 'date-fns'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Stethoscope,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer,
  CalendarClock,
  FileText,
  List,
  Loader2,
  Upload,
} from 'lucide-react'
import { ImportCsvDialog } from '@/components/ImportCsvDialog'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPut, ApiError, type PaginatedResponse } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { AddAppointmentDialog } from './AddAppointmentDialog'
import { AppointmentCalendar } from './AppointmentCalendar'

// ==================== TYPES ====================

interface Appointment {
  id: string
  appointmentId: string
  patientId: string
  patientName?: string
  doctorId: string
  doctorName?: string
  specialization?: string
  consultationFee?: number
  date: string
  time: string
  duration: number
  status: string
  type: string
  notes?: string | null
}

// ==================== HELPERS ====================

const TIME_SLOTS: string[] = []
for (let h = 9; h <= 19; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = h.toString().padStart(2, '0')
    const mm = m.toString().padStart(2, '0')
    TIME_SLOTS.push(`${hh}:${mm}`)
  }
}
TIME_SLOTS.push('20:00')

function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'Scheduled':
      return {
        className: 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
        badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200',
        icon: Clock,
        iconClass: 'text-blue-500',
      }
    case 'Completed':
      return {
        className: 'border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200',
        icon: CheckCircle2,
        iconClass: 'text-emerald-500',
      }
    case 'Cancelled':
      return {
        className: 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
        badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200',
        icon: XCircle,
        iconClass: 'text-red-500',
      }
    case 'No-Show':
      return {
        className: 'border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20',
        badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200',
        icon: AlertCircle,
        iconClass: 'text-orange-500',
      }
    default:
      return {
        className: 'border-l-4 border-l-gray-400 bg-gray-50/50',
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
        icon: Clock,
        iconClass: 'text-gray-500',
      }
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'Consultation':
      return <Stethoscope className="h-3.5 w-3.5" />
    case 'Follow-up':
      return <Timer className="h-3.5 w-3.5" />
    case 'Emergency':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
    default:
      return null
  }
}

function getTypeBadgeClass(type: string) {
  switch (type) {
    case 'Consultation':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    case 'Follow-up':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
    case 'Emergency':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    default:
      return ''
  }
}

// ==================== SUB COMPONENTS ====================

function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status)
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`${config.badgeClass} gap-1`}>
      <Icon className={`h-3 w-3 ${config.iconClass}`} />
      {status}
    </Badge>
  )
}

function TimelineAppointmentCard({ appointment }: { appointment: Appointment }) {
  const config = getStatusConfig(appointment.status)
  const patientLabel = appointment.patientName || `Patient ${appointment.patientId}`
  const doctorLabel = appointment.doctorName || `Doctor ${appointment.doctorId}`

  return (
    <div className={`${config.className} rounded-lg p-3 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-xs font-bold">
            {patientLabel.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{patientLabel}</p>
            <p className="text-xs text-muted-foreground truncate">{doctorLabel}</p>
          </div>
        </div>
        <StatusBadge status={appointment.status} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className={`gap-1 text-[11px] px-1.5 py-0 ${getTypeBadgeClass(appointment.type)}`}>
          {getTypeIcon(appointment.type)}
          {appointment.type}
        </Badge>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {appointment.duration} min
        </span>
        {appointment.notes && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="truncate max-w-[150px]" title={appointment.notes}>
              {appointment.notes}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function TimelineView({
  appointments,
  dateStr,
  loading,
}: {
  appointments: Appointment[]
  dateStr: string
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const dayAppointments = appointments.filter((apt) => apt.date === dateStr)
  const sortedApts = [...dayAppointments].sort((a, b) => a.time.localeCompare(b.time))

  const slotMap = new Map<string, Appointment[]>()
  for (const apt of sortedApts) {
    if (!slotMap.has(apt.time)) slotMap.set(apt.time, [])
    slotMap.get(apt.time)!.push(apt)
  }

  const occupiedSlots = new Set<string>()
  for (const apt of sortedApts) {
    const [h, m] = apt.time.split(':').map(Number)
    const endMinutes = h * 60 + m + apt.duration
    const slotH = Math.floor(endMinutes / 60)
    const slotM = Math.floor((endMinutes % 60) / 30) * 30
    const endSlot = `${slotH.toString().padStart(2, '0')}:${slotM.toString().padStart(2, '0')}`
    let current = apt.time
    while (current < endSlot && current <= '20:00') {
      occupiedSlots.add(current)
      const [ch, cm] = current.split(':').map(Number)
      const nextMin = cm + 30
      if (nextMin >= 60) {
        current = `${(ch + 1).toString().padStart(2, '0')}:00`
      } else {
        current = `${ch.toString().padStart(2, '0')}:${nextMin.toString().padStart(2, '0')}`
      }
    }
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="relative min-w-[320px]">
        {TIME_SLOTS.map((slot) => {
          const slotApts = slotMap.get(slot)
          const isOccupied = occupiedSlots.has(slot) && !slotApts

          return (
            <div key={slot} className="flex min-h-[72px] border-b border-border/50 last:border-b-0">
              <div className="w-20 shrink-0 py-2 pr-3 text-right">
                <span className="text-xs font-medium text-muted-foreground">{formatTime(slot)}</span>
              </div>
              <div className="flex-1 border-l border-border/50 py-1.5 pl-3">
                {slotApts ? (
                  <div className="space-y-2">
                    {slotApts.map((apt) => (
                      <TimelineAppointmentCard key={apt.id} appointment={apt} />
                    ))}
                  </div>
                ) : isOccupied ? (
                  <div className="h-full opacity-20">
                    <div className="h-10 w-3/4 rounded bg-emerald-200 dark:bg-emerald-800" />
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

function AppointmentTable({
  appointments,
  dateStr,
  loading,
  onComplete,
  onCancel,
}: {
  appointments: Appointment[]
  dateStr: string
  loading: boolean
  onComplete: (id: string) => void
  onCancel: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const dayAppointments = appointments
    .filter((apt) => apt.date === dateStr)
    .sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[100px]">Time</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead className="hidden sm:table-cell">Doctor</TableHead>
            <TableHead className="hidden md:table-cell">Type</TableHead>
            <TableHead className="hidden md:table-cell">Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[60px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dayAppointments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No appointments scheduled for this day.
              </TableCell>
            </TableRow>
          ) : (
            dayAppointments.map((apt) => (
              <TableRow key={apt.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatTime(apt.time)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-[11px] font-bold">
                      {(apt.patientName || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{apt.patientName || `Patient ${apt.patientId}`}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">{apt.doctorName || `Doctor ${apt.doctorId}`}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <span className="text-sm">{apt.doctorName || `Doctor ${apt.doctorId}`}</span>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className={`gap-1 text-xs ${getTypeBadgeClass(apt.type)}`}>
                    {getTypeIcon(apt.type)}
                    {apt.type}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm text-muted-foreground">{apt.duration} min</span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={apt.status} />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {apt.status === 'Scheduled' && (
                        <>
                          <DropdownMenuItem onClick={() => onComplete(apt.id)}>
                            <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                            Mark Complete
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onCancel(apt.id)} className="text-red-600">
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem>
                        <FileText className="mr-2 h-4 w-4" />
                        View Details
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
  )
}

// ==================== MAIN COMPONENT ====================

export function AppointmentListPage() {
  const { toast } = useToast()
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [activeView, setActiveView] = useState<'timeline' | 'list' | 'calendar'>('timeline')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dateStr = format(currentDate, 'yyyy-MM-dd')

  const fetchAppointments = useCallback(async (date: string, status: string) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        date,
        limit: 100,
      }
      if (status && status !== 'all') params.status = status
      const res = await apiGet<PaginatedResponse<Appointment>>('/appointments', params)
      setAppointments(res.data)
      setTotalCount(res.total)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      } else {
        toast({ title: 'Error', description: 'Failed to load appointments', variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
    fetchTimeoutRef.current = setTimeout(() => {
      fetchAppointments(dateStr, statusFilter)
    }, 100)
    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
    }
  }, [dateStr, statusFilter, fetchAppointments])

  const dayAppointments = appointments.filter((apt) => apt.date === dateStr)

  const counts = {
    all: dayAppointments.length,
    scheduled: dayAppointments.filter((a) => a.status === 'Scheduled').length,
    completed: dayAppointments.filter((a) => a.status === 'Completed').length,
    cancelled: dayAppointments.filter((a) => a.status === 'Cancelled').length,
  }

  const filteredAppointments = statusFilter === 'all'
    ? appointments
    : appointments.filter((apt) => apt.status.toLowerCase() === statusFilter)

  const stats = {
    total: counts.all,
    completedCount: counts.completed,
    scheduledCount: counts.scheduled,
    revenue: dayAppointments
      .filter((a) => a.status === 'Completed')
      .reduce((sum, a) => sum + (a.consultationFee || 0), 0),
  }

  const handleComplete = async (id: string) => {
    try {
      await apiPut(`/appointments/${id}`, { status: 'Completed' })
      toast({ title: 'Completed', description: 'Appointment marked as completed.' })
      fetchAppointments(dateStr, statusFilter)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await apiPut(`/appointments/${id}`, { status: 'Cancelled' })
      toast({ title: 'Cancelled', description: 'Appointment has been cancelled.' })
      fetchAppointments(dateStr, statusFilter)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    }
  }

  const handleDialogSuccess = () => {
    setDialogOpen(false)
    fetchAppointments(dateStr, statusFilter)
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Date Navigation & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track patient appointments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? <Loader2 className="size-5 animate-spin" /> : stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? <Loader2 className="size-5 animate-spin" /> : stats.completedCount}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? <Loader2 className="size-5 animate-spin" /> : stats.scheduledCount}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">₹</span>
            </div>
            <div>
              <p className="text-2xl font-bold">{loading ? '...' : formatCurrency(stats.revenue)}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Date Navigation + Filter Tabs + View Toggle */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Date Navigator */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentDate((d) => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isToday(currentDate) ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentDate(startOfDay(new Date()))}
              className={isToday(currentDate) ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
            >
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentDate((d) => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold">
                {isToday(currentDate) ? 'Today, ' : ''}{format(currentDate, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
            <Button
              variant={activeView === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setActiveView('timeline')}
            >
              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
              Timeline
            </Button>
            <Button
              variant={activeView === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setActiveView('list')}
            >
              <List className="mr-1.5 h-3.5 w-3.5" />
              List
            </Button>
            <Button
              variant={activeView === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setActiveView('calendar')}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              Calendar
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all" className="gap-1.5">
              All
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {loading ? '...' : counts.all}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-1.5">
              Scheduled
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {loading ? '...' : counts.scheduled}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1.5">
              Completed
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {loading ? '...' : counts.completed}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="cancelled" className="gap-1.5">
              Cancelled
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                {loading ? '...' : counts.cancelled}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter} className="mt-4">
            {activeView === 'calendar' ? (
              <AppointmentCalendar />
            ) : activeView === 'timeline' ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Daily Timeline
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {loading ? '...' : dayAppointments.length} appointment{dayAppointments.length !== 1 ? 's' : ''}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <TimelineView appointments={filteredAppointments} dateStr={dateStr} loading={loading} />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Appointment List
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {loading ? '...' : dayAppointments.length} appointment{dayAppointments.length !== 1 ? 's' : ''}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AppointmentTable
                    appointments={filteredAppointments}
                    dateStr={dateStr}
                    loading={loading}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Appointment Dialog */}
      <AddAppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleDialogSuccess}
      />

      <ImportCsvDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Appointments"
        importUrl="/api/import/appointments"
        templateHeaders={['Patient ID', 'Patient Name', 'Patient Phone', 'Doctor ID', 'Doctor Name', 'Date', 'Time', 'Duration', 'Type', 'Status', 'Notes']}
        onSuccess={() => fetchAppointments(dateStr, statusFilter)}
      />
    </div>
  )
}
