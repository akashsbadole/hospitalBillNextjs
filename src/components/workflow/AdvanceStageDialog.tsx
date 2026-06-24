'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { apiPost, apiGet, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import {
  WORKFLOW_STAGES,
  getNextStages,
  StageBadge,
} from './WorkflowStepper'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, ArrowRight, CheckCircle2, Plus, Trash2, Receipt, CreditCard, FileText, TestTube2, Pill, Search, Check, X as XIcon, Shield, Eye, Info } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────

interface AdvanceStageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  visitId: string
  currentStage: string
  patientId: string
  patientName: string
  onSuccess?: () => void
}

interface InvoiceFormItem {
  id: string
  description: string
  hsnCode: string
  quantity: number
  unitPrice: number
  gstRate: number
  type: 'Service' | 'Medicine' | 'Lab Test' | 'Room Charge' | 'Package'
}

interface LabTestItem {
  testName: string
  testCode: string
  category: string
}

interface MedicineFormItem {
  id: string
  medicine: string
  dosage: string
  frequency: string
  duration: string
}

interface InvoiceData {
  patientId: string
  invoiceNumber: string
  grandTotal: number
  paidAmount: number
  status: string
}

interface BillingSummaryItem {
  description: string
  hsnCode: string
  quantity: number
  unitPrice: number
  gstRate: number
  type: 'Service' | 'Medicine' | 'Lab Test' | 'Room Charge' | 'Package'
  source: string
}

interface BillingSummaryData {
  visitId: string
  patientName: string
  visitType: string
  department: string | null
  doctorName: string | null
  insuranceProvider: string | null
  insuranceNumber: string | null
  items: BillingSummaryItem[]
  summary: {
    consultationFee: number
    labTestCount: number
    labTestTotal: number
    roomDays: number
    roomDailyRate: number
    medicineCount: number
    medicineTotal: number
  }
  totals: {
    subtotal: number
    totalGst: number
    grandTotal: number
  }
}

// ─── Predefined Quick-Add Items ────────────────────────────────────────────

const QUICK_ADD_ITEMS: Omit<InvoiceFormItem, 'id'>[] = [
  { description: 'General Consultation', hsnCode: '0011', quantity: 1, unitPrice: 500, gstRate: 5, type: 'Service' },
  { description: 'Specialist Consultation', hsnCode: '0011', quantity: 1, unitPrice: 1000, gstRate: 5, type: 'Service' },
  { description: 'Follow-up Consultation', hsnCode: '0011', quantity: 1, unitPrice: 300, gstRate: 5, type: 'Service' },
  { description: 'Emergency Consultation', hsnCode: '0012', quantity: 1, unitPrice: 2000, gstRate: 5, type: 'Service' },
  { description: 'Blood Test (CBC)', hsnCode: '0013', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' },
  { description: 'X-Ray', hsnCode: '0014', quantity: 1, unitPrice: 800, gstRate: 5, type: 'Lab Test' },
  { description: 'Ultrasound', hsnCode: '0015', quantity: 1, unitPrice: 1500, gstRate: 5, type: 'Lab Test' },
  { description: 'MRI Scan', hsnCode: '0016', quantity: 1, unitPrice: 5000, gstRate: 5, type: 'Lab Test' },
  { description: 'CT Scan', hsnCode: '0017', quantity: 1, unitPrice: 3500, gstRate: 5, type: 'Lab Test' },
  { description: 'ECG', hsnCode: '0018', quantity: 1, unitPrice: 500, gstRate: 5, type: 'Lab Test' },
  { description: 'Pathology Test', hsnCode: '0019', quantity: 1, unitPrice: 600, gstRate: 5, type: 'Lab Test' },
  { description: 'General Medicine', hsnCode: '3004', quantity: 1, unitPrice: 200, gstRate: 12, type: 'Medicine' },
  { description: 'General Ward (per day)', hsnCode: '0010', quantity: 1, unitPrice: 1500, gstRate: 5, type: 'Room Charge' },
  { description: 'Private Room (per day)', hsnCode: '0010', quantity: 1, unitPrice: 3500, gstRate: 5, type: 'Room Charge' },
  { description: 'ICU (per day)', hsnCode: '0010', quantity: 1, unitPrice: 8000, gstRate: 5, type: 'Room Charge' },
  { description: 'Health Checkup Package', hsnCode: '0020', quantity: 1, unitPrice: 2500, gstRate: 5, type: 'Package' },
]

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash', icon: '💵' },
  { value: 'UPI', label: 'UPI', icon: '📱' },
  { value: 'Card', label: 'Card', icon: '💳' },
  { value: 'Net Banking', label: 'Net Banking', icon: '🏦' },
  { value: 'Wallet', label: 'Wallet', icon: '👛' },
  { value: 'Razorpay', label: 'Razorpay', icon: '⚡' },
  { value: 'PayPal', label: 'PayPal', icon: '🅿️' },
] as const

// ─── Predefined Lab Tests ──────────────────────────────────────────────

