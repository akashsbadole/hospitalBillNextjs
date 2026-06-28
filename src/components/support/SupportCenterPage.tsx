'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageSquare,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Send,
  ArrowUpRight,
  CircleHelp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  HeadsetIcon,
  Timer,
  Gauge,
  TrendingUp,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  apiGet,
  apiPost,
  apiPut,
  type PaginatedResponse,
  type SingleResponse,
  ApiError,
} from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface SupportTicket {
  id: string
  ticketId: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  createdById: string
  assignedToId: string | null
  resolution: string | null
  rating: number | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; name: string; email: string; role: string } | null
  assignedTo: { id: string; name: string; email: string; role: string } | null
  _count?: { replies: number }
}

interface SupportReply {
  id: string
  ticketId: string
  userId: string
  userName: string
  userRole: string
  message: string
  isInternal: boolean
  createdAt: string
}

interface SupportStats {
  open: number
  inProgress: number
  resolved: number
  urgent: number
  resolvedToday: number
  avgResponseTime: string
  slaCompliance: number
}

interface StaffUser {
  id: string
  userId: string
  name: string
  email: string
  role: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10

const CATEGORIES = [
  'General',
  'Billing',
  'Technical',
  'Appointment',
  'Prescription',
  'Inventory',
  'Account',
  'Other',
] as const

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-700 border-gray-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Urgent: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  Open: 'bg-blue-100 text-blue-700 border-blue-200',
  'In Progress': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Closed: 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  Open: <ArrowUpRight className="size-3" />,
  'In Progress': <Loader2 className="size-3 animate-spin" />,
  Resolved: <CheckCircle2 className="size-3" />,
  Closed: <XCircle className="size-3" />,
}

const CATEGORY_COLORS: Record<string, string> = {
  General: 'bg-slate-100 text-slate-700 border-slate-300',
  Billing: 'bg-amber-100 text-amber-700 border-amber-300',
  Technical: 'bg-violet-100 text-violet-700 border-violet-300',
  Appointment: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  Prescription: 'bg-pink-100 text-pink-700 border-pink-300',
  Inventory: 'bg-orange-100 text-orange-700 border-orange-300',
  Account: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  Other: 'bg-gray-100 text-gray-600 border-gray-300',
}

// ── Priority row border ──────────────────────────────────────────────────

const PRIORITY_ROW_BORDER: Record<string, string> = {
  Urgent: 'border-l-4 border-l-red-500',
  High: 'border-l-4 border-l-orange-500',
  Medium: 'border-l-4 border-l-amber-400',
  Low: 'border-l-4 border-l-gray-300',
}

// ── SLA Badge ──────────────────────────────────────────────────────────────

function SlaBadge({ createdAt }: { createdAt: string }) {
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 2) {
    return (
      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0 h-5 gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Fresh
      </Badge>
    )
  }
  if (diffHours < 24) {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0 h-5 gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Aging
      </Badge>
    )
  }
  if (diffHours < 72) {
    return (
      <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] px-1.5 py-0 h-5 gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
        Overdue
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0 h-5 gap-0.5">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      Critical
    </Badge>
  )
}

// ── Helper Components ──────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={PRIORITY_COLORS[priority] || PRIORITY_COLORS.Low}>
      {priority}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STATUS_COLORS[status] || STATUS_COLORS.Open}>
      <span className="flex items-center gap-1">
        {STATUS_ICONS[status] || null}
        {status}
      </span>
    </Badge>
  )
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge variant="outline" className={CATEGORY_COLORS[category] || CATEGORY_COLORS.Other}>
      {category}
    </Badge>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

// ── Main Component ─────────────────────────────────────────────────────────

