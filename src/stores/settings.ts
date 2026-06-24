import { create } from 'zustand'
import { apiGet, apiPut, type SingleResponse, ApiError } from '@/lib/api-client'

// ─── Types ───────────────────────────────────────────────────────────────

export interface GatewaySettings {
  id: string
  razorpayEnabled: boolean
  razorpayKeyId: string | null
  razorpayKeySecret: string | null // masked from server
  razorpayMode: string
  paypalEnabled: boolean
  paypalClientId: string | null
  paypalClientSecret: string | null // masked from server
  paypalMode: string
  paypalCurrency: string
  upiEnabled: boolean
  upiVpa: string | null
  upiMerchantName: string | null
}

interface SettingsForm {
  // Razorpay
  razorpayEnabled: boolean
  razorpayKeyId: string
  razorpayKeySecret: string
  razorpayMode: string
  showRazorpaySecret: boolean
  // PayPal
  paypalEnabled: boolean
  paypalClientId: string
  paypalClientSecret: string
  paypalMode: string
  paypalCurrency: string
  showPaypalSecret: boolean
  // UPI
  upiEnabled: boolean
  upiVpa: string
  upiMerchantName: string
}

interface SettingsState {
  // Loaded settings from server
  settings: GatewaySettings | null
  loading: boolean
  error: string | null
  // Editable form (initialized from settings)
  form: SettingsForm
  // Saving state
  saving: boolean
  saveError: string | null
  saveSuccess: boolean
  // Which section was last saved
  lastSavedSection: string | null

  // ── Actions ──
  fetchSettings: () => Promise<void>
  updateFormField: (field: keyof SettingsForm, value: unknown) => void
  saveRazorpaySettings: () => Promise<boolean>
  savePaypalSettings: () => Promise<boolean>
  saveUpiSettings: () => Promise<boolean>
  resetSection: (section: 'razorpay' | 'paypal' | 'upi') => void
}

// ─── Initial form ───────────────────────────────────────────────────────

const initialForm: SettingsForm = {
  razorpayEnabled: false,
  razorpayKeyId: '',
  razorpayKeySecret: '',
  razorpayMode: 'Test',
  showRazorpaySecret: false,
  paypalEnabled: false,
  paypalClientId: '',
  paypalClientSecret: '',
  paypalMode: 'Sandbox',
  paypalCurrency: 'USD',
  showPaypalSecret: false,
  upiEnabled: false,
  upiVpa: '',
  upiMerchantName: '',
}

// ─── Store ──────────────────────────────────────────────────────────────

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: null,
  loading: false,
  error: null,
  form: { ...initialForm },
  saving: false,
  saveError: null,
  saveSuccess: false,
  lastSavedSection: null,

  // ── Fetch settings ──

  fetchSettings: async () => {
    set({ loading: true, error: null })
    try {
      const res = await apiGet<SingleResponse<GatewaySettings>>('/settings/payment')
      const settings = res.data

      // Initialize form from settings
      const form: SettingsForm = {
        razorpayEnabled: settings.razorpayEnabled,
        razorpayKeyId: settings.razorpayKeyId || '',
        razorpayKeySecret: '', // Never prefill secret (masked)
        razorpayMode: settings.razorpayMode || 'Test',
        showRazorpaySecret: false,
        paypalEnabled: settings.paypalEnabled,
        paypalClientId: settings.paypalClientId || '',
        paypalClientSecret: '', // Never prefill secret (masked)
        paypalMode: settings.paypalMode || 'Sandbox',
        paypalCurrency: settings.paypalCurrency || 'USD',
        showPaypalSecret: false,
        upiEnabled: settings.upiEnabled,
        upiVpa: settings.upiVpa || '',
        upiMerchantName: settings.upiMerchantName || '',
      }

      set({ settings, form, loading: false })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to fetch settings'
      set({ loading: false, error: msg })
    }
  },

  // ── Update form field ──

  updateFormField: (field, value) => {
    set({ form: { ...get().form, [field]: value }, saveError: null, saveSuccess: false })
  },

  // ── Save Razorpay ──

  saveRazorpaySettings: async () => {
    const { form } = get()
    set({ saving: true, saveError: null, saveSuccess: false })
    try {
      const res = await apiPut<SingleResponse<GatewaySettings>>('/settings/payment', {
        razorpayEnabled: form.razorpayEnabled,
        razorpayKeyId: form.razorpayKeyId || undefined,
        razorpayKeySecret: form.razorpayKeySecret || undefined, // empty = no change
        razorpayMode: form.razorpayMode as 'Test' | 'Live',
      })

      set({
        settings: res.data,
        form: {
          ...form,
          razorpayKeySecret: '', // Clear after save
          showRazorpaySecret: false,
        },
        saving: false,
        saveSuccess: true,
        lastSavedSection: 'razorpay',
      })
      return true
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save Razorpay settings'
      set({ saving: false, saveError: msg })
      return false
    }
  },

  // ── Save PayPal ──

  savePaypalSettings: async () => {
    const { form } = get()
    set({ saving: true, saveError: null, saveSuccess: false })
    try {
      const res = await apiPut<SingleResponse<GatewaySettings>>('/settings/payment', {
        paypalEnabled: form.paypalEnabled,
        paypalClientId: form.paypalClientId || undefined,
        paypalClientSecret: form.paypalClientSecret || undefined,
        paypalMode: form.paypalMode as 'Sandbox' | 'Live',
        paypalCurrency: form.paypalCurrency,
      })

      set({
        settings: res.data,
        form: {
          ...form,
          paypalClientSecret: '',
          showPaypalSecret: false,
        },
        saving: false,
        saveSuccess: true,
        lastSavedSection: 'paypal',
      })
      return true
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save PayPal settings'
      set({ saving: false, saveError: msg })
      return false
    }
  },

  // ── Save UPI ──

  saveUpiSettings: async () => {
    const { form } = get()
    set({ saving: true, saveError: null, saveSuccess: false })
    try {
      const res = await apiPut<SingleResponse<GatewaySettings>>('/settings/payment', {
        upiEnabled: form.upiEnabled,
        upiVpa: form.upiVpa || undefined,
        upiMerchantName: form.upiMerchantName || undefined,
      })

      set({
        settings: res.data,
        saving: false,
        saveSuccess: true,
        lastSavedSection: 'upi',
      })
      return true
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save UPI settings'
      set({ saving: false, saveError: msg })
      return false
    }
  },

  // ── Reset section to loaded settings ──

  resetSection: (section) => {
    const { settings, form } = get()
    if (!settings) return

    const updates: Partial<SettingsForm> = {}
    if (section === 'razorpay') {
      updates.razorpayEnabled = settings.razorpayEnabled
      updates.razorpayKeyId = settings.razorpayKeyId || ''
      updates.razorpayKeySecret = ''
      updates.razorpayMode = settings.razorpayMode || 'Test'
      updates.showRazorpaySecret = false
    } else if (section === 'paypal') {
      updates.paypalEnabled = settings.paypalEnabled
      updates.paypalClientId = settings.paypalClientId || ''
      updates.paypalClientSecret = ''
      updates.paypalMode = settings.paypalMode || 'Sandbox'
      updates.paypalCurrency = settings.paypalCurrency || 'USD'
      updates.showPaypalSecret = false
    } else if (section === 'upi') {
      updates.upiEnabled = settings.upiEnabled
      updates.upiVpa = settings.upiVpa || ''
      updates.upiMerchantName = settings.upiMerchantName || ''
    }

    set({ form: { ...form, ...updates }, saveError: null, saveSuccess: false })
  },
}))