const LAB_TESTS: LabTestItem[] = [
  { testName: 'Complete Blood Count (CBC)', testCode: 'LAB-CBC', category: 'Hematology' },
  { testName: 'Lipid Profile', testCode: 'LAB-LIP', category: 'Biochemistry' },
  { testName: 'Liver Function Test (LFT)', testCode: 'LAB-LFT', category: 'Biochemistry' },
  { testName: 'Kidney Function Test (KFT)', testCode: 'LAB-KFT', category: 'Biochemistry' },
  { testName: 'Thyroid Profile (T3, T4, TSH)', testCode: 'LAB-THY', category: 'Endocrine' },
  { testName: 'Fasting Blood Sugar (FBS)', testCode: 'LAB-FBS', category: 'Biochemistry' },
  { testName: 'Post Prandial Blood Sugar (PPBS)', testCode: 'LAB-PPBS', category: 'Biochemistry' },
  { testName: 'HbA1c (Glycated Hemoglobin)', testCode: 'LAB-HBA', category: 'Biochemistry' },
  { testName: 'Urine Routine Examination', testCode: 'LAB-URR', category: 'Urology' },
  { testName: 'Urine Culture & Sensitivity', testCode: 'LAB-UCS', category: 'Urology' },
  { testName: 'X-Ray (Chest)', testCode: 'RAD-XRC', category: 'Radiology' },
  { testName: 'X-Ray (Extremity)', testCode: 'LAB-XRE', category: 'Radiology' },
  { testName: 'Ultrasound (Abdomen)', testCode: 'RAD-USG', category: 'Radiology' },
  { testName: 'Ultrasound (Pelvis)', testCode: 'RAD-USP', category: 'Radiology' },
  { testName: 'CT Scan (Head)', testCode: 'RAD-CTH', category: 'Radiology' },
  { testName: 'CT Scan (Abdomen)', testCode: 'RAD-CTA', category: 'Radiology' },
  { testName: 'MRI (Brain)', testCode: 'RAD-MRB', category: 'Radiology' },
  { testName: 'MRI (Spine)', testCode: 'RAD-MRS', category: 'Radiology' },
  { testName: 'ECG (12-Lead)', testCode: 'CAR-ECG', category: 'Cardiology' },
  { testName: 'ECHO (Echocardiogram)', testCode: 'CAR-ECH', category: 'Cardiology' },
  { testName: 'Treadmill Test (TMT)', testCode: 'CAR-TMT', category: 'Cardiology' },
  { testName: 'Vitamin D', testCode: 'LAB-VD3', category: 'Biochemistry' },
  { testName: 'Vitamin B12', testCode: 'LAB-VB12', category: 'Biochemistry' },
  { testName: 'Serum Iron / Ferritin', testCode: 'LAB-IRN', category: 'Biochemistry' },
  { testName: 'CRP (C-Reactive Protein)', testCode: 'LAB-CRP', category: 'Immunology' },
  { testName: 'ESR (Erythrocyte Sedimentation Rate)', testCode: 'LAB-ESR', category: 'Hematology' },
  { testName: 'Dengue NS1 / IgM / IgG', testCode: 'LAB-DNG', category: 'Serology' },
  { testName: 'COVID-19 RT-PCR', testCode: 'LAB-CVD', category: 'Serology' },
  { testName: 'Blood Group & Rh Typing', testCode: 'LAB-BGR', category: 'Hematology' },
  { testName: 'Prothrombin Time (PT/INR)', testCode: 'LAB-PTI', category: 'Hematology' },
]

const FREQUENCY_OPTIONS = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 8 hours', 'Every 12 hours', 'Every 6 hours', 'As needed (PRN)', 'At bedtime', 'With meals', 'Before meals', 'After meals', 'Weekly', 'Monthly']
const DURATION_OPTIONS = ['1 day', '3 days', '5 days', '7 days', '10 days', '14 days', '21 days', '30 days', '45 days', '60 days', '90 days', 'As directed', 'As needed', 'Lifetime']

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function calculateTotals(items: InvoiceFormItem[], discount: number) {
  let subtotal = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalGst = 0

  for (const item of items) {
    const lineTotal = item.unitPrice * item.quantity
    subtotal += lineTotal
    const gstAmount = (lineTotal * item.gstRate) / 100
    const halfGst = gstAmount / 2
    totalCgst += halfGst
    totalSgst += halfGst
    totalGst += gstAmount
  }

  const roundedSubtotal = parseFloat(subtotal.toFixed(2))
  const roundedCgst = parseFloat(totalCgst.toFixed(2))
  const roundedSgst = parseFloat(totalSgst.toFixed(2))
  const roundedGst = parseFloat(totalGst.toFixed(2))
  const roundedGrandTotal = parseFloat((roundedSubtotal + roundedGst - discount).toFixed(2))

  return {
    subtotal: roundedSubtotal,
    cgst: roundedCgst,
    sgst: roundedSgst,
    totalGst: roundedGst,
    grandTotal: Math.max(0, roundedGrandTotal),
  }
}

