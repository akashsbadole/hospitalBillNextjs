import { create } from 'zustand'
import { apiPost, apiGet, type SingleResponse, ApiError } from '@/lib/api-client'

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface PaymentGatewaySettings {
  id: string
  razorpayEnabled: boolean
  razorpayKeyId: string | null
  razorpayKeySecret: string | null // masked
  razorpayMode: string
  paypalEnabled: boolean
  paypalClientId: string | null
  paypalClientSecret: string | null // masked
  paypalMode: string
  paypalCurrency: string
  upiEnabled: boolean
  upiVpa: string | null
  upiMerchantName: string | null
}

export type PaymentMethod = 'Cash' | 'UPI' | 'Card' | 'Net Banking' | 'Wallet' | 'Razorpay'
export type OnlineStep = 'idle' | 'choose' | 'processing' | 'upi-qr' | 'upi-confirm' | 'success' | 'error'

interface InvoiceSummary {
  id: string
  invoiceNumber: string
  patientId: string
  patientName: string
  patientEmail: string | null
  patientPhone: string
  grandTotal: number
  paidAmount: number
  status: string
}

interface PaymentState {
  // Dialog visibility
  dialogOpen: boolean
  // Current invoice context
  invoice: InvoiceSummary | null
  // Amount
  amount: string
  // Selected method
  method: PaymentMethod
  // Online payment
  onlineStep: OnlineStep
  onlineError: string
  razorpayLoading: boolean
  paypalLoading: boolean
  // UPI
  upiVpa: string
  upiTransactionId: string
  // Offline recording
  recording: boolean
  // Gateway settings (cached)
  gatewaySettings: PaymentGatewaySettings | null
  // Callbacks (set by the consuming component)
  onPaymentSuccess: (() => void) | null

  // ── Simple setters ──
  setAmount: (amount: string) => void
  setMethod: (method: PaymentMethod) => void
  setOnlineStep: (step: OnlineStep) => void
  setOnlineError: (error: string) => void
  setRazorpayLoading: (loading: boolean) => void
  setPaypalLoading: (loading: boolean) => void
  setUpiVpa: (vpa: string) => void
  setUpiTransactionId: (txId: string) => void
  setRecording: (recording: boolean) => void
  setGatewaySettings: (settings: PaymentGatewaySettings | null) => void
  setOnPaymentSuccess: (cb: (() => void) | null) => void

  // ── Async actions ──
  openDialog: (invoice: InvoiceSummary, settings: PaymentGatewaySettings | null) => void
  closeDialog: () => void
  fetchGatewaySettings: () => Promise<PaymentGatewaySettings | null>
  recordOfflinePayment: () => Promise<boolean>
  processRazorpayPayment: (clinicName?: string) => Promise<void>
  confirmUpiPayment: () => Promise<boolean>
  reset: () => void
}

// ─── Initial State ──────────────────────────────────────────────────────

const initialState = {
  dialogOpen: false,
  invoice: null as InvoiceSummary | null,
  amount: '',
  method: 'Cash' as PaymentMethod,
  onlineStep: 'idle' as OnlineStep,
  onlineError: '',
  razorpayLoading: false,
  paypalLoading: false,
  upiVpa: '',
  upiTransactionId: '',
  recording: false,
  gatewaySettings: null as PaymentGatewaySettings | null,
  onPaymentSuccess: null as (() => void) | null,
}

