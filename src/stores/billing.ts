import { create } from 'zustand'
import { apiGet, apiPost, apiPut, apiDelete, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { QUICK_SERVICES } from '@/lib/constants'

// ─── Shared Types ───────────────────────────────────────────────────────

export interface InvoicePatient {
  id: string
  patientId: string
  name: string
  phone: string
  email: string | null
}

export interface InvoiceItem {
  id: string
  description: string
  hsnCode: string | null
  quantity: number
  unitPrice: number
  gstRate: number
  gstAmount: number
  total: number
  type: string
}

export interface InvoicePayment {
  id: string
  paymentId: string
  amount: number
  method: string
  status: string
  receiptNumber: string | null
  razorpayPaymentId: string | null
  razorpayOrderId: string | null
  createdAt: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  patientId: string
  date: string
  dueDate: string | null
  status: string
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  totalGst: number
  grandTotal: number
  discount: number
  discountType: string
  roundOff: number
  paidAmount: number
  notes: string | null
  patient: InvoicePatient
  items?: InvoiceItem[]
  payments?: InvoicePayment[]
}

export interface InvoiceLineItem {
  id: string
  description: string
  type: string
  hsnCode: string
  quantity: number
  unitPrice: number
  gstRate: number
}

export interface PatientResult {
  id: string
  patientId: string
  name: string
  phone: string
  city?: string | null
  state?: string | null
}

export interface PaymentRecord {
  id: string
  paymentId: string
  invoiceId: string
  patientId: string
  amount: number
  method: string
  status: string
  receiptNumber: string | null
  razorpayPaymentId: string | null
  razorpayOrderId: string | null
  upiVpa: string | null
  upiTransactionId: string | null
  createdAt: string
  updatedAt: string
  invoice: { id: string; invoiceNumber: string; grandTotal: number }
  patient: { id: string; patientId: string; name: string; phone: string }
}

export interface ClinicSettings {
  clinicName: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  gstType: string
}

// ─── Helper ────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

const ITEM_TYPE_HSN_MAP: Record<string, string> = {
  Service: '0011',
  Medicine: '3004',
  'Lab Test': '0013',
  'Room Charge': '0010',
  Package: '0020',
}

function getDefaultItem(): InvoiceLineItem {
  return {
    id: generateId(),
    description: '',
    type: 'Service',
    hsnCode: '0011',
    quantity: 1,
    unitPrice: 0,
    gstRate: 0,
  }
}

// ─── Invoice List State ────────────────────────────────────────────────

interface InvoiceFilters {
  search: string
  status: string
  patientId: string
  fromDate: string
  toDate: string
}

interface InvoiceListState {
  invoices: Invoice[]
  loading: boolean
  error: string | null
  page: number
  limit: number
  total: number
  totalPages: number
  filters: InvoiceFilters
}

// ─── Create Invoice Form State ─────────────────────────────────────────

interface CreateFormState {
  dialogOpen: boolean
  patientSearch: string
  selectedPatient: PatientResult | null
  patientPopoverOpen: boolean
  patientResults: PatientResult[]
  patientLoading: boolean
  items: InvoiceLineItem[]
  discount: number
  discountType: 'flat' | 'percentage'
  roundOff: boolean
  dueDate: string
  notes: string
  isInterstate: boolean
  submitting: boolean
  formErrors: Record<string, string>
}

// ─── Invoice Detail State ──────────────────────────────────────────────

interface InvoiceDetailState {
  invoice: (Invoice & { items: InvoiceItem[]; payments: InvoicePayment[] }) | null
  clinicSettings: ClinicSettings | null
  loading: boolean
  error: string | null
  deleteDialogOpen: boolean
  deletingItemId: string | null
  cancelling: boolean
  cancelDialogOpen: boolean
}

// ─── Payment List State ────────────────────────────────────────────────

interface PaymentFilters {
  search: string
  status: string
  method: string
  patientId: string
  fromDate: string
  toDate: string
}

interface PaymentListState {
  payments: PaymentRecord[]
  loading: boolean
  error: string | null
  page: number
  limit: number
  total: number
  totalPages: number
  filters: PaymentFilters
  refundDialogOpen: boolean
  refundingPaymentId: string | null
  refunding: boolean
}

// ─── GST Calculation ───────────────────────────────────────────────────

interface GstCalculation {
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  totalGst: number
  effectiveDiscount: number
  discountType: 'flat' | 'percentage'
  roundOff: number
  grandTotal: number
}

// ─── Master Billing Store ─────────────────────────────────────────────

interface BillingState {
  // Invoice List
  invoiceList: InvoiceListState
  // Create Invoice Form
  createForm: CreateFormState
  // Invoice Detail
  invoiceDetail: InvoiceDetailState
  // Payment List
  paymentList: PaymentListState

  // ── Invoice List Actions ──
  fetchInvoices: () => Promise<void>
  setInvoiceFilter: (key: keyof InvoiceFilters, value: string) => void
  setInvoicePage: (page: number) => void
  resetInvoiceFilters: () => void

  // ── Create Invoice Actions ──
  openCreateDialog: () => void
  closeCreateDialog: () => void
  setPatientSearch: (search: string) => void
  selectPatient: (patient: PatientResult | null) => void
  setPatientPopoverOpen: (open: boolean) => void
  searchPatients: () => Promise<void>
  updateFormField: (field: string, value: unknown) => void
  addFormItem: () => void
  updateFormItem: (id: string, field: keyof InvoiceLineItem, value: string | number) => void
  removeFormItem: (id: string) => void
  addQuickService: (serviceIndex: number) => void
  setFormErrors: (errors: Record<string, string>) => void
  getGstCalculation: () => GstCalculation
  submitInvoice: () => Promise<boolean>
  resetCreateForm: () => void
  // ── Invoice Detail Actions ──
  fetchInvoiceDetail: (invoiceId: string) => Promise<void>
  setDeleteDialogOpen: (open: boolean, itemId?: string | null) => void
  deleteInvoiceItem: (itemId: string) => Promise<void>
  setCancelDialogOpen: (open: boolean) => void
  cancelInvoice: () => Promise<void>
  clearInvoiceDetail: () => void

  // ── Payment List Actions ──
  fetchPayments: () => Promise<void>
  setPaymentFilter: (key: keyof PaymentFilters, value: string) => void
  setPaymentPage: (page: number) => void
  resetPaymentFilters: () => void
  setRefundDialogOpen: (open: boolean, paymentId?: string | null) => void
  refundPayment: (reason: string) => Promise<void>
}

// ─── Initial States ────────────────────────────────────────────────────

const initialInvoiceFilters: InvoiceFilters = {
  search: '',
  status: '',
  patientId: '',
  fromDate: '',
  toDate: '',
}

const initialCreateForm: CreateFormState = {
  dialogOpen: false,
  patientSearch: '',
  selectedPatient: null,
  patientPopoverOpen: false,
  patientResults: [],
  patientLoading: false,
  items: [getDefaultItem()],
  discount: 0,
  discountType: 'flat',
  roundOff: false,
  dueDate: '',
  notes: '',
  isInterstate: false,
  submitting: false,
  formErrors: {},
}

const initialPaymentFilters: PaymentFilters = {
  search: '',
  status: '',
  method: '',
  patientId: '',
  fromDate: '',
  toDate: '',
}

// ─── Store ─────────────────────────────────────────────────────────────

let patientDebounceTimer: ReturnType<typeof setTimeout> | null = null

export const useBillingStore = create<BillingState>()((set, get) => ({
  // ── Invoice List ──
  invoiceList: {
    invoices: [],
    loading: false,
    error: null,
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    filters: { ...initialInvoiceFilters },
  },

  // ── Create Form ──
  createForm: { ...initialCreateForm },

  // ── Invoice Detail ──
  invoiceDetail: {
    invoice: null,
    clinicSettings: null,
    loading: false,
    error: null,
    deleteDialogOpen: false,
    deletingItemId: null,
    cancelling: false,
    cancelDialogOpen: false,
  },

  // ── Payment List ──
  paymentList: {
    payments: [],
    loading: false,
    error: null,
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    filters: { ...initialPaymentFilters },
    refundDialogOpen: false,
    refundingPaymentId: null,
    refunding: false,
  },

  // ═══════════════════════════════════════════════════════════════════
  // INVOICE LIST ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  fetchInvoices: async () => {
    const { invoiceList } = get()
    set({ invoiceList: { ...invoiceList, loading: true, error: null } })
    try {
      const { filters, page, limit } = get().invoiceList
      const params: Record<string, string | number | undefined> = { page, limit }
      if (filters.search) params.search = filters.search
      if (filters.status) params.status = filters.status
      if (filters.patientId) params.patientId = filters.patientId
      if (filters.fromDate) params.fromDate = filters.fromDate
      if (filters.toDate) params.toDate = filters.toDate

      const res = await apiGet<PaginatedResponse<Invoice>>('/billing', params)
      set({
        invoiceList: {
          ...get().invoiceList,
          invoices: res.data || [],
          total: res.total,
          totalPages: res.totalPages,
          loading: false,
        },
      })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to fetch invoices'
      set({ invoiceList: { ...get().invoiceList, loading: false, error: msg } })
    }
  },

  setInvoiceFilter: (key, value) => {
    const { invoiceList } = get()
    set({
      invoiceList: {
        ...invoiceList,
        filters: { ...invoiceList.filters, [key]: value },
        page: 1, // Reset to first page on filter change
      },
    })
  },

  setInvoicePage: (page) => {
    set({ invoiceList: { ...get().invoiceList, page } })
  },

  resetInvoiceFilters: () => {
    set({
      invoiceList: {
        ...get().invoiceList,
        filters: { ...initialInvoiceFilters },
        page: 1,
      },
    })
  },

  // ═══════════════════════════════════════════════════════════════════
  // CREATE INVOICE ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  openCreateDialog: () => {
    set({
      createForm: {
        ...initialCreateForm,
        dialogOpen: true,
        items: [getDefaultItem()],
      },
    })
  },

  closeCreateDialog: () => {
    set({ createForm: { ...get().createForm, dialogOpen: false } })
  },

  setPatientSearch: (search) => {
    const { createForm } = get()
    set({ createForm: { ...createForm, patientSearch: search, patientLoading: false } })

    // Debounce search
    if (patientDebounceTimer) clearTimeout(patientDebounceTimer)
    if (!search.trim()) {
      set({ createForm: { ...get().createForm, patientResults: [] } })
      return
    }
    patientDebounceTimer = setTimeout(() => {
      get().searchPatients()
    }, 300)
  },

  selectPatient: (patient) => {
    set({ createForm: { ...get().createForm, selectedPatient: patient, patientPopoverOpen: false } })
  },

  setPatientPopoverOpen: (open) => {
    set({ createForm: { ...get().createForm, patientPopoverOpen: open } })
  },

  searchPatients: async () => {
    const { createForm } = get()
    if (!createForm.patientSearch.trim()) return
    set({ createForm: { ...createForm, patientLoading: true } })
    try {
      const res = await apiGet<PaginatedResponse<PatientResult>>('/patients', {
        limit: 50,
        search: createForm.patientSearch,
      })
      set({ createForm: { ...get().createForm, patientResults: res.data || [], patientLoading: false } })
    } catch {
      set({ createForm: { ...get().createForm, patientResults: [], patientLoading: false } })
    }
  },

  updateFormField: (field, value) => {
    const { createForm } = get()
    set({ createForm: { ...createForm, [field]: value } })
  },

  addFormItem: () => {
    const { createForm } = get()
    set({ createForm: { ...createForm, items: [...createForm.items, getDefaultItem()] } })
  },

  updateFormItem: (id, field, value) => {
    const { createForm } = get()
    set({
      createForm: {
        ...createForm,
        items: createForm.items.map((item) => {
          if (item.id !== id) return item
          const updated = { ...item, [field]: value }
          if (field === 'type') {
            updated.hsnCode = ITEM_TYPE_HSN_MAP[value as string] || '0011'
          }
          return updated
        }),
      },
    })
  },

  removeFormItem: (id) => {
    const { createForm } = get()
    if (createForm.items.length <= 1) return
    set({
      createForm: {
        ...createForm,
        items: createForm.items.filter((item) => item.id !== id),
      },
    })
  },

  addQuickService: (serviceIndex) => {
    const service = QUICK_SERVICES[serviceIndex]
    if (!service) return
    const { createForm } = get()
    const newItem: InvoiceLineItem = {
      id: generateId(),
      description: service.name,
      type: service.type,
      hsnCode: service.hsnCode,
      quantity: 1,
      unitPrice: service.price,
      gstRate: service.gstRate,
    }
    set({ createForm: { ...createForm, items: [...createForm.items, newItem] } })
  },

  setFormErrors: (errors) => {
    set({ createForm: { ...get().createForm, formErrors: errors } })
  },

  getGstCalculation: () => {
    const { createForm } = get()
    const { items, discount, discountType, isInterstate } = createForm

    let subtotal = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0

    for (const item of items) {
      if (!item.description.trim() || item.unitPrice <= 0) continue
      const lineTotal = item.unitPrice * item.quantity
      const gstAmount = lineTotal * (item.gstRate / 100)
      subtotal += lineTotal
      if (isInterstate) {
        totalIgst += gstAmount
      } else {
        totalCgst += gstAmount / 2
        totalSgst += gstAmount / 2
      }
    }

    const totalGst = totalCgst + totalSgst + totalIgst
    const preDiscountTotal = subtotal + totalGst

    let effectiveDiscount = 0
    if (discountType === 'percentage') {
      effectiveDiscount = preDiscountTotal * (discount / 100)
    } else {
      effectiveDiscount = Math.min(discount, preDiscountTotal)
    }

    const afterDiscount = preDiscountTotal - effectiveDiscount
    const roundOffValue = Math.round(afterDiscount) - afterDiscount
    const grandTotal = Math.round(afterDiscount)

    return {
      subtotal,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalGst,
      effectiveDiscount,
      discountType,
      roundOff: roundOffValue,
      grandTotal,
    }
  },

  submitInvoice: async () => {
    const { createForm, fetchInvoices } = get()
    const { selectedPatient, items, discount, discountType, roundOff, isInterstate, dueDate, notes } = createForm

    // Validate
    const errors: Record<string, string> = {}
    if (!selectedPatient) errors.patient = 'Please select a patient'

    if (discountType === 'percentage' && discount > 100) {
      errors.discount = 'Percentage discount cannot exceed 100%'
    }

    const validItems = items.filter((item) => item.description.trim() && item.unitPrice > 0)
    if (validItems.length === 0) errors.items = 'Add at least one item with description and price'

    if (Object.keys(errors).length > 0) {
      set({ createForm: { ...createForm, formErrors: errors } })
      return false
    }

    set({ createForm: { ...createForm, submitting: true, formErrors: {} } })

    try {
      const today = new Date().toISOString().split('T')[0]
      const body = {
        patientId: selectedPatient!.id,
        date: today,
        dueDate: dueDate || undefined,
        discount,
        discountType,
        roundOff,
        isInterstate,
        notes: notes || undefined,
        items: validItems.map((item) => ({
          description: item.description.trim(),
          hsnCode: item.hsnCode || undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstRate: item.gstRate,
          type: item.type,
        })),
      }

      await apiPost('/billing', body)
      set({ createForm: { ...initialCreateForm } })
      await fetchInvoices()
      return true
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to create invoice'
      set({ createForm: { ...get().createForm, submitting: false, formErrors: { submit: msg } } })
      return false
    }
  },

  resetCreateForm: () => {
    set({ createForm: { ...initialCreateForm } })
  },

  // ═══════════════════════════════════════════════════════════════════
  // INVOICE DETAIL ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  fetchInvoiceDetail: async (invoiceId) => {
    set({
      invoiceDetail: {
        ...get().invoiceDetail,
        loading: true,
        error: null,
      },
    })
    try {
      const [invoiceRes, settingsRes] = await Promise.all([
        apiGet<SingleResponse<Invoice & { items: InvoiceItem[]; payments: InvoicePayment[] }>>(`/billing/${invoiceId}`),
        apiGet<SingleResponse<ClinicSettings>>('/settings').catch(() => null),
      ])

      set({
        invoiceDetail: {
          ...get().invoiceDetail,
          invoice: invoiceRes.data,
          clinicSettings: settingsRes?.data || null,
          loading: false,
        },
      })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to fetch invoice'
      set({ invoiceDetail: { ...get().invoiceDetail, loading: false, error: msg } })
    }
  },

  setDeleteDialogOpen: (open, itemId = null) => {
    set({
      invoiceDetail: {
        ...get().invoiceDetail,
        deleteDialogOpen: open,
        deletingItemId: itemId,
      },
    })
  },

  deleteInvoiceItem: async (itemId) => {
    try {
      await apiDelete(`/billing/${get().invoiceDetail.invoice?.id}/items/${itemId}`)
      // Re-fetch to get updated data
      if (get().invoiceDetail.invoice?.id) {
        await get().fetchInvoiceDetail(get().invoiceDetail.invoice!.id)
      }
    } catch (err) {
      console.error('[BillingStore] Failed to delete invoice item:', err)
    }
    set({
      invoiceDetail: {
        ...get().invoiceDetail,
        deleteDialogOpen: false,
        deletingItemId: null,
      },
    })
  },

  setCancelDialogOpen: (open) => {
    set({ invoiceDetail: { ...get().invoiceDetail, cancelDialogOpen: open } })
  },

  cancelInvoice: async () => {
    const { invoiceDetail, fetchInvoiceDetail } = get()
    if (!invoiceDetail.invoice) return
    set({ invoiceDetail: { ...invoiceDetail, cancelling: true } })
    try {
      await apiPut(`/billing/${invoiceDetail.invoice.id}`, { status: 'Cancelled' })
      await fetchInvoiceDetail(invoiceDetail.invoice.id)
      set({
        invoiceDetail: {
          ...get().invoiceDetail,
          cancelling: false,
          cancelDialogOpen: false,
        },
      })
    } catch (err) {
      set({
        invoiceDetail: {
          ...get().invoiceDetail,
          cancelling: false,
          cancelDialogOpen: false,
        },
      })
      throw err
    }
  },

  clearInvoiceDetail: () => {
    set({
      invoiceDetail: {
        invoice: null,
        clinicSettings: null,
        loading: false,
        error: null,
        deleteDialogOpen: false,
        deletingItemId: null,
        cancelling: false,
        cancelDialogOpen: false,
      },
    })
  },

  // ═══════════════════════════════════════════════════════════════════
  // PAYMENT LIST ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  fetchPayments: async () => {
    const { paymentList } = get()
    set({ paymentList: { ...paymentList, loading: true, error: null } })
    try {
      const { filters, page, limit } = get().paymentList
      const params: Record<string, string | number | undefined> = { page, limit }
      if (filters.search) params.search = filters.search
      if (filters.status) params.status = filters.status
      if (filters.method) params.method = filters.method
      if (filters.patientId) params.patientId = filters.patientId
      if (filters.fromDate) params.fromDate = filters.fromDate
      if (filters.toDate) params.toDate = filters.toDate

      const res = await apiGet<PaginatedResponse<PaymentRecord>>('/payments', params)
      set({
        paymentList: {
          ...get().paymentList,
          payments: res.data || [],
          total: res.total,
          totalPages: res.totalPages,
          loading: false,
        },
      })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to fetch payments'
      set({ paymentList: { ...get().paymentList, loading: false, error: msg } })
    }
  },

  setPaymentFilter: (key, value) => {
    const { paymentList } = get()
    set({
      paymentList: {
        ...paymentList,
        filters: { ...paymentList.filters, [key]: value },
        page: 1,
      },
    })
  },

  setPaymentPage: (page) => {
    set({ paymentList: { ...get().paymentList, page } })
  },

  resetPaymentFilters: () => {
    set({
      paymentList: {
        ...get().paymentList,
        filters: { ...initialPaymentFilters },
        page: 1,
      },
    })
  },

  setRefundDialogOpen: (open, paymentId = null) => {
    set({
      paymentList: {
        ...get().paymentList,
        refundDialogOpen: open,
        refundingPaymentId: paymentId,
      },
    })
  },

  refundPayment: async (reason) => {
    const { paymentList, fetchPayments } = get()
    if (!paymentList.refundingPaymentId) return
    set({ paymentList: { ...paymentList, refunding: true } })
    try {
      await apiPut(`/payments/${paymentList.refundingPaymentId}`, {
        status: 'Refunded',
        notes: reason,
      })
      await fetchPayments()
      set({
        paymentList: {
          ...get().paymentList,
          refunding: false,
          refundDialogOpen: false,
          refundingPaymentId: null,
        },
      })
    } catch (err) {
      set({ paymentList: { ...get().paymentList, refunding: false } })
      throw err
    }
  },
}))