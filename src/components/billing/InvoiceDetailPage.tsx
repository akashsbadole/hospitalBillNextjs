'use client'

import React, { useEffect } from 'react'
import { useNavigation } from '@/stores/navigation'
import { useBillingStore } from '@/stores/billing'
import { usePaymentStore } from '@/stores/payment'
import { formatCurrency } from '@/lib/utils'
import { PaymentDialog } from './PaymentDialog'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Printer,
  Send,
  Download,
  Phone,
  MapPin,
  Calendar,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
  Wallet,
  Trash2,
  Loader2,
  Building2,
  CreditCard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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
  AlertDialog,
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

const STATUS_ICONS: Record<InvoiceStatus, React.ElementType> = {
  Paid: CheckCircle2,
  Unpaid: Clock,
  'Partially Paid': Clock,
  Overdue: AlertTriangle,
  Cancelled: Ban,
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
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

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="text-right space-y-2">
              <Skeleton className="h-8 w-32 ml-auto" />
              <Skeleton className="h-6 w-24 ml-auto" />
              <Skeleton className="h-4 w-32 ml-auto" />
            </div>
          </div>
          <Separator />
          <Skeleton className="h-20 w-full" />
          <Separator />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export function InvoiceDetailPage() {
  const { pageParams, setCurrentPage } = useNavigation()
  const { toast } = useToast()
  const invoiceId = pageParams?.id || ''

  const {
    invoiceDetail: { invoice, clinicSettings: clinic, loading, error, cancelDialogOpen, cancelling },
    fetchInvoiceDetail,
    setCancelDialogOpen,
    cancelInvoice,
    clearInvoiceDetail,
  } = useBillingStore()

  const paymentStore = usePaymentStore()

   
  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetail(invoiceId)
    }
    return () => {
      clearInvoiceDetail()
      paymentStore.closeDialog()
    }
  }, [invoiceId, fetchInvoiceDetail, clearInvoiceDetail, paymentStore])

  const openPaymentDialog = async () => {
    if (!invoice) return
    const settings = await paymentStore.fetchGatewaySettings()
    paymentStore.openDialog(
      {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        patientId: invoice.patientId,
        patientName: invoice.patient.name,
        patientEmail: invoice.patient.email,
        patientPhone: invoice.patient.phone,
        grandTotal: invoice.grandTotal,
        paidAmount: invoice.paidAmount,
        status: invoice.status,
      },
      settings,
    )
    paymentStore.setOnPaymentSuccess(() => fetchInvoiceDetail(invoiceId))
  }

  const handleCancelInvoice = async () => {
    try {
      await cancelInvoice()
      toast({ title: 'Invoice Cancelled', description: 'The invoice has been cancelled successfully.' })
      setCurrentPage('billing')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel invoice'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  if (loading) {
    return <DetailSkeleton />
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <FileText className="h-16 w-16 text-muted-foreground/30" />
        <p className="mt-4 text-lg font-medium text-muted-foreground">
          {error || 'Invoice not found'}
        </p>
        <Button
          variant="outline"
          onClick={() => setCurrentPage('billing')}
          className="mt-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoices
        </Button>
      </div>
    )
  }

  const balanceDue = invoice.grandTotal - invoice.paidAmount
  const StatusIcon = STATUS_ICONS[invoice.status as InvoiceStatus] || Clock

  const clinicName = clinic?.clinicName || 'Hospital'
  const clinicAddress = [clinic?.address, clinic?.city, clinic?.state, clinic?.pincode]
    .filter(Boolean)
    .join(', ')
  const clinicPhone = clinic?.phone || ''
  const clinicGstin = clinic?.gstin || ''

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentPage('billing')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoices
        </Button>

        <div className="flex flex-wrap gap-2">
          {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={openPaymentDialog}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
          <Button variant="outline" onClick={() => window.open(`/api/billing/${invoiceId}/pdf`, '_blank')}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={() => window.open(`/api/billing/${invoiceId}/pdf`, '_blank')}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const phone = invoice.patient.phone?.replace(/[^0-9]/g, '')
              if (!phone) {
                toast({ title: 'Error', description: 'Patient has no phone number', variant: 'destructive' })
                return
              }
              const msg = `🧾 Invoice from MediBill Pro

Patient: ${invoice.patient.name}
Invoice #: ${invoice.invoiceNumber}
Amount: Rs.${invoice.grandTotal.toFixed(2)}
Paid: Rs.${invoice.paidAmount.toFixed(2)}
Balance: Rs.${(invoice.grandTotal - invoice.paidAmount).toFixed(2)}
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
            }}
          >
            <Send className="mr-2 h-4 w-4" />
            Send to Patient
          </Button>
          {invoice.status !== 'Cancelled' && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => setCancelDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Invoice Card */}
      <Card>
        <CardContent className="p-6 md:p-8">
          {/* Invoice Header */}
          <div className="flex flex-col justify-between gap-6 md:flex-row">
            {/* Clinic Info */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600 text-white">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {clinicName}
                  </h2>
                  <p className="text-sm text-muted-foreground">Comprehensive Healthcare</p>
                </div>
              </div>
              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                {clinicAddress && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{clinicAddress}</span>
                  </div>
                )}
                {clinicPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{clinicPhone}</span>
                  </div>
                )}
                {clinicGstin && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">GSTIN: {clinicGstin}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Meta */}
            <div className="text-right">
              <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium">
                <Badge
                  variant="outline"
                  className={`gap-1 ${STATUS_COLORS[invoice.status as InvoiceStatus] || ''}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {invoice.status}
                </Badge>
              </div>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center justify-end gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Issued: {formatDate(invoice.date)}</span>
                </div>
                {invoice.dueDate && (
                  <div className="flex items-center justify-end gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Due: {formatDate(invoice.dueDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Patient Info */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Bill To
            </p>
            <div className="grid gap-1 text-sm md:grid-cols-2">
              <div>
                <p className="font-semibold text-base">{invoice.patient?.name || 'Unknown Patient'}</p>
                <p className="text-muted-foreground">{invoice.patient?.phone || ''}</p>
              </div>
              <div className="text-muted-foreground">
                <p>{invoice.patient?.email || ''}</p>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Items Table */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Invoice Items
            </h3>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-[40px] text-center">#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="hidden sm:table-cell w-[90px]">HSN/SAC</TableHead>
                    <TableHead className="text-center w-[60px]">Qty</TableHead>
                    <TableHead className="text-right w-[110px]">Unit Price</TableHead>
                    <TableHead className="text-center w-[70px]">GST%</TableHead>
                    <TableHead className="text-right w-[110px]">GST Amt</TableHead>
                    <TableHead className="text-right w-[110px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-center text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.description}</p>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">
                            {item.type}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground">
                        {item.hsnCode || '—'}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.gstRate > 0 ? (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {item.gstRate}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nil</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(item.gstAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatCurrency(item.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Summary and GST Breakdown */}
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {/* GST Breakdown */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                GST Compliance Breakdown
              </h4>
              <div className="space-y-2 text-sm">
                {invoice.cgst > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <span>CGST (Central GST)</span>
                    </div>
                    <span className="font-mono font-medium">{formatCurrency(invoice.cgst)}</span>
                  </div>
                )}
                {invoice.sgst > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                      <span>SGST (State GST)</span>
                    </div>
                    <span className="font-mono font-medium">{formatCurrency(invoice.sgst)}</span>
                  </div>
                )}
                {invoice.igst > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span>IGST (Integrated GST)</span>
                    </div>
                    <span className="font-mono font-medium">{formatCurrency(invoice.igst)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between font-semibold">
                  <span>Total GST</span>
                  <span className="font-mono">{formatCurrency(invoice.totalGst)}</span>
                </div>

                {/* GST rate breakdown by item */}
                <Separator />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  GST Rate Summary
                </p>
                {(() => {
                  const rateMap = new Map<number, number>()
                  invoice.items.forEach((item) => {
                    const existing = rateMap.get(item.gstRate) || 0
                    rateMap.set(item.gstRate, existing + item.gstAmount)
                  })
                  const entries = Array.from(rateMap.entries())
                    .filter(([rate]) => rate > 0)
                    .sort((a, b) => a[0] - b[0])
                  if (entries.length === 0) {
                    return <p className="text-xs text-muted-foreground">No GST applicable</p>
                  }
                  return entries.map(([rate, amount]) => (
                    <div key={rate} className="flex items-center justify-between text-muted-foreground">
                      <span className="font-mono">{rate}% GST</span>
                      <span className="font-mono">{formatCurrency(amount)}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>

            {/* Amount Summary */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Amount Summary
              </h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono font-medium">{formatCurrency(invoice.subtotal)}</span>
                </div>
                {invoice.cgst > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">CGST</span>
                    <span className="font-mono">{formatCurrency(invoice.cgst)}</span>
                  </div>
                )}
                {invoice.sgst > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">SGST</span>
                    <span className="font-mono">{formatCurrency(invoice.sgst)}</span>
                  </div>
                )}
                {invoice.igst > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">IGST</span>
                    <span className="font-mono">{formatCurrency(invoice.igst)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total GST</span>
                  <span className="font-mono font-medium">{formatCurrency(invoice.totalGst)}</span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex items-center justify-between text-red-600 dark:text-red-400">
                    <span>
                      Discount
                      {invoice.discountType === 'percentage' && (
                        <span className="text-xs ml-1 opacity-75">(percentage)</span>
                      )}
                    </span>
                    <span className="font-mono">- {formatCurrency(invoice.discount)}</span>
                  </div>
                )}
                {invoice.roundOff !== 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Round Off</span>
                    <span className="font-mono">
                      {invoice.roundOff > 0 ? '+' : ''}{formatCurrency(invoice.roundOff)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Grand Total</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(invoice.grandTotal)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Paid Amount</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(invoice.paidAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={balanceDue > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
                    Balance Due
                  </span>
                  <span className={`font-mono font-bold ${balanceDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {formatCurrency(balanceDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <>
              <Separator className="my-6" />
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Notes
                </h4>
                <p className="text-sm bg-muted/50 rounded-lg p-3 border">{invoice.notes}</p>
              </div>
            </>
          )}

          {/* Tax Declaration */}
          <div className="mt-6 rounded-lg bg-muted/30 border p-4 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">GST Declaration</p>
            <p>
              This is a GST-compliant tax invoice issued under the Goods and Services Tax (GST) regime of India.
              All applicable taxes (CGST/SGST/IGST) have been charged as per the prevailing GST rates.
              {clinicGstin && ` GSTIN: ${clinicGstin} |`} State: {clinic?.state || 'N/A'} | Tax Type:{' '}
              {invoice.igst > 0 ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {invoice.payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Wallet className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-2 text-sm">No payments recorded yet</p>
              {invoice.status !== 'Cancelled' && balanceDue > 0 && (
                <Button
                  size="sm"
                  className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={openPaymentDialog}
                >
                  Record First Payment
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden sm:table-cell">Receipt No</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {payment.paymentId}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(payment.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{payment.method}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell font-mono text-sm text-muted-foreground">
                        {payment.receiptNumber || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            payment.status === 'Success'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : payment.status === 'Pending'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                                : payment.status === 'Failed'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400'
                          }
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {invoice.payments.length > 0 && (
            <div className="mt-3 flex justify-end">
              <div className="text-sm text-muted-foreground">
                Total Paid:{' '}
                <span className="font-mono font-semibold text-foreground">
                  {formatCurrency(invoice.payments.reduce((s, p) => s + p.amount, 0))}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog (Zustand) */}
      <PaymentDialog clinicName={clinic?.clinicName} />

      {/* Cancel Invoice Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Cancel Invoice
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel invoice{' '}
              <span className="font-semibold">{invoice.invoiceNumber}</span>? This action cannot be
              undone. Invoices with successful payments cannot be cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Go Back</AlertDialogCancel>
            <Button variant="destructive" onClick={handleCancelInvoice} disabled={cancelling}>
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Cancel Invoice
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}