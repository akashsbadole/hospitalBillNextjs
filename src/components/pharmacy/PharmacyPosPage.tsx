'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { apiGet, apiPost, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useNavigation } from '@/stores/navigation'
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
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
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
  ShoppingCart,
  Pill,
  IndianRupee,
  Plus,
  Minus,
  Trash2,
  Search,
  Loader2,
  User,
  Smartphone,
  CreditCard,
  Banknote,
  Receipt,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Printer,
  X,
  ChevronDown,
  ChevronUp,
  Phone,
  UserPlus,
} from 'lucide-react'

interface Medicine {
  id: string
  medicineId: string
  name: string
  category: string | null
  manufacturer: string | null
  batchNumber: string | null
  expiryDate: string | null
  purchasePrice: number
  sellingPrice: number
  stock: number
  minStock: number
  gstRate: number
  status: string
}

interface CartItem {
  medicine: Medicine
  quantity: number
}

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string | null
}

interface SaleRecord {
  id: string
  saleId: string
  patientName: string | null
  patientPhone: string | null
  items: number
  subtotal: number
  discount: number
  grandTotal: number
  paymentMethod: string
  amountTendered: number
  changeAmount: number
  createdAt: string
}

type PaymentMethod = 'Cash' | 'UPI' | 'Card'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const QUICK_PAY_AMOUNTS = [500, 1000, 2000, 5000]