const typeColorMap: Record<string, string> = {
  Service: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Medicine: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Lab Test': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  'Room Charge': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Package: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function AdvanceStageDialog({
  open,
  onOpenChange,
  visitId,
  currentStage,
  patientId,
  patientName,
  onSuccess,
}: AdvanceStageDialogProps) {
  const { toast } = useToast()
  const [selectedStage, setSelectedStage] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Invoice form state
  const [invoiceItems, setInvoiceItems] = useState<InvoiceFormItem[]>([])
  const [invoiceDiscount, setInvoiceDiscount] = useState(0)
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddFilter, setQuickAddFilter] = useState('')

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)

  // Billing summary state (auto-populate)
  const [billingSummary, setBillingSummary] = useState<BillingSummaryData | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)

  // Bill & Pay state
  const [billAndPay, setBillAndPay] = useState(false)
  const [billPayMethod, setBillPayMethod] = useState('Cash')

  // Post-action success state
  const [lastAction, setLastAction] = useState<{ type: string; invoiceId?: string; invoiceNumber?: string } | null>(null)

  const nextStages = getNextStages(currentStage)
  const currentStageMeta = WORKFLOW_STAGES.find(s => s.key === currentStage)

  const showInvoiceForm = selectedStage === 'Billed'
  const showPaymentForm = selectedStage === 'Paid'
  const showLabOrderForm = selectedStage === 'Lab-Ordered'
  const showPrescriptionForm = selectedStage === 'Prescribed'

  // Lab order state
  const [selectedTests, setSelectedTests] = useState<LabTestItem[]>([])
  const [labTestSearch, setLabTestSearch] = useState('')
  const [labCategoryFilter, setLabCategoryFilter] = useState('')

  // Prescription form state
  const [prescriptionDiagnosis, setPrescriptionDiagnosis] = useState('')
  const [prescriptionMedicines, setPrescriptionMedicines] = useState<MedicineFormItem[]>([])
  const [prescriptionNotes, setPrescriptionNotes] = useState('')

  // Computed lab test filters
  const labCategories = useMemo(() => {
    const cats = new Map<string, number>()
    LAB_TESTS.forEach(t => cats.set(t.category, (cats.get(t.category) ?? 0) + 1))
    return Array.from(cats.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [])

  const filteredLabTests = useMemo(() => {
    let tests = LAB_TESTS
    if (labCategoryFilter) tests = tests.filter(t => t.category === labCategoryFilter)
    if (labTestSearch.trim()) {
      const q = labTestSearch.toLowerCase()
      tests = tests.filter(t => t.testName.toLowerCase().includes(q) || t.testCode.toLowerCase().includes(q))
    }
    return tests
  }, [labCategoryFilter, labTestSearch])

  const isLabTestSelected = (test: LabTestItem) => selectedTests.some(t => t.testCode === test.testCode)

  const totals = useMemo(
    () => calculateTotals(invoiceItems, invoiceDiscount),
    [invoiceItems, invoiceDiscount]
  )

  const filteredQuickAdd = useMemo(() => {
    if (!quickAddFilter.trim()) return QUICK_ADD_ITEMS
    const lower = quickAddFilter.toLowerCase()
    return QUICK_ADD_ITEMS.filter(
      item => item.description.toLowerCase().includes(lower) || item.type.toLowerCase().includes(lower)
    )
  }, [quickAddFilter])

  // Reset state on dialog open/close
  useEffect(() => {
    if (open) {
      setSelectedStage('')
      setNotes('')
      setIsSubmitting(false)
      setInvoiceItems([])
      setInvoiceDiscount(0)
      setInvoiceNotes('')
      setShowQuickAdd(false)
      setQuickAddFilter('')
      setPaymentAmount(0)
      setPaymentMethod('')
      setInvoiceData(null)
      setSelectedTests([])
      setLabTestSearch('')
      setLabCategoryFilter('')
      setPrescriptionDiagnosis('')
      setPrescriptionMedicines([])
      setPrescriptionNotes('')
      setBillingSummary(null)
      setIsLoadingSummary(false)
      setBillAndPay(false)
      setBillPayMethod('Cash')
      setLastAction(null)
    }
  }, [open])

  // Fetch billing summary when "Billed" stage is selected (auto-populate)
  useEffect(() => {
    if (open && selectedStage === 'Billed' && invoiceItems.length === 0) {
      fetchBillingSummary()
    }
  }, [open, selectedStage])

  // Fetch invoice data when "Paid" is selected
  useEffect(() => {
    if (open && selectedStage === 'Paid') {
      fetchLatestInvoice()
    }
  }, [open, selectedStage])

  const fetchBillingSummary = async () => {
    setIsLoadingSummary(true)
    try {
      const res = await apiGet<{ data: BillingSummaryData }>(
        `/patient-visits/${visitId}/billing-summary`
      )
      if (res.data && res.data.items && res.data.items.length > 0) {
        setBillingSummary(res.data)
        // Auto-populate invoice items if they are currently empty
        setInvoiceItems(prev => {
          if (prev.length === 0) {
            return res.data.items.map(item => ({
              id: generateTempId(),
              description: item.description,
              hsnCode: item.hsnCode || '',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              gstRate: item.gstRate,
              type: item.type,
            }))
          }
          return prev
        })
      }
    } catch {
      // Billing summary fetch failed — user can still add items manually
      setBillingSummary(null)
    } finally {
      setIsLoadingSummary(false)
    }
  }

  const fetchLatestInvoice = async () => {
    try {
      const res = await apiGet<{ data: { id: string; invoiceNumber: string; grandTotal: number; paidAmount: number; status: string }[] }>(
        '/billing',
        { patientId, status: 'Unpaid', limit: 1 }
      )
      if (res.data && res.data.length > 0) {
        const inv = res.data[0]
        setInvoiceData(inv as unknown as InvoiceData)
        const remaining = parseFloat((inv.grandTotal - inv.paidAmount).toFixed(2))
        setPaymentAmount(remaining)
      } else {
        setInvoiceData(null)
        setPaymentAmount(0)
      }
    } catch {
      // Invoice fetch failed — user can still enter amount manually
      setInvoiceData(null)
      setPaymentAmount(0)
    }
  }

  // ─── Invoice item handlers ────────────────────────────────────────────
  const addQuickItem = (item: Omit<InvoiceFormItem, 'id'>) => {
    setInvoiceItems(prev => [...prev, { ...item, id: generateTempId() }])
  }

  const addCustomItem = () => {
    setInvoiceItems(prev => [
      ...prev,
      {
        id: generateTempId(),
        description: '',
        hsnCode: '',
        quantity: 1,
        unitPrice: 0,
        gstRate: 5,
        type: 'Service',
      },
    ])
  }

  const updateItem = (id: string, field: keyof InvoiceFormItem, value: string | number) => {
    setInvoiceItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    )
  }

  const removeItem = (id: string) => {
    setInvoiceItems(prev => prev.filter(item => item.id !== id))
  }

  // ─── Lab test handlers ──────────────────────────────────────────
  const toggleLabTest = (test: LabTestItem) => {
    setSelectedTests(prev => {
      if (prev.some(t => t.testCode === test.testCode)) {
        return prev.filter(t => t.testCode !== test.testCode)
      }
      return [...prev, test]
    })
  }

  // ─── Prescription medicine handlers ──────────────────────────────────
  const addPrescriptionMedicine = () => {
    setPrescriptionMedicines(prev => [
      ...prev,
      { id: generateTempId(), medicine: '', dosage: '', frequency: '', duration: '' },
    ])
  }

  const updatePrescriptionMedicine = (id: string, field: keyof MedicineFormItem, value: string) => {
    setPrescriptionMedicines(prev => prev.map(m => (m.id === id ? { ...m, [field]: value } : m)))
  }

  const removePrescriptionMedicine = (id: string) => {
    setPrescriptionMedicines(prev => prev.filter(m => m.id !== id))
  }

  // ─── Submit handler ──────────────────────────────────────────────────
  const handleAdvance = async () => {
    if (!selectedStage) return
    if (showInvoiceForm && invoiceItems.length === 0) return
    if (showLabOrderForm && selectedTests.length === 0) return
    if (showPrescriptionForm && (prescriptionDiagnosis.trim() === '' || prescriptionMedicines.length === 0)) return

    setIsSubmitting(true)
    try {
      if (showLabOrderForm) {
        // Create lab orders and auto-advance
        const payload = {
          tests: selectedTests.map(t => ({
            testName: t.testName,
            testCode: t.testCode,
            category: t.category,
          })),
        }
        await apiPost(`/patient-visits/${visitId}/lab-orders`, payload)
        toast({
          title: 'Lab Tests Ordered',
          description: `${selectedTests.length} test(s) ordered for ${patientName}. Visit moved to "Lab-Ordered" stage.`,
        })
      } else if (showPrescriptionForm) {
        // Create prescription and auto-advance
        const payload = {
          diagnosis: prescriptionDiagnosis.trim(),
          medicines: prescriptionMedicines.filter(m => m.medicine.trim()).map(m => ({
            medicine: m.medicine,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration,
          })),
          notes: prescriptionNotes.trim() || undefined,
        }
        await apiPost(`/patient-visits/${visitId}/create-prescription`, payload)
        toast({
          title: 'Prescription Created',
          description: `${prescriptionMedicines.filter(m => m.medicine.trim()).length} medicine(s) prescribed. Visit moved to "Prescribed" stage.`,
        })
      } else if (showInvoiceForm) {
        // Create invoice and auto-advance
        const payload = {
          items: invoiceItems.map(item => ({
            description: item.description,
            hsnCode: item.hsnCode || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            gstRate: item.gstRate,
            type: item.type,
          })),
          discount: invoiceDiscount,
          notes: invoiceNotes.trim() || undefined,
        }

        const invResponse = await apiPost<{ data: { id: string; invoiceNumber: string } }>(
          `/patient-visits/${visitId}/create-invoice`, payload
        )

        // If bill & pay is enabled, also record payment
        if (billAndPay && invResponse.data) {
          await apiPost(`/patient-visits/${visitId}/record-payment`, {
            amount: totals.grandTotal,
            method: billPayMethod,
          })
          setLastAction({ type: 'payment', invoiceId: invResponse.data.id, invoiceNumber: invResponse.data.invoiceNumber })
          toast({
            title: 'Invoice Created & Payment Collected',
            description: `${formatCurrency(totals.grandTotal)} via ${billPayMethod}. ${patientName} moved to "Paid" stage.`,
          })
        } else {
          setLastAction({ type: 'invoice', invoiceId: invResponse.data?.id, invoiceNumber: invResponse.data?.invoiceNumber })
          toast({
            title: 'Invoice Created & Stage Advanced',
            description: `Invoice ${invResponse.data?.invoiceNumber} generated for ${formatCurrency(totals.grandTotal)}.`,
          })
        }
        // Don't close dialog — show success panel instead
        setIsSubmitting(false)
        return
      } else if (showPaymentForm) {
        // Record payment and auto-advance
        const payload = {
          amount: paymentAmount,
          method: paymentMethod,
        }
        await apiPost(`/patient-visits/${visitId}/record-payment`, payload)
        toast({
          title: 'Payment Recorded & Stage Advanced',
          description: `${formatCurrency(paymentAmount)} via ${paymentMethod}. ${patientName} moved to "Paid" stage.`,
        })
      } else {
        // Standard advance
        await apiPost(`/patient-visits/${visitId}/advance-stage`, {
          stage: selectedStage,
          notes: notes.trim() || undefined,
        })
        const targetLabel = WORKFLOW_STAGES.find(s => s.key === selectedStage)?.label ?? selectedStage
        toast({
          title: 'Stage Advanced',
          description: `${patientName} moved to "${targetLabel}" stage successfully.`,
        })
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({
          title: 'Action Failed',
          description: err.message || 'Something went wrong. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = selectedStage
    && !isSubmitting
    && (!showInvoiceForm || invoiceItems.length > 0)
    && (!showPaymentForm || (paymentAmount > 0 && paymentMethod !== ''))
    && (!showLabOrderForm || selectedTests.length > 0)
    && (!showPrescriptionForm || (prescriptionDiagnosis.trim() !== '' && prescriptionMedicines.some(m => m.medicine.trim())))
    && (!billAndPay || billPayMethod !== '')

  // Determine dialog max-width based on whether billing forms are shown
  const dialogMaxWidth = showInvoiceForm ? 'sm:max-w-2xl' : (showLabOrderForm || showPrescriptionForm) ? 'sm:max-w-xl' : showPaymentForm ? 'sm:max-w-lg' : 'sm:max-w-md'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogMaxWidth, 'max-h-[90vh]')}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ArrowRight className="h-5 w-5 text-emerald-600" />
            Advance Workflow Stage
          </DialogTitle>
          <DialogDescription>
            Move {patientName} to the next stage in the workflow.
          </DialogDescription>
        </DialogHeader>

        {/* ─── Success Panel (Post-Action) ─────────────────────────────── */}
        {lastAction && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {lastAction.type === 'invoice' ? 'Invoice Created' : 'Payment Recorded'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {lastAction.invoiceNumber && `Invoice: ${lastAction.invoiceNumber}`}
                {lastAction.type === 'payment' && ` — moved to "Paid" stage`}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                onOpenChange(false)
                onSuccess?.()
              }}>
                <Eye className="h-4 w-4 mr-1" />
                View in Billing
              </Button>
            </div>
          </div>
        )}

        {/* ─── Main Form (hidden when success panel is shown) ──────────── */}
        {!lastAction && (
          <>
            <ScrollArea className="max-h-[65vh] pr-2">
              <div className="space-y-5 py-2">
                {/* Current Stage Display */}
                <div className="rounded-lg border p-4 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Current Stage</p>
                  <div className="flex items-center gap-3">
                    <StageBadge stage={currentStage} />
                    <span className="text-sm text-muted-foreground">
                      {currentStageMeta?.icon} {currentStageMeta?.label}
                    </span>
                  </div>
                </div>

                {/* Visual Mini Progress */}
                <div className="flex items-center gap-1">
                  {WORKFLOW_STAGES.map((s, i) => {
                    const stageIdx = WORKFLOW_STAGES.findIndex(ws => ws.key === currentStage)
                    const selectedIdx = WORKFLOW_STAGES.findIndex(ws => ws.key === selectedStage)
                    const isCompleted = i <= stageIdx
                    const isTarget = s.key === selectedStage
                    const isInPath = i > stageIdx && i <= selectedIdx

                    return (
                      <React.Fragment key={s.key}>
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full transition-all',
                            isCompleted && 'bg-emerald-500',
                            isTarget && 'bg-emerald-500 ring-2 ring-emerald-300 animate-pulse',
                            isInPath && !isTarget && 'bg-emerald-200 dark:bg-emerald-800',
                            !isCompleted && !isInPath && !isTarget && 'bg-gray-200 dark:bg-gray-700'
                          )}
                        />
                        {i < WORKFLOW_STAGES.length - 1 && (
                          <div className={cn(
                            'flex-1 h-px',
                            isCompleted && 'bg-emerald-500',
                            isInPath && 'bg-emerald-200 dark:bg-emerald-800',
                            !isCompleted && !isInPath && 'bg-gray-200 dark:bg-gray-700'
                          )} />
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>

                {/* Next Stage Selector */}
                <div className="space-y-2">
                  <Label htmlFor="next-stage">Next Stage</Label>
                  <Select value={selectedStage} onValueChange={setSelectedStage}>
                    <SelectTrigger id="next-stage" className="w-full">
                      <SelectValue placeholder="Select next stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nextStages.map(stageKey => {
                        const meta = WORKFLOW_STAGES.find(s => s.key === stageKey)
                        return (
                          <SelectItem key={stageKey} value={stageKey}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{meta?.icon}</span>
                              <span>{meta?.label ?? stageKey}</span>
                              {stageKey === 'Billed' && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 bg-orange-100 text-orange-700">
                                  Invoice
                                </Badge>
                              )}
                              {stageKey === 'Paid' && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 bg-emerald-100 text-emerald-700">
                                  Payment
                                </Badge>
                              )}
                              {stageKey === 'Lab-Ordered' && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 bg-rose-100 text-rose-700">
                                  Lab Order
                                </Badge>
                              )}
                              {stageKey === 'Prescribed' && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1 bg-cyan-100 text-cyan-700">
                                  Prescription
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* ─── Lab Order Form ─────────────────────────────────────── */}
                {showLabOrderForm && (
                  <div className="space-y-4 rounded-lg border border-rose-200 dark:border-rose-800/40 bg-rose-50/50 dark:bg-rose-950/20 p-4">
                    <div className="flex items-center gap-2">
                      <TestTube2 className="h-4 w-4 text-rose-600" />
                      <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300">
                        Order Lab Tests
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select tests to order. The visit will auto-advance to &quot;Lab-Ordered&quot; stage.
                    </p>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search tests..."
                        value={labTestSearch}
                        onChange={e => setLabTestSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>

                    {/* Category Filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                          labCategoryFilter === ''
                            ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => setLabCategoryFilter('')}
                      >
                        All
                      </button>
                      {labCategories.map(([cat, count]) => (
                        <button
                          key={cat}
                          type="button"
                          className={cn(
                            'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                            labCategoryFilter === cat
                              ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800'
                              : 'border-border hover:bg-muted/50'
                          )}
                          onClick={() => setLabCategoryFilter(cat)}
                        >
                          {cat} ({count})
                        </button>
                      ))}
                    </div>

                    {/* Test Selection Grid */}
                    <ScrollArea className="max-h-52">
                      <div className="space-y-1">
                        {filteredLabTests.map(test => (
                          <button
                            key={test.testCode}
                            type="button"
                            className={cn(
                              'w-full text-left flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all',
                              isLabTestSelected(test)
                                ? 'bg-rose-100 dark:bg-rose-900/30 ring-1 ring-rose-300 dark:ring-rose-700'
                                : 'hover:bg-muted/60'
                            )}
                            onClick={() => toggleLabTest(test)}
                          >
                            <div className={cn(
                              'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all',
                              isLabTestSelected(test)
                                ? 'bg-rose-500 border-rose-500'
                                : 'border-muted-foreground/30'
                            )}>
                              {isLabTestSelected(test) && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{test.testName}</p>
                              <p className="text-[10px] text-muted-foreground">{test.testCode} · {test.category}</p>
                            </div>
                          </button>
                        ))}
                        {filteredLabTests.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-3">No matching tests found</p>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Selected Tests Summary */}
                    {selectedTests.length > 0 && (
                      <div className="flex items-center justify-between rounded-md border bg-background p-3">
                        <div className="flex items-center gap-2">
                          <TestTube2 className="h-3.5 w-3.5 text-rose-500" />
                          <span className="text-sm font-medium">
                            {selectedTests.length} test{selectedTests.length > 1 ? 's' : ''} selected
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => setSelectedTests([])}
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Prescription Form ──────────────────────────────────── */}
                {showPrescriptionForm && (
                  <div className="space-y-4 rounded-lg border border-cyan-200 dark:border-cyan-800/40 bg-cyan-50/50 dark:bg-cyan-950/20 p-4">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-cyan-600" />
                      <h3 className="text-sm font-semibold text-cyan-800 dark:text-cyan-300">
                        Create Prescription
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add diagnosis and medicines. The visit will auto-advance to &quot;Prescribed&quot; stage.
                    </p>

                    {/* Diagnosis */}
                    <div className="space-y-1">
                      <Label htmlFor="rx-diagnosis">Diagnosis *</Label>
                      <Input
                        id="rx-diagnosis"
                        placeholder="e.g., Acute bronchitis, Type 2 Diabetes..."
                        value={prescriptionDiagnosis}
                        onChange={e => setPrescriptionDiagnosis(e.target.value)}
                        className="text-sm"
                      />
                    </div>

                    {/* Medicines */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Medicines *</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={addPrescriptionMedicine}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Medicine
                        </Button>
                      </div>

                      {prescriptionMedicines.length === 0 && (
                        <div className="rounded-md border border-dashed p-4 text-center">
                          <Pill className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                          <p className="text-xs text-muted-foreground">No medicines added yet. Click &quot;Add Medicine&quot; to begin.</p>
                        </div>
                      )}

                      <ScrollArea className="max-h-64">
                        <div className="space-y-3">
                          {prescriptionMedicines.map((med, idx) => (
                            <div key={med.id} className="rounded-md border bg-background p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Medicine #{idx + 1}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={() => removePrescriptionMedicine(med.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Input
                                placeholder="Medicine name *"
                                value={med.medicine}
                                onChange={e => updatePrescriptionMedicine(med.id, 'medicine', e.target.value)}
                                className="h-8 text-sm"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="Dosage (e.g., 500mg)"
                                  value={med.dosage}
                                  onChange={e => updatePrescriptionMedicine(med.id, 'dosage', e.target.value)}
                                  className="h-8 text-sm"
                                />
                                <Select value={med.frequency} onValueChange={v => updatePrescriptionMedicine(med.id, 'frequency', v)}>
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Frequency" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FREQUENCY_OPTIONS.map(f => (
                                      <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Select value={med.duration} onValueChange={v => updatePrescriptionMedicine(med.id, 'duration', v)}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Duration" />
                                </SelectTrigger>
                                <SelectContent>
                                  {DURATION_OPTIONS.map(d => (
                                    <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Prescription Notes */}
                    <div className="space-y-1">
                      <Label htmlFor="rx-notes" className="text-xs">Additional Notes (optional)</Label>
                      <Textarea
                        id="rx-notes"
                        placeholder="Any additional instructions for the patient..."
                        value={prescriptionNotes}
                        onChange={e => setPrescriptionNotes(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* ─── Invoice Creation Form ───────────────────────────────── */}
                {showInvoiceForm && (
                  <div className="space-y-4 rounded-lg border border-orange-200 dark:border-orange-800/40 bg-orange-50/50 dark:bg-orange-950/20 p-4">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-orange-600" />
                      <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                        Create Invoice
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add items to generate the invoice. The visit will auto-advance to &quot;Billed&quot; stage.
                    </p>

                    {/* Insurance Info Display */}
                    {billingSummary?.insuranceProvider && (
                      <div className="flex items-center gap-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                        <Shield className="h-4 w-4 text-violet-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
                            Insurance: {billingSummary.insuranceProvider}
                          </p>
                          {billingSummary.insuranceNumber && (
                            <p className="text-xs text-muted-foreground">
                              Policy: {billingSummary.insuranceNumber}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs border-violet-300 text-violet-600 shrink-0">
                          Insured
                        </Badge>
                      </div>
                    )}

                    {/* Auto-Populate Info Banner */}
                    {isLoadingSummary && (
                      <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Loading billing summary from visit...
                        </p>
                      </div>
                    )}
                    {!isLoadingSummary && billingSummary && billingSummary.items.length > 0 && (
                      <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3">
                        <Info className="h-4 w-4 text-blue-600 shrink-0" />
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Auto-populated from visit: {billingSummary.items.length} items ({formatCurrency(billingSummary.totals.grandTotal)})
                        </p>
                      </div>
                    )}

                    {/* Quick Add Section */}
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQuickAdd(!showQuickAdd)}
                        className="w-full justify-start"
                      >
                        <Plus className="h-3.5 w-3.5 mr-2" />
                        Quick-Add Service Item
                      </Button>

                      {showQuickAdd && (
                        <div className="rounded-md border bg-background p-3 space-y-2">
                          <Input
                            placeholder="Search services, tests, medicines..."
                            value={quickAddFilter}
                            onChange={e => setQuickAddFilter(e.target.value)}
                            className="text-sm"
                          />
                          <ScrollArea className="max-h-48">
                            <div className="space-y-1">
                              {filteredQuickAdd.map((item, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  className="w-full text-left flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-muted/60 transition-colors"
                                  onClick={() => addQuickItem(item)}
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', typeColorMap[item.type])}>
                                      {item.type}
                                    </Badge>
                                    <span className="text-sm">{item.description}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{formatCurrency(item.unitPrice)}</span>
                                    <span className="text-[10px]">({item.gstRate}% GST)</span>
                                  </div>
                                </button>
                              ))}
                              {filteredQuickAdd.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-2">No matching items found</p>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </div>

                    {/* Invoice Items Table */}
                    {invoiceItems.length > 0 && (
                      <div className="space-y-2">
                        <div className="rounded-md border">
                          <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/40 border-b">
                            <div className="col-span-4">Description</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-2 text-right">Unit Price</div>
                            <div className="col-span-1 text-center">GST%</div>
                            <div className="col-span-2 text-right">Line Total</div>
                            <div className="col-span-1" />
                          </div>
                          <ScrollArea className="max-h-52">
                            {invoiceItems.map(item => {
                              const lineTotal = parseFloat((item.unitPrice * item.quantity * (1 + item.gstRate / 100)).toFixed(2))
                              return (
                                <div key={item.id} className="border-b last:border-b-0">
                                  {/* Desktop row */}
                                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-2 items-center text-sm">
                                    <div className="col-span-4">
                                      <Input
                                        value={item.description}
                                        onChange={e => updateItem(item.id, 'description', e.target.value)}
                                        placeholder="Item description"
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={e => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                        className="h-8 text-sm text-center"
                                        min={1}
                                      />
                                    </div>
                                    <div className="col-span-2">
                                      <Input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={e => updateItem(item.id, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="h-8 text-sm text-right"
                                        min={0}
                                      />
                                    </div>
                                    <div className="col-span-1">
                                      <Select
                                        value={String(item.gstRate)}
                                        onValueChange={v => updateItem(item.id, 'gstRate', parseInt(v))}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="0">0%</SelectItem>
                                          <SelectItem value="5">5%</SelectItem>
                                          <SelectItem value="12">12%</SelectItem>
                                          <SelectItem value="18">18%</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="col-span-2 text-right font-medium text-sm">
                                      {formatCurrency(lineTotal)}
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => removeItem(item.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  {/* Mobile row */}
                                  <div className="sm:hidden px-3 py-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0', typeColorMap[item.type])}>
                                        {item.type}
                                      </Badge>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-destructive hover:text-destructive"
                                        onClick={() => removeItem(item.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <Input
                                      value={item.description}
                                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                                      placeholder="Item description"
                                      className="h-8 text-sm"
                                    />
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <Label className="text-[10px]">Qty</Label>
                                        <Input
                                          type="number"
                                          value={item.quantity}
                                          onChange={e => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                          className="h-8 text-sm"
                                          min={1}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px]">Price</Label>
                                        <Input
                                          type="number"
                                          value={item.unitPrice}
                                          onChange={e => updateItem(item.id, 'unitPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                                          className="h-8 text-sm"
                                          min={0}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-[10px]">GST</Label>
                                        <Select
                                          value={String(item.gstRate)}
                                          onValueChange={v => updateItem(item.id, 'gstRate', parseInt(v))}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="0">0%</SelectItem>
                                            <SelectItem value="5">5%</SelectItem>
                                            <SelectItem value="12">12%</SelectItem>
                                            <SelectItem value="18">18%</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="text-right text-sm font-medium">
                                      {formatCurrency(lineTotal)}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </ScrollArea>
                        </div>

                        {/* Add Custom Item */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addCustomItem}
                          className="text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Custom Item
                        </Button>

                        {/* Totals */}
                        <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">CGST</span>
                            <span>{formatCurrency(totals.cgst)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">SGST</span>
                            <span>{formatCurrency(totals.sgst)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total GST</span>
                            <span className="font-medium">{formatCurrency(totals.totalGst)}</span>
                          </div>
                          <Separator />
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs text-muted-foreground shrink-0">Discount (₹)</Label>
                            <Input
                              type="number"
                              value={invoiceDiscount || ''}
                              onChange={e => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                              className="h-7 text-sm w-28 text-right"
                              min={0}
                              placeholder="0"
                            />
                          </div>
                          <Separator />
                          <div className="flex justify-between font-bold text-base">
                            <span>Grand Total</span>
                            <span className="text-emerald-700 dark:text-emerald-400">{formatCurrency(totals.grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Invoice Notes */}
                    <div className="space-y-1">
                      <Label htmlFor="invoice-notes" className="text-xs">Invoice Notes (optional)</Label>
                      <Textarea
                        id="invoice-notes"
                        placeholder="Notes for the invoice..."
                        value={invoiceNotes}
                        onChange={e => setInvoiceNotes(e.target.value)}
                        rows={2}
                        className="resize-none text-sm"
                      />
                    </div>

                    <Separator />

                    {/* Bill & Collect Payment Toggle */}
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                        <div>
                          <p className="text-sm font-medium">Bill & Collect Payment</p>
                          <p className="text-xs text-muted-foreground">Create invoice and record payment in one step</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={billAndPay ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setBillAndPay(!billAndPay)}
                        className={billAndPay ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        {billAndPay ? 'Enabled' : 'Enable'}
                      </Button>
                    </div>

                    {/* Bill & Pay — Payment Details */}
                    {billAndPay && (
                      <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
                        <Label className="text-sm font-semibold">Payment Details</Label>

                        {/* Auto-filled Payment Amount */}
                        <div className="space-y-1">
                          <Label htmlFor="bill-pay-amount" className="text-xs text-muted-foreground">
                            Payment Amount (auto-filled)
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                            <Input
                              id="bill-pay-amount"
                              type="number"
                              value={totals.grandTotal || ''}
                              className="pl-7 text-sm bg-muted/50"
                              min={0}
                              step={0.01}
                              disabled
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Matches the invoice grand total above
                          </p>
                        </div>

                        {/* Payment Method Selector */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Payment Method</Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {PAYMENT_METHODS.map(method => (
                              <button
                                key={method.value}
                                type="button"
                                className={cn(
                                  'flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-all',
                                  billPayMethod === method.value
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                    : 'border-border hover:bg-muted/50'
                                )}
                                onClick={() => setBillPayMethod(method.value)}
                              >
                                <span className="text-base">{method.icon}</span>
                                <span className="text-xs font-medium">{method.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Payment Recording Form ───────────────────────────────── */}
                {showPaymentForm && (
                  <div className="space-y-4 rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        Record Payment
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Record payment for the patient&apos;s invoice. The visit will auto-advance to &quot;Paid&quot; stage.
                    </p>

                    {/* Invoice info */}
                    {invoiceData && (
                      <div className="rounded-md border bg-background p-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          <span>Invoice: <span className="font-medium text-foreground">{invoiceData.invoiceNumber}</span></span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Total</span>
                          <span className="font-medium">{formatCurrency(invoiceData.grandTotal)}</span>
                        </div>
                        {invoiceData.paidAmount > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Already Paid</span>
                            <span>{formatCurrency(invoiceData.paidAmount)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Balance Due</span>
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(parseFloat((invoiceData.grandTotal - invoiceData.paidAmount).toFixed(2)))}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Payment Amount */}
                    <div className="space-y-1">
                      <Label htmlFor="payment-amount">Payment Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                        <Input
                          id="payment-amount"
                          type="number"
                          value={paymentAmount || ''}
                          onChange={e => setPaymentAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="pl-7"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                        />
                      </div>
                      {invoiceData && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs mt-1"
                          onClick={() => {
                            const balance = parseFloat((invoiceData.grandTotal - invoiceData.paidAmount).toFixed(2))
                            setPaymentAmount(balance)
                          }}
                        >
                          Pay Full Amount ({formatCurrency(parseFloat((invoiceData.grandTotal - invoiceData.paidAmount).toFixed(2)))})
                        </Button>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1">
                      <Label>Payment Method</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PAYMENT_METHODS.map(method => (
                          <button
                            key={method.value}
                            type="button"
                            className={cn(
                              'flex items-center gap-2 px-3 py-2.5 rounded-md border text-sm transition-all',
                              paymentMethod === method.value
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                                : 'border-border hover:bg-muted/50'
                            )}
                            onClick={() => setPaymentMethod(method.value)}
                          >
                            <span className="text-base">{method.icon}</span>
                            <span className="text-xs font-medium">{method.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes (only for non-special stages) */}
                {!showInvoiceForm && !showPaymentForm && !showLabOrderForm && !showPrescriptionForm && (
                  <div className="space-y-2">
                    <Label htmlFor="transition-notes">Transition Notes (optional)</Label>
                    <Textarea
                      id="transition-notes"
                      placeholder="Add any notes about this transition..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                )}
              </div>
            </ScrollArea>

            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdvance}
                disabled={!canSubmit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : showInvoiceForm && billAndPay ? (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Bill & Collect Payment
                  </>
                ) : showInvoiceForm ? (
                  <>
                    <Receipt className="h-4 w-4 mr-2" />
                    Create Invoice & Advance
                  </>
                ) : showLabOrderForm ? (
                  <>
                    <TestTube2 className="h-4 w-4 mr-2" />
                    Order Tests & Advance
                  </>
                ) : showPrescriptionForm ? (
                  <>
                    <Pill className="h-4 w-4 mr-2" />
                    Create Prescription & Advance
                  </>
                ) : showPaymentForm ? (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Record Payment & Advance
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Advance Stage
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}