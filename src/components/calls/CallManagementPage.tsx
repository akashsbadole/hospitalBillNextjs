'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import {
  Video,
  Phone,
  PhoneCall,
  PhoneOff,
  Calendar,
  Clock,
  User,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Plus,
  MoreHorizontal,
  Loader2,
  Filter,
  MessageSquare,
  Search,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiPost, apiDelete, ApiError, type PaginatedResponse } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScheduleCallDialog } from './ScheduleCallDialog'
import { ActiveCallPanel } from './ActiveCallPanel'
import { CallDetailDialog } from './CallDetailDialog'
import { VideoCallContainer } from './VideoCallContainer'
import type { ActiveCallData } from './VideoCallContainer'

// ==================== TYPES ====================

interface CallSession {
  id: string
  sessionId: string
  appointmentId?: string
  patientId: string
  doctorId: string
  visitId?: string
  status: 'Scheduled' | 'In-Progress' | 'Completed' | 'Missed' | 'Cancelled'
  callType: 'Video' | 'Audio' | 'Chat'
  scheduledAt?: string
  startedAt?: string
  endedAt?: string
  duration: number
  notes?: string
  diagnosis?: string
  followUpNotes?: string
  rating?: number
  createdAt: string
  patient?: { name: string; phone: string }
  doctor?: { name: string; specialization: string }
}

interface CallStats {
  scheduled: number
  inProgress: number
  completed: number
  missed: number
  total: number
}

interface DoctorOption {
  id: string
  name: string
  specialization: string
}

// ==================== HELPERS ====================

function getStatusConfig(status: string) {
  switch (status) {
    case 'Scheduled':
      return {
        badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200',
        icon: Calendar,
        iconClass: 'text-amber-500',
        pulse: false,
      }
    case 'In-Progress':
      return {
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200',
        icon: Phone,
        iconClass: 'text-emerald-500',
        pulse: true,
      }
    case 'Completed':
      return {
        badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200',
        icon: CheckCircle2,
        iconClass: 'text-emerald-500',
        pulse: false,
      }
    case 'Missed':
      return {
        badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200',
        icon: AlertTriangle,
        iconClass: 'text-red-500',
        pulse: false,
      }
    case 'Cancelled':
      return {
        badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200',
        icon: PhoneOff,
        iconClass: 'text-gray-500',
        pulse: false,
      }
    default:
      return {
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
        icon: Clock,
        iconClass: 'text-gray-500',
        pulse: false,
      }
  }
}

function getCallTypeConfig(type: string) {
  switch (type) {
    case 'Video':
      return {
        badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200',
        icon: Video,
      }
    case 'Audio':
      return {
        badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200',
        icon: Phone,
      }
    case 'Chat':
      return {
        badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200',
        icon: MessageSquare,
      }
    default:
      return {
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
        icon: Phone,
      }
  }
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '--'
  try {
    return format(new Date(dateStr), 'MMM d, yyyy h:mm a')
  } catch {
    return '--'
  }
}

// ==================== SUB COMPONENTS ====================

function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status)
  const Icon = config.icon
  return (
    <Badge
      variant="outline"
      className={`${config.badgeClass} gap-1 ${config.pulse ? 'animate-pulse' : ''}`}
    >
      <Icon className={`h-3 w-3 ${config.iconClass}`} />
      {status}
    </Badge>
  )
}

function CallTypeBadge({ type }: { type: string }) {
  const config = getCallTypeConfig(type)
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`${config.badgeClass} gap-1`}>
      <Icon className="h-3 w-3" />
      {type}
    </Badge>
  )
}

function DurationTimer({ startedAt }: { startedAt: string }) {
  const startMs = new Date(startedAt).getTime()
  const calcElapsed = useCallback(() => Math.max(0, Math.floor((Date.now() - startMs) / 1000)), [startMs])
  const [elapsed, setElapsed] = useState(() => calcElapsed())

  useEffect(() => {
    const interval = setInterval(() => {
       
      setElapsed(calcElapsed())
    }, 1000)
    return () => clearInterval(interval)
  }, [calcElapsed])

  return (
    <span className="font-mono text-sm font-medium text-emerald-600 dark:text-emerald-400">
      {formatDuration(elapsed)}
    </span>
  )
}

