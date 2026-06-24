'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, type SingleResponse, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import {
  DollarSign,
  Users,
  CalendarDays,
  FileDown,
  Activity,
  ClipboardList,
  Stethoscope,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Building2,
  ArrowUpDown,
  Download,
  Receipt,
  ChevronDown,
  ChevronUp,
  Timer,
  Gauge,
  AlertTriangle,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────

interface DailyRevenueItem { date: string; amount: number }
interface RevenueByDeptItem { department: string; visits: number }
interface MonthlyRevenueItem { month: string; label: string; revenue: number }
interface StageDistItem { stage: string; count: number }
interface PeakHourItem { hour: number; count: number; label: string }
interface AvgDurationItem { stage: string; averageMinutes: number; visits: number }
interface OutstandingInvoice {
  id: string; invoiceNumber: string; patientName: string; patientId: string
  date: string; dueDate: string | null; grandTotal: number; paidAmount: number
  balance: number; status: string; daysOverdue?: number
}
interface AgingBucket { label: string; min: number; max: number; count: number; total: number }
interface DoctorPerfItem {
  id: string; doctorId: string; name: string; specialization: string
  consultationFee: number; experience: number; patientsSeen: number
  visitsCount: number; prescriptionsCount: number; revenueGenerated: number
  avgPatientsPerDay: number
}
interface AuditLogItem {
  id: string; userId: string; userName: string; userEmail: string
  userRole: string; action: string; module: string; details: string | null
  ipAddress: string | null; userAgent: string | null; status: string; createdAt: string
}

// GST types
interface HsnSummaryItem {
  hsnCode: string; description: string; totalQuantity: number
  totalValue: number; cgst: number; sgst: number; igst: number; totalTax: number
}
interface TaxByRateItem {
  rate: number; taxableValue: number; cgst: number; sgst: number
  igst: number; totalTax: number; invoiceCount: number
}
interface Gstr3bData {
  outwardSupplies: number; igst: number; cgst: number; sgst: number
  totalTax: number; taxableValue: number; taxByRate: TaxByRateItem[]
  totalInvoices: number; invoiceDateRange: { from: string | null; to: string | null }
}
interface GstReportData {
  gstr1: Array<unknown>
  gstr3b: Gstr3bData
  hsnSummary: HsnSummaryItem[]
  period: { fromDate: string | null; toDate: string | null }
}

// ─── Skeleton Component ───────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-5 w-40 mb-6" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-[80px]" />
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-3">
      <BarChart3 className="h-12 w-12 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Error State ─────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />Retry
      </Button>
    </div>
  )
}

// ─── CSS Bar Chart (vertical) ─────────────────────────────────────────────

