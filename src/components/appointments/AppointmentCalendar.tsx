'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  format,
  addWeeks,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
} from 'date-fns'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Stethoscope,
  AlertCircle,
  Timer,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, ApiError, type PaginatedResponse } from '@/lib/api-client'
import { useNavigation } from '@/stores/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'

// ==================== TYPES ====================

interface Appointment {
  id: string
  aptId: string
  patientId: string
  patient?: { id: string; patientId: string; name: string; phone: string }
  doctorId: string
  doctor?: { id: string; doctorId: string; name: string; specialization: string }
  date: string
  time: string
  duration: number
  status: string
  type: string
  notes?: string | null
}

interface DoctorOption {
  id: string
  doctorId: string
  name: string
  specialization: string
}

// ==================== CONSTANTS ====================

const TIME_SLOTS: string[] = []
for (let h = 9; h <= 19; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = h.toString().padStart(2, '0')
    const mm = m.toString().padStart(2, '0')
    TIME_SLOTS.push(`${hh}:${mm}`)
  }
}
TIME_SLOTS.push('20:00')

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`
}

// Type-based color config
function getTypeColor(type: string) {
  switch (type) {
    case 'Consultation':
      return {
        bg: 'bg-emerald-100 dark:bg-emerald-900/40',
        border: 'border-l-emerald-500',
        text: 'text-emerald-800 dark:text-emerald-200',
        dot: 'bg-emerald-500',
      }
    case 'Follow-up':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/40',
        border: 'border-l-amber-500',
        text: 'text-amber-800 dark:text-amber-200',
        dot: 'bg-amber-500',
      }
    case 'Emergency':
      return {
        bg: 'bg-red-100 dark:bg-red-900/40',
        border: 'border-l-red-500',
        text: 'text-red-800 dark:text-red-200',
        dot: 'bg-red-500',
      }
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-800',
        border: 'border-l-slate-500',
        text: 'text-slate-800 dark:text-slate-200',
        dot: 'bg-slate-500',
      }
  }
}

// Status indicator config
function getStatusIndicator(status: string) {
  switch (status) {
    case 'Completed':
      return { dot: 'bg-emerald-500', label: 'Completed' }
    case 'Cancelled':
      return { line: 'bg-gray-400 dark:bg-gray-500', label: 'Cancelled' }
    case 'Scheduled':
      return { dot: 'bg-blue-500', label: 'Scheduled' }
    case 'No-Show':
      return { dot: 'bg-orange-500', label: 'No-Show' }
    default:
      return { dot: 'bg-gray-400', label: status }
  }
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'Consultation':
      return <Stethoscope className="h-3 w-3 shrink-0" />
    case 'Follow-up':
      return <Timer className="h-3 w-3 shrink-0" />
    case 'Emergency':
      return <AlertCircle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
    default:
      return null
  }
}

// ==================== MOBILE LIST VIEW ====================

function MobileDayList({
  day,
  appointments,
  onAppointmentClick,
}: {
  day: Date
  appointments: Appointment[]
  onAppointmentClick: (apt: Appointment) => void
}) {
  const dayStr = format(day, 'yyyy-MM-dd')
  const dayApts = appointments
    .filter((a) => a.date === dayStr)
    .sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-semibold">
          {format(day, 'EEE, MMM d')}
        </span>
        {isToday(day) && (
          <Badge variant="outline" className="h-5 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700">
            Today
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {dayApts.length} apt{dayApts.length !== 1 ? 's' : ''}
        </span>
      </div>

      {dayApts.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 py-2 italic">No appointments</p>
      ) : (
        <div className="space-y-1.5">
          {dayApts.map((apt) => {
            const colors = getTypeColor(apt.type)
            const statusInd = getStatusIndicator(apt.status)
            const patientName = apt.patient?.name || `Patient`
            const doctorName = apt.doctor?.name || ''

            return (
              <button
                key={apt.id}
                onClick={() => onAppointmentClick(apt)}
                className={`w-full text-left rounded-lg border-l-4 ${colors.border} ${colors.bg} p-3 transition-all hover:shadow-md active:scale-[0.99]`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">{formatTime12(apt.time)}</span>
                      <span className="text-xs text-muted-foreground">· {apt.duration}m</span>
                    </div>
                    <p className="text-sm font-semibold truncate mt-0.5">{patientName}</p>
                    {doctorName && (
                      <p className="text-xs text-muted-foreground truncate">{doctorName}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors.text}`}>
                      {getTypeIcon(apt.type)}
                      {apt.type}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {'dot' in statusInd && (
                        <span className={`h-2 w-2 rounded-full ${statusInd.dot}`} />
                      )}
                      {'line' in statusInd && (
                        <span className={`h-0.5 w-3 rounded ${statusInd.line}`} />
                      )}
                      <span className="text-[10px] text-muted-foreground">{statusInd.label}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== DESKTOP WEEK GRID VIEW ====================