export function SupportCenterPage() {
  const { toast } = useToast()

  // ── Ticket list state ──
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Filters ──
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Stats ──
  const [stats, setStats] = useState<SupportStats>({
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
    resolvedToday: 0,
    avgResponseTime: '—',
    slaCompliance: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // ── Create ticket dialog ──
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    subject: '',
    description: '',
    category: 'General',
    priority: 'Medium',
  })
  const [creating, setCreating] = useState(false)

  // ── Ticket detail dialog ──
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)

  // ── Replies ──
  const [replies, setReplies] = useState<SupportReply[]>([])
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [replyMessage, setReplyMessage] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // ── Update ticket ──
  const [updateStatus, setUpdateStatus] = useState<string>('')
  const [updateAssignedTo, setUpdateAssignedTo] = useState<string>('')
  const [updateResolution, setUpdateResolution] = useState('')
  const [updatingTicket, setUpdatingTicket] = useState(false)

  // ── Staff list for assignment ──
  const [staffList, setStaffList] = useState<StaffUser[]>([])

  // ── Fetch tickets ──
  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      }
      if (debouncedSearch) params.search = debouncedSearch
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      if (priorityFilter && priorityFilter !== 'all') params.priority = priorityFilter
      if (categoryFilter && categoryFilter !== 'all') params.category = categoryFilter

      const res = await apiGet<PaginatedResponse<SupportTicket>>('/support', params)
      setTickets(res.data || [])
      setTotal(res.total || 0)
      setTotalPages(res.totalPages || 1)
    } catch (err) {
      console.error('[SupportCenter] fetch error:', err)
      const message = err instanceof ApiError ? err.message : 'Failed to load tickets'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedSearch, statusFilter, priorityFilter, categoryFilter])

  // ── Fetch stats (using lightweight paginated calls with status/priority filters) ──
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const [openRes, inProgressRes, resolvedRes, urgentRes] = await Promise.all([
        apiGet<PaginatedResponse<SupportTicket>>('/support', { status: 'Open', limit: 1 }),
        apiGet<PaginatedResponse<SupportTicket>>('/support', { status: 'In Progress', limit: 1 }),
        apiGet<PaginatedResponse<SupportTicket>>('/support', { status: 'Resolved', limit: 1 }),
        apiGet<PaginatedResponse<SupportTicket>>('/support', { priority: 'Urgent', limit: 1 }),
      ])

      // Fetch resolved tickets with replies for SLA metrics
      const resolvedListRes = await apiGet<PaginatedResponse<SupportTicket>>('/support', { status: 'Resolved', limit: 50 })

      // Calculate SLA compliance (resolved within 24h)
      let slaCompliant = 0
      let totalResolved = 0
      for (const ticket of resolvedListRes.data || []) {
        totalResolved++
        const created = new Date(ticket.createdAt)
        const updated = new Date(ticket.updatedAt)
        const diffHours = (updated.getTime() - created.getTime()) / (1000 * 60 * 60)
        if (diffHours <= 24) slaCompliant++
      }

      // Calculate resolved today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const resolvedToday = (resolvedListRes.data || []).filter(
        t => new Date(t.updatedAt) >= todayStart
      ).length

      // Calculate avg response time from resolved tickets
      const resolvedWithTime = (resolvedListRes.data || []).filter(t => t.updatedAt)
      let avgResponseMs = 0
      if (resolvedWithTime.length > 0) {
        const totalMs = resolvedWithTime.reduce((sum, t) => {
          return sum + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime())
        }, 0)
        avgResponseMs = totalMs / resolvedWithTime.length
      }
      const avgHours = avgResponseMs / (1000 * 60 * 60)
      const avgResponseStr = avgHours < 1
        ? `${Math.round(avgHours * 60)}m`
        : `${avgHours.toFixed(1)}h`

      setStats({
        open: openRes.total || 0,
        inProgress: inProgressRes.total || 0,
        resolved: resolvedRes.total || 0,
        urgent: urgentRes.total || 0,
        resolvedToday,
        avgResponseTime: avgResponseStr,
        slaCompliance: totalResolved > 0 ? Math.round((slaCompliant / totalResolved) * 100) : 100,
      })
    } catch (err) {
      console.error('[SupportCenter] stats error:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // ── Fetch staff ──
  const fetchStaff = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<StaffUser>>('/staff', { limit: 100 })
      setStaffList(res.data || [])
    } catch (err) {
      // Staff list is optional — don't block UI
      console.error('[SupportCenter] staff fetch error:', err)
    }
  }, [])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTickets()
  }, [fetchTickets])

    
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
  }, [fetchStats])

    
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStaff()
  }, [fetchStaff])

  // ── Search with debounce ──
  const handleSearchChange = (value: string) => {
    setSearch(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value)
      setCurrentPage(1)
    }, 300)
  }

  const handleFilterChange = (
    filter: 'status' | 'priority' | 'category',
    value: string
  ) => {
    if (filter === 'status') setStatusFilter(value)
    if (filter === 'priority') setPriorityFilter(value)
    if (filter === 'category') setCategoryFilter(value)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // ── Create ticket ──
  const handleCreateTicket = async () => {
    if (!createForm.subject.trim() || !createForm.description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Subject and description are required.',
        variant: 'destructive',
      })
      return
    }
    setCreating(true)
    try {
      await apiPost<SingleResponse<SupportTicket>>('/support', {
        subject: createForm.subject.trim(),
        description: createForm.description.trim(),
        category: createForm.category,
        priority: createForm.priority,
      })
      toast({ title: 'Ticket Created', description: 'Your support ticket has been submitted.' })
      setCreateDialogOpen(false)
      setCreateForm({ subject: '', description: '', category: 'General', priority: 'Medium' })
      fetchTickets()
      fetchStats()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create ticket'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  // ── View ticket detail ──
  const handleViewTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setUpdateStatus(ticket.status)
    setUpdateAssignedTo(ticket.assignedToId || '')
    setUpdateResolution(ticket.resolution || '')
    setDetailDialogOpen(true)

    // Fetch replies
    setRepliesLoading(true)
    try {
      const res = await apiGet<{ data: SupportReply[] }>(`/support/${ticket.id}/replies`)
      setReplies(res.data || [])
    } catch (err) {
      console.error('[SupportCenter] replies fetch error:', err)
      setReplies([])
    } finally {
      setRepliesLoading(false)
    }
  }

  // ── Update ticket ──
  const handleUpdateTicket = async () => {
    if (!selectedTicket) return
    setUpdatingTicket(true)
    try {
      await apiPut<SingleResponse<SupportTicket>>(`/support/${selectedTicket.id}`, {
        status: updateStatus,
        priority: selectedTicket.priority,
        assignedToId: updateAssignedTo || null,
        resolution: updateResolution || null,
      })
      toast({ title: 'Ticket Updated', description: 'Changes have been saved.' })

      // Refresh the ticket data
      try {
        const res = await apiGet<PaginatedResponse<SupportTicket>>('/support', {
          status: selectedTicket.status,
          limit: 1,
        })
        // Just verify the ticket still exists — use the existing selectedTicket
        if (!res.data || res.data.length === 0) {
          setSelectedTicket(null)
          setDetailDialogOpen(false)
        }
      } catch {
        // ignore
      }

      fetchTickets()
      fetchStats()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to update ticket'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setUpdatingTicket(false)
    }
  }

  // ── Send reply ──
  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return
    setSendingReply(true)
    try {
      await apiPost<SingleResponse<SupportReply>>(
        `/support/${selectedTicket.id}/replies`,
        { message: replyMessage.trim() }
      )
      toast({ title: 'Reply Sent', description: 'Your reply has been posted.' })
      setReplyMessage('')

      // Refresh replies
      const res = await apiGet<{ data: SupportReply[] }>(`/support/${selectedTicket.id}/replies`)
      setReplies(res.data || [])
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to send reply'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSendingReply(false)
    }
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Support Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage support tickets and help requests
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
        >
          <Plus className="size-4" />
          New Ticket
        </Button>
      </div>

      {/* ── Response Metrics Card ── */}
      {statsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-xl border shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-10" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Average Response Time */}
          <Card className="rounded-xl border shadow-sm border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Avg Response Time
                  </p>
                  <p className="mt-1 text-2xl font-bold">{stats.avgResponseTime}</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Timer className="size-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tickets Resolved Today */}
          <Card className="rounded-xl border shadow-sm border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Resolved Today
                  </p>
                  <p className="mt-1 text-2xl font-bold">{stats.resolvedToday}</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
                  <TrendingUp className="size-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SLA Compliance */}
          <Card className={cn(
            'rounded-xl border shadow-sm border-l-4',
            stats.slaCompliance >= 90 ? 'border-l-emerald-500' : stats.slaCompliance >= 70 ? 'border-l-amber-500' : 'border-l-red-500'
          )}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    SLA Compliance
                  </p>
                  <p className={cn(
                    'mt-1 text-2xl font-bold',
                    stats.slaCompliance >= 90 ? 'text-emerald-600' : stats.slaCompliance >= 70 ? 'text-amber-600' : 'text-red-600'
                  )}>
                    {stats.slaCompliance}%
                  </p>
                </div>
                <div className={cn(
                  'flex size-10 items-center justify-center rounded-lg',
                  stats.slaCompliance >= 90 ? 'bg-emerald-100' : stats.slaCompliance >= 70 ? 'bg-amber-100' : 'bg-red-100'
                )}>
                  <Gauge className={cn(
                    'size-5',
                    stats.slaCompliance >= 90 ? 'text-emerald-600' : stats.slaCompliance >= 70 ? 'text-amber-600' : 'text-red-600'
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Open Urgent */}
          <Card className="rounded-xl border shadow-sm border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Open Urgent
                  </p>
                  <p className="mt-1 text-2xl font-bold text-red-600">{stats.urgent}</p>
                </div>
                <div className="flex size-10 items-center justify-center rounded-lg bg-red-100">
                  <AlertTriangle className="size-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Stats Row (existing) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Open Tickets */}
        <Card className="rounded-xl border shadow-sm border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Open Tickets
                </p>
                <p className="mt-1 text-2xl font-bold">{stats.open}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100">
                <ArrowUpRight className="size-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card className="rounded-xl border shadow-sm border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  In Progress
                </p>
                <p className="mt-1 text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-yellow-100">
                <Clock className="size-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resolved */}
        <Card className="rounded-xl border shadow-sm border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Resolved
                </p>
                <p className="mt-1 text-2xl font-bold">{stats.resolved}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Urgent */}
        <Card className="rounded-xl border shadow-sm border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total Urgent
                </p>
                <p className="mt-1 text-2xl font-bold text-red-600">{stats.urgent}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Bar ── */}
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by ticket ID, subject, or keyword..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => handleFilterChange('status', v)}
              >
                <SelectTrigger className="w-[150px]">
                  <Filter className="size-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={priorityFilter}
                onValueChange={(v) => handleFilterChange('priority', v)}
              >
                <SelectTrigger className="w-[150px]">
                  <AlertTriangle className="size-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(v) => handleFilterChange('category', v)}
              >
                <SelectTrigger className="w-[160px]">
                  <CircleHelp className="size-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tickets Table — Desktop ── */}
      {loading ? (
        <Card className="rounded-xl border shadow-sm hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[110px]">Ticket ID</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[100px]">Priority</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[90px]">SLA</TableHead>
                  <TableHead className="hidden lg:table-cell">Created By</TableHead>
                  <TableHead className="w-[110px] hidden lg:table-cell">Date</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="size-12 text-red-400 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">Failed to load tickets</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={fetchTickets}>
              <RefreshCw className="size-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="rounded-xl border shadow-sm hidden md:block">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h3 className="text-base font-semibold">Support Tickets</h3>
                  <p className="text-sm text-muted-foreground">
                    Showing {tickets.length} of {total} tickets
                  </p>
                </div>
              </div>
              <ScrollArea className="max-h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[110px]">Ticket ID</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="w-[120px]">Category</TableHead>
                      <TableHead className="w-[100px]">Priority</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[90px]">SLA</TableHead>
                      <TableHead className="hidden lg:table-cell">Created By</TableHead>
                      <TableHead className="w-[110px] hidden lg:table-cell">Date</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <HeadsetIcon className="mx-auto size-12 text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">No tickets found</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              setStatusFilter('all')
                              setPriorityFilter('all')
                              setCategoryFilter('all')
                              setSearch('')
                              setDebouncedSearch('')
                            }}
                          >
                            Clear Filters
                          </Button>
                        </TableCell>
                      </TableRow>
                    ) : (
                      tickets.map((ticket) => (
                        <TableRow
                          key={ticket.id}
                          className={cn(
                            'cursor-pointer transition-colors hover:bg-muted/50',
                            PRIORITY_ROW_BORDER[ticket.priority] || ''
                          )}
                          onClick={() => handleViewTicket(ticket)}
                        >
                          <TableCell className="font-medium text-emerald-700 dark:text-emerald-400">
                            {ticket.ticketId}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[280px]">
                              <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {ticket.description.slice(0, 60)}
                                {ticket.description.length > 60 ? '...' : ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <CategoryBadge category={ticket.category} />
                          </TableCell>
                          <TableCell>
                            <PriorityBadge priority={ticket.priority} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={ticket.status} />
                          </TableCell>
                          <TableCell>
                            <SlaBadge createdAt={ticket.createdAt} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold shrink-0">
                                {ticket.createdBy?.name
                                  ?.split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .toUpperCase()
                                  .slice(0, 2) || '?'}
                              </div>
                              <span className="text-sm truncate max-w-[100px]">
                                {ticket.createdBy?.name || 'Unknown'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                            {formatDate(ticket.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewTicket(ticket)
                              }}
                            >
                              <Eye className="size-4" />
                              <span className="sr-only">View Details</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-6 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      <ChevronLeft className="size-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      Next
                      <ChevronRight className="size-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Mobile Cards ── */}
          <div className="flex flex-col gap-3 md:hidden">
            {tickets.length === 0 ? (
              <Card className="rounded-xl border shadow-sm">
                <CardContent className="p-6 text-center">
                  <HeadsetIcon className="mx-auto size-12 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No tickets found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setStatusFilter('all')
                      setPriorityFilter('all')
                      setCategoryFilter('all')
                      setSearch('')
                      setDebouncedSearch('')
                    }}
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              tickets.map((ticket) => (
                <Card
                  key={ticket.id}
                  className={cn(
                    'rounded-xl border shadow-sm cursor-pointer hover:border-emerald-200 transition-colors',
                    PRIORITY_ROW_BORDER[ticket.priority] || ''
                  )}
                  onClick={() => handleViewTicket(ticket)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {ticket.ticketId}
                          </span>
                          <StatusBadge status={ticket.status} />
                        </div>
                        <p className="font-semibold text-foreground mt-1 truncate">{ticket.subject}</p>
                      </div>
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <CategoryBadge category={ticket.category} />
                      <SlaBadge createdAt={ticket.createdAt} />
                      <span className="text-xs text-muted-foreground">
                        {ticket.createdBy?.name || 'Unknown'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(ticket.createdAt)}
                      </span>
                    </div>
                    {ticket._count && ticket._count.replies > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="size-3" />
                        {ticket._count.replies} {ticket._count.replies === 1 ? 'reply' : 'replies'}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewTicket(ticket)
                        }}
                      >
                        <Eye className="size-3.5 mr-1" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Mobile Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <ChevronLeft className="size-4 mr-1" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    Next
                    <ChevronRight className="size-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Create Ticket Dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-5 text-emerald-600" />
              Create Support Ticket
            </DialogTitle>
            <DialogDescription>
              Describe your issue and our team will get back to you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="ticket-subject">
                Subject <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ticket-subject"
                placeholder="Brief summary of your issue"
                value={createForm.subject}
                onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="ticket-description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="ticket-description"
                placeholder="Please provide detailed information about your issue..."
                rows={4}
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                className="resize-none"
              />
            </div>

            {/* Category + Priority Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={createForm.category}
                  onValueChange={(v) => setCreateForm({ ...createForm, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={createForm.priority}
                  onValueChange={(v) => setCreateForm({ ...createForm, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTicket}
              disabled={creating || !createForm.subject.trim() || !createForm.description.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {creating && <Loader2 className="size-4 mr-2 animate-spin" />}
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Ticket Detail Dialog ── */}
      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDialogOpen(false)
            setSelectedTicket(null)
            setReplies([])
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
          {selectedTicket && (
            <>
              {/* Dialog Header */}
              <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono text-emerald-600">{selectedTicket.ticketId}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{formatRelativeTime(selectedTicket.createdAt)}</span>
                  <SlaBadge createdAt={selectedTicket.createdAt} />
                </div>
                <DialogTitle className="text-lg">{selectedTicket.subject}</DialogTitle>
                <DialogDescription className="sr-only">
                  Details for ticket {selectedTicket.ticketId}
                </DialogDescription>
              </DialogHeader>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="space-y-6">
                  {/* Ticket Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <StatusBadge status={selectedTicket.status} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Priority</p>
                      <PriorityBadge priority={selectedTicket.priority} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Category</p>
                      <CategoryBadge category={selectedTicket.category} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Created</p>
                      <p className="text-sm font-medium">{formatDateTime(selectedTicket.createdAt)}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Description</p>
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.description}
                      </p>
                    </div>
                  </div>

                  {/* Created By / Assigned To */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Created By</p>
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          {selectedTicket.createdBy?.name
                            ?.split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{selectedTicket.createdBy?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{selectedTicket.createdBy?.role || ''}</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                      {selectedTicket.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            {selectedTicket.assignedTo.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{selectedTicket.assignedTo.name}</p>
                            <p className="text-xs text-muted-foreground">{selectedTicket.assignedTo.role}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Unassigned</p>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* ── Update Controls ── */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="size-4 text-muted-foreground" />
                      Ticket Management
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Status Update */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Update Status</Label>
                        <Select value={updateStatus} onValueChange={setUpdateStatus}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Assign To */}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Assign To</Label>
                        <Select value={updateAssignedTo} onValueChange={setUpdateAssignedTo}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select staff..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {staffList.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} ({s.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Save Button */}
                      <div className="flex items-end">
                        <Button
                          onClick={handleUpdateTicket}
                          disabled={updatingTicket}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          size="sm"
                        >
                          {updatingTicket && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
                          Save Changes
                        </Button>
                      </div>
                    </div>

                    {/* Resolution (visible when Resolved or Closed) */}
                    {(updateStatus === 'Resolved' || updateStatus === 'Closed') && (
                      <div className="mt-4 space-y-1.5">
                        <Label className="text-xs">Resolution Notes</Label>
                        <Textarea
                          placeholder="Describe how the issue was resolved..."
                          rows={3}
                          value={updateResolution}
                          onChange={(e) => setUpdateResolution(e.target.value)}
                          className="resize-none text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* ── Replies ── */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <MessageSquare className="size-4 text-muted-foreground" />
                      Replies ({replies.length})
                    </h4>

                    {repliesLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Skeleton className="size-6 rounded-full" />
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        ))}
                      </div>
                    ) : replies.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <MessageSquare className="mx-auto size-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No replies yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Be the first to respond to this ticket.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {replies.map((reply) => (
                          <div
                            key={reply.id}
                            className={`rounded-lg border p-3 ${
                              reply.isInternal ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20' : 'bg-muted/30'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                                  {reply.userName
                                    .split(' ')
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                    .slice(0, 2)}
                                </div>
                                <span className="text-sm font-medium">{reply.userName}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  {reply.userRole}
                                </Badge>
                                {reply.isInternal && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-amber-100 text-amber-700 border-amber-200">
                                    Internal
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(reply.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input */}
                    <div className="mt-4 flex flex-col gap-2">
                      <Textarea
                        placeholder="Type your reply..."
                        rows={2}
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        className="resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            handleSendReply()
                          }
                        }}
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleSendReply}
                          disabled={sendingReply || !replyMessage.trim()}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {sendingReply ? (
                            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Send className="size-3.5 mr-1.5" />
                          )}
                          Send Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
