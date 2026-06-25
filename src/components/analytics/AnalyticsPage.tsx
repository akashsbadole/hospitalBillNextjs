'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost, type SingleResponse, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BarChart4,
  TrendingUp,
  IndianRupee,
  Users,
  CalendarDays,
  Download,
  Plus,
  RefreshCw,
  AlertCircle,
  Eye,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react'

interface Dashboard {
  id: string
  name: string
  description: string | null
}

interface MetricCardData {
  totalRevenue: number
  patientVolume: number
  appointments: number
  avgBillValue: number
  revenueChange: number | null
  patientChange: number | null
  appointmentChange: number | null
  avgBillChange: number | null
}

interface RevenueTrend {
  date: string
  amount: number
}

interface DepartmentVolume {
  department: string
  patients: number
}

interface PaymentMethodDist {
  method: string
  amount: number
  count: number
}

interface TopProcedure {
  name: string
  count: number
  revenue: number
}

interface WidgetData {
  revenueTrend: RevenueTrend[]
  departmentVolume: DepartmentVolume[]
  paymentMethods: PaymentMethodDist[]
  topProcedures: TopProcedure[]
}

interface RecentReport {
  id: string
  name: string
  type: string
  generatedAt: string
  status: string
  dataUrl: string | null
}

const REPORT_TYPES = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'patient-volume', label: 'Patient Volume' },
  { value: 'department-performance', label: 'Department Performance' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'lab', label: 'Lab' },
  { value: 'collection', label: 'Collection' },
  { value: 'trend', label: 'Trend' },
  { value: 'predictive', label: 'Predictive' },
]

const PIE_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#f59e0b', '#8b5cf6', '#06b6d4']

function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-4 items-center p-2">
      {Array.from({ length: cols }).map((_, j) => (
        <Skeleton key={j} className="h-4 flex-1" />
      ))}
    </div>
  )
}