export function PharmacyPosPage() {
  const { toast } = useToast()
  const { setCurrentPage } = useNavigation()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Medicine[]>([])
  const [showResults, setShowResults] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [walkinName, setWalkinName] = useState('')
  const [walkinPhone, setWalkinPhone] = useState('')
  const [patientMode, setPatientMode] = useState<'walkin' | 'search'>('walkin')
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const patientSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptData, setReceiptData] = useState<{
    saleId: string
    items: { name: string; qty: number; price: number; total: number }[]
    subtotal: number
    discount: number
    grandTotal: number
    paymentMethod: string
    amountTendered: number
    changeAmount: number
    patientName: string | null
    date: string
  } | null>(null)

  const [recentSales, setRecentSales] = useState<SaleRecord[]>([])
  const [recentSalesLoading, setRecentSalesLoading] = useState(true)

  const subtotal = cart.reduce((sum, item) => sum + item.medicine.sellingPrice * item.quantity, 0)
  const discountValue = parseFloat(discount) || 0
  const grandTotal = Math.max(0, subtotal - discountValue)
  const tenderedValue = parseFloat(amountTendered) || 0
  const changeAmount = Math.max(0, tenderedValue - grandTotal)
  const isCartValid = cart.length > 0

  const fetchRecentSales = useCallback(async () => {
    setRecentSalesLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<SaleRecord>>('/pharmacy-sales', { limit: 10 })
      setRecentSales(res.data)
    } catch {
      // ignore
    } finally {
      setRecentSalesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRecentSales()
  }, [fetchRecentSales])

  const searchMedicines = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    try {
      const res = await apiGet<PaginatedResponse<Medicine>>('/medicines/search', { q, limit: 10 })
      setSearchResults(res.data.filter((m) => m.stock > 0 && (m.status === 'Active' || !m.status)))
      setShowResults(true)
    } catch {
      setSearchResults([])
    }
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => searchMedicines(value), 300)
  }

  const addToCart = (medicine: Medicine) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.medicine.id === medicine.id)
      if (existing) {
        if (existing.quantity >= medicine.stock) {
          toast({ title: 'Limit reached', description: `Only ${medicine.stock} units available`, variant: 'destructive' })
          return prev
        }
        return prev.map((item) =>
          item.medicine.id === medicine.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { medicine, quantity: 1 }]
    })
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)
    searchInputRef.current?.focus()
  }

  const updateQuantity = (medicineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.medicine.id !== medicineId) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          if (newQty > item.medicine.stock) {
            toast({ title: 'Limit reached', description: `Only ${item.medicine.stock} units available`, variant: 'destructive' })
            return item
          }
          return { ...item, quantity: newQty }
        })
        .filter(Boolean) as CartItem[]
    )
  }

  const removeFromCart = (medicineId: string) => {
    setCart((prev) => prev.filter((item) => item.medicine.id !== medicineId))
  }

  const clearCart = () => {
    setCart([])
    setDiscount('')
    setAmountTendered('')
    setPaymentMethod('Cash')
  }

  const searchPatients = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setPatientResults([])
      return
    }
    try {
      const res = await apiGet<PaginatedResponse<Patient>>('/patients', { search: q, limit: 10 })
      setPatientResults(res.data)
    } catch {
      setPatientResults([])
    }
  }, [])

  const handlePatientSearchChange = (value: string) => {
    setPatientSearch(value)
    if (patientSearchTimerRef.current) clearTimeout(patientSearchTimerRef.current)
    patientSearchTimerRef.current = setTimeout(() => searchPatients(value), 300)
  }

  const selectPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setPatientSearch(patient.name)
    setShowPatientDropdown(false)
  }

  const handleCompleteSale = async () => {
    if (!isCartValid) return
    if (discountValue > subtotal) {
      toast({ title: 'Error', description: 'Discount cannot exceed subtotal', variant: 'destructive' })
      return
    }
    if (paymentMethod !== 'Cash' && !amountTendered) {
      toast({ title: 'Error', description: 'Amount tendered is required for UPI/Card payments', variant: 'destructive' })
      return
    }
    if (paymentMethod === 'Cash' && tenderedValue < grandTotal) {
      toast({ title: 'Error', description: 'Amount tendered is less than grand total', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiPost<SingleResponse<{ id: string; saleId: string }>>('/pharmacy-sales', {
        items: cart.map((item) => ({
          medicineId: item.medicine.id,
          medicineName: item.medicine.name,
          batchNumber: item.medicine.batchNumber,
          quantity: item.quantity,
          unitPrice: item.medicine.sellingPrice,
          total: item.medicine.sellingPrice * item.quantity,
          gstRate: item.medicine.gstRate,
        })),
        subtotal,
        discount: discountValue,
        grandTotal,
        paymentMethod,
        amountTendered: tenderedValue,
        changeAmount,
        patientId: selectedPatient?.id || null,
        patientName: selectedPatient?.name || walkinName || null,
        patientPhone: selectedPatient?.phone || walkinPhone || null,
      })

      setReceiptData({
        saleId: res.data.saleId,
        items: cart.map((item) => ({
          name: item.medicine.name,
          qty: item.quantity,
          price: item.medicine.sellingPrice,
          total: item.medicine.sellingPrice * item.quantity,
        })),
        subtotal,
        discount: discountValue,
        grandTotal,
        paymentMethod,
        amountTendered: tenderedValue,
        changeAmount,
        patientName: selectedPatient?.name || walkinName || null,
        date: new Date().toISOString(),
      })
      setReceiptOpen(true)
      clearCart()
      setSelectedPatient(null)
      setWalkinName('')
      setWalkinPhone('')
      setPatientSearch('')
      fetchRecentSales()
      toast({ title: 'Sale complete', description: `Invoice ${res.data.saleId} created successfully!` })
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const setQuickAmount = (amount: number) => {
    setAmountTendered(String(amount))
  }

  const cartSidebar = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              Sale Cart
            </CardTitle>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500" onClick={clearCart}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
          <CardDescription>{cart.length} item{cart.length !== 1 ? 's' : ''} in cart</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Cart is empty</p>
              <p className="text-xs">Search and add medicines</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[320px] overflow-y-auto">
              {cart.map((item) => (
                <div key={item.medicine.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.medicine.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Batch: {item.medicine.batchNumber || '-'} | ₹{item.medicine.sellingPrice}/unit
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 shrink-0" onClick={() => removeFromCart(item.medicine.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.medicine.id, -1)} disabled={item.quantity <= 1}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.medicine.id, 1)} disabled={item.quantity >= item.medicine.stock}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-sm font-semibold">{formatCurrency(item.medicine.sellingPrice * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor="discount" className="text-xs">Discount (₹)</Label>
              <Input
                id="discount"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-500">-{formatCurrency(discountValue)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Grand Total</span>
                <span className="text-emerald-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            Patient
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={patientMode === 'walkin' ? 'default' : 'outline'}
              className={cn('flex-1', patientMode === 'walkin' ? 'bg-emerald-600 hover:bg-emerald-700' : '')}
              onClick={() => setPatientMode('walkin')}
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Walk-in
            </Button>
            <Button
              size="sm"
              variant={patientMode === 'search' ? 'default' : 'outline'}
              className={cn('flex-1', patientMode === 'search' ? 'bg-emerald-600 hover:bg-emerald-700' : '')}
              onClick={() => setPatientMode('search')}
            >
              <Search className="mr-1.5 h-3.5 w-3.5" />
              Search
            </Button>
          </div>

          {patientMode === 'walkin' ? (
            <div className="space-y-2">
              <Input
                placeholder="Patient name"
                value={walkinName}
                onChange={(e) => setWalkinName(e.target.value)}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Phone number"
                value={walkinPhone}
                onChange={(e) => setWalkinPhone(e.target.value)}
                className="h-8 text-sm"
                type="tel"
              />
            </div>
          ) : (
            <div className="relative">
              <Input
                placeholder="Search patient..."
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value)
                  handlePatientSearchChange(e.target.value)
                }}
                onFocus={() => patientResults.length > 0 && setShowPatientDropdown(true)}
                onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
                className="h-8 text-sm pl-8"
              />
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              {showPatientDropdown && patientResults.length > 0 && (
                <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
                  <CardContent className="p-2 max-h-48 overflow-y-auto">
                    {patientResults.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                        onMouseDown={() => selectPatient(p)}
                      >
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.patientId}{p.phone ? ` | ${p.phone}` : ''}</p>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
              {selectedPatient && (
                <div className="flex items-center justify-between mt-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5">
                  <div>
                    <p className="text-xs font-medium">{selectedPatient.name}</p>
                    <p className="text-[10px] text-muted-foreground">{selectedPatient.patientId}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setSelectedPatient(null); setPatientSearch('') }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
            Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map((method) => (
              <Button
                key={method}
                size="sm"
                variant={paymentMethod === method ? 'default' : 'outline'}
                className={cn(
                  'flex-1',
                  paymentMethod === method && method === 'Cash' && 'bg-emerald-600 hover:bg-emerald-700',
                  paymentMethod === method && method === 'UPI' && 'bg-blue-600 hover:bg-blue-700',
                  paymentMethod === method && method === 'Card' && 'bg-purple-600 hover:bg-purple-700',
                )}
                onClick={() => setPaymentMethod(method)}
              >
                {method === 'Cash' && <Banknote className="mr-1.5 h-3.5 w-3.5" />}
                {method === 'UPI' && <Smartphone className="mr-1.5 h-3.5 w-3.5" />}
                {method === 'Card' && <CreditCard className="mr-1.5 h-3.5 w-3.5" />}
                {method}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tendered" className="text-xs">Amount Tendered</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="tendered"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                className="h-8 text-sm pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PAY_AMOUNTS.map((amt) => (
              <Button key={amt} variant="outline" size="sm" className="h-7 text-xs" onClick={() => setQuickAmount(amt)}>
                ₹{amt.toLocaleString('en-IN')}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setQuickAmount(grandTotal)}>
              Exact
            </Button>
          </div>

          {tenderedValue >= grandTotal && grandTotal > 0 && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-2 text-center">
              <p className="text-xs text-muted-foreground">Change Due</p>
              <p className="text-lg font-bold text-emerald-600">{formatCurrency(changeAmount)}</p>
            </div>
          )}

          <Button
            className={cn(
              'w-full',
              paymentMethod === 'Cash' && 'bg-emerald-600 hover:bg-emerald-700',
              paymentMethod === 'UPI' && 'bg-blue-600 hover:bg-blue-700',
              paymentMethod === 'Card' && 'bg-purple-600 hover:bg-purple-700',
            )}
            size="lg"
            disabled={!isCartValid || isSubmitting}
            onClick={handleCompleteSale}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Receipt className="mr-2 h-5 w-5" />
            )}
            Complete Sale — {formatCurrency(grandTotal)}
          </Button>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pharmacy POS</h1>
        <p className="text-sm text-muted-foreground">Point of Sale counter for medicine sales</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search medicine by name or barcode..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  className="pl-11 h-12 text-base"
                  autoFocus
                />
              </div>

              {showResults && searchResults.length > 0 && (
                <Card className="mt-2 shadow-lg border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-2 max-h-72 overflow-y-auto">
                    {searchResults.map((med) => (
                      <button
                        key={med.id}
                        className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted transition-colors flex items-center justify-between gap-4"
                        onMouseDown={() => addToCart(med)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{med.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {med.manufacturer || ''}{med.batchNumber ? ` | Batch: ${med.batchNumber}` : ''} | Stock: {med.stock}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-emerald-600">{formatCurrency(med.sellingPrice)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            GST: {med.gstRate}%
                          </p>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {searchQuery && !showResults && searchResults.length === 0 && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Pill className="h-4 w-4 mr-2" />
                  No medicines found. Try a different search term.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="xl:hidden">{cartSidebar}</div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-5 w-5 text-muted-foreground" />
                Recent Sales
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSalesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recentSales.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-muted-foreground">
                  <Receipt className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No recent sales</p>
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {recentSales.map((sale) => (
                    <AccordionItem key={sale.id} value={sale.id}>
                      <AccordionTrigger className="py-2.5">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-semibold">{sale.saleId}</span>
                            <span className="text-sm">{sale.patientName || 'Walk-in'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{sale.items} item{sale.items !== 1 ? 's' : ''}</span>
                            <span className="font-semibold text-emerald-600">{formatCurrency(sale.grandTotal)}</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 gap-3 text-sm pb-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Sale ID</p>
                            <p className="font-mono text-xs">{sale.saleId}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Date</p>
                            <p className="text-xs">{formatDateTime(sale.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Payment</p>
                            <p className="font-medium">{sale.paymentMethod}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Tendered</p>
                            <p>{formatCurrency(sale.amountTendered)}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="hidden xl:block">{cartSidebar}</div>
      </div>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Sale Complete
            </DialogTitle>
            <DialogDescription>
              Invoice {receiptData?.saleId}
            </DialogDescription>
          </DialogHeader>

          {receiptData && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="text-center border-b pb-2">
                  <p className="text-sm font-bold">MediBill Pharmacy</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(receiptData.date)}</p>
                  {receiptData.patientName && (
                    <p className="text-xs text-muted-foreground mt-0.5">Patient: {receiptData.patientName}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  {receiptData.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="flex-1">
                        {item.name}{' '}
                        <span className="text-muted-foreground">x{item.qty}</span>
                      </span>
                      <span className="font-medium">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(receiptData.subtotal)}</span>
                  </div>
                  {receiptData.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-500">-{formatCurrency(receiptData.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span className="text-emerald-600">{formatCurrency(receiptData.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid via</span>
                    <span>{receiptData.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tendered</span>
                    <span>{formatCurrency(receiptData.amountTendered)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Change</span>
                    <span className="font-medium">{formatCurrency(receiptData.changeAmount)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print Receipt
                </Button>
                <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setReceiptOpen(false)}>
                  New Sale
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
