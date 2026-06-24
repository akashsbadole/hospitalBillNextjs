'use client'

import React, { useState, useCallback } from 'react'
import { usePaymentStore, type PaymentMethod } from '@/stores/payment'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  Wallet,
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  WalletIcon,
  Zap,
  Globe,
  QrCode,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// ─── Method config ─────────────────────────────────────────────────

interface MethodOption {
  value: PaymentMethod
  label: string
  sublabel: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
}

const METHODS: MethodOption[] = [
  { value: 'Cash', label: 'Cash', sublabel: 'Physical cash payment', icon: Banknote, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800' },
  { value: 'UPI', label: 'UPI (Direct)', sublabel: 'Show QR code for patient', icon: QrCode, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
  { value: 'Card', label: 'Card', sublabel: 'Credit / Debit card', icon: CreditCard, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30', border: 'border-sky-200 dark:border-sky-800' },
  { value: 'Net Banking', label: 'Net Banking', sublabel: 'Online bank transfer', icon: Building2, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800' },
  { value: 'Wallet', label: 'Wallet', sublabel: 'Paytm, PhonePe, etc.', icon: WalletIcon, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800' },
]

// ─── UPI Deep Link Generator ───────────────────────────────────────

function generateUpiLink(vpa: string, amount: number, merchantName: string, invoiceNumber: string): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: merchantName,
    am: String(Math.round(amount * 100)), // amount in paise
    cu: 'INR',
    tn: `Invoice ${invoiceNumber}`,
  })
  return `upi://pay?${params.toString()}`
}

// ─── Component ─────────────────────────────────────────────────────

export function PaymentDialog({ clinicName }: { clinicName?: string }) {
  const { toast } = useToast()
  const {
    dialogOpen, invoice, amount, method, onlineStep, onlineError,
    razorpayLoading, upiVpa, upiTransactionId, recording,
    gatewaySettings,
    closeDialog, setAmount, setMethod, setOnlineStep,
    setUpiTransactionId,
    recordOfflinePayment, processRazorpayPayment, confirmUpiPayment,
  } = usePaymentStore()

  const [copied, setCopied] = useState(false)
  const balanceDue = invoice ? invoice.grandTotal - invoice.paidAmount : 0
  const parsedAmount = parseFloat(amount) || 0
  const hasOnlineMethods = gatewaySettings
    ? gatewaySettings.razorpayEnabled || gatewaySettings.paypalEnabled
    : false
  const hasUpi = gatewaySettings?.upiEnabled && gatewaySettings.upiVpa

  // ─── Record offline payment ───
  const handleRecordOffline = async () => {
    try {
      const payAmount = Math.min(parsedAmount, balanceDue)
      await recordOfflinePayment()
      toast({ title: 'Payment Recorded', description: `${formatCurrency(payAmount)} received via ${method}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment'
      toast({ title: 'Payment Failed', description: msg, variant: 'destructive' })
    }
  }

  // ─── Razorpay payment ───
  const handleRazorpayPay = async () => {
    try {
      await processRazorpayPayment(clinicName)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Razorpay payment failed'
      toast({ title: 'Payment Failed', description: msg, variant: 'destructive' })
    }
  }

  // ─── UPI confirm after QR scan ───
  const handleUpiConfirm = async () => {
    try {
      await confirmUpiPayment()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to record UPI payment'
      toast({ title: 'Payment Failed', description: msg, variant: 'destructive' })
    }
  }

  // ─── Copy UPI link ───
  const handleCopyUpiLink = useCallback(() => {
    if (!gatewaySettings?.upiVpa || !invoice) return
    const link = generateUpiLink(
      gatewaySettings.upiVpa,
      Math.min(parsedAmount, balanceDue),
      gatewaySettings.upiMerchantName || clinicName || 'Hospital',
      invoice.invoiceNumber,
    )
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [gatewaySettings, invoice, parsedAmount, balanceDue, clinicName])

  const upiDeepLink = hasUpi && invoice
    ? generateUpiLink(
        gatewaySettings!.upiVpa!,
        Math.min(parsedAmount, balanceDue),
        gatewaySettings!.upiMerchantName || clinicName || 'Hospital',
        invoice.invoiceNumber,
      )
    : ''

  const handleClose = (open: boolean) => {
    if (!open) closeDialog()
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600" />
            {onlineStep === 'upi-qr' ? 'UPI Payment' : onlineStep === 'upi-confirm' ? 'Confirm UPI Payment' : 'Record Payment'}
          </DialogTitle>
          <DialogDescription>
            {invoice && (
              <>Invoice {invoice.invoiceNumber} &mdash; Balance: <span className="font-semibold text-foreground">{formatCurrency(balanceDue)}</span></>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step: Choose method + amount ─── */}
        {(onlineStep === 'idle' || onlineStep === 'choose') && (
          <>
            <div className="space-y-4 py-1">
              {/* Amount input */}
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={1}
                    max={balanceDue}
                    className="text-lg font-semibold"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 px-3 text-xs"
                    onClick={() => setAmount(String(balanceDue))}
                  >
                    Full
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Max: {formatCurrency(balanceDue)}</p>
              </div>

              {/* Offline methods */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Payment Method</Label>
                <div className="grid grid-cols-1 gap-2">
                  {METHODS.map((m) => {
                    // Skip UPI if no gateway configured
                    if (m.value === 'UPI' && !hasUpi) return null
                    const Icon = m.icon
                    return (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMethod(m.value)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                          method === m.value
                            ? `${m.border} ${m.bg} ring-1 ring-current/20`
                            : 'border-transparent hover:bg-muted/50'
                        )}
                      >
                        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', m.bg)}>
                          <Icon className={cn('h-4 w-4', m.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{m.label}</p>
                          <p className="text-xs text-muted-foreground">{m.sublabel}</p>
                        </div>
                        <div
                          className={cn(
                            'h-4 w-4 rounded-full border-2 shrink-0 transition-colors',
                            method === m.value ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'
                          )}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Online payment options (if Razorpay/PayPal configured) */}
            {hasOnlineMethods && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Or Pay Online</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {gatewaySettings?.razorpayEnabled && (
                      <Button
                        variant="outline"
                        className="h-auto py-3 justify-start gap-3 border-sky-200 hover:bg-sky-50 dark:border-sky-800 dark:hover:bg-sky-950/30"
                        disabled={parsedAmount <= 0}
                        onClick={() => setOnlineStep('choose')}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                          <Zap className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Pay with Razorpay</p>
                          <p className="text-xs text-muted-foreground">UPI, Cards, Net Banking, Wallets</p>
                        </div>
                        <Badge variant="secondary" className="ml-auto text-[10px]">{gatewaySettings.razorpayMode}</Badge>
                      </Button>
                    )}
                    {gatewaySettings?.paypalEnabled && (
                      <Button
                        variant="outline"
                        className="h-auto py-3 justify-start gap-3 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                        disabled={parsedAmount <= 0}
                        onClick={() => {
                          setOnlineStep('choose')
                          toast({ title: 'PayPal', description: 'PayPal redirect coming soon.', duration: 3000 })
                        }}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                          <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Pay with PayPal</p>
                          <p className="text-xs text-muted-foreground">International Cards ({gatewaySettings.paypalCurrency})</p>
                        </div>
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* UPI-specific subflow: if UPI selected, show QR code button */}
            {method === 'UPI' && hasUpi && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">UPI Payment Options</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex-col gap-1 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/30"
                      onClick={() => setOnlineStep('upi-qr')}
                      disabled={parsedAmount <= 0}
                    >
                      <QrCode className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-medium">Show QR Code</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-3 flex-col gap-1 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950/30"
                      onClick={() => setOnlineStep('upi-confirm')}
                      disabled={parsedAmount <= 0}
                    >
                      <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-medium">Manual Record</span>
                    </Button>
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              {(method !== 'UPI' || !hasUpi) && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleRecordOffline}
                  disabled={parsedAmount <= 0 || parsedAmount > balanceDue || recording}
                >
                  {recording && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record {method} Payment
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {/* ─── Step: Online choose gateway ─── */}
        {onlineStep === 'choose' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(parsedAmount)}</p>
              <p className="text-sm text-muted-foreground">Payment Amount</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {gatewaySettings?.razorpayEnabled && (
                <Button
                  className="h-auto py-4 justify-start gap-3 bg-sky-600 hover:bg-sky-700 text-white"
                  disabled={razorpayLoading}
                  onClick={handleRazorpayPay}
                >
                  {razorpayLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                  <div className="text-left">
                    <p className="font-medium">Pay with Razorpay</p>
                    <p className="text-xs opacity-80">UPI, Cards, Net Banking, Wallets</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto text-[10px] bg-white/20 text-white border-0">{gatewaySettings.razorpayMode}</Badge>
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOnlineStep('idle')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ─── Step: UPI QR Code ─── */}
        {onlineStep === 'upi-qr' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(parsedAmount)}</p>
              <p className="text-sm text-muted-foreground">Pay via any UPI app</p>
            </div>

            {/* QR Code display area */}
            <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-purple-200 dark:border-purple-800 p-6 bg-purple-50/50 dark:bg-purple-950/20">
              <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-white dark:bg-gray-900 border shadow-sm">
                <QrCode className="h-24 w-24 text-purple-600" strokeWidth={1.5} />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold">Scan with any UPI App</p>
                <p className="text-xs text-muted-foreground">{gatewaySettings?.upiVpa}</p>
                <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{formatCurrency(parsedAmount)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopyUpiLink}
              >
                {copied ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy UPI Link'}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  if (upiDeepLink) window.open(upiDeepLink, '_blank')
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in App
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOnlineStep('idle')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setOnlineStep('upi-confirm')}
              >
                Payment Received ✓
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ─── Step: UPI Confirm ─── */}
        {onlineStep === 'upi-confirm' && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(parsedAmount)}</p>
              <p className="text-sm text-muted-foreground">UPI Payment</p>
            </div>

            <div className="space-y-2">
              <Label>UPI Transaction ID (optional)</Label>
              <Input
                placeholder="e.g., 432156789012"
                value={upiTransactionId}
                onChange={(e) => setUpiTransactionId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Enter the UPI reference ID from the payment app for tracking.</p>
            </div>

            <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 text-sm text-purple-700 dark:text-purple-300">
              <p className="font-medium">Hospital UPI: {gatewaySettings?.upiVpa}</p>
              <p className="text-xs mt-0.5 opacity-80">Patient should pay ₹{parsedAmount.toFixed(2)} to this VPA</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOnlineStep('upi-qr')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleUpiConfirm}
                disabled={recording}
              >
                {recording && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ─── Step: Processing ─── */}
        {onlineStep === 'processing' && (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
            <p className="text-lg font-medium">Processing Payment</p>
            <p className="text-sm text-muted-foreground">Complete the payment in the new window...</p>
          </div>
        )}

        {/* ─── Step: Success ─── */}
        {onlineStep === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="text-lg font-medium text-emerald-700">Payment Successful!</p>
            <p className="text-sm text-muted-foreground mb-4">The payment has been recorded.</p>
            <Button onClick={closeDialog} className="bg-emerald-600 hover:bg-emerald-700">
              Done
            </Button>
          </div>
        )}

        {/* ─── Step: Error ─── */}
        {onlineStep === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <p className="text-lg font-medium text-red-700">Payment Failed</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">{onlineError}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOnlineStep('choose')}>Try Again</Button>
              <Button onClick={closeDialog}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}