function StatsCards({ stats, loading }: { stats: CallStats; loading: boolean }) {
  const cards = [
    {
      label: 'Scheduled Today',
      value: stats.scheduled,
      icon: Calendar,
      color: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'In Progress',
      value: stats.inProgress,
      icon: Phone,
      color: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      pulse: stats.inProgress > 0,
    },
    {
      label: 'Completed Today',
      value: stats.completed,
      icon: CheckCircle2,
      color: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Missed',
      value: stats.missed,
      icon: AlertTriangle,
      color: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label} className="py-4">
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.color} ${
                  card.pulse ? 'animate-pulse' : ''
                }`}
              >
                <Icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {loading ? <Loader2 className="size-5 animate-spin" /> : card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ActiveCallsBanner({
  activeCalls,
  onEndCall,
  onJoinCall,
}: {
  activeCalls: CallSession[]
  onEndCall: (callId: string) => void
  onJoinCall: (call: CallSession) => void
}) {
  if (activeCalls.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
        <Phone className="h-4 w-4 animate-pulse" />
        You have {activeCalls.length} active call{activeCalls.length !== 1 ? 's' : ''}
      </div>
      {activeCalls.slice(0, 3).map((call) => (
        <ActiveCallPanel
          key={call.id}
          call={{
            id: call.id,
            sessionId: call.sessionId,
            patientId: call.patientId,
            patientName: call.patient?.name || `Patient ${call.patientId.slice(0, 6)}`,
            patientPhone: call.patient?.phone,
            doctorId: call.doctorId,
            doctorName: call.doctor?.name || `Doctor ${call.doctorId.slice(0, 6)}`,
            doctorSpecialization: call.doctor?.specialization,
            callType: call.callType,
            startedAt: call.startedAt || call.createdAt,
            visitId: call.visitId,
          }}
          onEndCall={onEndCall}
          onJoinCall={() => onJoinCall(call)}
        />
      ))}
    </div>
  )
}

// ==================== MAIN COMPONENT ====================

export function CallManagementPage() {
  const { toast } = useToast()
  const [calls, setCalls] = useState<CallSession[]>([])
  const [activeCalls, setActiveCalls] = useState<CallSession[]>([])
  const [stats, setStats] = useState<CallStats>({
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    missed: 0,
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [viewTab, setViewTab] = useState('Scheduled')
  const [callTypeFilter, setCallTypeFilter] = useState<string>('all')
  const [doctorFilter, setDoctorFilter] = useState<string>('all')
  const [doctors, setDoctors] = useState<DoctorOption[]>([])
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [detailCallId, setDetailCallId] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [joinCallData, setJoinCallData] = useState<ActiveCallData | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch doctors for filter
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<DoctorOption>>('/doctors', { limit: 100 })
      setDoctors(res.data)
    } catch {
      // silent fail for filter dropdown
    }
  }, [])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const res = await apiGet<{ data: CallStats }>('/calls', { stats: 'true' })
      if (res.data) {
        setStats(res.data)
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoadingStats(false)
    }
  }, [toast])

  // Fetch active calls
  const fetchActiveCalls = useCallback(async () => {
    try {
      const res = await apiGet<CallSession[] | { data: CallSession[] }>('/calls/active')
      const list = Array.isArray(res) ? res : (res as { data: CallSession[] }).data || []
      setActiveCalls(Array.isArray(list) ? list : [])
    } catch {
      setActiveCalls([])
    }
  }, [])

  // Fetch call list
  const fetchCalls = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {
        page,
        limit: 20,
      }
      if (viewTab === 'Active') {
        // fetch active separately, show nothing here
        setCalls([])
        setLoading(false)
        return
      }
      if (viewTab === 'All') {
        // no status filter
      } else {
        params.status = viewTab
      }
      if (callTypeFilter !== 'all') {
        params.callType = callTypeFilter
      }
      if (doctorFilter !== 'all') {
        params.doctorId = doctorFilter
      }
      // Search is handled client-side after fetch

      const res = await apiGet<PaginatedResponse<CallSession>>('/calls', params)
      setCalls(res.data)
      setTotalPages(res.totalPages)
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    } finally {
      setLoading(false)
    }
  }, [viewTab, callTypeFilter, doctorFilter, page, toast])

  // Initial load
   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDoctors()
     
    fetchStats()
     
    fetchActiveCalls()
  }, [fetchDoctors, fetchStats, fetchActiveCalls])

  // Fetch calls when filters change
   
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchCalls()
    }, 150)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [viewTab, callTypeFilter, doctorFilter, page, fetchCalls])

  // Auto-refresh active calls every 30 seconds
   
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchActiveCalls()
      if (viewTab === 'Active') {
        fetchCalls()
      }
    }, 30000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchActiveCalls, fetchCalls, viewTab])

  // Actions
  const handleStartCall = async (callId: string) => {
    try {
      await apiPost(`/calls/${callId}/start`)
      toast({ title: 'Call Started', description: 'The call is now in progress.' })
      fetchStats()
      fetchActiveCalls()
      fetchCalls()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    }
  }

  const handleEndCall = async (callId: string) => {
    try {
      await apiPost(`/calls/${callId}/end`)
      toast({ title: 'Call Ended', description: 'The call has been ended.' })
      fetchStats()
      fetchActiveCalls()
      fetchCalls()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    }
  }

  const handleCancelCall = async (callId: string) => {
    try {
      await apiDelete(`/calls/${callId}`)
      toast({ title: 'Cancelled', description: 'Call has been cancelled.' })
      fetchStats()
      fetchCalls()
    } catch (error) {
      if (error instanceof ApiError) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' })
      }
    }
  }

  const handleViewDetail = (callId: string) => {
    setDetailCallId(callId)
    setDetailDialogOpen(true)
  }

  const handleJoinCall = (call: CallSession) => {
    setJoinCallData({
      id: call.id,
      sessionId: call.sessionId,
      patientId: call.patientId,
      patientName: call.patient?.name || `Patient ${call.patientId.slice(0, 6)}`,
      patientPhone: call.patient?.phone,
      doctorId: call.doctorId,
      doctorName: call.doctor?.name || `Doctor ${call.doctorId.slice(0, 6)}`,
      doctorSpecialization: call.doctor?.specialization,
      callType: call.callType,
      startedAt: call.startedAt || call.createdAt,
      visitId: call.visitId,
      appointmentId: call.appointmentId,
    })
  }

  const handleVideoCallClosed = () => {
    setJoinCallData(null)
  }

  const handleVideoCallEnded = () => {
    setJoinCallData(null)
    fetchStats()
    fetchActiveCalls()
    fetchCalls()
  }

  const handleScheduleSuccess = () => {
    setScheduleDialogOpen(false)
    fetchStats()
    fetchCalls()
    fetchActiveCalls()
  }

  // Client-side search filter
  const filteredCalls = (viewTab === 'Active' ? activeCalls : calls).filter(c => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      c.patient?.name?.toLowerCase().includes(q) ||
      c.doctor?.name?.toLowerCase().includes(q) ||
      c.sessionId.toLowerCase().includes(q)
    )
  })

  // Active calls to display in "Active" tab (filtered)
  const displayCalls = filteredCalls

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telemedicine Calls</h1>
          <p className="text-sm text-muted-foreground">
            Schedule and manage video/audio consultations
          </p>
        </div>
        <Button
          onClick={() => setScheduleDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          Schedule Call
        </Button>
      </div>

      {/* Stats Cards */}
      <StatsCards stats={stats} loading={loadingStats} />

      {/* Active Calls Banner */}
      <ActiveCallsBanner activeCalls={activeCalls} onEndCall={handleEndCall} onJoinCall={handleJoinCall} />

      {/* Filters & Tabs */}
      <div className="flex flex-col gap-4">
        {/* Filter Row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search calls..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2">
            <Select
              value={callTypeFilter}
              onValueChange={(v) => {
                setCallTypeFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-[130px]">
                <Filter className="mr-1 h-3.5 w-3.5" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Video">
                  <span className="flex items-center gap-1.5">
                    <Video className="h-3 w-3" /> Video
                  </span>
                </SelectItem>
                <SelectItem value="Audio">
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> Audio
                  </span>
                </SelectItem>
                <SelectItem value="Chat">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" /> Chat
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {doctors.length > 0 && (
              <Select
                value={doctorFilter}
                onValueChange={(v) => {
                  setDoctorFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <Stethoscope className="mr-1 h-3.5 w-3.5" />
                  <SelectValue placeholder="All Doctors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* View Tabs */}
        <Tabs value={viewTab} onValueChange={(v) => { setViewTab(v); setPage(1) }}>
          <TabsList>
            <TabsTrigger value="Scheduled" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="Active" className="gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              Active
              {stats.inProgress > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full bg-emerald-100 text-emerald-700 px-1.5 text-[10px]">
                  {stats.inProgress}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="Completed" className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed
            </TabsTrigger>
            <TabsTrigger value="All" className="gap-1.5">
              <PhoneCall className="h-3.5 w-3.5" />
              All
            </TabsTrigger>
          </TabsList>

          <TabsContent value={viewTab} className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    {viewTab === 'Active' ? 'Active Calls' : viewTab === 'Scheduled' ? 'Scheduled Calls' : viewTab === 'Completed' ? 'Completed Calls' : 'All Calls'}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {loading ? '...' : `${displayCalls.length} call${displayCalls.length !== 1 ? 's' : ''}`}
                    </span>
                  </span>
                  {viewTab === 'Active' && stats.inProgress > 0 && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 animate-pulse">
                      <Phone className="mr-1 h-3 w-3" /> {stats.inProgress} Live
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Active tab: show as panels */}
                {viewTab === 'Active' ? (
                  <ActiveCallsList
                    calls={displayCalls}
                    loading={loading}
                    onEndCall={handleEndCall}
                    onViewDetail={handleViewDetail}
                    onJoinCall={handleJoinCall}
                  />
                ) : (
                  <CallTable
                    calls={displayCalls}
                    loading={loading}
                    onStartCall={handleStartCall}
                    onEndCall={handleEndCall}
                    onCancelCall={handleCancelCall}
                    onViewDetail={handleViewDetail}
                    onJoinCall={handleJoinCall}
                  />
                )}
              </CardContent>

              {/* Pagination */}
              {viewTab !== 'Active' && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 px-4 py-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Schedule Call Dialog */}
      <ScheduleCallDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onSuccess={handleScheduleSuccess}
      />

      {/* Call Detail Dialog */}
      {detailCallId && (
        <CallDetailDialog
          callId={detailCallId}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
        />
      )}

      {/* Video Call Container */}
      {joinCallData && (
        <VideoCallContainer
          call={joinCallData}
          onClose={handleVideoCallClosed}
          onCallEnded={handleVideoCallEnded}
        />
      )}
    </div>
  )
}

// ==================== TABLE COMPONENTS ====================

function CallTable({
  calls,
  loading,
  onStartCall,
  onEndCall,
  onCancelCall,
  onViewDetail,
  onJoinCall,
}: {
  calls: CallSession[]
  loading: boolean
  onStartCall: (id: string) => void
  onEndCall: (id: string) => void
  onCancelCall: (id: string) => void
  onViewDetail: (id: string) => void
  onJoinCall: (call: CallSession) => void
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="py-16 text-center">
        <PhoneCall className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">No calls found</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[110px]">Session</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead className="hidden md:table-cell">Doctor</TableHead>
            <TableHead className="hidden sm:table-cell">Type</TableHead>
            <TableHead className="hidden lg:table-cell">Scheduled</TableHead>
            <TableHead className="hidden lg:table-cell">Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id}>
              <TableCell className="font-mono text-xs font-medium">
                {call.sessionId}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white text-[11px] font-bold">
                    {(call.patient?.name || 'P').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {call.patient?.name || `Patient ${call.patientId.slice(0, 6)}`}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white text-[11px] font-bold">
                    {(call.doctor?.name || 'D').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {call.doctor?.name || `Doctor ${call.doctorId.slice(0, 6)}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {call.doctor?.specialization || ''}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <CallTypeBadge type={call.callType} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-sm text-muted-foreground">
                  {call.scheduledAt ? formatDateTime(call.scheduledAt) : formatDateTime(call.createdAt)}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {call.status === 'In-Progress' && call.startedAt ? (
                  <DurationTimer startedAt={call.startedAt} />
                ) : call.duration > 0 ? (
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(call.duration)}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">--:--</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={call.status} />
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
                    {call.status === 'Scheduled' && (
                      <DropdownMenuItem onClick={() => onStartCall(call.id)}>
                        <PhoneCall className="mr-2 h-4 w-4 text-emerald-500" />
                        Start Call
                      </DropdownMenuItem>
                    )}
                    {call.status === 'In-Progress' && (
                      <DropdownMenuItem onClick={() => onEndCall(call.id)}>
                        <PhoneOff className="mr-2 h-4 w-4 text-red-500" />
                        End Call
                      </DropdownMenuItem>
                    )}
                    {call.status === 'In-Progress' && (
                      <DropdownMenuItem onClick={() => onJoinCall(call)}>
                        <Video className="mr-2 h-4 w-4 text-purple-500" />
                        Join Video Call
                      </DropdownMenuItem>
                    )}
                    {(call.status === 'Scheduled' || call.status === 'In-Progress') && (
                      <DropdownMenuItem onClick={() => onViewDetail(call.id)}>
                        <User className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                    )}
                    {call.status === 'Scheduled' && (
                      <DropdownMenuItem
                        onClick={() => onCancelCall(call.id)}
                        className="text-red-600"
                      >
                        <PhoneOff className="mr-2 h-4 w-4" />
                        Cancel
                      </DropdownMenuItem>
                    )}
                    {(call.status === 'Completed' || call.status === 'Missed' || call.status === 'Cancelled') && (
                      <DropdownMenuItem onClick={() => onViewDetail(call.id)}>
                        <User className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ActiveCallsList({
  calls,
  loading,
  onEndCall,
  onViewDetail,
  onJoinCall,
}: {
  calls: CallSession[]
  loading: boolean
  onEndCall: (callId: string) => void
  onViewDetail: (callId: string) => void
  onJoinCall: (call: CallSession) => void
}) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (calls.length === 0) {
    return (
      <div className="py-16 text-center">
        <PhoneOff className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">No active calls</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {calls.map((call) => (
        <ActiveCallPanel
          key={call.id}
          call={{
            id: call.id,
            sessionId: call.sessionId,
            patientId: call.patientId,
            patientName: call.patient?.name || `Patient ${call.patientId.slice(0, 6)}`,
            patientPhone: call.patient?.phone,
            doctorId: call.doctorId,
            doctorName: call.doctor?.name || `Doctor ${call.doctorId.slice(0, 6)}`,
            doctorSpecialization: call.doctor?.specialization,
            callType: call.callType,
            startedAt: call.startedAt || call.createdAt,
            visitId: call.visitId,
          }}
          onEndCall={onEndCall}
          onViewDetail={onViewDetail}
          onJoinCall={() => onJoinCall(call)}
        />
      ))}
    </div>
  )
}