function WeekGridView({
  weekDays,
  appointments,
  onAppointmentClick,
}: {
  weekDays: Date[]
  appointments: Appointment[]
  onAppointmentClick: (apt: Appointment) => void
}) {
  // Build a map: date -> time -> appointments
  const gridMap = useMemo(() => {
    const map = new Map<string, Map<string, Appointment[]>>()
    for (const apt of appointments) {
      const dayMap = map.get(apt.date)
      if (!dayMap) {
        const newDayMap = new Map<string, Appointment[]>()
        newDayMap.set(apt.time, [apt])
        map.set(apt.date, newDayMap)
      } else {
        const slot = dayMap.get(apt.time)
        if (slot) {
          slot.push(apt)
        } else {
          dayMap.set(apt.time, [apt])
        }
      }
    }
    return map
  }, [appointments])

  // Current time indicator position
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const showCurrentTimeLine = currentMinutes >= 9 * 60 && currentMinutes <= 21 * 60
  const currentTimePosition = showCurrentTimeLine
    ? ((currentMinutes - 9 * 60) / (12 * 60)) * 100
    : -1

  return (
    <ScrollArea className="h-[600px]">
      <div className="relative min-w-[700px]">
        {/* Time indicator */}
        {showCurrentTimeLine && (
          <div
            className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
            style={{ top: `${currentTimePosition}%` }}
          >
            <div className="absolute left-[-4px] h-3 w-3 rounded-full bg-red-500" />
            <div className="absolute left-[16px] right-0 h-[2px] bg-red-500/60" />
          </div>
        )}

        {/* Header row with day names */}
        <div className="sticky top-0 z-10 grid grid-cols-[64px_repeat(7,1fr)] bg-background border-b">
          <div className="p-1.5 text-center text-[10px] font-medium text-muted-foreground">
            Time
          </div>
          {weekDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd')
            const dayMap = gridMap.get(dayStr)
            const dayCount = dayMap
              ? Array.from(dayMap.values()).reduce((sum, arr) => sum + arr.length, 0)
              : 0

            return (
              <div
                key={dayStr}
                className={`p-1.5 text-center border-l ${isToday(day) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}
              >
                <p className="text-[10px] font-medium text-muted-foreground uppercase">
                  {format(day, 'EEE')}
                </p>
                <p
                  className={`text-sm font-bold ${
                    isToday(day)
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-foreground'
                  }`}
                >
                  {format(day, 'd')}
                </p>
                {dayCount > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {dayCount} apt{dayCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Time rows */}
        {TIME_SLOTS.map((slot, slotIdx) => (
          <div
            key={slot}
            className="grid grid-cols-[64px_repeat(7,1fr)] border-b last:border-b-0"
          >
            {/* Time label */}
            <div className="p-1 text-right pr-2 text-[10px] font-medium text-muted-foreground flex items-end justify-end">
              {slotIdx % 2 === 0 ? formatTime12(slot) : ''}
            </div>

            {/* Day cells */}
            {weekDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const dayMap = gridMap.get(dayStr)
              const slotApts = dayMap?.get(slot)

              return (
                <div
                  key={`${dayStr}-${slot}`}
                  className={`border-l min-h-[40px] p-0.5 transition-colors hover:bg-muted/30 ${
                    isToday(day) ? 'bg-emerald-50/30 dark:bg-emerald-950/10' : ''
                  }`}
                >
                  {slotApts && slotApts.length > 0 && (
                    <div className="space-y-0.5">
                      {slotApts.map((apt) => {
                        const colors = getTypeColor(apt.type)
                        const statusInd = getStatusIndicator(apt.status)
                        const patientName = apt.patient?.name || 'Patient'
                        const rowSpan = Math.max(1, Math.ceil(apt.duration / 30))

                        return (
                          <button
                            key={apt.id}
                            onClick={() => onAppointmentClick(apt)}
                            className={`w-full text-left rounded border-l-2 ${colors.border} ${colors.bg} p-1 transition-all hover:shadow-sm hover:brightness-95 active:scale-[0.98] overflow-hidden`}
                            style={{
                              minHeight: `${rowSpan * 40 - 4}px`,
                            }}
                            title={`${patientName} - ${apt.type} - ${apt.status} (${formatTime12(apt.time)})`}
                          >
                            <div className="flex items-center gap-0.5">
                              {'dot' in statusInd && (
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusInd.dot}`} />
                              )}
                              {'line' in statusInd && (
                                <span className={`h-0.5 w-2.5 rounded shrink-0 ${statusInd.line}`} />
                              )}
                              <span className={`text-[10px] font-semibold truncate ${colors.text}`}>
                                {patientName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[9px] text-muted-foreground truncate">
                                {formatTime12(apt.time)}
                              </span>
                              <Badge
                                variant="outline"
                                className={`h-3.5 px-1 text-[8px] leading-none py-0 ${colors.text}`}
                              >
                                {apt.type}
                              </Badge>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// ==================== MAIN CALENDAR COMPONENT ====================

export function AppointmentCalendar() {
  const { toast } = useToast()
  const { setCurrentPage } = useNavigation()
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  )
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [doctorsLoading, setDoctorsLoading] = useState(true)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: currentWeekStart, end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }) }),
    [currentWeekStart]
  )

  const weekStartStr = format(currentWeekStart, 'MMM d')
  const weekEndStr = format(weekDays[6], 'MMM d, yyyy')

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    setDoctorsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<DoctorOption>>('/doctors', { limit: 100 })
      setDoctors(res.data)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setDoctorsLoading(false)
    }
  }, [toast])

  // Fetch appointments for the week
  const fetchAppointments = useCallback(
    async (weekStart: Date, doctorId: string) => {
      setLoading(true)
      try {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
        // Fetch all 7 days in the week
        const params: Record<string, string | number> = {
          limit: 500,
        }
        if (doctorId !== 'all') params.doctorId = doctorId

        const res = await apiGet<PaginatedResponse<Appointment>>('/appointments', params)

        // Filter to only the current week in memory
        const weekStartStr = format(weekStart, 'yyyy-MM-dd')
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd')
        const weekApts = res.data.filter((apt) => {
          return apt.date >= weekStartStr && apt.date <= weekEndStr
        })

        setAppointments(weekApts)
      } catch (error) {
        if (error instanceof ApiError) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' })
        }
      } finally {
        setLoading(false)
      }
    },
    [toast]
  )

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDoctors()
  }, [fetchDoctors])

    
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAppointments(currentWeekStart, selectedDoctorId)
  }, [currentWeekStart, selectedDoctorId, fetchAppointments])

  const goToPrevWeek = () => setCurrentWeekStart((d) => subWeeks(d, 1))
  const goToNextWeek = () => setCurrentWeekStart((d) => addWeeks(d, 1))
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentWeekStart(startOfWeek(date, { weekStartsOn: 1 }))
      setDatePickerOpen(false)
    }
  }

  const handleAppointmentClick = (apt: Appointment) => {
    setCurrentPage('patient-detail', { id: apt.patientId })
  }

  // Get selected doctor name
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId)
  const doctorLabel = selectedDoctorId === 'all' ? 'All Doctors' : selectedDoctor?.name || 'Select Doctor'

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 gap-1.5 px-3 text-sm font-medium">
                    <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
                    {weekStartStr} – {weekEndStr}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={currentWeekStart}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant="default"
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700"
                onClick={goToToday}
              >
                Today
              </Button>
            </div>

            {/* Doctor Filter */}
            <div className="flex items-center gap-2">
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger className="h-8 w-[180px] text-sm">
                  <SelectValue placeholder={doctorsLoading ? 'Loading...' : doctorLabel}>
                    {doctorLabel}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                      All Doctors
                    </span>
                  </SelectItem>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      <span className="flex items-center gap-2">
                        <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{doc.name}</span>
                        <span className="text-xs text-muted-foreground">({doc.specialization})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t">
            <span className="text-[10px] text-muted-foreground font-medium">Type:</span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Consultation
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Follow-up
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Emergency
            </span>
            <span className="mx-1 text-muted-foreground">|</span>
            <span className="text-[10px] text-muted-foreground font-medium">Status:</span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Completed
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Scheduled
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              No-Show
            </span>
            <span className="flex items-center gap-1 text-[10px]">
              <span className="h-0.5 w-3 rounded bg-gray-400" />
              Cancelled
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-8 w-full rounded" />
            <Skeleton className="h-[500px] w-full rounded" />
          </CardContent>
        </Card>
      ) : (
        <Card>
          {/* Mobile: list view */}
          <div className="block md:hidden">
            <CardContent className="p-4">
              <div className="space-y-6">
                {weekDays.map((day) => (
                  <MobileDayList
                    key={format(day, 'yyyy-MM-dd')}
                    day={day}
                    appointments={appointments}
                    onAppointmentClick={handleAppointmentClick}
                  />
                ))}
              </div>
            </CardContent>
          </div>

          {/* Desktop: week grid view */}
          <div className="hidden md:block">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Week of {weekStartStr} – {weekEndStr}
                <span className="ml-2">
                  {loading
                    ? '...'
                    : `${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <WeekGridView
                weekDays={weekDays}
                appointments={appointments}
                onAppointmentClick={handleAppointmentClick}
              />
            </CardContent>
          </div>
        </Card>
      )}
    </div>
  )
}
