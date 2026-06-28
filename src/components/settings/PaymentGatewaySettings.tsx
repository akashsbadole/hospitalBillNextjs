'use client'

import React, { useState, useEffect } from 'react'
import { apiPost, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Eye,
  EyeOff,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Shield,
  Globe,
  Wallet,
  AlertTriangle,
  Zap,
  CreditCard,
  Smartphone,
} from 'lucide-react'

// ─── Component ─────────────────────────────────────────────────────────────

export function PaymentGatewaySettings() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Admin'

  // ── Store ──
  const {
    settings,
    loading,
    form,
    saving,
    fetchSettings,
    updateFormField,
    saveRazorpaySettings,
    savePaypalSettings,
    saveUpiSettings,
  } = useSettingsStore()

  // ── Local state for test connections (not in store) ──
  const [testingRzp, setTestingRzp] = useState(false)
  const [testingPp, setTestingPp] = useState(false)
  const [rzpTestResult, setRzpTestResult] = useState<'success' | 'fail' | null>(null)
  const [ppTestResult, setPpTestResult] = useState<'success' | 'fail' | null>(null)

  // ─── Fetch Config ───
   
  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // ─── Save Handlers (wrap store actions with toasts) ───
  const handleSaveRazorpay = async () => {
    const ok = await saveRazorpaySettings()
    if (ok) {
      toast({ title: 'Razorpay Settings Saved', description: 'Your Razorpay configuration has been updated successfully.' })
    } else {
      const err = useSettingsStore.getState().saveError
      toast({ title: 'Error', description: err || 'Failed to save Razorpay settings', variant: 'destructive' })
    }
  }

  const handleSavePayPal = async () => {
    const ok = await savePaypalSettings()
    if (ok) {
      toast({ title: 'PayPal Settings Saved', description: 'Your PayPal configuration has been updated successfully.' })
    } else {
      const err = useSettingsStore.getState().saveError
      toast({ title: 'Error', description: err || 'Failed to save PayPal settings', variant: 'destructive' })
    }
  }

  const handleSaveUpi = async () => {
    const ok = await saveUpiSettings()
    if (ok) {
      toast({ title: 'UPI Settings Saved', description: 'Your UPI configuration has been updated successfully.' })
    } else {
      const err = useSettingsStore.getState().saveError
      toast({ title: 'Error', description: err || 'Failed to save UPI settings', variant: 'destructive' })
    }
  }

  // ─── Test Razorpay Connection ───
  const handleTestRazorpay = async () => {
    setTestingRzp(true)
    setRzpTestResult(null)
    try {
      const res = await apiPost<{ data: { orderId: string } }>('/payments/razorpay/order', {
        invoiceId: 'test',
        amount: 1,
      })
      setRzpTestResult('success')
      toast({ title: 'Razorpay Connected', description: `Test order created: ${res.data.orderId}` })
    } catch (err) {
      setRzpTestResult('fail')
      const message = err instanceof ApiError ? err.message : 'Connection test failed'
      toast({ title: 'Razorpay Test Failed', description: message, variant: 'destructive' })
    } finally {
      setTestingRzp(false)
    }
  }

  // ─── Test PayPal Connection ───
  const handleTestPayPal = async () => {
    setTestingPp(true)
    setPpTestResult(null)
    try {
      const res = await apiPost<{ data: { orderId: string } }>('/payments/paypal/order', {
        invoiceId: 'test',
        amount: 1,
      })
      setPpTestResult('success')
      toast({ title: 'PayPal Connected', description: `Test order created: ${res.data.orderId}` })
    } catch (err) {
      setPpTestResult('fail')
      const message = err instanceof ApiError ? err.message : 'Connection test failed'
      toast({ title: 'PayPal Test Failed', description: message, variant: 'destructive' })
    } finally {
      setTestingPp(false)
    }
  }

  // ─── Loading ───
  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ═══ RAZORPAY CONFIGURATION ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                <Zap className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Razorpay
                  {settings?.razorpayEnabled && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Active
                    </Badge>
                  )}
                  {!settings?.razorpayEnabled && (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      Disabled
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Accept payments via UPI, Cards, Net Banking & Wallets (India)</CardDescription>
              </div>
            </div>
            <Switch
              checked={form.razorpayEnabled}
              onCheckedChange={(v) => updateFormField('razorpayEnabled', v)}
              disabled={!isAdmin}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-sky-50 border border-sky-200 dark:bg-sky-950/20 dark:border-sky-800 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
              <div className="text-xs text-sky-700 dark:text-sky-300">
                <p className="font-medium mb-1">About Razorpay</p>
                <p>Razorpay is India&apos;s leading payment gateway. Supports UPI, Credit/Debit Cards, Net Banking, and Wallets. Get your API keys from the <a href="https://dashboard.razorpay.com/settings/api-keys" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-sky-800">Razorpay Dashboard</a>.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>API Key ID</Label>
              <Input
                placeholder="rzp_test_xxxxxxxxxxxxx"
                value={form.razorpayKeyId}
                onChange={(e) => updateFormField('razorpayKeyId', e.target.value)}
                disabled={!isAdmin}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Your Razorpay Key ID from the dashboard</p>
            </div>
            <div className="space-y-1.5">
              <Label>API Key Secret</Label>
              <div className="relative">
                <Input
                  type={form.showRazorpaySecret ? 'text' : 'password'}
                  placeholder={settings?.razorpayKeySecret ? 'Enter new secret to update' : 'xxxxxxxxxxxxxxxxxxxxxxxx'}
                  value={form.razorpayKeySecret}
                  onChange={(e) => updateFormField('razorpayKeySecret', e.target.value)}
                  disabled={!isAdmin}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => updateFormField('showRazorpaySecret', !form.showRazorpaySecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {form.showRazorpaySecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {settings?.razorpayKeySecret ? 'Leave blank to keep the existing secret' : 'Your Razorpay Key Secret'}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={form.razorpayMode} onValueChange={(v) => updateFormField('razorpayMode', v)} disabled={!isAdmin}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Test">
                  <span className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5" />
                    Test Mode
                  </span>
                </SelectItem>
                <SelectItem value="Live">
                  <span className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    Live Mode
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use Test Mode for development. Switch to Live for production.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              onClick={handleSaveRazorpay}
              disabled={!isAdmin || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Razorpay Settings
            </Button>
            <Button
              variant="outline"
              onClick={handleTestRazorpay}
              disabled={testingRzp}
              className="gap-2"
            >
              {testingRzp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Test Connection
            </Button>
            {rzpTestResult === 'success' && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                <CheckCircle2 className="h-3 w-3" />Connected
              </Badge>
            )}
            {rzpTestResult === 'fail' && (
              <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                <XCircle className="h-3 w-3" />Failed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ═══ PAYPAL CONFIGURATION ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  PayPal
                  {settings?.paypalEnabled && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                      <CheckCircle2 className="h-3 w-3 mr-1" />Active
                    </Badge>
                  )}
                  {!settings?.paypalEnabled && (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      Disabled
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Accept international payments via Credit/Debit Cards & PayPal Balance</CardDescription>
              </div>
            </div>
            <Switch
              checked={form.paypalEnabled}
              onCheckedChange={(v) => updateFormField('paypalEnabled', v)}
              disabled={!isAdmin}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium mb-1">About PayPal</p>
                <p>PayPal supports international payments from 200+ countries. Supports Credit/Debit Cards, PayPal Balance, and Bank transfers. Get your credentials from the <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener noreferrer" className="underline font-medium hover:text-amber-800">PayPal Developer Dashboard</a>.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Client ID</Label>
              <Input
                placeholder="AXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={form.paypalClientId}
                onChange={(e) => updateFormField('paypalClientId', e.target.value)}
                disabled={!isAdmin}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Your PayPal REST API Client ID</p>
            </div>
            <div className="space-y-1.5">
              <Label>Client Secret</Label>
              <div className="relative">
                <Input
                  type={form.showPaypalSecret ? 'text' : 'password'}
                  placeholder={settings?.paypalClientSecret ? 'Enter new secret to update' : 'xxxxxxxxxxxxxxxxxxxxxxxx'}
                  value={form.paypalClientSecret}
                  onChange={(e) => updateFormField('paypalClientSecret', e.target.value)}
                  disabled={!isAdmin}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => updateFormField('showPaypalSecret', !form.showPaypalSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {form.showPaypalSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {settings?.paypalClientSecret ? 'Leave blank to keep the existing secret' : 'Your PayPal Client Secret'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={form.paypalMode} onValueChange={(v) => updateFormField('paypalMode', v)} disabled={!isAdmin}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sandbox">
                    <span className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5" />
                      Sandbox (Test)
                    </span>
                  </SelectItem>
                  <SelectItem value="Live">
                    <span className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5" />
                      Live (Production)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Sandbox for testing, Live for real payments</p>
            </div>
            <div className="space-y-1.5">
              <Label>Default Currency</Label>
              <Select value={form.paypalCurrency} onValueChange={(v) => updateFormField('paypalCurrency', v)} disabled={!isAdmin}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'USD', label: 'USD - US Dollar' },
                    { value: 'EUR', label: 'EUR - Euro' },
                    { value: 'GBP', label: 'GBP - British Pound' },
                    { value: 'INR', label: 'INR - Indian Rupee' },
                    { value: 'AUD', label: 'AUD - Australian Dollar' },
                    { value: 'CAD', label: 'CAD - Canadian Dollar' },
                    { value: 'SGD', label: 'SGD - Singapore Dollar' },
                    { value: 'AED', label: 'AED - UAE Dirham' },
                  ].map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Currency for PayPal transactions</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-2"
              onClick={handleSavePayPal}
              disabled={!isAdmin || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save PayPal Settings
            </Button>
            <Button
              variant="outline"
              onClick={handleTestPayPal}
              disabled={testingPp}
              className="gap-2"
            >
              {testingPp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Test Connection
            </Button>
            {ppTestResult === 'success' && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                <CheckCircle2 className="h-3 w-3" />Connected
              </Badge>
            )}
            {ppTestResult === 'fail' && (
              <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
                <XCircle className="h-3 w-3" />Failed
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══ UPI SETTINGS ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-100 dark:bg-purple-900/30">
              <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            UPI (Direct)
          </CardTitle>
          <CardDescription>
            Accept UPI payments directly. Patients scan QR code or pay to your VPA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="upi-toggle" className="text-sm font-medium">Enable UPI Payments</Label>
              <p className="text-xs text-muted-foreground">Show UPI QR code option in payment dialog</p>
            </div>
            <Switch
              id="upi-toggle"
              checked={form.upiEnabled}
              onCheckedChange={(v) => updateFormField('upiEnabled', v)}
              disabled={!isAdmin}
            />
          </div>

          {form.upiEnabled && (
            <>
              <div className="space-y-1.5">
                <Label>UPI VPA (Virtual Payment Address)</Label>
                <Input
                  placeholder="e.g., hospital@ybl, sai@paytm"
                  value={form.upiVpa}
                  onChange={(e) => updateFormField('upiVpa', e.target.value)}
                  disabled={!isAdmin}
                />
                <p className="text-xs text-muted-foreground">Your hospital&apos;s UPI ID. Patients will scan &amp; pay to this address.</p>
              </div>

              <div className="space-y-1.5">
                <Label>Merchant Name (optional)</Label>
                <Input
                  placeholder="e.g., Sai Multispecialty Hospital"
                  value={form.upiMerchantName}
                  onChange={(e) => updateFormField('upiMerchantName', e.target.value)}
                  disabled={!isAdmin}
                />
                <p className="text-xs text-muted-foreground">Name shown in UPI payment apps.</p>
              </div>

              <div className="flex gap-2">
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleSaveUpi}
                  disabled={saving || !form.upiVpa}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save UPI Settings
                </Button>
              </div>

              {form.upiVpa && (
                <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3">
                  <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">UPI Deep Link Preview</p>
                  <p className="text-xs text-muted-foreground break-all font-mono">
                    upi://pay?pa={form.upiVpa}&amp;pn={form.upiMerchantName || 'Hospital'}&amp;am=100&amp;cu=INR
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ STATUS OVERVIEW ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Gateway Status
          </CardTitle>
          <CardDescription>Overview of configured payment methods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                <Zap className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Razorpay</p>
                <div className="flex items-center gap-2">
                  {settings?.razorpayEnabled ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                      <span className="text-xs text-emerald-600 font-medium">Active - {settings.razorpayMode}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not configured</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">PayPal</p>
                <div className="flex items-center gap-2">
                  {settings?.paypalEnabled ? (
                    <span className="text-xs text-emerald-600 font-medium">Active - {settings.paypalMode} ({settings.paypalCurrency})</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not configured</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Smartphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">UPI (Direct)</p>
                <div className="flex items-center gap-2">
                  {settings?.upiEnabled ? (
                    <span className="text-xs text-emerald-600 font-medium">Active - {settings.upiVpa}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {!isAdmin && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Only Admin can modify payment gateway settings.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}