export const usePaymentStore = create<PaymentState>()((set, get) => ({
  ...initialState,

  // ── Simple setters ──

  setAmount: (amount) => set({ amount }),
  setMethod: (method) => set({ method, onlineStep: 'idle', onlineError: '' }),
  setOnlineStep: (step) => set({ onlineStep: step }),
  setOnlineError: (error) => set({ onlineError: error }),
  setRazorpayLoading: (loading) => set({ razorpayLoading: loading }),
  setPaypalLoading: (loading) => set({ paypalLoading: loading }),
  setUpiVpa: (vpa) => set({ upiVpa: vpa }),
  setUpiTransactionId: (txId) => set({ upiTransactionId: txId }),
  setRecording: (recording) => set({ recording }),
  setGatewaySettings: (settings) => set({ gatewaySettings: settings }),
  setOnPaymentSuccess: (cb) => set({ onPaymentSuccess: cb }),

  // ── Dialog open/close ──

  openDialog: (invoice, settings) => {
    const balance = invoice.grandTotal - invoice.paidAmount
    set({
      dialogOpen: true,
      invoice,
      amount: balance > 0 ? String(balance) : '',
      method: 'Cash',
      onlineStep: 'idle',
      onlineError: '',
      razorpayLoading: false,
      paypalLoading: false,
      upiVpa: '',
      upiTransactionId: '',
      recording: false,
      gatewaySettings: settings,
    })
  },

  closeDialog: () => set({
    dialogOpen: false,
    onlineStep: 'idle',
    onlineError: '',
    razorpayLoading: false,
    paypalLoading: false,
    recording: false,
  }),

  // ── Fetch gateway settings ──

  fetchGatewaySettings: async () => {
    try {
      const res = await apiGet<SingleResponse<PaymentGatewaySettings>>('/settings/payment')
      const settings = res.data
      set({ gatewaySettings: settings })
      return settings
    } catch {
      return null
    }
  },

  // ── Record offline payment ──

  recordOfflinePayment: async () => {
    const { invoice, amount, method, upiVpa } = get()
    const parsedAmount = parseFloat(amount) || 0
    const balanceDue = invoice ? invoice.grandTotal - invoice.paidAmount : 0

    if (!invoice || parsedAmount <= 0) return false

    set({ recording: true })
    try {
      const payAmount = Math.min(parsedAmount, balanceDue)
      await apiPost('/payments', {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        amount: payAmount,
        method,
        ...(method === 'UPI' && upiVpa ? { upiVpa } : {}),
      })
      get().onPaymentSuccess?.()
      set({ dialogOpen: false, recording: false })
      return true
    } catch (err) {
      set({ recording: false })
      throw err
    }
  },

  // ── Razorpay payment flow ──

  processRazorpayPayment: async (clinicName?: string) => {
    const { invoice, amount } = get()
    const parsedAmount = parseFloat(amount) || 0
    const balanceDue = invoice ? invoice.grandTotal - invoice.paidAmount : 0

    if (!invoice || parsedAmount <= 0) return

    set({ razorpayLoading: true, onlineStep: 'processing', onlineError: '' })
    try {
      const payAmount = Math.min(parsedAmount, balanceDue)
      const res = await apiPost<{
        data: { orderId: string; keyId: string; mode: string }
      }>('/payments/razorpay/order', {
        invoiceId: invoice.id,
        amount: payAmount,
      })

      const { orderId, keyId } = res.data

      // Load Razorpay checkout.js
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.async = true
        script.onload = () => {
          const options = {
            key: keyId,
            amount: Math.round(payAmount * 100),
            currency: 'INR',
            name: clinicName || 'MediBill Pro',
            description: `Invoice ${invoice.invoiceNumber}`,
            order_id: orderId,
            handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
              try {
                await apiPost('/payments/razorpay/verify', {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  invoiceId: invoice.id,
                  patientId: invoice.patientId,
                  amount: payAmount,
                })
                set({ onlineStep: 'success', razorpayLoading: false })
                get().onPaymentSuccess?.()
                resolve()
              } catch (err) {
                const msg = err instanceof ApiError ? err.message : 'Verification failed'
                set({ onlineStep: 'error', onlineError: msg, razorpayLoading: false })
                reject(err)
              }
            },
            prefill: {
              name: invoice.patientName || '',
              email: invoice.patientEmail || '',
              contact: invoice.patientPhone || '',
            },
            theme: { color: '#059669' },
            modal: {
              ondismiss: () => {
                set({ onlineStep: 'choose', razorpayLoading: false })
              },
            },
          }
          const rzp = new window.Razorpay(options)
          rzp.open()
          set({ razorpayLoading: false })
        }
        script.onerror = () => {
          set({ onlineStep: 'error', onlineError: 'Failed to load Razorpay SDK.', razorpayLoading: false })
          reject(new Error('Failed to load Razorpay SDK'))
        }
        document.body.appendChild(script)
      })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to initiate Razorpay'
      set({ onlineStep: 'error', onlineError: msg, razorpayLoading: false })
    }
  },

  // ── UPI confirm after QR scan ──

  confirmUpiPayment: async () => {
    const { invoice, amount, upiTransactionId, upiVpa } = get()
    const parsedAmount = parseFloat(amount) || 0
    const balanceDue = invoice ? invoice.grandTotal - invoice.paidAmount : 0

    if (!invoice || parsedAmount <= 0) return false
    if (!upiTransactionId.trim()) return false

    set({ recording: true })
    try {
      const payAmount = Math.min(parsedAmount, balanceDue)
      await apiPost('/payments', {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        amount: payAmount,
        method: 'UPI',
        upiVpa: upiVpa || undefined,
        upiTransactionId: upiTransactionId.trim(),
      })
      set({ onlineStep: 'success', recording: false })
      get().onPaymentSuccess?.()
      return true
    } catch (err) {
      set({ recording: false })
      throw err
    }
  },

  reset: () => set(initialState),
}))