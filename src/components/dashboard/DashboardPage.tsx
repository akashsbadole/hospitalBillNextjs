'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiGet, apiPost, type SingleResponse, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { useNavigation } from '@/stores/navigation'
import { formatCurrency, cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  Users,
  CalendarDays,
  IndianRupee,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Plus,
  CalendarPlus,
  FileText,
  Clock,
  Stethoscope,
  Activity,
  UserCheck,
  LogOut,
  BedDouble,
  Timer,
  ClipboardList,
  ShieldCheck,
  Banknote,
  Smartphone,
  CreditCard,
  CheckCircle2,
  XCircle,
  PackageX,
  DollarSign,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'

// ─── Types ─────────────────────────────────────────────────────────────────

interface WorkflowMetrics {
  activeVisits: number
  todayRegistrations: number
  visitsByStage: Array<{ stage: string; count: number }>
  avgConsultationTime: number
  todaysDischarges: number
  opdVsIpd: { opd: number; ipd: number }
}

interface AuditLogEntry {
  id: string
  userId: string
  userName: string
  userEmail: string
  userRole: string
  action: string
  module: string
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  status: string
  createdAt: string
}

interface DashboardData {
  totalPatients: number
  todayAppointments: number
  todayRevenue: number
  outstandingPayments: number
  recentAppointments: Array<{
    id: string
    aptId: string
    patientId: string
    doctorId: string
    date: string
    time: string
    status: string
    type: string
    notes: string | null
    patient: { id: string; patientId: string; name: string } | null
    doctor: { id: string; doctorId: string; name: string; specialization: string } | null
  }>
  recentPayments: Array<{
    id: string
    amount: number
    method: string
    status: string
    createdAt: string
    patient: { id: string; patientId: string; name: string } | null
    invoice: { id: string; invoiceNumber: string } | null
  }>
  appointmentsByStatus: {
    Scheduled: number
    Completed: number
    Cancelled: number
    'No-Show': number
  }
  monthlyRevenue: Array<{
    month: string
    label: string
    revenue: number
  }>
  workflowMetrics: WorkflowMetrics
}

interface PendingPayment {
  id: string
  invoiceNumber: string
  totalAmount: number
  paidAmount: number
  status: string
  patient: { id: string; name: string } | null
}

interface ActiveVisit {
  id: string
  visitId: string
  patient: { id: string; name: string } | null
  currentStage: string
}

// ─── Stage Colors (matching WorkflowStepper) ───────────────────────────────

const STAGE_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  'Registration':      { bg: 'bg-slate-100 dark:bg-slate-800',       bar: 'bg-slate-500',        text: 'text-slate-700 dark:text-slate-300' },
  'Triage':           { bg: 'bg-amber-100 dark:bg-amber-900/40',    bar: 'bg-amber-500',        text: 'text-amber-700 dark:text-amber-300' },
  'Waiting':          { bg: 'bg-gray-100 dark:bg-gray-800',         bar: 'bg-gray-400',         text: 'text-gray-700 dark:text-gray-300' },
  'In-Consultation':  { bg: 'bg-purple-100 dark:bg-purple-900/40',  bar: 'bg-purple-500',       text: 'text-purple-700 dark:text-purple-300' },
  'Lab-Ordered':      { bg: 'bg-rose-100 dark:bg-rose-900/40',      bar: 'bg-rose-500',         text: 'text-rose-700 dark:text-rose-300' },
  'Lab-Done':         { bg: 'bg-teal-100 dark:bg-teal-900/40',      bar: 'bg-teal-500',         text: 'text-teal-700 dark:text-teal-300' },
  'Prescribed':       { bg: 'bg-cyan-100 dark:bg-cyan-900/40',      bar: 'bg-cyan-500',         text: 'text-cyan-700 dark:text-cyan-300' },
  'Billed':           { bg: 'bg-orange-100 dark:bg-orange-900/40',  bar: 'bg-orange-500',      text: 'text-orange-700 dark:text-orange-300' },
  'Paid':             { bg: 'bg-emerald-100 dark:bg-emerald-900/40',bar: 'bg-emerald-500',      text: 'text-emerald-700 dark:text-emerald-300' },
  'Discharged':       { bg: 'bg-emerald-100 dark:bg-emerald-900/40',bar: 'bg-emerald-500',      text: 'text-emerald-700 dark:text-emerald-300' },
}