function EmptyState({ message, icon: Icon = BarChart4 }: { message: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-3">
      <Icon className="h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <AlertCircle className="h-8 w-8 text-red-400" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />Retry
      </Button>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, colorClass, change }: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  colorClass?: string
  change?: number | null
}) {
  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${colorClass || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass || ''}`}>{value}</div>
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
            <span className="text-xs text-muted-foreground">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function AnalyticsPage() {
  const { toast } = useToast()

  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [selectedDashboard, setSelectedDashboard] = useState('default')
  const [dashboardsLoading, setDashboardsLoading] = useState(true)

  const [metrics, setMetrics] = useState<MetricCardData | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)

  const [widgetData, setWidgetData] = useState<WidgetData | null>(null)
  const [widgetLoading, setWidgetLoading] = useState(false)
  const [widgetError, setWidgetError] = useState<string | null>(null)

  const [reportType, setReportType] = useState('revenue')
  const [reportDateFrom, setReportDateFrom] = useState('')
  const [reportDateTo, setReportDateTo] = useState('')
  const [reportGenerating, setReportGenerating] = useState(false)
  const [generatedReport, setGeneratedReport] = useState<Record<string, unknown> | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)

  const [recentReports, setRecentReports] = useState<RecentReport[]>([])
  const [recentReportsLoading, setRecentReportsLoading] = useState(false)

  const fetchDashboards = useCallback(async () => {
    setDashboardsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<Dashboard>>('/analytics/dashboards')
      setDashboards(res.data)
    } catch {
      // Silently fail
    } finally {
      setDashboardsLoading(false)
    }
  }, [])

  const fetchMetrics = useCallback(async (dashboardId: string) => {
    setMetricsLoading(true)
    setMetricsError(null)
    try {
      const res = await apiGet<SingleResponse<MetricCardData>>(`/analytics/metrics`, { dashboardId })
      setMetrics(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load metrics'
      setMetricsError(msg)
    } finally {
      setMetricsLoading(false)
    }
  }, [])

  const fetchWidgetData = useCallback(async (dashboardId: string) => {
    setWidgetLoading(true)
    setWidgetError(null)
    try {
      const res = await apiGet<SingleResponse<WidgetData>>(`/analytics/widgets`, { dashboardId })
      setWidgetData(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load widget data'
      setWidgetError(msg)
    } finally {
      setWidgetLoading(false)
    }
  }, [])

  const fetchRecentReports = useCallback(async () => {
    setRecentReportsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<RecentReport>>('/analytics/reports')
      setRecentReports(res.data)
    } catch {
      // Silently fail
    } finally {
      setRecentReportsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboards()
  }, [fetchDashboards])

  useEffect(() => {
    if (selectedDashboard) {
      fetchMetrics(selectedDashboard)
      fetchWidgetData(selectedDashboard)
      fetchRecentReports()
    }
  }, [selectedDashboard, fetchMetrics, fetchWidgetData, fetchRecentReports])

  const handleGenerateReport = async () => {
    setReportGenerating(true)
    setGeneratedReport(null)
    try {
      const params: Record<string, string> = { type: reportType }
      if (reportDateFrom) params.dateFrom = reportDateFrom
      if (reportDateTo) params.dateTo = reportDateTo
      const res = await apiPost<SingleResponse<Record<string, unknown>>>('/analytics/reports', params)
      setGeneratedReport(res.data)
      setReportModalOpen(true)
      toast({ title: 'Report Generated', description: `${REPORT_TYPES.find((r) => r.value === reportType)?.label} report is ready` })
      fetchRecentReports()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to generate report', variant: 'destructive' })
    } finally {
      setReportGenerating(false)
    }
  }

  const handleDeleteReport = async (id: string) => {
    try {
      const { apiDelete } = await import('@/lib/api-client')
      await apiDelete(`/analytics/reports/${id}`)
      toast({ title: 'Report Deleted', description: 'Report has been removed' })
      fetchRecentReports()
    } catch (err) {
      toast({ title: 'Error', description: err instanceof ApiError ? err.message : 'Failed to delete report', variant: 'destructive' })
    }
  }

  const downloadReportJson = (report: Record<string, unknown>, filename: string) => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderWidgetGrid = () => {
    if (widgetLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
              <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (widgetError) {
      return <ErrorState message={widgetError} onRetry={() => fetchWidgetData(selectedDashboard)} />
    }

    if (!widgetData) {
      return <EmptyState message="No widget data available" />
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Daily revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            {widgetData.revenueTrend.length > 0 ? (
              <div className="flex items-end gap-[2px] w-full h-[200px]">
                {widgetData.revenueTrend.slice(-30).map((d, idx) => {
                  const values = widgetData.revenueTrend.slice(-30).map((v) => v.amount)
                  const maxVal = Math.max(...values, 1)
                  const pct = (d.amount / maxVal) * 100
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative min-w-0">
                      <div
                        className="bg-emerald-500 w-full rounded-t-sm transition-all duration-200 hover:opacity-80 min-h-[2px]"
                        style={{ height: `${Math.max(pct, 1)}%` }}
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border border-border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10 pointer-events-none">
                        {d.date}: {formatCurrency(d.amount)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState message="No revenue trend data" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart4 className="h-4 w-4 text-blue-500" />
              Patient Volume by Department
            </CardTitle>
            <CardDescription>Patient distribution across departments</CardDescription>
          </CardHeader>
          <CardContent>
            {widgetData.departmentVolume.length > 0 ? (
              <div className="space-y-2">
                {widgetData.departmentVolume.map((dept, idx) => {
                  const maxPatients = Math.max(...widgetData.departmentVolume.map((d) => d.patients), 1)
                  const pct = (dept.patients / maxPatients) * 100
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 truncate text-right shrink-0">{dept.department}</span>
                      <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${pct}%`, minWidth: dept.patients > 0 ? '20px' : '0px' }}
                        >
                          <span className="text-[10px] font-medium text-white">{dept.patients}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState message="No department volume data" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-amber-500" />
              Payment Method Distribution
            </CardTitle>
            <CardDescription>Revenue by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            {widgetData.paymentMethods.length > 0 ? (
              <div className="space-y-3">
                {widgetData.paymentMethods.map((pm, idx) => {
                  const total = widgetData.paymentMethods.reduce((s, p) => s + p.amount, 0)
                  const pct = total > 0 ? ((pm.amount / total) * 100).toFixed(1) : '0'
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <span className="text-foreground">{pm.method}</span>
                        </div>
                        <span className="text-muted-foreground text-xs">{pct}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                            minWidth: pm.amount > 0 ? '4px' : '0px',
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        {formatCurrency(pm.amount)} ({pm.count} txns)
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState message="No payment method data" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-purple-500" />
              Top Procedures / Services
            </CardTitle>
            <CardDescription>Most performed procedures</CardDescription>
          </CardHeader>
          <CardContent>
            {widgetData.topProcedures.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Procedure</TableHead>
                    <TableHead className="text-xs text-right">Count</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {widgetData.topProcedures.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-right">{p.count}</TableCell>
                      <TableCell className="text-sm text-right">{formatCurrency(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No procedure data" />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderGeneratedReport = () => {
    if (!generatedReport) return null
    const entries = Object.entries(generatedReport).filter(([k]) => !['id', 'createdAt', 'updatedAt'].includes(k))
    return (
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated Report</DialogTitle>
            <DialogDescription>
              {REPORT_TYPES.find((r) => r.value === reportType)?.label} report
              {reportDateFrom && reportDateTo ? ` (${reportDateFrom} to ${reportDateTo})` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                    <TableCell>
                      {typeof value === 'number' ? (
                        key.toLowerCase().includes('revenue') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('average') ? (
                          formatCurrency(value)
                        ) : (
                          value.toLocaleString()
                        )
                      ) : typeof value === 'object' && value !== null ? (
                        <pre className="text-xs bg-muted p-2 rounded max-h-[200px] overflow-auto">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      ) : (
                        String(value)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => downloadReportJson(generatedReport as Record<string, unknown>, `report-${reportType}`)}>
              <Download className="mr-2 h-4 w-4" />Download JSON
            </Button>
            <Button onClick={() => setReportModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics & BI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Advanced analytics and business intelligence dashboard
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedDashboard} onValueChange={setSelectedDashboard} disabled={dashboardsLoading}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Dashboard" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Dashboard</SelectItem>
              {dashboards.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {metricsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-24" /></CardContent>
            </Card>
          ))}
        </div>
      ) : metricsError ? (
        <ErrorState message={metricsError} onRetry={() => fetchMetrics(selectedDashboard)} />
      ) : metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Revenue (This Month)"
            value={formatCurrency(metrics.totalRevenue)}
            icon={IndianRupee}
            colorClass="text-emerald-600"
            change={metrics.revenueChange}
          />
          <MetricCard
            label="Patient Volume"
            value={metrics.patientVolume.toLocaleString()}
            icon={Users}
            colorClass="text-blue-600"
            change={metrics.patientChange}
          />
          <MetricCard
            label="Appointments"
            value={metrics.appointments.toLocaleString()}
            icon={CalendarDays}
            colorClass="text-amber-600"
            change={metrics.appointmentChange}
          />
          <MetricCard
            label="Avg. Bill Value"
            value={formatCurrency(metrics.avgBillValue)}
            icon={BarChart4}
            colorClass="text-purple-600"
            change={metrics.avgBillChange}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No data available
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {renderWidgetGrid()}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Download className="h-5 w-5 text-emerald-500" />
            Report Generator
          </CardTitle>
          <CardDescription>Generate custom analytics reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
            <div className="space-y-1.5">
              <Label className="text-xs">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="w-[150px]" />
            </div>
            <Button
              onClick={handleGenerateReport}
              disabled={reportGenerating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {reportGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {renderGeneratedReport()}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Reports</CardTitle>
          <CardDescription>Previously generated analytics reports</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {recentReportsLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
            </div>
          ) : recentReports.length === 0 ? (
            <EmptyState message="No reports generated yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Report ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReports.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-medium">{r.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm font-medium">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">{r.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(r.generatedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        r.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300' :
                        r.status === 'Failed' ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' :
                        'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                      }>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {r.dataUrl && (
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => window.open(r.dataUrl!, '_blank')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="size-8 text-red-500" onClick={() => handleDeleteReport(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
