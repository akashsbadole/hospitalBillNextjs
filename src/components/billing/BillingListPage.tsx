'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigation } from '@/stores/navigation'
import { useBillingStore, type Invoice as StoreInvoice } from '@/stores/billing'
import { apiGet, apiDelete, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { CreateInvoiceDialog } from './CreateInvoiceDialog'
import {
  Plus,
  Search,
  FileText,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Eye,
  Printer,
  Send,
  Trash2,
  Filter,
  TrendingUp,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react'
import { ImportCsvDialog } from '@/components/ImportCsvDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
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

type InvoiceStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled'

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  Paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  Unpaid: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'Partially Paid': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  Overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  Cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400',
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status as InvoiceStatus] || 'bg-gray-100 text-gray-600'
  return (
    <Badge variant="outline" className={colorClass}>
      {status}
    </Badge>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border-l-4 border-l-muted">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface InvoiceStats {
  total: number
  totalRevenue: number
  outstanding: number
  overdue: number
}

export function BillingListPage() {
  const { setCurrentPage } = useNavigation()
  const { toast } = useToast()

  // Store state
  const {
    invoiceList,
    createForm,
    fetchInvoices,
    setInvoiceFilter,
    setInvoicePage,
    resetInvoiceFilters,
    openCreateDialog,
  } = useBillingStore()

  const { invoices, loading, error, page, totalPages, total, filters } = invoiceList

  // Local state: stats (not managed by store)
  const [stats, setStats] = useState<InvoiceStats>({
    total: 0,
    totalRevenue: 0,
    outstanding: 0,
    overdue: 0,
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // Local state: delete confirmation (list-page specific)
  const [deleteTarget, setDeleteTarget] = useState<StoreInvoice | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // Local search input with debounce to store
  const [localSearch, setLocalSearch] = useState(filters.search || '')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Previous dialog open state for stats refresh
  const prevDialogOpen = useRef(false)

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await apiGet<{ data: Record<string, unknown> }>('/reports', { type: 'financial' })
      const report = res.data
      setStats({
        total: (report?.totalInvoices as number) || 0,
        totalRevenue: (report?.totalCollected as number) || 0,
        outstanding: (report?.totalOutstanding as number) || 0,
        overdue: ((report?.invoicesByStatus as Record<string, number>)?.['Overdue']) || 0,
      })
    } catch (err) {
      console.error('[BillingList] stats error:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // Fetch invoices on mount and when page/filters change
  useEffect(() => {
    fetchInvoices()
  }, [page, filters.search, filters.status, filters.fromDate, filters.toDate, fetchInvoices])

  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Refresh stats when create dialog closes (invoice may have been created)
  useEffect(() => {
    if (prevDialogOpen.current && !createForm.dialogOpen) {
      fetchStats()
    }
    prevDialogOpen.current = createForm.dialogOpen
  }, [createForm.dialogOpen, fetchStats])

  // Debounced search input → store filter
  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setInvoiceFilter('search', value)
    }, 300)
  }

  const handleStatusChange = (value: string) => {
    setInvoiceFilter('status', value)
  }

  const handleDateFromChange = (value: string) => {
    setInvoiceFilter('fromDate', value)
  }

  const handleDateToChange = (value: string) => {
    setInvoiceFilter('toDate', value)
  }

  const handleClearFilters = () => {
    resetInvoiceFilters()
    setLocalSearch('')
  }

  const handleDeleteInvoice = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/billing/${deleteTarget.id}`)
      toast({ title: 'Invoice Cancelled', description: `${deleteTarget.invoiceNumber} has been cancelled.` })
      setDeleteTarget(null)
      fetchInvoices()
      fetchStats()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to cancel invoice'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // GST summary calculations from current page data
  const gstSummary = {
    subtotal: invoices.reduce((s, i) => s + i.subtotal, 0),
    cgst: invoices.reduce((s, i) => s + i.cgst, 0),
    sgst: invoices.reduce((s, i) => s + i.sgst, 0),
    totalGst: invoices.reduce((s, i) => s + i.totalGst, 0),
    grandTotal: invoices.reduce((s, i) => s + i.grandTotal, 0),
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Invoices
                  </p>
                  <p className="mt-1 text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Total Revenue
                  </p>
                  <p className="mt-1 text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Outstanding
                  </p>
                  <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(stats.outstanding)}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <IndianRupee className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Overdue
                  </p>
                  <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats.overdue}
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Bar + Create Button */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search invoice or patient..."
                  className="pl-9"
                  value={localSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                />
              </div>

              {/* Status Filter */}
              <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <Filter className="mr-1 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Paid">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Paid
                    </span>
                  </SelectItem>
                  <SelectItem value="Unpaid">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-orange-500" /> Unpaid
                    </span>
                  </SelectItem>
                  <SelectItem value="Partially Paid">Partially Paid</SelectItem>
                  <SelectItem value="Overdue">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-red-500" /> Overdue
                    </span>
                  </SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Date From */}
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="w-full sm:w-[160px]"
                placeholder="From"
              />

              {/* Date To */}
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="w-full sm:w-[160px]"
                placeholder="To"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  const params = new URLSearchParams()
                  if (filters.search) params.set('search', filters.search)
                  if (filters.status) params.set('status', filters.status)
                  if (filters.fromDate) params.set('fromDate', filters.fromDate)
                  if (filters.toDate) params.set('toDate', filters.toDate)
                  window.open('/api/export/invoices?' + params.toString(), '_blank')
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Button
                onClick={openCreateDialog}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">Failed to load invoices</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={fetchInvoices}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h3 className="text-base font-semibold">Invoice Records</h3>
                <p className="text-sm text-muted-foreground">
                  Showing {invoices.length} of {total} invoices
                </p>
              </div>
            </div>

            <ScrollArea className="max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[130px]">Invoice No</TableHead>
                    <TableHead>Patient Name</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">Due Date</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">GST</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12">
                        <Receipt className="mx-auto h-12 w-12 text-muted-foreground/30" />
                        <p className="mt-2 text-sm text-muted-foreground">No invoices found</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={handleClearFilters}
                        >
                          Clear Filters
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        onClick={() =>
                          setCurrentPage('invoice-detail', { id: invoice.id })
                        }
                      >
                        <TableCell className="font-medium text-emerald-700 dark:text-emerald-400">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{invoice.patient?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{invoice.patient?.phone || ''}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {formatDate(invoice.date)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(invoice.subtotal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                          {formatCurrency(invoice.totalGst)}
                        </TableCell>
                        <TableCell className="text-right font-semibold font-mono text-sm">
                          {formatCurrency(invoice.grandTotal)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.status} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCurrentPage('invoice-detail', { id: invoice.id })
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                window.open(`/api/billing/${invoice.id}/pdf`, '_blank')
                              }}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={async (e) => {
                                e.stopPropagation()
                                const phone = invoice.patient.phone?.replace(/[^0-9]/g, '')
                                if (!phone) {
                                  toast({ title: 'Error', description: 'Patient has no phone number', variant: 'destructive' })
                                  return
                                }
                                const msg = `🧾 Invoice from MediBill Pro

Patient: ${invoice.patient.name}
Invoice #: ${invoice.invoiceNumber}
Amount: Rs.${invoice.grandTotal.toFixed(2)}
Status: ${invoice.status}

Thank you for choosing our services.`
                                try {
                                  const { sendWhatsApp } = await import('@/lib/whatsapp-client')
                                  sendWhatsApp({
                                    to: `+91${phone}`,
                                    template: 'invoice',
                                    entityType: 'Invoice',
                                    entityId: invoice.id,
                                    messageBody: msg,
                                    onSuccess: () => toast({ title: 'Sent!', description: `Invoice sent via WhatsApp to ${invoice.patient.name}` }),
                                    onError: (err) => toast({ title: 'Failed', description: err, variant: 'destructive' }),
                                  })
                                } catch {
                                  toast({ title: 'Error', description: 'Failed to send invoice', variant: 'destructive' })
                                }
                              }}>
                                <Send className="mr-2 h-4 w-4" />
                                Send to Patient
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteTarget(invoice)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cancel Invoice
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            {/* GST Summary Footer */}
            {invoices.length > 0 && (
              <div className="border-t bg-muted/30 px-6 py-3">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Total Subtotal:</span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(gstSummary.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Total CGST:</span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(gstSummary.cgst)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Total SGST:</span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(gstSummary.sgst)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Total GST:</span>
                    <span className="font-semibold font-mono">
                      {formatCurrency(gstSummary.totalGst)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Grand Total:</span>
                    <span className="font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(gstSummary.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-6 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setInvoicePage(page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setInvoicePage(page + 1)}
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

      {/* Create Invoice Dialog — controlled by store, no props needed */}
      <CreateInvoiceDialog />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Cancel Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel invoice{' '}
              <span className="font-semibold">{deleteTarget?.invoiceNumber}</span>? This action cannot
              be undone. Invoices with successful payments cannot be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteInvoice}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel Invoice
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportCsvDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Invoices"
        importUrl="/api/import/invoices"
        templateHeaders={['Invoice No', 'Patient ID', 'Patient Name', 'Date', 'Status', 'Description', 'Quantity', 'Unit Price', 'GST Rate', 'HSN Code', 'Type']}
        onSuccess={() => fetchInvoices()}
      />
    </div>
  )
}