function VerticalBarChart({
  data,
  dataKey,
  labelKey,
  maxItems = 30,
  colorClass = 'bg-emerald-500',
  height = 200,
  showLabels = true,
  labelTransform,
}: {
  data: Record<string, unknown>[]
  dataKey: string
  labelKey: string
  maxItems?: number
  colorClass?: string
  height?: number
  showLabels?: boolean
  labelTransform?: (v: string) => string
}) {
  const sliced = data.slice(-maxItems)
  const values = sliced.map((d) => (d[dataKey] as number) || 0)
  const maxVal = Math.max(...values, 1)

  return (
    <div className="flex items-end gap-[2px] w-full" style={{ height }}>
      {sliced.map((d, idx) => {
        const val = (d[dataKey] as number) || 0
        const pct = (val / maxVal) * 100
        const label = labelTransform ? labelTransform(String(d[labelKey])) : String(d[labelKey])
        return (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-0">
            <div
              className={`${colorClass} w-full rounded-t-sm transition-all duration-200 hover:opacity-80 min-h-[2px]`}
              style={{ height: `${Math.max(pct, 1)}%` }}
            />
            {showLabels && (
              <div className="absolute -bottom-5 text-[8px] text-muted-foreground truncate max-w-full opacity-0 group-hover:opacity-100 transition-opacity">
                {label}
              </div>
            )}
            {/* Tooltip */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 pointer-events-none">
              {label}: {typeof val === 'number' && val > 1000 ? formatCurrency(val) : val}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── CSS Horizontal Bar ─────────────────────────────────────────────────

function HorizontalBarChart({
  items,
  maxItems = 10,
  colorClass = 'bg-emerald-500',
  showValues = true,
}: {
  items: { label: string; value: number }[]
  maxItems?: number
  colorClass?: string
  showValues?: boolean
}) {
  const sliced = items.slice(0, maxItems)
  const maxVal = Math.max(...sliced.map((i) => i.value), 1)

  return (
    <div className="space-y-2">
      {sliced.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-28 truncate text-right shrink-0">{item.label}</span>
          <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
            <div
              className={`${colorClass} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
              style={{ width: `${(item.value / maxVal) * 100}%`, minWidth: item.value > 0 ? '24px' : '0px' }}
            >
              {showValues && (item.value / maxVal) > 0.15 && (
                <span className="text-[10px] font-medium text-white">{item.value}</span>
              )}
            </div>
          </div>
          {showValues && (item.value / maxVal) <= 0.15 && (
            <span className="text-xs text-muted-foreground w-10 shrink-0">{item.value}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── CSS Pie-Like Display ────────────────────────────────────────────────

function PieLikeDisplay({
  data,
  colors,
}: {
  data: { label: string; value: number }[]
  colors: string[]
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return <EmptyState message="No data available" />

  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const pct = ((item.value / total) * 100).toFixed(1)
        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                <span className="text-foreground">{item.label}</span>
              </div>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: colors[idx % colors.length],
                  minWidth: item.value > 0 ? '4px' : '0px',
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {typeof item.value === 'number' && item.value > 100 ? formatCurrency(item.value) : item.value.toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Metric Card ────────────────────────────────────────────────────────

function MetricCard({ label, value, icon: Icon, colorClass, sub, change, changeLabel }: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  colorClass?: string
  sub?: string
  change?: number | null
  changeLabel?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${colorClass || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass || ''}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {change !== null && change !== undefined && (
          <div className="flex items-center gap-1 mt-1.5">
            {change >= 0 ? (
              <ChevronUp className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-red-500" />
            )}
            <span className={`text-xs font-medium ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
            {changeLabel && <span className="text-xs text-muted-foreground">{changeLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Export Button ───────────────────────────────────────────────────────

function ExportButton({ label, onClick }: { label: string; onClick?: () => void }) {
  const { toast } = useToast()
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={onClick || (() => toast({ title: 'Export started', description: `${label} report is being prepared...` }))}
    >
      <FileDown className="h-4 w-4" />
      Export {label}
    </Button>
  )
}

// ─── CSV Download Helper ─────────────────────────────────────────────────

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

// ─── Main Component ──────────────────────────────────────────────────────

export function ReportsPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('revenue')

  // ─── Revenue state ──────────────────────────────────────────────────────
  const [revenueData, setRevenueData] = useState<Record<string, unknown> | null>(null)
  const [prevRevenueData, setPrevRevenueData] = useState<Record<string, unknown> | null>(null)
  const [loadingRevenue, setLoadingRevenue] = useState(false)
  const [errorRevenue, setErrorRevenue] = useState<string | null>(null)

  // ─── Patient Flow state ────────────────────────────────────────────────
  const [flowData, setFlowData] = useState<Record<string, unknown> | null>(null)
  const [loadingFlow, setLoadingFlow] = useState(false)
  const [errorFlow, setErrorFlow] = useState<string | null>(null)

  // ─── Billing state ──────────────────────────────────────────────────────
  const [billingData, setBillingData] = useState<Record<string, unknown> | null>(null)
  const [loadingBilling, setLoadingBilling] = useState(false)
  const [errorBilling, setErrorBilling] = useState<string | null>(null)

  // ─── Doctor Performance state ───────────────────────────────────────────
  const [doctorData, setDoctorData] = useState<Record<string, unknown> | null>(null)
  const [loadingDoctor, setLoadingDoctor] = useState(false)
  const [errorDoctor, setErrorDoctor] = useState<string | null>(null)
  const [doctorSortBy, setDoctorSortBy] = useState<'revenueGenerated' | 'patientsSeen'>('revenueGenerated')

  // ─── Audit Trail state ──────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [errorAudit, setErrorAudit] = useState<string | null>(null)
  const [auditFilterAction, setAuditFilterAction] = useState<string>('')
  const [auditFilterModule, setAuditFilterModule] = useState<string>('')
  const [auditFilterUser, setAuditFilterUser] = useState<string>('')
  const [auditFilterSearch, setAuditFilterSearch] = useState('')

  // ─── GST state ──────────────────────────────────────────────────────────
  const [gstData, setGstData] = useState<GstReportData | null>(null)
  const [loadingGst, setLoadingGst] = useState(false)
  const [errorGst, setErrorGst] = useState<string | null>(null)
  const [gstPeriod, setGstPeriod] = useState<'monthly' | 'quarterly' | 'custom'>('monthly')
  const [gstMonth, setGstMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [gstQuarter, setGstQuarter] = useState(() => {
    const now = new Date()
    const q = Math.floor(now.getMonth() / 3) + 1
    return `${now.getFullYear()}-Q${q}`
  })
  const [gstCustomFrom, setGstCustomFrom] = useState('')
  const [gstCustomTo, setGstCustomTo] = useState('')

  // ─── Fetch helpers ─────────────────────────────────────────────────────
  const fetchSingleReport = useCallback(async (
    type: string,
    setter: (data: Record<string, unknown> | null) => void,
    setLoading: (v: boolean) => void,
    setError: (v: string | null) => void
  ) => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet<SingleResponse<Record<string, unknown>>>(`/reports`, { type })
      setter(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load report'
      setError(msg)
      toast({ title: 'Error', description: `Failed to load ${type} report`, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchAuditLogs = useCallback(async (page: number, action: string, module: string, search: string, user: string) => {
    setLoadingAudit(true)
    setErrorAudit(null)
    try {
      const params: Record<string, string | number> = { page, limit: 25 }
      if (action) params.action = action
      if (module) params.module = module
      if (search) params.search = search
      if (user) params.userId = user
      const res = await apiGet<PaginatedResponse<AuditLogItem>>('/audit-logs', params)
      setAuditLogs(res.data)
      setAuditTotal(res.total)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load audit logs'
      setErrorAudit(msg)
    } finally {
      setLoadingAudit(false)
    }
  }, [])

  const fetchGstReport = useCallback(async () => {
    setLoadingGst(true)
    setErrorGst(null)
    try {
      let fromDate = ''
      let toDate = ''

      if (gstPeriod === 'monthly' && gstMonth) {
        const [y, m] = gstMonth.split('-').map(Number)
        const firstDay = new Date(y, m - 1, 1)
        const lastDay = new Date(y, m, 0)
        fromDate = firstDay.toISOString().split('T')[0]
        toDate = lastDay.toISOString().split('T')[0]
      } else if (gstPeriod === 'quarterly' && gstQuarter) {
        const [y, q] = gstQuarter.split('-Q').map(Number)
        const firstMonth = (q - 1) * 3
        const firstDay = new Date(y, firstMonth, 1)
        const lastDay = new Date(y, firstMonth + 3, 0)
        fromDate = firstDay.toISOString().split('T')[0]
        toDate = lastDay.toISOString().split('T')[0]
      } else if (gstPeriod === 'custom' && gstCustomFrom && gstCustomTo) {
        fromDate = gstCustomFrom
        toDate = gstCustomTo
      } else {
        // Default: current month
        const now = new Date()
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        fromDate = firstDay.toISOString().split('T')[0]
        toDate = lastDay.toISOString().split('T')[0]
      }

      const res = await apiGet<SingleResponse<GstReportData>>('/reports/gst', { fromDate, toDate })
      setGstData(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load GST report'
      setErrorGst(msg)
    } finally {
      setLoadingGst(false)
    }
  }, [gstPeriod, gstMonth, gstQuarter, gstCustomFrom, gstCustomTo])

  // ─── Load data on demand ───────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'revenue' && !revenueData && !loadingRevenue) {
      fetchSingleReport('revenue', setRevenueData, setLoadingRevenue, setErrorRevenue)
    }
  }, [activeTab, revenueData, loadingRevenue, fetchSingleReport])

  useEffect(() => {
    if (activeTab === 'revenue' && !prevRevenueData && !loadingRevenue) {
      fetchSingleReport('revenue-prev', setPrevRevenueData, () => {}, () => {})
    }
  }, [activeTab, prevRevenueData, loadingRevenue, fetchSingleReport])

  useEffect(() => {
    if (activeTab === 'patient-flow' && !flowData && !loadingFlow) {
      fetchSingleReport('patient-flow', setFlowData, setLoadingFlow, setErrorFlow)
    }
  }, [activeTab, flowData, loadingFlow, fetchSingleReport])

  useEffect(() => {
    if (activeTab === 'billing' && !billingData && !loadingBilling) {
      fetchSingleReport('billing', setBillingData, setLoadingBilling, setErrorBilling)
    }
  }, [activeTab, billingData, loadingBilling, fetchSingleReport])

  useEffect(() => {
    if (activeTab === 'doctor-performance' && !doctorData && !loadingDoctor) {
      fetchSingleReport('doctor-performance', setDoctorData, setLoadingDoctor, setErrorDoctor)
    }
  }, [activeTab, doctorData, loadingDoctor, fetchSingleReport])

  useEffect(() => {
    if (activeTab === 'audit-trail') {
      fetchAuditLogs(auditPage, auditFilterAction, auditFilterModule, auditFilterSearch, auditFilterUser)
    }
  }, [activeTab, auditPage, auditFilterAction, auditFilterModule, auditFilterSearch, auditFilterUser, fetchAuditLogs])

  useEffect(() => {
    if (activeTab === 'gst') {
      fetchGstReport()
    }
  }, [activeTab, fetchGstReport])

  // ─── Color palettes ────────────────────────────────────────────────────
  const PIE_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
  const BAR_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#f59e0b', '#fbbf24', '#fcd34d']
  const PEAK_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5', '#f59e0b', '#ef4444']

  // ─── Tab 1: Revenue ─────────────────────────────────────────────────────
  const renderRevenue = () => {
    if (loadingRevenue) return <ReportSkeleton />
    if (errorRevenue) return <ErrorState message={errorRevenue} onRetry={() => fetchSingleReport('revenue', setRevenueData, setLoadingRevenue, setErrorRevenue)} />
    if (!revenueData) return <EmptyState message="No revenue data available" />

    const rd = revenueData as {
      dailyRevenue: DailyRevenueItem[]
      revenueByMethod: Record<string, number>
      revenueByDepartment: RevenueByDeptItem[]
      monthlyRevenue: MonthlyRevenueItem[]
      totalRevenue30Days: number
      totalOutstanding: number
      averageInvoice: number
    }

    const prevRd = prevRevenueData as {
      totalRevenue30Days?: number
      averageInvoice?: number
    } | null

    const methodData = Object.entries(rd.revenueByMethod || {}).map(([label, value]) => ({ label, value }))
    const deptData = (rd.revenueByDepartment || []).map((d) => ({ label: d.department, value: d.visits }))

    // Calculate period comparison
    const currentRevenue = rd.totalRevenue30Days
    const prevRevenue = prevRd?.totalRevenue30Days
    const revenueChange = prevRevenue && prevRevenue > 0
      ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
      : null

    const currentAvgInvoice = rd.averageInvoice
    const prevAvgInvoice = prevRd?.averageInvoice
    const avgInvoiceChange = prevAvgInvoice && prevAvgInvoice > 0
      ? ((currentAvgInvoice - prevAvgInvoice) / prevAvgInvoice) * 100
      : null

    return (
      <div className="space-y-6">
        {/* KPI Cards with Period Comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Revenue (30 days)"
            value={formatCurrency(rd.totalRevenue30Days)}
            icon={DollarSign}
            colorClass="text-emerald-600"
            sub="Last 30 days"
            change={revenueChange}
            changeLabel="vs previous period"
          />
          <MetricCard
            label="Outstanding"
            value={formatCurrency(rd.totalOutstanding)}
            icon={TrendingDown}
            colorClass="text-red-500"
            sub="Pending collection"
          />
          <MetricCard
            label="Avg Invoice"
            value={formatCurrency(rd.averageInvoice)}
            icon={BarChart3}
            colorClass="text-amber-600"
            change={avgInvoiceChange}
            changeLabel="vs previous period"
          />
          <MetricCard
            label="Daily Avg"
            value={formatCurrency(rd.totalRevenue30Days / 30)}
            icon={TrendingUp}
            colorClass="text-emerald-500"
          />
        </div>

        {/* Revenue Trend with Line Indicator */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Daily Revenue (30 Days)</CardTitle>
              <CardDescription>Daily payment collection trend</CardDescription>
            </div>
            <ExportButton label="Revenue Trend" />
          </CardHeader>
          <CardContent>
            {rd.dailyRevenue && rd.dailyRevenue.length > 0 ? (
              <>
                {/* Trend line summary */}
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50">
                  {(() => {
                    const first = rd.dailyRevenue[0]?.amount || 0
                    const last = rd.dailyRevenue[rd.dailyRevenue.length - 1]?.amount || 0
                    const trendPct = first > 0 ? ((last - first) / first) * 100 : 0
                    return (
                      <>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm text-muted-foreground">30-day trend:</span>
                        <span className={`text-sm font-semibold ${trendPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {trendPct >= 0 ? '+' : ''}{trendPct.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({formatCurrency(first)} → {formatCurrency(last)})
                        </span>
                      </>
                    )
                  })()}
                </div>
                <div className="pt-2 pb-6">
                  <VerticalBarChart
                    data={rd.dailyRevenue as unknown as Record<string, unknown>[]}
                    dataKey="amount"
                    labelKey="date"
                    colorClass="bg-emerald-500"
                    height={220}
                    maxItems={30}
                    labelTransform={(v) => {
                      const parts = v.split('-')
                      return `${parts[2]}/${parts[1]}`
                    }}
                  />
                </div>
              </>
            ) : (
              <EmptyState message="No daily revenue data" />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Payment Method */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Payment Method</CardTitle>
              <CardDescription>Distribution of payment collection</CardDescription>
            </CardHeader>
            <CardContent>
              {methodData.length > 0 ? (
                <PieLikeDisplay data={methodData} colors={PIE_COLORS} />
              ) : (
                <EmptyState message="No payment method data" />
              )}
            </CardContent>
          </Card>

          {/* Monthly Revenue Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue (6 Months)</CardTitle>
              <CardDescription>Revenue trend over last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              {rd.monthlyRevenue && rd.monthlyRevenue.length > 0 ? (
                <div className="space-y-3">
                  <HorizontalBarChart
                    items={rd.monthlyRevenue.map((m) => ({ label: m.label, value: m.revenue }))}
                    colorClass="bg-emerald-500"
                    maxItems={6}
                    showValues={false}
                  />
                  <div className="flex flex-wrap gap-4 mt-2">
                    {rd.monthlyRevenue.map((m, idx) => {
                      const prevMonth = rd.monthlyRevenue[idx - 1]?.revenue
                      const pctChange = prevMonth && prevMonth > 0 ? ((m.revenue - prevMonth) / prevMonth) * 100 : null
                      return (
                        <div key={m.month} className="text-center">
                          <p className="text-sm font-bold text-emerald-600">{formatCurrency(m.revenue)}</p>
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                          {pctChange !== null && (
                            <div className="flex items-center justify-center gap-0.5 mt-0.5">
                              {pctChange >= 0 ? (
                                <ChevronUp className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <ChevronDown className="h-3 w-3 text-red-500" />
                              )}
                              <span className={`text-[10px] font-medium ${pctChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState message="No monthly data" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Revenue by Department */}
        {deptData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Visits by Department</CardTitle>
              <CardDescription>Patient visit distribution across departments</CardDescription>
            </CardHeader>
            <CardContent>
              <HorizontalBarChart items={deptData} colorClass="bg-emerald-500" maxItems={10} />
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ─── Tab 2: Patient Flow ───────────────────────────────────────────────
  const renderPatientFlow = () => {
    if (loadingFlow) return <ReportSkeleton />
    if (errorFlow) return <ErrorState message={errorFlow} onRetry={() => fetchSingleReport('patient-flow', setFlowData, setLoadingFlow, setErrorFlow)} />
    if (!flowData) return <EmptyState message="No patient flow data available" />

    const fd = flowData as {
      stageDistribution: StageDistItem[]
      visitsByDepartment: { department: string; visits: number }[]
      opdVsIpd: Record<string, number>
      peakHours: PeakHourItem[]
      averageDurationByStage: AvgDurationItem[]
      totalVisits: number
      activeVisits: number
      completedVisits: number
    }

    const opdIpdData = Object.entries(fd.opdVsIpd || {}).map(([label, value]) => ({ label, value }))
    const deptData = (fd.visitsByDepartment || []).map((d) => ({ label: d.department, value: d.visits }))
    const peakData = (fd.peakHours || []).map((h) => ({ label: h.label, value: h.count }))

    const getPeakColor = (idx: number, data: { label: string; value: number }[]) => {
      if (data.length === 0) return 'bg-emerald-500'
      const max = Math.max(...data.map((d) => d.value))
      const val = data[idx].value
      if (val >= max * 0.8) return 'bg-red-500'
      if (val >= max * 0.5) return 'bg-amber-500'
      return 'bg-emerald-500'
    }

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Visits" value={fd.totalVisits.toLocaleString()} icon={Users} colorClass="text-emerald-600" />
          <MetricCard label="Active Visits" value={fd.activeVisits.toLocaleString()} icon={Activity} colorClass="text-blue-600" />
          <MetricCard label="Completed" value={fd.completedVisits.toLocaleString()} icon={ClipboardList} colorClass="text-emerald-500" />
          <MetricCard label="Departments" value={(fd.visitsByDepartment || []).length.toString()} icon={Building2} colorClass="text-amber-600" />
        </div>

        {/* OPD vs IPD + Stage Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>OPD vs IPD Distribution</CardTitle>
              <CardDescription>Patient visit type breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              {opdIpdData.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {opdIpdData.map((item, idx) => (
                    <div key={idx} className="text-center p-4 rounded-lg border">
                      <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] + '20' }}>
                        <span className="text-lg font-bold" style={{ color: PIE_COLORS[idx % PIE_COLORS.length] }}>
                          {item.value}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {fd.totalVisits > 0 ? ((item.value / fd.totalVisits) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No visit type data" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Stage Distribution</CardTitle>
              <CardDescription>Patients currently at each workflow stage</CardDescription>
            </CardHeader>
            <CardContent>
              {fd.stageDistribution && fd.stageDistribution.length > 0 ? (
                <div className="max-h-[280px] overflow-y-auto space-y-2">
                  {fd.stageDistribution.map((stage, idx) => {
                    const maxCount = Math.max(...fd.stageDistribution.map((s) => s.count), 1)
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-36 truncate text-right shrink-0">{stage.stage}</span>
                        <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                            style={{
                              width: `${(stage.count / maxCount) * 100}%`,
                              backgroundColor: BAR_COLORS[idx % BAR_COLORS.length],
                              minWidth: stage.count > 0 ? '20px' : '0px',
                            }}
                          >
                            {(stage.count / maxCount) > 0.15 && (
                              <span className="text-[10px] font-medium text-white">{stage.count}</span>
                            )}
                          </div>
                        </div>
                        {(stage.count / maxCount) <= 0.15 && (
                          <span className="text-xs text-muted-foreground w-6 shrink-0">{stage.count}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState message="No active patients in stages" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Peak Hours */}
        <Card>
          <CardHeader>
            <CardTitle>Peak Hours Analysis</CardTitle>
            <CardDescription>Patient arrival pattern by hour of day</CardDescription>
          </CardHeader>
          <CardContent>
            {peakData.length > 0 ? (
              <div className="flex items-end gap-1 w-full h-[180px]">
                {peakData.map((h, idx) => {
                  const max = Math.max(...peakData.map((p) => p.value), 1)
                  const pct = (h.value / max) * 100
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-0">
                      <div
                        className={`${getPeakColor(idx, peakData)} w-full rounded-t-sm transition-all hover:opacity-80`}
                        style={{ height: `${Math.max(pct, 2)}%`, minWidth: '2px' }}
                      />
                      <span className="text-[7px] text-muted-foreground mt-1 leading-none">{h.label}</span>
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 pointer-events-none">
                        {h.value} visits
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState message="No peak hours data" />
            )}
          </CardContent>
        </Card>

        {/* Visits by Department Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Visits by Department</CardTitle>
              <CardDescription>Department-wise patient distribution</CardDescription>
            </div>
            <ExportButton label="Patient Flow" />
          </CardHeader>
          <CardContent>
            {deptData.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptData.map((dept, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{dept.label}</TableCell>
                      <TableCell className="text-right">{dept.value.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {fd.totalVisits > 0 ? ((dept.value / fd.totalVisits) * 100).toFixed(1) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No department data" />
            )}
          </CardContent>
        </Card>

        {/* Average Duration by Stage */}
        {fd.averageDurationByStage && fd.averageDurationByStage.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Average Time by Stage</CardTitle>
              <CardDescription>Average duration patients spend at each stage (minutes)</CardDescription>
            </CardHeader>
            <CardContent>
              <HorizontalBarChart
                items={fd.averageDurationByStage.map((s) => ({ label: s.stage, value: s.averageMinutes }))}
                colorClass="bg-amber-500"
                maxItems={10}
              />
              <p className="text-xs text-muted-foreground mt-3">Based on {Math.max(...fd.averageDurationByStage.map((s) => s.visits))} recent completed stages</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ─── Tab 3: Billing ─────────────────────────────────────────────────────
  const renderBilling = () => {
    if (loadingBilling) return <ReportSkeleton />
    if (errorBilling) return <ErrorState message={errorBilling} onRetry={() => fetchSingleReport('billing', setBillingData, setLoadingBilling, setErrorBilling)} />
    if (!billingData) return <EmptyState message="No billing data available" />

    const bd = billingData as {
      outstandingInvoices: OutstandingInvoice[]
      outstandingCount: number
      outstandingTotal: number
      overdueInvoices: OutstandingInvoice[]
      overdueCount: number
      overdueTotal: number
      agingBuckets: AgingBucket[]
      averageInvoiceAmount: number
      totalDiscount: number
      invoicesWithDiscountCount: number
      averageDiscount: number
      collectionRate: number
      invoiceStatusCounts: Record<string, number>
      totalInvoices: number
    }

    const statusData = Object.entries(bd.invoiceStatusCounts || {}).map(([label, value]) => ({ label, value }))

    const getAgingColor = (label: string) => {
      if (label.includes('90+')) return 'bg-red-500'
      if (label.includes('61')) return 'bg-orange-500'
      if (label.includes('31')) return 'bg-amber-500'
      return 'bg-emerald-500'
    }

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Outstanding" value={formatCurrency(bd.outstandingTotal)} icon={DollarSign} colorClass="text-red-500" sub={`${bd.outstandingCount} invoices`} />
          <MetricCard label="Overdue" value={formatCurrency(bd.overdueTotal)} icon={AlertCircle} colorClass="text-red-600" sub={`${bd.overdueCount} invoices`} />
          <MetricCard label="Collection Rate" value={`${bd.collectionRate}%`} icon={TrendingUp} colorClass={bd.collectionRate >= 80 ? 'text-emerald-600' : 'text-amber-600'} />
          <MetricCard label="Avg Invoice" value={formatCurrency(bd.averageInvoiceAmount)} icon={BarChart3} colorClass="text-emerald-500" />
        </div>

        {/* Outstanding Invoices Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Outstanding Invoices</CardTitle>
              <CardDescription>{bd.outstandingCount} invoices pending payment</CardDescription>
            </div>
            <ExportButton label="Outstanding" />
          </CardHeader>
          <CardContent>
            {bd.outstandingInvoices.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bd.outstandingInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>
                          <div>{inv.patientName}</div>
                          <div className="text-xs text-muted-foreground">{inv.patientId}</div>
                        </TableCell>
                        <TableCell className="text-sm">{inv.date}</TableCell>
                        <TableCell className="text-sm">
                          {inv.dueDate ? (
                            <span className={inv.dueDate < new Date().toISOString().split('T')[0] ? 'text-red-500 font-medium' : ''}>
                              {inv.dueDate}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'Overdue' ? 'destructive' : 'secondary'} className="text-xs">
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.grandTotal)}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{formatCurrency(inv.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState message="No outstanding invoices — all clear!" />
            )}
          </CardContent>
        </Card>

        {/* Overdue Aging + Invoice Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Aging Buckets */}
          <Card>
            <CardHeader>
              <CardTitle>Overdue Aging</CardTitle>
              <CardDescription>Overdue invoices grouped by age</CardDescription>
            </CardHeader>
            <CardContent>
              {bd.agingBuckets.some((b) => b.count > 0) ? (
                <div className="space-y-4">
                  {bd.agingBuckets.map((bucket, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{bucket.label}</span>
                        <span className="text-muted-foreground">{bucket.count} invoices</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className={`${getAgingColor(bucket.label)} h-full rounded-full transition-all duration-500`}
                          style={{
                            width: `${bd.overdueCount > 0 ? (bucket.count / bd.overdueCount) * 100 : 0}%`,
                            minWidth: bucket.count > 0 ? '4px' : '0px',
                          }}
                        />
                      </div>
                      <p className="text-xs text-right text-muted-foreground">{formatCurrency(bucket.total)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No overdue invoices" />
              )}
            </CardContent>
          </Card>

          {/* Invoice Status + Discount Stats */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <PieLikeDisplay data={statusData} colors={PIE_COLORS} />
                ) : (
                  <EmptyState message="No status data" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Discount Utilization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 rounded-lg border">
                    <p className="text-xl font-bold text-amber-600">{formatCurrency(bd.totalDiscount)}</p>
                    <p className="text-xs text-muted-foreground">Total Discounts</p>
                  </div>
                  <div className="text-center p-3 rounded-lg border">
                    <p className="text-xl font-bold text-emerald-600">{bd.invoicesWithDiscountCount}</p>
                    <p className="text-xs text-muted-foreground">Invoices with Discount</p>
                  </div>
                  <div className="text-center p-3 rounded-lg border">
                    <p className="text-xl font-bold">{formatCurrency(bd.averageDiscount)}</p>
                    <p className="text-xs text-muted-foreground">Avg Discount</p>
                  </div>
                  <div className="text-center p-3 rounded-lg border">
                    <p className="text-xl font-bold">{bd.totalInvoices}</p>
                    <p className="text-xs text-muted-foreground">Total Invoices</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // ─── Tab 4: Doctor Performance ─────────────────────────────────────────
  const renderDoctorPerformance = () => {
    if (loadingDoctor) return <ReportSkeleton />
    if (errorDoctor) return <ErrorState message={errorDoctor} onRetry={() => fetchSingleReport('doctor-performance', setDoctorData, setLoadingDoctor, setErrorDoctor)} />
    if (!doctorData) return <EmptyState message="No doctor performance data" />

    const dd = doctorData as {
      doctors: DoctorPerfItem[]
      totalDoctors: number
      totalPatientsSeen: number
      totalRevenue: number
    }

    const sortedDoctors = [...(dd.doctors || [])].sort((a, b) => b[doctorSortBy] - a[doctorSortBy])

    const maxPatients = Math.max(...(dd.doctors || []).map((d) => d.patientsSeen), 1)
    const maxRevenue = Math.max(...(dd.doctors || []).map((d) => d.revenueGenerated), 1)

    return (
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Doctors" value={dd.totalDoctors.toString()} icon={Stethoscope} colorClass="text-emerald-600" />
          <MetricCard label="Patients Seen" value={dd.totalPatientsSeen.toLocaleString()} icon={Users} colorClass="text-blue-600" />
          <MetricCard label="Total Revenue" value={formatCurrency(dd.totalRevenue)} icon={DollarSign} colorClass="text-emerald-500" />
          <MetricCard label="Avg Revenue/Doctor" value={formatCurrency(dd.totalDoctors > 0 ? dd.totalRevenue / dd.totalDoctors : 0)} icon={TrendingUp} colorClass="text-amber-600" />
        </div>

        {/* Doctor Performance Table */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Doctor Performance Ranking</CardTitle>
              <CardDescription>Comprehensive doctor analytics</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={doctorSortBy} onValueChange={(v) => setDoctorSortBy(v as 'revenueGenerated' | 'patientsSeen')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenueGenerated">
                    <span className="flex items-center gap-2"><ArrowUpDown className="h-3 w-3" />Sort by Revenue</span>
                  </SelectItem>
                  <SelectItem value="patientsSeen">
                    <span className="flex items-center gap-2"><ArrowUpDown className="h-3 w-3" />Sort by Patients</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <ExportButton label="Doctor Report" />
            </div>
          </CardHeader>
          <CardContent>
            {sortedDoctors.length > 0 ? (
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead className="text-right">Patients Seen</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Prescriptions</TableHead>
                      <TableHead className="text-right">Avg/Day</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDoctors.map((doc, idx) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <Badge variant={idx < 3 ? 'default' : 'secondary'} className={idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-gray-400 text-white' : idx === 2 ? 'bg-orange-400 text-white' : ''}>
                            {idx + 1}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">{doc.doctorId} · {doc.experience}yr exp</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{doc.specialization}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{doc.patientsSeen}</div>
                          <div className="w-16 bg-muted rounded-full h-1.5 ml-auto mt-1">
                            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(doc.patientsSeen / maxPatients) * 100}%` }} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(doc.revenueGenerated)}</TableCell>
                        <TableCell className="text-right">{doc.prescriptionsCount}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{doc.avgPatientsPerDay}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState message="No doctor performance data" />
            )}
          </CardContent>
        </Card>

        {/* Visual Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Patients per Doctor</CardTitle>
              <CardDescription>Horizontal comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <HorizontalBarChart
                items={sortedDoctors.slice(0, 8).map((d) => ({ label: d.name, value: d.patientsSeen }))}
                colorClass="bg-emerald-500"
                maxItems={8}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue per Doctor</CardTitle>
              <CardDescription>Revenue generation comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <HorizontalBarChart
                items={sortedDoctors.slice(0, 8).map((d) => ({ label: d.name, value: d.revenueGenerated }))}
                colorClass="bg-amber-500"
                maxItems={8}
                showValues={false}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ─── Tab 5: Audit Trail ───────────────────────────────────────────────
  const renderAuditTrail = () => {
    const actionOptions = ['', 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'STATUS_CHANGE']
    const moduleOptions = ['', 'patients', 'appointments', 'doctors', 'billing', 'payments', 'prescriptions', 'medicines', 'settings', 'reports', 'support', 'auth', 'users', 'staff']
    const userOptions = ['', ...Array.from(new Set(auditLogs.map(l => l.userId))).slice(0, 20)]
    const userNames: Record<string, string> = {}
    auditLogs.forEach(l => { userNames[l.userId] = l.userName })
    const totalPages = Math.ceil(auditTotal / 25)

    const handleExportAuditCsv = () => {
      const header = 'Timestamp,User,Email,Role,Action,Module,Status,IP Address,Details'
      const rows = auditLogs.map(l => [
        new Date(l.createdAt).toISOString(),
        `"${l.userName}"`,
        `"${l.userEmail}"`,
        l.userRole,
        l.action,
        l.module,
        l.status,
        l.ipAddress || '',
        `"${(l.details || '').replace(/"/g, '""')}"`,
      ].join(','))
      downloadCsv(`audit-logs-${new Date().toISOString().split('T')[0]}.csv`, [header, ...rows].join('\n'))
      toast({ title: 'Export Complete', description: 'Audit log CSV downloaded' })
    }

    return (
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>System activity logs with filtering</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Action Type</label>
                <Select value={auditFilterAction} onValueChange={(v) => { setAuditFilterAction(v === 'all' ? '' : v); setAuditPage(1) }}>
                  <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {actionOptions.filter(Boolean).map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Module</label>
                <Select value={auditFilterModule} onValueChange={(v) => { setAuditFilterModule(v === 'all' ? '' : v); setAuditPage(1) }}>
                  <SelectTrigger><SelectValue placeholder="All Modules" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modules</SelectItem>
                    {moduleOptions.filter(Boolean).map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">User</label>
                <Select value={auditFilterUser} onValueChange={(v) => { setAuditFilterUser(v === 'all' ? '' : v); setAuditPage(1) }}>
                  <SelectTrigger><SelectValue placeholder="All Users" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {userOptions.filter(Boolean).map((u) => (
                      <SelectItem key={u} value={u}>{userNames[u] || u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Search</label>
                <Input
                  placeholder="Search user, action..."
                  value={auditFilterSearch}
                  onChange={(e) => { setAuditFilterSearch(e.target.value); setAuditPage(1) }}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                  setAuditFilterAction('')
                  setAuditFilterModule('')
                  setAuditFilterUser('')
                  setAuditFilterSearch('')
                  setAuditPage(1)
                }}>
                  Clear
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExportAuditCsv}>
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardContent className="p-0">
            {loadingAudit ? (
              <div className="p-6"><TableSkeleton rows={8} /></div>
            ) : errorAudit ? (
              <div className="p-6"><ErrorState message={errorAudit} onRetry={() => fetchAuditLogs(auditPage, auditFilterAction, auditFilterModule, auditFilterSearch, auditFilterUser)} /></div>
            ) : auditLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{log.userName}</div>
                          <div className="text-xs text-muted-foreground">{log.userEmail}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{log.userRole}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              log.action === 'LOGIN' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                              log.action === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              log.action === 'CREATE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              log.action === 'UPDATE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              ''
                            }`}
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.module}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === 'Success' ? 'default' : 'destructive'} className="text-xs">
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground font-mono">
                          {log.ipAddress || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-6"><EmptyState message="No audit logs found" /></div>
            )}
          </CardContent>

          {/* Pagination */}
          {!loadingAudit && auditLogs.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {((auditPage - 1) * 25) + 1}–{Math.min(auditPage * 25, auditTotal)} of {auditTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage <= 1}
                  onClick={() => setAuditPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const startPage = Math.max(1, auditPage - 2)
                    const pageNum = startPage + i
                    if (pageNum > totalPages) return null
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === auditPage ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setAuditPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auditPage >= totalPages}
                  onClick={() => setAuditPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // ─── Tab 6: GST Reports ───────────────────────────────────────────────
  const renderGstReports = () => {
    if (loadingGst) return <ReportSkeleton />
    if (errorGst) return <ErrorState message={errorGst} onRetry={fetchGstReport} />
    if (!gstData) return <EmptyState message="No GST data available" />

    const { gstr3b, hsnSummary } = gstData

    const handleDownloadGstr1Csv = () => {
      const header = 'HSN Code,Description,Total Quantity,Total Taxable Value,CGST,SGST,IGST,Total Tax'
      const rows = hsnSummary.map(h => [
        h.hsnCode,
        `"${h.description}"`,
        h.totalQuantity,
        h.totalValue.toFixed(2),
        h.cgst.toFixed(2),
        h.sgst.toFixed(2),
        h.igst.toFixed(2),
        h.totalTax.toFixed(2),
      ].join(','))

      // Grand totals
      const totals = hsnSummary.reduce((acc, h) => {
        acc.qty += h.totalQuantity
        acc.value += h.totalValue
        acc.cgst += h.cgst
        acc.sgst += h.sgst
        acc.igst += h.igst
        acc.tax += h.totalTax
        return acc
      }, { qty: 0, value: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 })

      rows.push([
        'TOTAL', '', totals.qty,
        totals.value.toFixed(2), totals.cgst.toFixed(2),
        totals.sgst.toFixed(2), totals.igst.toFixed(2), totals.tax.toFixed(2),
      ].join(','))

      downloadCsv(`GSTR-1-${gstPeriod}-${gstMonth || gstQuarter}.csv`, [header, ...rows].join('\n'))
      toast({ title: 'Downloaded', description: 'GSTR-1 CSV downloaded' })
    }

    const handleDownloadGstr3bCsv = () => {
      const header = 'Tax Rate (%),Taxable Value,CGST,SGST,IGST,Total Tax,Invoice Count'
      const rows = gstr3b.taxByRate.map(t => [
        t.rate.toString(),
        t.taxableValue.toFixed(2),
        t.cgst.toFixed(2),
        t.sgst.toFixed(2),
        t.igst.toFixed(2),
        t.totalTax.toFixed(2),
        t.invoiceCount.toString(),
      ].join(','))

      // Grand totals
      rows.push([
        'TOTAL',
        gstr3b.taxableValue.toFixed(2),
        gstr3b.cgst.toFixed(2),
        gstr3b.sgst.toFixed(2),
        gstr3b.igst.toFixed(2),
        gstr3b.totalTax.toFixed(2),
        gstr3b.totalInvoices.toString(),
      ].join(','))

      downloadCsv(`GSTR-3B-${gstPeriod}-${gstMonth || gstQuarter}.csv`, [header, ...rows].join('\n'))
      toast({ title: 'Downloaded', description: 'GSTR-3B CSV downloaded' })
    }

    const hsnTotals = hsnSummary.reduce((acc, h) => {
      acc.qty += h.totalQuantity
      acc.value += h.totalValue
      acc.cgst += h.cgst
      acc.sgst += h.sgst
      acc.igst += h.igst
      acc.tax += h.totalTax
      return acc
    }, { qty: 0, value: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 })

    return (
      <div className="space-y-6">
        {/* Period Selector */}
        <Card>
          <CardHeader>
            <CardTitle>GST Period Selection</CardTitle>
            <CardDescription>Select the filing period for GST reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Period Type</label>
                <Select value={gstPeriod} onValueChange={(v) => setGstPeriod(v as 'monthly' | 'quarterly' | 'custom')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {gstPeriod === 'monthly' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Month</label>
                  <Input
                    type="month"
                    value={gstMonth}
                    onChange={(e) => setGstMonth(e.target.value)}
                  />
                </div>
              )}

              {gstPeriod === 'quarterly' && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Quarter</label>
                  <Select value={gstQuarter} onValueChange={setGstQuarter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2025-Q1">Jan–Mar 2025</SelectItem>
                      <SelectItem value="2025-Q2">Apr–Jun 2025</SelectItem>
                      <SelectItem value="2025-Q3">Jul–Sep 2025</SelectItem>
                      <SelectItem value="2025-Q4">Oct–Dec 2025</SelectItem>
                      <SelectItem value="2024-Q1">Jan–Mar 2024</SelectItem>
                      <SelectItem value="2024-Q2">Apr–Jun 2024</SelectItem>
                      <SelectItem value="2024-Q3">Jul–Sep 2024</SelectItem>
                      <SelectItem value="2024-Q4">Oct–Dec 2024</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {gstPeriod === 'custom' && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">From Date</label>
                    <Input
                      type="date"
                      value={gstCustomFrom}
                      onChange={(e) => setGstCustomFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">To Date</label>
                    <Input
                      type="date"
                      value={gstCustomTo}
                      onChange={(e) => setGstCustomTo(e.target.value)}
                    />
                  </div>
                </>
              )}

              {(gstPeriod === 'custom' || gstPeriod === 'quarterly' || gstPeriod === 'monthly') && (
                <div className="flex items-end">
                  <Button variant="outline" onClick={fetchGstReport} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* GSTR-1 Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
                GSTR-1 Summary
              </CardTitle>
              <CardDescription>HSN/SAC-wise outward supply details</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadGstr1Csv}>
              <Download className="h-4 w-4" />
              Download GSTR-1 CSV
            </Button>
          </CardHeader>
          <CardContent>
            {hsnSummary.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>HSN Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">Total Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hsnSummary.map((h, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs font-medium">{h.hsnCode}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{h.description}</TableCell>
                        <TableCell className="text-right">{h.totalQuantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(h.totalValue)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(h.cgst)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(h.sgst)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(h.igst)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(h.totalTax)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Grand Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell className="font-mono text-xs">TOTAL</TableCell>
                      <TableCell className="text-sm">{hsnSummary.length} HSN codes</TableCell>
                      <TableCell className="text-right">{hsnTotals.qty}</TableCell>
                      <TableCell className="text-right">{formatCurrency(hsnTotals.value)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(hsnTotals.cgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(hsnTotals.sgst)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(hsnTotals.igst)}</TableCell>
                      <TableCell className="text-right text-emerald-700">{formatCurrency(hsnTotals.tax)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState message="No HSN-wise data for this period" />
            )}
          </CardContent>
        </Card>

        {/* GSTR-3B Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-amber-600" />
                GSTR-3B Summary
              </CardTitle>
              <CardDescription>Monthly return filing data</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadGstr3bCsv}>
              <Download className="h-4 w-4" />
              Download GSTR-3B CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Outward Supplies</p>
                  <p className="text-lg font-bold">{formatCurrency(gstr3b.outwardSupplies)}</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Total CGST</p>
                  <p className="text-lg font-bold">{formatCurrency(gstr3b.cgst)}</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Total SGST</p>
                  <p className="text-lg font-bold">{formatCurrency(gstr3b.sgst)}</p>
                </div>
                <div className="text-center p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Total IGST</p>
                  <p className="text-lg font-bold">{formatCurrency(gstr3b.igst)}</p>
                </div>
                <div className="text-center p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-950">
                  <p className="text-xs text-muted-foreground">Total Tax</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(gstr3b.totalTax)}</p>
                </div>
              </div>

              {/* Late Fees Indicator */}
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700 dark:text-amber-300">
                  {gstr3b.totalInvoices} invoices in period
                  {gstr3b.invoiceDateRange.from && (
                    <span className="ml-1">
                      ({gstr3b.invoiceDateRange.from} to {gstr3b.invoiceDateRange.to})
                    </span>
                  )}
                </span>
              </div>

              {/* Tax Breakdown by Rate */}
              {gstr3b.taxByRate.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Tax Breakdown by Rate</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tax Rate</TableHead>
                        <TableHead className="text-right">Taxable Value</TableHead>
                        <TableHead className="text-right">CGST</TableHead>
                        <TableHead className="text-right">SGST</TableHead>
                        <TableHead className="text-right">IGST</TableHead>
                        <TableHead className="text-right">Total Tax</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gstr3b.taxByRate.map((t, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">{t.rate}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(t.taxableValue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.cgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.sgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(t.igst)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(t.totalTax)}</TableCell>
                          <TableCell className="text-right">{t.invoiceCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Export handler ────────────────────────────────────────────────────
  const REPORT_EXPORT_MAP: Record<string, string> = {
    revenue: 'revenue',
    'patient-flow': 'patient-flow',
    billing: 'billing',
  }

  const handleExportReport = () => {
    const reportType = REPORT_EXPORT_MAP[activeTab]
    if (!reportType) return
    window.open('/api/export/reports?type=' + reportType, '_blank')
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="revenue">
              <DollarSign className="h-4 w-4 mr-1.5" />
              Revenue
            </TabsTrigger>
            <TabsTrigger value="patient-flow">
              <Activity className="h-4 w-4 mr-1.5" />
              Patient Flow
            </TabsTrigger>
            <TabsTrigger value="billing">
              <ClipboardList className="h-4 w-4 mr-1.5" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="doctor-performance">
              <Stethoscope className="h-4 w-4 mr-1.5" />
              Doctor Performance
            </TabsTrigger>
            <TabsTrigger value="audit-trail">
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              Audit Trail
            </TabsTrigger>
            <TabsTrigger value="gst">
              <Receipt className="h-4 w-4 mr-1.5" />
              GST Reports
            </TabsTrigger>
          </TabsList>
          {REPORT_EXPORT_MAP[activeTab] && (
            <Button variant="outline" onClick={handleExportReport} className="shrink-0 ml-4">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>

        <TabsContent value="revenue" className="space-y-6 mt-6">
          {renderRevenue()}
        </TabsContent>

        <TabsContent value="patient-flow" className="space-y-6 mt-6">
          {renderPatientFlow()}
        </TabsContent>

        <TabsContent value="billing" className="space-y-6 mt-6">
          {renderBilling()}
        </TabsContent>

        <TabsContent value="doctor-performance" className="space-y-6 mt-6">
          {renderDoctorPerformance()}
        </TabsContent>

        <TabsContent value="audit-trail" className="space-y-6 mt-6">
          {renderAuditTrail()}
        </TabsContent>

        <TabsContent value="gst" className="space-y-6 mt-6">
          {renderGstReports()}
        </TabsContent>
      </Tabs>
    </div>
  )
}
