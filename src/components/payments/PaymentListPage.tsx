'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiGet, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { VALID_PAYMENT_METHODS } from '@/lib/constants'
import { useBillingStore, type PaymentRecord } from '@/stores/billing'
import { useToast } from '@/hooks/use-toast'
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
import { Skeleton } from '@/components/ui/skeleton'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  Wallet,
  Globe,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  Filter,
  TrendingUp,
  Clock,
  Receipt,
  Wifi,
  Zap,
  Shield,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react'

// ── Helpers ──

function MethodBadge({ method }: { method: string }) {
  const config: Record<string, { icon: React.ElementType; className: string }> = {
    Cash: { icon: Banknote, className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300' },
    UPI: { icon: Smartphone, className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300' },
    Card: { icon: CreditCard, className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300' },
    'Net Banking': { icon: Building2, className: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300' },
    Wallet: { icon: Wallet, className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300' },
    Razorpay: { icon: Globe, className: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300' },
    PayPal: { icon: Globe, className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300' },
  }
  const { icon: Icon, className } = config[method] || { icon: Banknote, className: '' }
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {method}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: React.ElementType; className: string }> = {
    Success: { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300' },
    Pending: { icon: Clock, className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300' },
    Failed: { icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300' },
    Refunded: { icon: RotateCcw, className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400' },
  }
  const { icon: Icon, className } = config[status] || { icon: Clock, className: '' }
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function PaymentListPage() {
  const { toast } = useToast()

  // ── Store ──
  const {
    paymentList,
    fetchPayments,
    setPaymentFilter,
    setPaymentPage,
    resetPaymentFilters,
    setRefundDialogOpen,
    refundPayment,
  } = useBillingStore()

  const {
    payments,
    loading,
    error,
    page,
    total,
    totalPages,
    filters,
    refundDialogOpen,
    refundingPaymentId,
    refunding,
  } = paymentList

  // ── Local state (stats fetched from reports API) ──
  const [stats, setStats] = useState({
    todayCollected: 0,
    monthCollected: 0,
    pendingCount: 0,
    failedCount: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // Method breakdown
  const [methodBreakdown, setMethodBreakdown] = useState<Record<string, { count: number; total: number }>>({})
  const [breakdownLoading, setBreakdownLoading] = useState(true)

  // Receipt dialog (local, not in store)
  const [receiptDialog, setReceiptDialog] = useState<PaymentRecord | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptDetail, setReceiptDetail] = useState<PaymentRecord | null>(null)

  // Derived refund payment
  const refundPaymentRecord = refundingPaymentId ? payments.find((p) => p.id === refundingPaymentId) || null : null

  // ── Effects ──
  useEffect(() => {
    fetchPayments()
  }, [page, filters.method, filters.status, filters.fromDate, filters.toDate, fetchPayments])

  // Show toast on fetch error
  useEffect(() => {
    if (error) {
      toast({ title: 'Error', description: error, variant: 'destructive' })
    }
  }, [error, toast])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const monthStartStr = monthStart.toISOString().split('T')[0]

      // Use the reports API for today/month collections and method breakdown,
      // and lightweight paginated calls (limit: 1) for status counts.
      const [todayRes, monthRes, overallRes, pendingRes, failedRes] = await Promise.all([
        apiGet<{ data: { totalCollected: number } }>('/reports', { type: 'financial', fromDate: todayStr, toDate: todayStr }),
        apiGet<{ data: { totalCollected: number } }>('/reports', { type: 'financial', fromDate: monthStartStr }),
        apiGet<{ data: { revenueByMethod: Record<string, number> } }>('/reports', { type: 'financial' }),
        apiGet<PaginatedResponse<PaymentRecord>>('/payments', { status: 'Pending', limit: 1 }),
        apiGet<PaginatedResponse<PaymentRecord>>('/payments', { status: 'Failed', limit: 1 }),
      ])

      const reportToday = todayRes.data as Record<string, unknown> | undefined
      const reportMonth = monthRes.data as Record<string, unknown> | undefined
      const reportOverall = overallRes.data as Record<string, unknown> | undefined
      const methodMap = (reportOverall?.revenueByMethod as Record<string, number>) || {}

      setStats({
        todayCollected: (reportToday?.totalCollected as number) || 0,
        monthCollected: (reportMonth?.totalCollected as number) || 0,
        pendingCount: pendingRes.total || 0,
        failedCount: failedRes.total || 0,
      })

      // Build method breakdown from revenueByMethod (amounts from server)
      const breakdown: Record<string, { count: number; total: number }> = {}
      for (const [method, total] of Object.entries(methodMap)) {
        breakdown[method] = { count: 0, total }
      }
      setMethodBreakdown(breakdown)
    } catch (err) {
      console.error('[PaymentList] stats error:', err)
    } finally {
      setStatsLoading(false)
      setBreakdownLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // View receipt - fetch full payment detail
  const handleViewReceipt = async (payment: PaymentRecord) => {
    setReceiptDialog(payment)
    setReceiptLoading(true)
    setReceiptDetail(null)
    try {
      const res = await apiGet<{ data: PaymentRecord }>(`/payments/${payment.id}`)
      setReceiptDetail(res.data)
    } catch (err) {
      console.error('[PaymentList] receipt fetch error:', err)
      setReceiptDetail(payment)
    } finally {
      setReceiptLoading(false)
    }
  }

  // Process refund
  const handleRefund = async () => {
    if (!refundingPaymentId || !refundPaymentRecord) return
    try {
      await refundPayment('')
      toast({
        title: 'Refund Processed',
        description: `Payment ${refundPaymentRecord.paymentId} has been refunded successfully. Amount: ${formatCurrency(refundPaymentRecord.amount)}`,
      })
      fetchStats()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to process refund'
      toast({ title: 'Refund Failed', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Collected Today</CardTitle>
              <IndianRupee className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.todayCollected)}</div>
              <p className="text-xs text-muted-foreground mt-1">Today&apos;s successful collections</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.monthCollected)}</div>
              <p className="text-xs text-muted-foreground mt-1">Monthly successful collections</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting confirmation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed Transactions</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failedCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Require attention</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Method Breakdown Summary */}
      {breakdownLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-3">
                  <Skeleton className="h-5 w-16 mb-2" />
                  <Skeleton className="h-6 w-20 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : Object.keys(methodBreakdown).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Method Breakdown</CardTitle>
            <CardDescription>Revenue by payment method (successful transactions)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Object.entries(methodBreakdown).map(([method, data]) => (
                <div
                  key={method}
                  className="rounded-lg border p-3 text-center transition-colors hover:bg-muted/50"
                >
                  <MethodBadge method={method} />
                  <p className="mt-2 text-lg font-bold">{formatCurrency(data.total)}</p>
                  <p className="text-xs text-muted-foreground">{data.count} transaction{data.count > 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">From Date</label>
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => setPaymentFilter('fromDate', e.target.value)}
                  className="w-full lg:w-40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">To Date</label>
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => setPaymentFilter('toDate', e.target.value)}
                  className="w-full lg:w-40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Method</label>
                <Select value={filters.method || 'all'} onValueChange={(v) => setPaymentFilter('method', v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    {VALID_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={filters.status || 'all'} onValueChange={(v) => setPaymentFilter('status', v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-full lg:w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Success">Success</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                    <SelectItem value="Refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams()
                  if (filters.method) params.set('method', filters.method)
                  if (filters.status) params.set('status', filters.status)
                  if (filters.fromDate) params.set('fromDate', filters.fromDate)
                  if (filters.toDate) params.set('toDate', filters.toDate)
                  window.open('/api/export/payments?' + params.toString(), '_blank')
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={resetPaymentFilters}
                className="shrink-0"
              >
                <Filter className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment History Table */}
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">Failed to load payments</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={fetchPayments}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
            <CardDescription>
              Showing {payments.length} of {total} payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[520px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        <Receipt className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                        No payments found matching the filters.
                        <div className="mt-2">
                          <Button variant="outline" size="sm" onClick={resetPaymentFilters}>
                            Clear Filters
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">{payment.paymentId}</TableCell>
                        <TableCell className="font-mono text-xs">{payment.invoice?.invoiceNumber || '—'}</TableCell>
                        <TableCell className="font-medium">{payment.patient?.name || 'Unknown'}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          <MethodBadge method={payment.method} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(payment.createdAt)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={payment.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleViewReceipt(payment)}
                              title="View Receipt"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {payment.status === 'Success' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => setRefundDialogOpen(true, payment.id)}
                                title="Process Refund"
                              >
                                <RotateCcw className="h-4 w-4" />
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPaymentPage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPaymentPage(page + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Razorpay Integration Section (Info Display Only) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Globe className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-base">Razorpay Settings</CardTitle>
              <CardDescription>Online payment gateway configuration</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-medium">Gateway Status</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
                <span className="text-sm font-semibold text-emerald-600">Active</span>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Mode</span>
              </div>
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300">
                Test Mode
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">rzp_test_xxxx...</p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">Connection</span>
              </div>
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600">Connected</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Last ping: 2 min ago</p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Webhook</span>
              </div>
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600">Configured</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">3 endpoints active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={!!receiptDialog} onOpenChange={(open) => !open && setReceiptDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
            <DialogDescription>Detailed payment information</DialogDescription>
          </DialogHeader>
          {receiptLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : receiptDetail ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Payment ID</span>
                  <span className="font-mono text-sm font-semibold">{receiptDetail.paymentId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Invoice</span>
                  <span className="font-mono text-sm">{receiptDetail.invoice?.invoiceNumber || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Patient</span>
                  <span className="text-sm font-medium">{receiptDetail.patient?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-sm">{formatDateTime(receiptDetail.createdAt)}</span>
                </div>
                {receiptDetail.receiptNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Receipt No</span>
                    <span className="font-mono text-sm font-semibold">{receiptDetail.receiptNumber}</span>
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Method</span>
                  <MethodBadge method={receiptDetail.method} />
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={receiptDetail.status} />
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="text-base font-semibold">Amount</span>
                  <span className="text-xl font-bold text-emerald-600">
                    {formatCurrency(receiptDetail.amount)}
                  </span>
                </div>
              </div>
              {(receiptDetail.razorpayPaymentId || receiptDetail.razorpayOrderId) && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Razorpay Reference</p>
                  <div className="space-y-1">
                    {receiptDetail.razorpayPaymentId && (
                      <p className="text-xs font-mono">
                        <span className="text-muted-foreground">Pay ID: </span>
                        {receiptDetail.razorpayPaymentId}
                      </p>
                    )}
                    {receiptDetail.razorpayOrderId && (
                      <p className="text-xs font-mono">
                        <span className="text-muted-foreground">Order ID: </span>
                        {receiptDetail.razorpayOrderId}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialog(null)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (receiptDetail?.id) {
                  window.open(`/api/payments/${receiptDetail.id}/receipt`, '_blank')
                }
                setReceiptDialog(null)
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Receipt className="mr-2 h-4 w-4" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Confirmation Dialog */}
      <AlertDialog open={refundDialogOpen} onOpenChange={(open) => !open && setRefundDialogOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <RotateCcw className="h-5 w-5" />
              Process Refund
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will refund the payment to the patient&apos;s original payment method.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {refundPaymentRecord && (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:bg-red-950/30 dark:border-red-800">
                <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
                  You are about to refund:
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Payment</span>
                    <span className="text-sm font-mono">{refundPaymentRecord.paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Patient</span>
                    <span className="text-sm">{refundPaymentRecord.patient?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Method</span>
                    <MethodBadge method={refundPaymentRecord.method} />
                  </div>
                  <div className="flex justify-between border-t border-red-200 dark:border-red-800 pt-2">
                    <span className="text-sm font-semibold">Amount</span>
                    <span className="text-lg font-bold text-red-600">
                      {formatCurrency(refundPaymentRecord.amount)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>Refunds typically take 5-7 business days to reflect in the patient&apos;s account.</p>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refunding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              disabled={refunding}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {refunding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}