const ALL_STAGE_KEYS = [
  'Registration', 'Triage', 'Waiting', 'In-Consultation',
  'Lab-Ordered', 'Lab-Done', 'Prescribed', 'Billed', 'Paid', 'Discharged',
]

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Scheduled: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    Cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
    'No-Show': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium text-xs px-2.5 py-0.5',
        styles[status] ?? 'bg-gray-100 text-gray-700 border-gray-200'
      )}
    >
      {status}
    </Badge>
  )
}

// ─── Appointment Type Badge ──────────────────────────────────────────────────

function AppointmentTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    Consultation: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    'Follow-up': 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
    Emergency: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  }
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0 font-medium',
        styles[type] ?? 'bg-gray-100 text-gray-600 border-gray-200'
      )}
    >
      {type}
    </Badge>
  )
}

// ─── Appointment Status Dot ─────────────────────────────────────────────────

function AppointmentStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'Scheduled':
      return <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
    case 'Completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
    case 'Cancelled':
      return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
    default:
      return <div className="h-2.5 w-2.5 rounded-full bg-gray-400 shrink-0" />
  }
}

// ─── Payment Method Icon ───────────────────────────────────────────────────

function PaymentMethodIcon({ method }: { method: string }) {
  const m = method.toLowerCase()
  if (m.includes('cash') || m === 'cash') return <Banknote className="h-4 w-4 text-emerald-600" />
  if (m.includes('upi')) return <Smartphone className="h-4 w-4 text-purple-600" />
  if (m.includes('card') || m === 'card') return <CreditCard className="h-4 w-4 text-sky-600" />
  if (m.includes('net') || m.includes('online')) return <DollarSign className="h-4 w-4 text-orange-600" />
  return <Banknote className="h-4 w-4 text-gray-600" />
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  title: string
  value: string
  icon: React.ReactNode
  trend?: { value: string; isPositive: boolean }
  description: string
  iconBg: string
  iconColor: string
}

