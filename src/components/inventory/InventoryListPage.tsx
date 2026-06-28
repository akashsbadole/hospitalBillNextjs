'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { MEDICINE_CATEGORIES, GST_SLABS } from '@/lib/constants'
import { apiGet, apiPost, apiPut, apiDelete, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
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
import { Label } from '@/components/ui/label'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Plus,
  Package,
  AlertTriangle,
  Clock,
  Pill,
  ArrowUpDown,
  Filter,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  IndianRupee,
  Trash2,
  Loader2,
  RefreshCw,
  Search as SearchIcon,
  Eye,
  PackageCheck,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  CalendarX,
  Wrench,
  FileText,
  ArrowUpRight,
  TimerReset,
  Minus,
  Upload,
} from 'lucide-react'
import { ImportCsvDialog } from '@/components/ImportCsvDialog'

// ==================== TYPES ====================

type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Expired'

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
  hsnCode: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface Supplier {
  id: string
  supplierId: string
  name: string
  contact: string | null
  email: string | null
  address?: string | null
  gstin?: string | null
}

interface POItem {
  id: string
  poId: string
  medicineId: string
  quantity: number
  unitPrice: number
  receivedQty: number
  total: number
  createdAt: string
  medicine: { id: string; medicineId: string; name: string; category?: string | null; manufacturer?: string | null }
}

interface PurchaseOrder {
  id: string
  poId: string
  supplierId: string
  status: string
  orderDate: string
  expectedDate: string | null
  notes: string | null
  totalAmount: number
  receivedAmount: number
  createdAt: string
  updatedAt: string
  supplier: Supplier
  items: POItem[]
}

interface StockMovement {
  id: string
  movementId: string
  medicineId: string
  type: string
  quantity: number
  referenceId: string | null
  notes: string | null
  createdAt: string
  medicine: { id: string; medicineId: string; name: string; category: string | null; manufacturer: string | null }
}

// ==================== HELPERS ====================