function KPICard({ title, value, icon, trend, description, iconBg, iconColor }: KPICardProps) {
  return (
    <Card className="rounded-xl border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          </div>
          <div className={cn('flex items-center justify-center rounded-lg p-2.5 shrink-0', iconBg)}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center text-xs font-semibold gap-0.5',
                trend.isPositive ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {trend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {trend.value}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Patient Workflow Overview ────────────────────────────────────────────────

function PatientWorkflowOverview({ metrics }: { metrics: WorkflowMetrics }) {
  const { setCurrentPage } = useNavigation()

  const totalActive = metrics.opdVsIpd.opd + metrics.opdVsIpd.ipd
  const opdPercent = totalActive > 0 ? ((metrics.opdVsIpd.opd / totalActive) * 100).toFixed(0) : '0'
  const ipdPercent = totalActive > 0 ? ((metrics.opdVsIpd.ipd / totalActive) * 100).toFixed(0) : '0'

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Patient Workflow Overview</CardTitle>
            <CardDescription>Real-time visit tracking</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            onClick={() => setCurrentPage('workflow')}
          >
            View All
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Metric Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Active Visits</span>
            </div>
            <p className="text-xl font-bold ml-10">{metrics.activeVisits}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-sky-50 dark:bg-sky-950">
                <UserCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Registered Today</span>
            </div>
            <p className="text-xl font-bold ml-10">{metrics.todayRegistrations}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-teal-50 dark:bg-teal-950">
                <LogOut className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Discharged Today</span>
            </div>
            <p className="text-xl font-bold ml-10">{metrics.todaysDischarges}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950">
                <Timer className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Avg Consult</span>
            </div>
            <p className="text-xl font-bold ml-10">{metrics.avgConsultationTime}m</p>
          </div>
        </div>

        {/* OPD vs IPD Distribution */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">OPD vs IPD Distribution</span>
            <span className="text-xs text-muted-foreground">
              OPD {opdPercent}% · IPD {ipdPercent}%
            </span>
          </div>
          <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
            <div
              className="bg-emerald-500 transition-all duration-500 rounded-l-full"
              style={{ width: `${opdPercent}%` }}
            />
            <div
              className="bg-purple-500 transition-all duration-500 rounded-r-full"
              style={{ width: `${ipdPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">
                OPD <span className="font-semibold text-foreground">{metrics.opdVsIpd.opd}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
              <span className="text-xs text-muted-foreground">
                IPD <span className="font-semibold text-foreground">{metrics.opdVsIpd.ipd}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Mini visits by stage */}
        {metrics.visitsByStage.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Quick Stage Glance</span>
            <div className="flex flex-wrap gap-1.5">
              {metrics.visitsByStage.slice(0, 5).map((vs) => {
                const colors = STAGE_COLORS[vs.stage] ?? STAGE_COLORS['Registration']
                return (
                  <button
                    key={vs.stage}
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80',
                      colors.bg, colors.text
                    )}
                    onClick={() => setCurrentPage('workflow', { stage: vs.stage })}
                  >
                    {vs.stage}
                    <span className="font-bold">{vs.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Stage Distribution Chart ──────────────────────────────────────────────

function StageDistributionChart({ metrics }: { metrics: WorkflowMetrics }) {
  const { setCurrentPage } = useNavigation()
  const maxCount = Math.max(...metrics.visitsByStage.map((s) => s.count), 1)

  const stageData = ALL_STAGE_KEYS.map((key) => {
    const found = metrics.visitsByStage.find((s) => s.stage === key)
    return { stage: key, count: found?.count ?? 0 }
  }).filter((s) => s.count > 0)

  if (stageData.length === 0) {
    return (
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Stage Distribution</CardTitle>
          <CardDescription>Patient visits by workflow stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No active visits in workflow</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border shadow-sm col-span-1 lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Stage Distribution</CardTitle>
            <CardDescription>Patient visits by workflow stage — click to filter</CardDescription>
          </div>
          <Badge variant="secondary" className="font-normal">
            {metrics.activeVisits} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {stageData.map((item) => {
          const colors = STAGE_COLORS[item.stage] ?? STAGE_COLORS['Registration']
          const percentage = ((item.count / maxCount) * 100).toFixed(0)
          const label = item.stage === 'In-Consultation' ? 'Consultation' : item.stage

          return (
            <button
              key={item.stage}
              className="w-full text-left group"
              onClick={() => setCurrentPage('workflow', { stage: item.stage })}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn('h-3 w-3 rounded-sm shrink-0', colors.bar)} />
                  <span className="text-sm font-medium truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-sm font-bold">{item.count}</span>
                  <span className="text-xs text-muted-foreground">
                    ({((item.count / metrics.activeVisits) * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110',
                    colors.bar
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Recent Activity Feed ──────────────────────────────────────────────────

function ActionIcon({ action }: { action: string }) {
  switch (action) {
    case 'LOGIN':
      return <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
    case 'LOGOUT':
      return <LogOut className="h-3.5 w-3.5 text-gray-400" />
    case 'CREATE':
      return <Plus className="h-3.5 w-3.5 text-sky-500" />
    case 'UPDATE':
      return <Activity className="h-3.5 w-3.5 text-amber-500" />
    case 'DELETE':
      return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
    case 'VIEW':
      return <Users className="h-3.5 w-3.5 text-purple-500" />
    case 'EXPORT':
      return <FileText className="h-3.5 w-3.5 text-teal-500" />
    case 'STATUS_CHANGE':
      return <TrendingUp className="h-3.5 w-3.5 text-orange-500" />
    default:
      return <FileText className="h-3.5 w-3.5 text-gray-400" />
  }
}

const actionBadgeStyles: Record<string, string> = {
  LOGIN: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  LOGOUT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  CREATE: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  UPDATE: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  DELETE: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  VIEW: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  EXPORT: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  STATUS_CHANGE: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
}

function RecentActivityFeed({ logs, isLoading }: { logs: AuditLogEntry[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="rounded-xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-5 w-36 mb-1" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <CardDescription>Latest system actions</CardDescription>
          </div>
          <Badge variant="secondary" className="font-normal">
            {logs.length} events
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ClipboardList className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="px-6 pb-4">
              {logs.map((log, index) => (
                <div key={log.id}>
                  <div className="flex items-start gap-3 py-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted shrink-0">
                      <ActionIcon action={log.action} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{log.userName}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0 font-semibold',
                            actionBadgeStyles[log.action] ?? 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">{log.module}</span>
                      </div>
                      {log.details && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
                          {log.details}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  {index < logs.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────

const revenueChartConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-emerald)' },
} satisfies ChartConfig

function RevenueChart({ data }: { data: Array<{ label: string; revenue: number }> }) {
  return (
    <Card className="rounded-xl border shadow-sm col-span-1 lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Revenue Overview</CardTitle>
            <CardDescription>Last 6 months performance</CardDescription>
          </div>
          <Badge variant="secondary" className="font-normal">This Month</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-emerald)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-emerald)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs fill-muted-foreground" />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} className="text-xs fill-muted-foreground" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <div className="flex items-center gap-1.5">
                      <IndianRupee className="h-3.5 w-3.5" />
                      <span className="font-medium">{formatCurrency(value as number)}</span>
                    </div>
                  )}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="var(--chart-emerald)"
              fill="url(#fillRevenue)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: 'var(--chart-emerald)', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ─── Today's Overview Section ───────────────────────────────────────────────

function TodaysOverview({
  todayAppointments,
  pendingPayments,
  activeVisits,
  lowStockItems,
  isLoading,
}: {
  todayAppointments: number
  pendingPayments: number
  activeVisits: number
  lowStockItems: number
  isLoading: boolean
}) {
  const { setCurrentPage } = useNavigation()

  const cards = [
    {
      title: "Today's Appointments",
      value: todayAppointments,
      icon: <CalendarDays className="h-5 w-5" />,
      iconBg: 'bg-sky-50 dark:bg-sky-950',
      iconColor: 'text-sky-600 dark:text-sky-400',
      page: 'appointments' as const,
      label: 'View All',
    },
    {
      title: 'Pending Payments',
      value: pendingPayments,
      icon: <IndianRupee className="h-5 w-5" />,
      iconBg: 'bg-amber-50 dark:bg-amber-950',
      iconColor: 'text-amber-600 dark:text-amber-400',
      page: 'billing' as const,
      label: 'View All',
    },
    {
      title: 'Active Workflow Visits',
      value: activeVisits,
      icon: <Activity className="h-5 w-5" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      page: 'workflow' as const,
      label: 'View All',
    },
    {
      title: 'Low Stock Items',
      value: lowStockItems,
      icon: <PackageX className="h-5 w-5" />,
      iconBg: lowStockItems > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-gray-50 dark:bg-gray-900',
      iconColor: lowStockItems > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400',
      page: 'inventory' as const,
      label: 'View All',
    },
  ]

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-xl border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-3 w-24 mb-2" />
                  <Skeleton className="h-6 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="rounded-xl border shadow-sm cursor-pointer hover:shadow-md transition-shadow duration-200 group"
          onClick={() => setCurrentPage(card.page)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn('flex items-center justify-center rounded-lg p-2 shrink-0', card.iconBg)}>
                <div className={card.iconColor}>{card.icon}</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">{card.title}</p>
                <p className={cn(
                  'text-xl font-bold tracking-tight mt-0.5',
                  card.title === 'Low Stock Items' && card.value > 0 && 'text-red-600 dark:text-red-400'
                )}>
                  {card.value}
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 inline-flex items-center gap-0.5">
                {card.label}
                <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Revenue Trend Summary Bar ───────────────────────────────────────────────

function RevenueTrendBar({ monthlyRevenue }: { monthlyRevenue: Array<{ month: string; revenue: number }> }) {
  if (monthlyRevenue.length < 2) return null

  const sorted = [...monthlyRevenue].sort((a, b) => a.month.localeCompare(b.month))
  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]
  const change = previous.revenue > 0 ? ((latest.revenue - previous.revenue) / previous.revenue) * 100 : 0
  const isPositive = change >= 0

  return (
    <div className={cn(
      'flex items-center justify-between gap-4 rounded-lg border px-4 py-3',
      isPositive
        ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/30'
        : 'border-red-200 bg-red-50/80 dark:border-red-800 dark:bg-red-950/30'
    )}>
      <div className="flex items-center gap-2 text-sm">
        <TrendingUp className={cn('h-4 w-4', isPositive ? 'text-emerald-600' : 'text-red-600')} />
        <span className="font-medium text-muted-foreground">Revenue Trend (Last 30 Days):</span>
        <span className="font-semibold">{formatCurrency(previous.revenue)}</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-bold">{formatCurrency(latest.revenue)}</span>
      </div>
      <Badge variant="outline" className={cn(
        'font-semibold shrink-0',
        isPositive
          ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300'
      )}>
        {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
        {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
      </Badge>
    </div>
  )
}

// ─── Upcoming Appointments (Enhanced) ────────────────────────────────────────

function UpcomingAppointments({ appointments }: { appointments: DashboardData['recentAppointments'] }) {
  const upcoming = appointments
    .filter((a) => a.date === new Date().toISOString().split('T')[0] && a.status === 'Scheduled')
    .sort((a, b) => a.time.localeCompare(b.time))

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Upcoming Appointments</CardTitle>
            <CardDescription>Next scheduled appointments</CardDescription>
          </div>
          <Badge variant="secondary" className="font-normal">{upcoming.length} today</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No upcoming appointments</p>
          </div>
        ) : (
          <ScrollArea className="h-[360px]">
            <div className="px-6">
              {upcoming.map((apt, index) => {
                const initials = (apt.patient?.name || '?').split(' ').map((n) => n[0]).join('')
                return (
                  <div key={apt.id}>
                    <div className="flex items-start gap-4 py-3">
                      {/* Time Badge */}
                      <div className="flex flex-col items-center shrink-0">
                        <Badge className="bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300 font-semibold text-xs">
                          {apt.time}
                        </Badge>
                        {index < upcoming.length - 1 && <div className="w-px h-full bg-border mt-2" />}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Avatar */}
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{apt.patient?.name || 'Unknown'}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-muted-foreground">{apt.doctor?.name || 'Unknown'}</span>
                                <Separator orientation="vertical" className="h-3" />
                                <AppointmentTypeBadge type={apt.type} />
                              </div>
                            </div>
                          </div>
                          <AppointmentStatusIcon status={apt.status} />
                        </div>
                      </div>
                    </div>
                    {index < upcoming.length - 1 && <Separator className="ml-[4.5rem]" />}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Recent Payments Widget ──────────────────────────────────────────────────

function RecentPaymentsWidget({ payments }: { payments: DashboardData['recentPayments'] }) {
  const latest5 = payments.slice(0, 5)

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Recent Payments</CardTitle>
            <CardDescription>Latest 5 transactions</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
            onClick={() => useNavigation.getState().setCurrentPage('payments')}
          >
            View All
            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {latest5.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Banknote className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No recent payments</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <div className="px-6">
              {latest5.map((payment, index) => (
                <div key={payment.id}>
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                      <PaymentMethodIcon method={payment.method} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{payment.patient?.name || 'Unknown Patient'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {payment.invoice?.invoiceNumber || '-'}
                        </span>
                        <Separator orientation="vertical" className="h-3" />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(payment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatCurrency(payment.amount)}
                    </span>
                  </div>
                  {index < latest5.length - 1 && <Separator />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Top Services ─────────────────────────────────────────────────────────────

function TopServices({ payments }: { payments: DashboardData['recentPayments'] }) {
  const methodRevenue = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.method] = (acc[p.method] || 0) + p.amount
    return acc
  }, {})

  const services = Object.entries(methodRevenue)
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue]) => ({ name, revenue }))

  const totalRevenue = services.reduce((sum, s) => sum + s.revenue, 0)
  const maxRevenue = services.length > 0 ? services[0].revenue : 1

  if (services.length === 0) {
    return (
      <Card className="rounded-xl border shadow-sm col-span-1 lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Payment Methods</CardTitle>
          <CardDescription>Revenue by payment method</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No payment data yet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border shadow-sm col-span-1 lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Payment Methods</CardTitle>
            <CardDescription>Revenue breakdown by payment method</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {services.map((service, index) => (
          <div key={service.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn('flex items-center justify-center h-7 w-7 rounded-md shrink-0 text-xs font-bold', index === 0 && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', index === 1 && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', index === 2 && 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', index > 2 && 'bg-muted text-muted-foreground')}>
                  {index < 3 ? `#${index + 1}` : ''}
                </div>
                <span className="text-sm font-medium truncate">{service.name}</span>
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="text-sm font-semibold">{formatCurrency(service.revenue)}</span>
                <span className="text-xs text-muted-foreground ml-2">({totalRevenue > 0 ? ((service.revenue / totalRevenue) * 100).toFixed(1) : 0}%)</span>
              </div>
            </div>
            <Progress
              value={(service.revenue / maxRevenue) * 100}
              className={cn('h-2', index === 0 && '[&>div]:bg-amber-500', index === 1 && '[&>div]:bg-slate-500', index === 2 && '[&>div]:bg-orange-500', index > 2 && '[&>div]:bg-emerald-500')}
            />
          </div>
        ))}
        <div className="pt-2">
          <Separator />
          <div className="flex items-center justify-between pt-3">
            <span className="text-sm font-semibold">Total Revenue</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRevenue)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Dashboard Skeleton ──────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="rounded-xl border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /></div>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
              <div className="mt-3 flex items-center gap-2"><Skeleton className="h-3 w-12" /><Skeleton className="h-3 w-20" /></div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Workflow overview skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="rounded-xl border shadow-sm lg:col-span-1">
          <CardContent className="p-6"><Skeleton className="h-5 w-48 mb-1" /><Skeleton className="h-4 w-40 mb-6" /><div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="space-y-1"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-6 w-16" /></div>)}</div></CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm lg:col-span-2">
          <CardContent className="p-6"><Skeleton className="h-5 w-40 mb-1" /><Skeleton className="h-4 w-52 mb-6" /><div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="space-y-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-2.5 w-full rounded-full" /></div>)}</div></CardContent>
        </Card>
      </div>
      {/* Revenue + Quick actions skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="rounded-xl border shadow-sm lg:col-span-2">
          <CardContent className="p-6"><Skeleton className="h-5 w-40 mb-1" /><Skeleton className="h-4 w-52 mb-6" /><Skeleton className="h-[250px] w-full rounded-lg" /></CardContent>
        </Card>
        <Card className="rounded-xl border shadow-sm">
          <CardContent className="p-6"><Skeleton className="h-5 w-32 mb-1" /><Skeleton className="h-4 w-44 mb-6" /><div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div></CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Real-Time Clock ────────────────────────────────────────────────────────

function RealTimeClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatted = format(now, "EEEE, d MMM yyyy • h:mm a 'IST'")

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Zap className="h-4 w-4 text-emerald-500 animate-pulse" />
      <span className="font-medium">{formatted}</span>
    </div>
  )
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export function DashboardPage() {
  const { toast } = useToast()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minLoadingDone, setMinLoadingDone] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(true)

  // Today's Overview data
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [overviewLoading, setOverviewLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    const startTime = Date.now()
    try {
      const res = await apiGet<SingleResponse<DashboardData>>('/dashboard')
      setDashboardData(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        toast({ title: 'Error', description: 'Failed to load dashboard data', variant: 'destructive' })
      }
    } finally {
      const elapsed = Date.now() - startTime
      if (elapsed < 800) {
        setTimeout(() => {
          setIsLoading(false)
          setMinLoadingDone(true)
        }, 800 - elapsed)
      } else {
        setIsLoading(false)
        setMinLoadingDone(true)
      }
    }
  }, [toast])

  const fetchAuditLogs = useCallback(async () => {
    setAuditLogsLoading(true)
    try {
      const res = await apiGet<{ data: AuditLogEntry[]; total: number }>('/audit-logs?limit=10')
      setAuditLogs(res.data ?? [])
    } catch {
      // Silently fail — audit logs are supplementary
      setAuditLogs([])
    } finally {
      setAuditLogsLoading(false)
    }
  }, [])

  const fetchOverviewData = useCallback(async () => {
    setOverviewLoading(true)
    try {
      const [invoiceRes, medRes] = await Promise.all([
        apiGet<PaginatedResponse<PendingPayment>>('/invoices', { status: 'Pending', limit: 1 }).catch(() => ({ total: 0 })),
        apiGet<PaginatedResponse<{ id: string; stock: number; minStock: number }>>('/medicines', { status: 'Active', limit: 100 }).catch(() => ({ data: [], total: 0 })),
      ])
      setPendingPaymentsCount((invoiceRes as { total: number }).total || 0)
      const meds = (medRes as { data: Array<{ stock: number; minStock: number }> }).data || []
      const lowCount = meds.filter((m) => m.stock <= m.minStock).length
      setLowStockCount(lowCount)
    } catch {
      // Silently fail
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    fetchAuditLogs()
    fetchOverviewData()
  }, [fetchDashboard, fetchAuditLogs, fetchOverviewData])

  // Show skeleton during minimum loading period
  if (isLoading || !minLoadingDone) {
    return <DashboardSkeleton />
  }

  if (error && !dashboardData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Welcome back! Here&apos;s what&apos;s happening at your hospital today.</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <AlertCircle className="h-16 w-16 text-red-400" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchDashboard}>
            <Activity className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!dashboardData) return null

  return (
    <div className="space-y-6">
      {/* Page Header with Real-Time Clock */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back! Here&apos;s what&apos;s happening at your hospital today.</p>
        </div>
        <RealTimeClock />
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Patients"
          value={dashboardData.totalPatients.toLocaleString('en-IN')}
          icon={<Users className="h-5 w-5" />}
          trend={{ value: '+12.5%', isPositive: true }}
          description="Active patients"
          iconBg="bg-emerald-50 dark:bg-emerald-950"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <KPICard
          title="Today's Appointments"
          value={dashboardData.todayAppointments.toString()}
          icon={<CalendarDays className="h-5 w-5" />}
          trend={{ value: `+${dashboardData.appointmentsByStatus.Scheduled} scheduled`, isPositive: true }}
          description={`${dashboardData.appointmentsByStatus.Completed} completed`}
          iconBg="bg-sky-50 dark:bg-sky-950"
          iconColor="text-sky-600 dark:text-sky-400"
        />
        <KPICard
          title="Today's Revenue"
          value={formatCurrency(dashboardData.todayRevenue)}
          icon={<IndianRupee className="h-5 w-5" />}
          trend={{ value: `${dashboardData.recentPayments.length} payments`, isPositive: true }}
          description="Successful payments"
          iconBg="bg-amber-50 dark:bg-amber-950"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <KPICard
          title="Outstanding Payments"
          value={formatCurrency(dashboardData.outstandingPayments)}
          icon={<AlertCircle className="h-5 w-5" />}
          trend={{ value: 'Needs attention', isPositive: false }}
          description="Unpaid invoices"
          iconBg="bg-red-50 dark:bg-red-950"
          iconColor="text-red-600 dark:text-red-400"
        />
      </div>

      {/* Revenue Trend Summary Bar */}
      <RevenueTrendBar monthlyRevenue={dashboardData.monthlyRevenue} />

      {/* Today's Overview Section */}
      <TodaysOverview
        todayAppointments={dashboardData.todayAppointments}
        pendingPayments={pendingPaymentsCount}
        activeVisits={dashboardData.workflowMetrics.activeVisits}
        lowStockItems={lowStockCount}
        isLoading={overviewLoading}
      />

      {/* Patient Workflow Overview + Stage Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PatientWorkflowOverview metrics={dashboardData.workflowMetrics} />
        <StageDistributionChart metrics={dashboardData.workflowMetrics} />
      </div>

      {/* Revenue Chart + Recent Payments Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RevenueChart data={dashboardData.monthlyRevenue} />
        <RecentPaymentsWidget payments={dashboardData.recentPayments} />
      </div>

      {/* Upcoming Appointments + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <UpcomingAppointments appointments={dashboardData.recentAppointments} />
        <RecentActivityFeed logs={auditLogs} isLoading={auditLogsLoading} />
      </div>

      {/* Top Services */}
      <TopServices payments={dashboardData.recentPayments} />
    </div>
  )
}