function getStockStatus(med: Medicine): StockStatus {
  if (med.expiryDate) {
    const expiryDate = new Date(med.expiryDate + 'T00:00:00')
    if (expiryDate < new Date()) return 'Expired'
  }
  if (med.stock <= 0) return 'Out of Stock'
  if (med.stock <= med.minStock) return 'Low Stock'
  return 'In Stock'
}

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  const expiry = new Date(expiryDate + 'T00:00:00')
  const diff = expiry.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function StockStatusBadge({ status }: { status: StockStatus }) {
  const config: Record<StockStatus, { className: string; icon: React.ElementType }> = {
    'In Stock': { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', icon: CheckCircle2 },
    'Low Stock': { className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800', icon: AlertTriangle },
    'Out of Stock': { className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800', icon: XCircle },
    'Expired': { className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700', icon: Clock },
  }
  const { className, icon: Icon } = config[status]
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

function POStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    Submitted: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    Approved: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    'Partially Received': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
    Received: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    Cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  }
  return (
    <Badge variant="outline" className={config[status] || 'bg-gray-100 text-gray-700 border-gray-200'}>
      {status}
    </Badge>
  )
}

function StockMovementTypeBadge({ type }: { type: string }) {
  const config: Record<string, { className: string; icon: React.ElementType }> = {
    Purchase: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', icon: TrendingUp },
    Sale: { className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800', icon: TrendingDown },
    Return: { className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800', icon: RotateCcw },
    Adjustment: { className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800', icon: Wrench },
    Expiry: { className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700', icon: CalendarX },
  }
  const { className, icon: Icon } = config[type] || { className: 'bg-gray-100 text-gray-700 border-gray-200', icon: FileText }
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {type}
    </Badge>
  )
}

function StockBar({ stock, minStock }: { stock: number; minStock: number }) {
  const doubleMin = minStock * 2
  const maxRef = doubleMin > 0 ? doubleMin : 1
  const ratio = Math.min(stock / maxRef, 1)
  const isOut = stock <= 0
  const isCritical = stock > 0 && stock <= minStock
  const isWarning = stock > minStock && stock <= doubleMin

  const barColor = isOut ? 'bg-red-500' : isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = isOut ? 'text-red-600' : isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-semibold min-w-[24px] ${textColor}`}>
        {stock}
      </span>
      <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">/ {minStock} min</span>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ==================== MAIN COMPONENT ====================

export function InventoryListPage() {
  const { toast } = useToast()

  // ===== TAB STATE =====
  const [activeTab, setActiveTab] = useState('inventory')

  // ===== INVENTORY TAB STATE =====
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [stockFilter, setStockFilter] = useState<string>('')
  const [expiryFilter, setExpiryFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedSearch = useRef('')

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [stockDialogMed, setStockDialogMed] = useState<Medicine | null>(null)
  const [stockValue, setStockValue] = useState('')
  const [isSubmittingStock, setIsSubmittingStock] = useState(false)
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Quick Stock Adjustment state
  const [quickAdjustMed, setQuickAdjustMed] = useState<Medicine | null>(null)
  const [quickAdjustType, setQuickAdjustType] = useState<string>('Add Stock')
  const [quickAdjustQty, setQuickAdjustQty] = useState('')
  const [quickAdjustReason, setQuickAdjustReason] = useState('')
  const [quickAdjustRef, setQuickAdjustRef] = useState('')
  const [quickAdjustSubmitting, setQuickAdjustSubmitting] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newManufacturer, setNewManufacturer] = useState('')
  const [newBatchNumber, setNewBatchNumber] = useState('')
  const [newExpiryDate, setNewExpiryDate] = useState('')
  const [newPurchasePrice, setNewPurchasePrice] = useState('')
  const [newSellingPrice, setNewSellingPrice] = useState('')
  const [newStock, setNewStock] = useState('')
  const [newMinStock, setNewMinStock] = useState('')
  const [newGstRate, setNewGstRate] = useState('12')
  const [newHsnCode, setNewHsnCode] = useState('')

  const limit = 20

  // ===== PO TAB STATE =====
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [poTotal, setPoTotal] = useState(0)
  const [poTotalPages, setPoTotalPages] = useState(1)
  const [poPage, setPoPage] = useState(1)
  const [poStatusFilter, setPoStatusFilter] = useState<string>('')
  const [poLoading, setPoLoading] = useState(true)

  const [poCreateDialogOpen, setPoCreateDialogOpen] = useState(false)
  const [poDetailDialogOpen, setPoDetailDialogOpen] = useState(false)
  const [poReceiveDialogOpen, setPoReceiveDialogOpen] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)

  // PO Create form
  const [poSuppliers, setPoSuppliers] = useState<Supplier[]>([])
  const [poFormSupplierId, setPoFormSupplierId] = useState('')
  const [poFormOrderDate, setPoFormOrderDate] = useState('')
  const [poFormExpectedDate, setPoFormExpectedDate] = useState('')
  const [poFormNotes, setPoFormNotes] = useState('')
  const [poFormItems, setPoFormItems] = useState<{ medicineId: string; quantity: string; unitPrice: string }[]>([
    { medicineId: '', quantity: '', unitPrice: '' },
  ])
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([])
  const [poFormSubmitting, setPoFormSubmitting] = useState(false)

  // PO Receive form
  const [receiveItems, setReceiveItems] = useState<{ itemId: string; receivedQty: string }[]>([])
  const [receiveSubmitting, setReceiveSubmitting] = useState(false)

  // ===== STOCK MOVEMENTS TAB STATE =====
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [smTotal, setSmTotal] = useState(0)
  const [smTotalPages, setSmTotalPages] = useState(1)
  const [smPage, setSmPage] = useState(1)
  const [smTypeFilter, setSmTypeFilter] = useState<string>('')
  const [smMedicineFilter, setSmMedicineFilter] = useState<string>('')
  const [smLoading, setSmLoading] = useState(true)

  // ===== STATS STATE =====
  const [statsLoading, setStatsLoading] = useState(true)
  const [inventoryStats, setInventoryStats] = useState({
    lowStockCount: 0,
    outOfStockCount: 0,
  })
  const [lowStockMedicines, setLowStockMedicines] = useState<Medicine[]>([])

  // ===== DATA FETCHING =====

  const fetchMedicines = useCallback(async (search?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const params: Record<string, string | number> = { page, limit }
      const s = search !== undefined ? search : debouncedSearch.current
      if (s) params.search = s
      if (categoryFilter) params.category = categoryFilter
      if (stockFilter) params.stockStatus = stockFilter

      const res = await apiGet<PaginatedResponse<Medicine>>('/medicines', params)
      setMedicines(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        setError(err.message)
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [page, categoryFilter, stockFilter, toast])

   
  useEffect(() => {
    if (activeTab === 'inventory') // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMedicines()
  }, [fetchMedicines, activeTab])

  const fetchPurchaseOrders = useCallback(async () => {
    setPoLoading(true)
    try {
      const params: Record<string, string | number> = { page: poPage, limit: 20 }
      if (poStatusFilter) params.status = poStatusFilter
      const res = await apiGet<PaginatedResponse<PurchaseOrder>>('/inventory/purchase-orders', params)
      setPurchaseOrders(res.data)
      setPoTotal(res.total)
      setPoTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setPoLoading(false)
    }
  }, [poPage, poStatusFilter, toast])

   
  useEffect(() => {
    if (activeTab === 'purchase-orders') // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPurchaseOrders()
  }, [fetchPurchaseOrders, activeTab])

  const fetchStockMovements = useCallback(async () => {
    setSmLoading(true)
    try {
      const params: Record<string, string | number> = { page: smPage, limit: 20 }
      if (smTypeFilter) params.type = smTypeFilter
      if (smMedicineFilter) params.medicineId = smMedicineFilter
      const res = await apiGet<PaginatedResponse<StockMovement>>('/inventory/stock-movements', params)
      setStockMovements(res.data)
      setSmTotal(res.total)
      setSmTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setSmLoading(false)
    }
  }, [smPage, smTypeFilter, smMedicineFilter, toast])

   
  useEffect(() => {
    if (activeTab === 'stock-movements') // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStockMovements()
  }, [fetchStockMovements, activeTab])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const [lowRes, outRes] = await Promise.all([
        apiGet<PaginatedResponse<Medicine>>('/medicines', { stockStatus: 'Low Stock', limit: 1 }),
        apiGet<PaginatedResponse<Medicine>>('/medicines', { stockStatus: 'Out of Stock', limit: 1 }),
      ])
      setInventoryStats({
        lowStockCount: lowRes.total || 0,
        outOfStockCount: outRes.total || 0,
      })
      // Fetch all low stock / out of stock medicines for the alert cards
      const [lowMeds, outMeds] = await Promise.all([
        apiGet<PaginatedResponse<Medicine>>('/medicines', { stockStatus: 'Low Stock', limit: 50 }),
        apiGet<PaginatedResponse<Medicine>>('/medicines', { stockStatus: 'Out of Stock', limit: 50 }),
      ])
      const combined = [...lowMeds.data, ...outMeds.data].sort((a, b) => a.stock - b.stock)
      setLowStockMedicines(combined)
    } catch (err) {
      console.error('[InventoryList] stats error:', err)
    } finally {
      setStatsLoading(false)
    }
  }, [])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
  }, [fetchStats])

  const fetchAllMedicines = useCallback(async () => {
    try {
      const res = await apiGet<PaginatedResponse<Medicine>>('/medicines', { limit: 200, status: 'Active' })
      setAllMedicines(res.data)
    } catch {
      // ignore
    }
  }, [])

  const fetchSuppliers = useCallback(async () => {
    try {
      const res = await apiGet<{ data: Supplier[] }>('/inventory/suppliers')
      if (res?.data) {
        setPoSuppliers(res.data)
      }
    } catch {
      // If no supplier endpoint, suppliers will be empty
    }
  }, [])

  // ===== SEARCH DEBOUNCE =====
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      debouncedSearch.current = value
      setPage(1)
      fetchMedicines(value)
    }, 300)
  }

  const handleCategoryChange = (v: string) => { setCategoryFilter(v === '__all__' ? '' : v); setPage(1) }
  const handleStockChange = (v: string) => { setStockFilter(v === '__all__' ? '' : v); setPage(1) }
  const handleExpiryChange = (v: string) => { setExpiryFilter(v === '__all__' ? '' : v); setPage(1) }

  // Client-side expiry filtering
  const filteredMedicines = useMemo(() => {
    if (!expiryFilter) return medicines
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    return medicines.filter((med) => {
      if (!med.expiryDate) return expiryFilter === 'no_expiry'
      const expiry = new Date(med.expiryDate + 'T00:00:00').getTime()
      const daysUntil = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
      if (expiryFilter === 'expiring_soon') return daysUntil > 0 && daysUntil <= 30
      if (expiryFilter === 'expired') return daysUntil <= 0
      if (expiryFilter === 'no_expiry') return false
      return true
    })
  }, [medicines, expiryFilter])

  // ===== STATS MEMO =====
  const stats = React.useMemo(() => {
    const allMeds = medicines
    const totalValue = allMeds.reduce((sum, m) => sum + m.sellingPrice * m.stock, 0)
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const expiringSoonCount = allMeds.filter((m) => {
      if (!m.expiryDate) return false
      const expiry = new Date(m.expiryDate + 'T00:00:00').getTime()
      const days = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
      return days > 0 && days <= 30
    }).length
    return { totalMedicines: total, lowStockCount: inventoryStats.lowStockCount, outOfStockCount: inventoryStats.outOfStockCount, totalValue, expiringSoonCount }
  }, [medicines, total, inventoryStats])

  // ===== MEDICINE ACTIONS =====
  const handleAddMedicine = async () => {
    setIsSubmittingAdd(true)
    try {
      await apiPost<SingleResponse<Medicine>>('/medicines', {
        name: newName,
        category: newCategory || undefined,
        manufacturer: newManufacturer || undefined,
        batchNumber: newBatchNumber || undefined,
        expiryDate: newExpiryDate || undefined,
        purchasePrice: parseFloat(newPurchasePrice) || 0,
        sellingPrice: parseFloat(newSellingPrice) || 0,
        stock: parseInt(newStock) || 0,
        minStock: parseInt(newMinStock) || 0,
        gstRate: parseFloat(newGstRate) || 12,
        hsnCode: newHsnCode || undefined,
      })
      toast({ title: 'Success', description: 'Medicine added successfully!' })
      setAddDialogOpen(false)
      resetAddForm()
      fetchMedicines()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  const resetAddForm = () => {
    setNewName('')
    setNewCategory('')
    setNewManufacturer('')
    setNewBatchNumber('')
    setNewExpiryDate('')
    setNewPurchasePrice('')
    setNewSellingPrice('')
    setNewStock('')
    setNewMinStock('')
    setNewGstRate('12')
    setNewHsnCode('')
  }

  const handleUpdateStock = async () => {
    if (!stockDialogMed || !stockValue) return
    setIsSubmittingStock(true)
    try {
      await apiPut<SingleResponse<Medicine>>(`/medicines/${stockDialogMed.id}`, {
        stock: parseInt(stockValue),
      })
      toast({ title: 'Success', description: 'Stock updated successfully!' })
      setStockDialogMed(null)
      setStockValue('')
      fetchMedicines()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setIsSubmittingStock(false)
    }
  }

  const handleDeleteMedicine = async (id: string, name: string) => {
    setDeletingId(id)
    try {
      await apiDelete<SingleResponse<Medicine>>(`/medicines/${id}`)
      toast({ title: 'Success', description: `"${name}" has been deactivated.` })
      fetchMedicines()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setDeletingId(null)
    }
  }

  // ===== QUICK STOCK ADJUSTMENT =====
  const handleOpenQuickAdjust = (med: Medicine) => {
    setQuickAdjustMed(med)
    setQuickAdjustType('Add Stock')
    setQuickAdjustQty('')
    setQuickAdjustReason('')
    setQuickAdjustRef('')
  }

  const handleCloseQuickAdjust = () => {
    setQuickAdjustMed(null)
    setQuickAdjustType('Add Stock')
    setQuickAdjustQty('')
    setQuickAdjustReason('')
    setQuickAdjustRef('')
  }

  const handleSubmitQuickAdjust = async () => {
    if (!quickAdjustMed || !quickAdjustQty || parseInt(quickAdjustQty) <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid quantity', variant: 'destructive' })
      return
    }

    setQuickAdjustSubmitting(true)
    try {
      const qty = parseInt(quickAdjustQty)
      const movementType = quickAdjustType === 'Add Stock' ? 'Adjustment' : quickAdjustType === 'Remove Stock' ? 'Adjustment' : 'Adjustment'
      const signedQty = quickAdjustType === 'Add Stock' ? qty : quickAdjustType === 'Remove Stock' ? -qty : qty

      // Record the stock movement
      await apiPost('/inventory/stock-movements', {
        medicineId: quickAdjustMed.id,
        type: movementType,
        quantity: signedQty,
        referenceId: quickAdjustRef || undefined,
        notes: quickAdjustReason || `${quickAdjustType} of ${qty} units`,
      })

      // Update the medicine stock
      const newStock = quickAdjustType === 'Add Stock'
        ? quickAdjustMed.stock + qty
        : quickAdjustType === 'Remove Stock'
          ? Math.max(0, quickAdjustMed.stock - qty)
          : qty

      await apiPut<SingleResponse<Medicine>>(`/medicines/${quickAdjustMed.id}`, {
        stock: newStock,
      })

      toast({ title: 'Success', description: `Stock adjusted: ${quickAdjustType} ${qty} units for ${quickAdjustMed.name}` })
      handleCloseQuickAdjust()
      fetchMedicines()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setQuickAdjustSubmitting(false)
    }
  }

  // ===== PO ACTIONS =====
  const handleOpenCreatePO = (preselectedMedicineId?: string) => {
    fetchSuppliers()
    fetchAllMedicines()
    setPoFormSupplierId('')
    setPoFormOrderDate(new Date().toISOString().split('T')[0])
    setPoFormExpectedDate('')
    setPoFormNotes('')
    if (preselectedMedicineId) {
      const med = allMedicines.find((m) => m.id === preselectedMedicineId)
      setPoFormItems([{ medicineId: preselectedMedicineId, quantity: '', unitPrice: med ? String(med.purchasePrice) : '' }])
    } else {
      setPoFormItems([{ medicineId: '', quantity: '', unitPrice: '' }])
    }
    setPoCreateDialogOpen(true)
  }

  const handleAddPOItem = () => {
    setPoFormItems([...poFormItems, { medicineId: '', quantity: '', unitPrice: '' }])
  }

  const handleRemovePOItem = (index: number) => {
    setPoFormItems(poFormItems.filter((_, i) => i !== index))
  }

  const handleUpdatePOItem = (index: number, field: string, value: string) => {
    const updated = [...poFormItems]
    if (field === 'medicineId') {
      updated[index] = { ...updated[index], medicineId: value }
      // Auto-fill purchase price from medicine
      const med = allMedicines.find((m) => m.id === value)
      if (med) {
        updated[index].unitPrice = String(med.purchasePrice)
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setPoFormItems(updated)
  }

  const handleSubmitPO = async () => {
    if (!poFormSupplierId || !poFormOrderDate) {
      toast({ title: 'Error', description: 'Supplier and order date are required', variant: 'destructive' })
      return
    }
    const validItems = poFormItems.filter((item) => item.medicineId && item.quantity && item.unitPrice)
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'At least one valid item is required', variant: 'destructive' })
      return
    }
    setPoFormSubmitting(true)
    try {
      await apiPost('/inventory/purchase-orders', {
        supplierId: poFormSupplierId,
        orderDate: poFormOrderDate,
        expectedDate: poFormExpectedDate || undefined,
        notes: poFormNotes || undefined,
        items: validItems.map((item) => ({
          medicineId: item.medicineId,
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
        })),
      })
      toast({ title: 'Success', description: 'Purchase order created successfully!' })
      setPoCreateDialogOpen(false)
      fetchPurchaseOrders()
      fetchStats()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setPoFormSubmitting(false)
    }
  }

  const handleViewPO = async (po: PurchaseOrder) => {
    try {
      const res = await apiGet<SingleResponse<PurchaseOrder>>(`/inventory/purchase-orders/${po.id}`)
      setSelectedPO(res.data)
      setPoDetailDialogOpen(true)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleCancelPO = async (po: PurchaseOrder) => {
    try {
      await apiDelete(`/inventory/purchase-orders/${po.id}`)
      toast({ title: 'Success', description: `PO ${po.poId} has been cancelled` })
      fetchPurchaseOrders()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleUpdatePOStatus = async (po: PurchaseOrder, newStatus: string) => {
    try {
      await apiPut(`/inventory/purchase-orders/${po.id}`, { status: newStatus })
      toast({ title: 'Success', description: `PO ${po.poId} status updated to ${newStatus}` })
      fetchPurchaseOrders()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleOpenReceive = (po: PurchaseOrder) => {
    setSelectedPO(po)
    setReceiveItems(
      po.items.map((item) => ({
        itemId: item.id,
        receivedQty: String(Math.max(0, item.quantity - item.receivedQty)),
      }))
    )
    setPoReceiveDialogOpen(true)
  }

  const handleSubmitReceive = async () => {
    if (!selectedPO) return
    const validItems = receiveItems.filter((item) => item.itemId && parseInt(item.receivedQty) > 0)
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'At least one item with quantity > 0 is required', variant: 'destructive' })
      return
    }
    setReceiveSubmitting(true)
    try {
      await apiPost(`/inventory/purchase-orders/${selectedPO.id}/receive`, {
        items: validItems.map((item) => ({
          itemId: item.itemId,
          receivedQty: parseInt(item.receivedQty),
        })),
      })
      toast({ title: 'Success', description: 'Items received successfully!' })
      setPoReceiveDialogOpen(false)
      fetchPurchaseOrders()
      fetchStats()
      fetchMedicines()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setReceiveSubmitting(false)
    }
  }

  const categories = [...MEDICINE_CATEGORIES] as readonly string[]

  // ===== PO Form Totals =====
  const poFormTotal = React.useMemo(() => {
    return poFormItems.reduce((sum, item) => {
      const qty = parseInt(item.quantity) || 0
      const price = parseFloat(item.unitPrice) || 0
      return sum + qty * price
    }, 0)
  }, [poFormItems])

  // ===== RENDER =====
  const totalLowStock = inventoryStats.lowStockCount + inventoryStats.outOfStockCount

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
                <Pill className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMedicines}</div>
                <p className="text-xs text-muted-foreground mt-1">Registered items</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
                <IndianRupee className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalValue)}</div>
                <p className="text-xs text-muted-foreground mt-1">Stock × Selling Price</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.lowStockCount + stats.outOfStockCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Below minimum level</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{stats.expiringSoonCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Within 30 days</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Stock Alert Banner */}
      {!statsLoading && totalLowStock > 0 && (
        <button
          className="w-full flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50/80 px-4 py-3 text-left hover:bg-amber-100/80 transition-colors dark:border-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
          onClick={() => { setStockFilter('Low Stock'); setActiveTab('inventory') }}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              ⚠️ {totalLowStock} item{totalLowStock > 1 ? 's' : ''} below minimum stock level
            </span>
          </div>
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400 inline-flex items-center gap-0.5 shrink-0">
            Show Low Stock
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </button>
      )}

      {/* Low Stock Alerts Panel */}
      {!statsLoading && lowStockMedicines.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
            <CardDescription>
              {lowStockMedicines.length} item{lowStockMedicines.length > 1 ? 's' : ''} below minimum stock level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lowStockMedicines.slice(0, 6).map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between rounded-lg border border-orange-200 bg-background p-3 dark:border-orange-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{med.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Current:</span>
                      <span className={`text-xs font-semibold ${med.stock === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {med.stock}
                      </span>
                      <span className="text-xs text-muted-foreground">Min:</span>
                      <span className="text-xs font-medium">{med.minStock}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400"
                      onClick={() => handleOpenCreatePO(med.id)}
                    >
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                      Create PO
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => { setStockDialogMed(med); setStockValue(String(med.stock)) }}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inventory" className="gap-1.5">
            <Package className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="purchase-orders" className="gap-1.5">
            <ShoppingCart className="h-4 w-4" />
            Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="stock-movements" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Stock Movements
          </TabsTrigger>
        </TabsList>

        {/* ========== INVENTORY TAB ========== */}
        <TabsContent value="inventory">
          {/* Filter Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <Select value={categoryFilter || '__all__'} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="w-full lg:w-40">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Categories</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Stock Status</label>
                    <Select value={stockFilter || '__all__'} onValueChange={handleStockChange}>
                      <SelectTrigger className="w-full lg:w-40">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Status</SelectItem>
                        <SelectItem value="In Stock">In Stock</SelectItem>
                        <SelectItem value="Low Stock">Low Stock</SelectItem>
                        <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Expiry Status</label>
                    <Select value={expiryFilter || '__all__'} onValueChange={handleExpiryChange}>
                      <SelectTrigger className="w-full lg:w-44">
                        <SelectValue placeholder="All Expiry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Expiry</SelectItem>
                        <SelectItem value="expiring_soon">Expiring Soon (&lt;30d)</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="no_expiry">No Expiry Date</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5 lg:flex-1 lg:max-w-sm">
                    <label className="text-xs font-medium text-muted-foreground">Search</label>
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search name, manufacturer, batch..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full pl-9"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCategoryFilter('')
                      setStockFilter('')
                      setExpiryFilter('')
                      setSearchQuery('')
                      debouncedSearch.current = ''
                      setPage(1)
                      fetchMedicines('')
                    }}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                  <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                  </Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setAddDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Medicine
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medicine Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Medicine Inventory</CardTitle>
                  <CardDescription>
                    {isLoading ? 'Loading...' : `Showing ${medicines.length} of ${total} medicines`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <AlertTriangle className="h-12 w-12 text-red-400" />
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button variant="outline" onClick={() => fetchMedicines()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[560px] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Medicine ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Batch No</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Selling Price</TableHead>
                        <TableHead>GST%</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMedicines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            No medicines found matching the filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMedicines.map((med) => {
                          const stockStatus = getStockStatus(med)
                          const daysExpiry = getDaysUntilExpiry(med.expiryDate)
                          const isExpired = daysExpiry !== null && daysExpiry <= 0
                          const isExpiringSoon = daysExpiry !== null && daysExpiry > 0 && daysExpiry <= 30
                          return (
                            <TableRow key={med.id}>
                              <TableCell className="font-mono text-xs">{med.medicineId}</TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{med.name}</p>
                                  <p className="text-xs text-muted-foreground">{med.manufacturer}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{med.category || '-'}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">{med.batchNumber || '-'}</TableCell>
                              <TableCell>
                                <StockBar stock={med.stock} minStock={med.minStock} />
                              </TableCell>
                              <TableCell className="font-semibold">{formatCurrency(med.sellingPrice)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">{med.gstRate}%</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <StockStatusBadge status={stockStatus} />
                                  {isExpired && (
                                    <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 border-red-300 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                                      <XCircle className="h-2.5 w-2.5" />
                                      Expired
                                    </Badge>
                                  )}
                                  {isExpiringSoon && !isExpired && (
                                    <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 border-amber-300 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                                      <AlertTriangle className="h-2.5 w-2.5" />
                                      Expiring Soon
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                                    title="Quick Adjust"
                                    onClick={() => handleOpenQuickAdjust(med)}
                                  >
                                    <TimerReset className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Update Stock"
                                    onClick={() => { setStockDialogMed(med); setStockValue(String(med.stock)) }}
                                  >
                                    <ArrowUpDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700"
                                    title="Deactivate"
                                    disabled={deletingId === med.id}
                                    onClick={() => handleDeleteMedicine(med.id, med.name)}
                                  >
                                    {deletingId === med.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== PURCHASE ORDERS TAB ========== */}
        <TabsContent value="purchase-orders">
          {/* PO Filter Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <Select value={poStatusFilter || '__all__'} onValueChange={(v) => { setPoStatusFilter(v === '__all__' ? '' : v); setPoPage(1) }}>
                      <SelectTrigger className="w-full lg:w-44">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Statuses</SelectItem>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Submitted">Submitted</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Partially Received">Partially Received</SelectItem>
                        <SelectItem value="Received">Received</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleOpenCreatePO()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New PO
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* PO Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Purchase Orders</CardTitle>
                  <CardDescription>
                    {poLoading ? 'Loading...' : `Showing ${purchaseOrders.length} of ${poTotal} orders`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {poLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[560px] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>PO No</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            No purchase orders found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchaseOrders.map((po) => (
                          <TableRow key={po.id}>
                            <TableCell className="font-mono text-xs font-semibold">{po.poId}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{po.supplier.name}</p>
                                <p className="text-xs text-muted-foreground">{po.supplier.contact || po.supplier.email || '-'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(po.orderDate)}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">{po.items.length}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(po.totalAmount)}</TableCell>
                            <TableCell>
                              <POStatusBadge status={po.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="View Details" onClick={() => handleViewPO(po)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {(po.status === 'Submitted' || po.status === 'Approved') && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700" title="Receive Items" onClick={() => handleOpenReceive(po)}>
                                    <PackageCheck className="h-4 w-4" />
                                  </Button>
                                )}
                                {po.status === 'Draft' && (
                                  <>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleUpdatePOStatus(po, 'Submitted')}>
                                      Submit
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" title="Cancel" onClick={() => handleCancelPO(po)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {poTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {poPage} of {poTotalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={poPage <= 1} onClick={() => setPoPage(poPage - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={poPage >= poTotalPages} onClick={() => setPoPage(poPage + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========== STOCK MOVEMENTS TAB ========== */}
        <TabsContent value="stock-movements">
          {/* SM Filter Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Type</label>
                    <Select value={smTypeFilter || '__all__'} onValueChange={(v) => { setSmTypeFilter(v === '__all__' ? '' : v); setSmPage(1) }}>
                      <SelectTrigger className="w-full lg:w-40">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Types</SelectItem>
                        <SelectItem value="Purchase">Purchase</SelectItem>
                        <SelectItem value="Sale">Sale</SelectItem>
                        <SelectItem value="Return">Return</SelectItem>
                        <SelectItem value="Adjustment">Adjustment</SelectItem>
                        <SelectItem value="Expiry">Expiry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Medicine</label>
                    <Input
                      placeholder="Search medicine..."
                      value={smMedicineFilter}
                      onChange={(e) => { setSmMedicineFilter(e.target.value) }}
                      className="w-full lg:w-56"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSmTypeFilter('')
                    setSmMedicineFilter('')
                    setSmPage(1)
                    fetchStockMovements()
                  }}
                >
                  <Filter className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* SM Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Stock Movement History</CardTitle>
                  <CardDescription>
                    {smLoading ? 'Loading...' : `Showing ${stockMovements.length} of ${smTotal} movements`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {smLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[560px] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Movement ID</TableHead>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockMovements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                            <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            No stock movements found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        stockMovements.map((sm) => (
                          <TableRow key={sm.id}>
                            <TableCell className="font-mono text-xs">{sm.movementId}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{sm.medicine.name}</p>
                                <p className="text-xs text-muted-foreground">{sm.medicine.category || sm.medicine.manufacturer || ''}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <StockMovementTypeBadge type={sm.type} />
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${sm.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {sm.quantity > 0 ? '+' : ''}{sm.quantity}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{sm.referenceId || '-'}</TableCell>
                            <TableCell className="text-sm">{formatDateTime(sm.createdAt)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{sm.notes || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {smTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">Page {smPage} of {smTotalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={smPage <= 1} onClick={() => setSmPage(smPage - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={smPage >= smTotalPages} onClick={() => setSmPage(smPage + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========== DIALOGS ========== */}

      {/* Update Stock Dialog */}
      <Dialog open={!!stockDialogMed} onOpenChange={(open) => { if (!open) { setStockDialogMed(null); setStockValue('') } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-emerald-600" />
              Update Stock
            </DialogTitle>
            <DialogDescription>
              {stockDialogMed?.name} ({stockDialogMed?.medicineId})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Stock</span>
                <span className="font-semibold">{stockDialogMed?.stock} units</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Minimum Stock</span>
                <span className="font-medium">{stockDialogMed?.minStock} units</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-stock">New Stock Quantity</Label>
              <Input
                id="new-stock"
                type="number"
                min="0"
                value={stockValue}
                onChange={(e) => setStockValue(e.target.value)}
                placeholder="Enter new stock quantity"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setStockDialogMed(null); setStockValue('') }}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleUpdateStock}
              disabled={!stockValue || isSubmittingStock}
            >
              {isSubmittingStock ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Medicine Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) { setAddDialogOpen(false); resetAddForm() } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Add New Medicine
            </DialogTitle>
            <DialogDescription>Add a new medicine to the inventory</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="med-name">Medicine Name *</Label>
                <Input id="med-name" placeholder="e.g., Paracetamol 500mg" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-category">Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="med-manufacturer">Manufacturer</Label>
                <Input id="med-manufacturer" placeholder="e.g., Cipla Ltd" value={newManufacturer} onChange={(e) => setNewManufacturer(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-batch">Batch Number</Label>
                <Input id="med-batch" placeholder="e.g., B2024-001" value={newBatchNumber} onChange={(e) => setNewBatchNumber(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="med-expiry">Expiry Date</Label>
                <Input id="med-expiry" type="date" value={newExpiryDate} onChange={(e) => setNewExpiryDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-purchase-price">Purchase Price</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="med-purchase-price" type="number" placeholder="0.00" value={newPurchasePrice} onChange={(e) => setNewPurchasePrice(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-selling-price">Selling Price</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="med-selling-price" type="number" placeholder="0.00" value={newSellingPrice} onChange={(e) => setNewSellingPrice(e.target.value)} className="pl-9" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="med-stock">Stock Quantity *</Label>
                <Input id="med-stock" type="number" placeholder="0" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-min-stock">Min Stock Level</Label>
                <Input id="med-min-stock" type="number" placeholder="10" value={newMinStock} onChange={(e) => setNewMinStock(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="med-gst">GST Rate</Label>
                <Select value={newGstRate} onValueChange={setNewGstRate}>
                  <SelectTrigger><SelectValue placeholder="Select GST rate" /></SelectTrigger>
                  <SelectContent>
                    {GST_SLABS.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="med-hsn">HSN Code</Label>
              <Input id="med-hsn" placeholder="e.g., 30049099" value={newHsnCode} onChange={(e) => setNewHsnCode(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetAddForm() }}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAddMedicine}
              disabled={!newName || !newStock || isSubmittingAdd}
            >
              {isSubmittingAdd ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
              Add Medicine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create PO Dialog */}
      <Dialog open={poCreateDialogOpen} onOpenChange={(open) => { if (!open) setPoCreateDialogOpen(false) }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              New Purchase Order
            </DialogTitle>
            <DialogDescription>Create a new purchase order to supplier</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="po-supplier">Supplier *</Label>
                <Select value={poFormSupplierId} onValueChange={setPoFormSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {poSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-date">Order Date *</Label>
                <Input id="po-date" type="date" value={poFormOrderDate} onChange={(e) => setPoFormOrderDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="po-expected">Expected Date</Label>
                <Input id="po-expected" type="date" value={poFormExpectedDate} onChange={(e) => setPoFormExpectedDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-notes">Notes</Label>
              <Input id="po-notes" placeholder="Optional notes..." value={poFormNotes} onChange={(e) => setPoFormNotes(e.target.value)} />
            </div>

            {/* PO Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Order Items</Label>
                <Button variant="outline" size="sm" onClick={handleAddPOItem}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Item
                </Button>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {poFormItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end rounded-lg border p-3">
                    <div className="col-span-5 space-y-1">
                      {index === 0 ? <Label className="text-xs text-muted-foreground">Medicine</Label> : null}
                      <Select
                        value={item.medicineId}
                        onValueChange={(v) => handleUpdatePOItem(index, 'medicineId', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select medicine" />
                        </SelectTrigger>
                        <SelectContent>
                          {allMedicines.map((med) => (
                            <SelectItem key={med.id} value={med.id}>{med.name} ({med.medicineId})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 space-y-1">
                      {index === 0 ? <Label className="text-xs text-muted-foreground">Qty</Label> : null}
                      <Input
                        type="number"
                        min="1"
                        placeholder="0"
                        value={item.quantity}
                        onChange={(e) => handleUpdatePOItem(index, 'quantity', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3 space-y-1">
                      {index === 0 ? <Label className="text-xs text-muted-foreground">Unit Price</Label> : null}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdatePOItem(index, 'unitPrice', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      {poFormItems.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemovePOItem(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end border-t pt-3">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(poFormTotal)}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPoCreateDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmitPO}
              disabled={!poFormSupplierId || !poFormOrderDate || poFormSubmitting}
            >
              {poFormSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PO Detail Dialog */}
      <Dialog open={poDetailDialogOpen} onOpenChange={(open) => { if (!open) { setPoDetailDialogOpen(false); setSelectedPO(null) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              PO {selectedPO?.poId}
            </DialogTitle>
            <DialogDescription>
              <span className="mr-3">Supplier: {selectedPO?.supplier.name}</span>
              <POStatusBadge status={selectedPO?.status || ''} />
            </DialogDescription>
          </DialogHeader>

          {selectedPO && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p className="text-sm font-medium">{formatDate(selectedPO.orderDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expected Date</p>
                  <p className="text-sm font-medium">{selectedPO.expectedDate ? formatDate(selectedPO.expectedDate) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="text-sm font-semibold">{formatCurrency(selectedPO.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Received Amount</p>
                  <p className="text-sm font-semibold text-emerald-600">{formatCurrency(selectedPO.receivedAmount)}</p>
                </div>
              </div>

              {selectedPO.notes && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{selectedPO.notes}</p>
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead className="text-right">Qty Ordered</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPO.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{item.medicine.name}</p>
                          <p className="text-xs text-muted-foreground">{item.medicine.medicineId}</p>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                        <TableCell className="text-right">
                          <span className={item.receivedQty >= item.quantity ? 'text-emerald-600 font-semibold' : item.receivedQty > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
                            {item.receivedQty} / {item.quantity}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {(selectedPO.status === 'Submitted' || selectedPO.status === 'Approved') && (
                <DialogFooter>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setPoDetailDialogOpen(false)
                      handleOpenReceive(selectedPO)
                    }}
                  >
                    <PackageCheck className="mr-2 h-4 w-4" />
                    Record Receipt
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receive Items Dialog */}
      <Dialog open={poReceiveDialogOpen} onOpenChange={(open) => { if (!open) { setPoReceiveDialogOpen(false); setSelectedPO(null); setReceiveItems([]) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-emerald-600" />
              Receive Items — {selectedPO?.poId}
            </DialogTitle>
            <DialogDescription>
              Record received quantities for this purchase order
            </DialogDescription>
          </DialogHeader>

          {selectedPO && (
            <div className="space-y-4">
              <div className="max-h-[400px] overflow-y-auto space-y-3">
                {selectedPO.items.map((item, _index) => {
                  const ri = receiveItems.find((r) => r.itemId === item.id)
                  return (
                    <div key={item.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.medicine.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Ordered: {item.quantity} | Already received: {item.receivedQty} | Pending: {item.quantity - item.receivedQty}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min="0"
                          max={item.quantity - item.receivedQty}
                          placeholder="0"
                          className="w-24 text-right"
                          value={ri?.receivedQty || ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setReceiveItems((prev) =>
                              prev.map((r) => r.itemId === item.id ? { ...r, receivedQty: val } : r)
                            )
                          }}
                        />
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${(item.receivedQty / item.quantity) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPoReceiveDialogOpen(false); setSelectedPO(null); setReceiveItems([]) }}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmitReceive}
              disabled={receiveSubmitting}
            >
              {receiveSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Stock Adjustment Dialog */}
      <Dialog open={!!quickAdjustMed} onOpenChange={(open) => { if (!open) handleCloseQuickAdjust() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TimerReset className="h-5 w-5 text-amber-600" />
              Quick Stock Adjustment
            </DialogTitle>
            <DialogDescription>
              {quickAdjustMed?.name} ({quickAdjustMed?.medicineId})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current Info */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Stock</span>
                <span className="font-semibold">{quickAdjustMed?.stock} units</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Minimum Stock</span>
                <span className="font-medium">{quickAdjustMed?.minStock} units</span>
              </div>
            </div>

            {/* Adjustment Type */}
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {['Add Stock', 'Remove Stock', 'Adjust'].map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={quickAdjustType === type ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      quickAdjustType === type && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                      quickAdjustType === 'Remove Stock' && quickAdjustType === type && 'bg-red-600 hover:bg-red-700',
                    )}
                    onClick={() => setQuickAdjustType(type)}
                  >
                    {type === 'Add Stock' && <Plus className="h-3.5 w-3.5 mr-1" />}
                    {type === 'Remove Stock' && <Minus className="h-3.5 w-3.5 mr-1" />}
                    {type === 'Adjust' && <Wrench className="h-3.5 w-3.5 mr-1" />}
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quick-qty">Quantity</Label>
              <Input
                id="quick-qty"
                type="number"
                min="1"
                value={quickAdjustQty}
                onChange={(e) => setQuickAdjustQty(e.target.value)}
                placeholder="Enter quantity"
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="quick-reason">Reason</Label>
              <Input
                id="quick-reason"
                value={quickAdjustReason}
                onChange={(e) => setQuickAdjustReason(e.target.value)}
                placeholder="e.g., Damaged stock, New shipment"
              />
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="quick-ref">Reference (Optional)</Label>
              <Input
                id="quick-ref"
                value={quickAdjustRef}
                onChange={(e) => setQuickAdjustRef(e.target.value)}
                placeholder="e.g., PO-2025-001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseQuickAdjust}>Cancel</Button>
            <Button
              className={cn(
                quickAdjustType === 'Remove Stock' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700',
              )}
              onClick={handleSubmitQuickAdjust}
              disabled={!quickAdjustQty || parseInt(quickAdjustQty) <= 0 || quickAdjustSubmitting}
            >
              {quickAdjustSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TimerReset className="mr-2 h-4 w-4" />}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportCsvDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        title="Medicines"
        importUrl="/api/import/medicines"
        templateHeaders={['Name', 'Category', 'Manufacturer', 'Batch Number', 'Expiry Date', 'Purchase Price', 'Selling Price', 'Stock', 'Min Stock', 'GST Rate', 'HSN Code', 'Barcode', 'Status']}
        onSuccess={() => fetchMedicines('')}
      />
    </div>
  )
}