'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { formatCurrency } from '@/lib/utils'
import { apiGet, apiPost, apiPut, type PaginatedResponse, type SingleResponse, ApiError } from '@/lib/api-client'
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
import { Textarea } from '@/components/ui/textarea'
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
  Wrench,
  ClipboardList,
  Calendar,
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Plus,
  Building2,
  Monitor,
  Truck,
  Stethoscope,
  Sofa,
  Beaker,
  IndianRupee,
} from 'lucide-react'

type AssetCategory = 'Medical Equipment' | 'Furniture' | 'IT' | 'Vehicle' | 'Building' | 'Instrument'
type AssetCondition = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Damaged'
type AssetStatus = 'Active' | 'Under Maintenance' | 'Retired' | 'Lost'
type MaintenanceType = 'Preventive' | 'Corrective' | 'Calibration' | 'AMC'
type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled'

interface Asset {
  id: string
  assetId: string
  name: string
  category: AssetCategory
  subCategory: string | null
  model: string | null
  manufacturer: string | null
  serialNumber: string | null
  purchaseDate: string | null
  purchaseCost: number
  warrantyExpiry: string | null
  location: string | null
  assignedTo: string | null
  condition: AssetCondition
  status: AssetStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface MaintenanceRecord {
  id: string
  maintenanceId: string
  assetId: string
  assetName: string
  maintenanceDate: string
  type: MaintenanceType
  description: string | null
  cost: number
  performedBy: string | null
  nextDueDate: string | null
  status: MaintenanceStatus
  createdAt: string
}

const CATEGORIES: AssetCategory[] = ['Medical Equipment', 'Furniture', 'IT', 'Vehicle', 'Building', 'Instrument']
const CONDITIONS: AssetCondition[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']
const STATUSES: AssetStatus[] = ['Active', 'Under Maintenance', 'Retired', 'Lost']
const MAINTENANCE_TYPES: MaintenanceType[] = ['Preventive', 'Corrective', 'Calibration', 'AMC']

const CATEGORY_ICONS: Record<AssetCategory, React.ElementType> = {
  'Medical Equipment': Stethoscope,
  Furniture: Sofa,
  IT: Monitor,
  Vehicle: Truck,
  Building: Building2,
  Instrument: Beaker,
}

const STATUS_CONFIG: Record<AssetStatus, { className: string; icon: React.ElementType }> = {
  Active: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', icon: CheckCircle2 },
  'Under Maintenance': { className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800', icon: Wrench },
  Retired: { className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', icon: XCircle },
  Lost: { className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800', icon: AlertTriangle },
}

const MAINTENANCE_STATUS_CONFIG: Record<MaintenanceStatus, string> = {
  Scheduled: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  Completed: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  Cancelled: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

const CONDITION_CONFIG: Record<AssetCondition, string> = {
  Excellent: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
  Good: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  Fair: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  Poor: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  Damaged: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
}

function StatusBadge({ status }: { status: AssetStatus }) {
  const { className, icon: Icon } = STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  )
}

function ConditionBadge({ condition }: { condition: AssetCondition }) {
  return (
    <Badge variant="outline" className={CONDITION_CONFIG[condition]}>
      {condition}
    </Badge>
  )
}

function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return (
    <Badge variant="outline" className={MAINTENANCE_STATUS_CONFIG[status]}>
      {status}
    </Badge>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AssetManagementPage() {
  const { toast } = useToast()

  const [assets, setAssets] = useState<Asset[]>([])
  const [assetsLoading, setAssetsLoading] = useState(true)
  const [assetsError, setAssetsError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 20

  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedSearch = useRef('')

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)

  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenancePage] = useState(1)
  const [maintenanceTotal, setMaintenanceTotal] = useState(0)
  const [, setMaintenanceTotalPages] = useState(1)

  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false)
  const [maintFormAssetId, setMaintFormAssetId] = useState('')
  const [maintFormDate, setMaintFormDate] = useState(new Date().toISOString().split('T')[0])
  const [maintFormType, setMaintFormType] = useState<MaintenanceType>('Preventive')
  const [maintFormDescription, setMaintFormDescription] = useState('')
  const [maintFormCost, setMaintFormCost] = useState('')
  const [maintFormPerformedBy, setMaintFormPerformedBy] = useState('')
  const [maintFormNextDue, setMaintFormNextDue] = useState('')
  const [maintSubmitting, setMaintSubmitting] = useState(false)

  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState<AssetCategory>('Medical Equipment')
  const [formSubCategory, setFormSubCategory] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formManufacturer, setFormManufacturer] = useState('')
  const [formSerialNumber, setFormSerialNumber] = useState('')
  const [formPurchaseDate, setFormPurchaseDate] = useState('')
  const [formPurchaseCost, setFormPurchaseCost] = useState('')
  const [formWarrantyExpiry, setFormWarrantyExpiry] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formAssignedTo, setFormAssignedTo] = useState('')
  const [formCondition, setFormCondition] = useState<AssetCondition>('Good')
  const [formStatus, setFormStatus] = useState<AssetStatus>('Active')
  const [formNotes, setFormNotes] = useState('')

  const fetchAssets = useCallback(async (search?: string) => {
    setAssetsLoading(true)
    setAssetsError(null)
    try {
      const params: Record<string, string | number> = { page, limit }
      const s = search !== undefined ? search : debouncedSearch.current
      if (s) params.search = s
      if (categoryFilter) params.category = categoryFilter
      if (statusFilter) params.status = statusFilter

      const res = await apiGet<PaginatedResponse<Asset>>('/assets', params)
      setAssets(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        setAssetsError(err.message)
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setAssetsLoading(false)
    }
  }, [page, categoryFilter, statusFilter, toast])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssets()
  }, [fetchAssets])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      debouncedSearch.current = value
      setPage(1)
      fetchAssets(value)
    }, 300)
  }

  const stats = useMemo(() => {
    const active = assets.filter((a) => a.status === 'Active').length
    const maintenance = assets.filter((a) => a.status === 'Under Maintenance').length
    const retired = assets.filter((a) => a.status === 'Retired').length
    const totalValue = assets.reduce((sum, a) => sum + a.purchaseCost, 0)
    return { total: assets.length, active, maintenance, retired, totalValue }
  }, [assets])

  const resetForm = () => {
    setFormName('')
    setFormCategory('Medical Equipment')
    setFormSubCategory('')
    setFormModel('')
    setFormManufacturer('')
    setFormSerialNumber('')
    setFormPurchaseDate('')
    setFormPurchaseCost('')
    setFormWarrantyExpiry('')
    setFormLocation('')
    setFormAssignedTo('')
    setFormCondition('Good')
    setFormStatus('Active')
    setFormNotes('')
  }

  const handleOpenAdd = () => {
    setIsEditing(false)
    resetForm()
    setAddDialogOpen(true)
  }

  const handleOpenEdit = (asset: Asset) => {
    setIsEditing(true)
    setFormName(asset.name)
    setFormCategory(asset.category)
    setFormSubCategory(asset.subCategory || '')
    setFormModel(asset.model || '')
    setFormManufacturer(asset.manufacturer || '')
    setFormSerialNumber(asset.serialNumber || '')
    setFormPurchaseDate(asset.purchaseDate ? asset.purchaseDate.split('T')[0] : '')
    setFormPurchaseCost(String(asset.purchaseCost))
    setFormWarrantyExpiry(asset.warrantyExpiry ? asset.warrantyExpiry.split('T')[0] : '')
    setFormLocation(asset.location || '')
    setFormAssignedTo(asset.assignedTo || '')
    setFormCondition(asset.condition)
    setFormStatus(asset.status)
    setFormNotes(asset.notes || '')
    setSelectedAsset(asset)
    setAddDialogOpen(true)
  }

  const handleView = (asset: Asset) => {
    setSelectedAsset(asset)
    setViewDialogOpen(true)
    fetchMaintenance(asset.id)
  }

  const handleSubmit = async () => {
    if (!formName) {
      toast({ title: 'Error', description: 'Asset name is required', variant: 'destructive' })
      return
    }
    setFormSubmitting(true)
    try {
      const payload = {
        name: formName,
        category: formCategory,
        subCategory: formSubCategory || undefined,
        model: formModel || undefined,
        manufacturer: formManufacturer || undefined,
        serialNumber: formSerialNumber || undefined,
        purchaseDate: formPurchaseDate || undefined,
        purchaseCost: parseFloat(formPurchaseCost) || 0,
        warrantyExpiry: formWarrantyExpiry || undefined,
        location: formLocation || undefined,
        assignedTo: formAssignedTo || undefined,
        condition: formCondition,
        status: formStatus,
        notes: formNotes || undefined,
      }

      if (isEditing && selectedAsset) {
        await apiPut<SingleResponse<Asset>>(`/assets/${selectedAsset.id}`, payload)
        toast({ title: 'Success', description: 'Asset updated successfully!' })
      } else {
        await apiPost<SingleResponse<Asset>>('/assets', payload)
        toast({ title: 'Success', description: 'Asset added successfully!' })
      }
      setAddDialogOpen(false)
      fetchAssets()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setFormSubmitting(false)
    }
  }

  const fetchMaintenance = useCallback(async (assetId: string) => {
    setMaintenanceLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<MaintenanceRecord>>(`/assets/${assetId}/maintenance`, { page: maintenancePage, limit: 10 })
      setMaintenanceRecords(res.data)
      setMaintenanceTotal(res.total)
      setMaintenanceTotalPages(res.totalPages)
    } catch {
      setMaintenanceRecords([])
    } finally {
      setMaintenanceLoading(false)
    }
  }, [maintenancePage])

  const handleOpenScheduleMaintenance = (assetId?: string) => {
    setMaintFormAssetId(assetId || '')
    setMaintFormDate(new Date().toISOString().split('T')[0])
    setMaintFormType('Preventive')
    setMaintFormDescription('')
    setMaintFormCost('')
    setMaintFormPerformedBy('')
    setMaintFormNextDue('')
    setMaintenanceDialogOpen(true)
  }

  const handleSubmitMaintenance = async () => {
    if (!maintFormAssetId || !maintFormDate) {
      toast({ title: 'Error', description: 'Asset and date are required', variant: 'destructive' })
      return
    }
    setMaintSubmitting(true)
    try {
      await apiPost<SingleResponse<MaintenanceRecord>>(`/assets/${maintFormAssetId}/maintenance`, {
        maintenanceDate: maintFormDate,
        type: maintFormType,
        description: maintFormDescription || undefined,
        cost: parseFloat(maintFormCost) || 0,
        performedBy: maintFormPerformedBy || undefined,
        nextDueDate: maintFormNextDue || undefined,
      })
      toast({ title: 'Success', description: 'Maintenance scheduled successfully!' })
      setMaintenanceDialogOpen(false)
      if (selectedAsset) fetchMaintenance(selectedAsset.id)
      fetchAssets()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setMaintSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Asset Management</h1>
          <p className="text-sm text-muted-foreground">Track equipment, instruments, and other assets</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Asset
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {assetsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle>
                <ClipboardList className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{total}</div>
                <p className="text-xs text-muted-foreground mt-1">Value: {formatCurrency(stats.totalValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
                <p className="text-xs text-muted-foreground mt-1">Currently in use</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Under Maintenance</CardTitle>
                <Wrench className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{stats.maintenance}</div>
                <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Retired</CardTitle>
                <XCircle className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-500">{stats.retired}</div>
                <p className="text-xs text-muted-foreground mt-1">Decommissioned</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={categoryFilter || '__all__'} onValueChange={(v) => { setCategoryFilter(v === '__all__' ? '' : v); setPage(1) }}>
                  <SelectTrigger className="w-full lg:w-44">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Categories</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={statusFilter || '__all__'} onValueChange={(v) => { setStatusFilter(v === '__all__' ? '' : v); setPage(1) }}>
                  <SelectTrigger className="w-full lg:w-44">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Statuses</SelectItem>
                    {STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5 lg:flex-1 lg:max-w-sm">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search asset name, model, serial..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-9"
                  />
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setCategoryFilter('')
                setStatusFilter('')
                setSearchQuery('')
                debouncedSearch.current = ''
                setPage(1)
                fetchAssets('')
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Assets</CardTitle>
              <CardDescription>
                {assetsLoading ? 'Loading...' : `Showing ${assets.length} of ${total} assets`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {assetsError ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <AlertTriangle className="h-12 w-12 text-red-400" />
              <p className="text-sm text-muted-foreground">{assetsError}</p>
              <Button variant="outline" onClick={() => fetchAssets()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : assetsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-[560px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Asset ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Model / Serial</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        No assets found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assets.map((asset) => {
                      const CatIcon = CATEGORY_ICONS[asset.category]
                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono text-xs">{asset.assetId}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                <CatIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{asset.name}</p>
                                <p className="text-xs text-muted-foreground">{asset.manufacturer || '-'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{asset.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <p className="font-mono">{asset.model || '-'}</p>
                              <p className="text-muted-foreground font-mono">{asset.serialNumber || '-'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{asset.location || '-'}</TableCell>
                          <TableCell>
                            <ConditionBadge condition={asset.condition} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={asset.status} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="View Details" onClick={() => handleView(asset)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => handleOpenEdit(asset)}>
                                <Wrench className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600" title="Schedule Maintenance" onClick={() => handleOpenScheduleMaintenance(asset.id)}>
                                <Calendar className="h-4 w-4" />
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-600" />
              Maintenance History
            </CardTitle>
            <CardDescription>
              {maintenanceRecords.length > 0 ? `${maintenanceTotal} record(s)` : 'Schedule and track maintenance'}
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => handleOpenScheduleMaintenance()}>
            <Calendar className="mr-1.5 h-4 w-4" />
            Schedule Maintenance
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : maintenanceRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No maintenance records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  maintenanceRecords.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="text-sm">{formatDate(rec.maintenanceDate)}</TableCell>
                      <TableCell className="text-sm font-medium">{rec.assetName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{rec.type}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{rec.description || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(rec.cost)}</TableCell>
                      <TableCell>
                        <MaintenanceStatusBadge status={rec.status} />
                      </TableCell>
                      <TableCell className="text-sm">{rec.nextDueDate ? formatDate(rec.nextDueDate) : '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) setAddDialogOpen(false) }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              {isEditing ? 'Edit Asset' : 'Add New Asset'}
            </DialogTitle>
            <DialogDescription>
              {isEditing ? `Update details for ${selectedAsset?.name}` : 'Register a new asset in the system'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asset-name">Asset Name *</Label>
                <Input id="asset-name" placeholder="e.g., X-Ray Machine" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-category">Category *</Label>
                <Select value={formCategory} onValueChange={(v) => setFormCategory(v as AssetCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asset-subcategory">Sub Category</Label>
                <Input id="asset-subcategory" placeholder="e.g., Digital X-Ray" value={formSubCategory} onChange={(e) => setFormSubCategory(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-model">Model</Label>
                <Input id="asset-model" placeholder="e.g., XR-2000" value={formModel} onChange={(e) => setFormModel(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asset-manufacturer">Manufacturer</Label>
                <Input id="asset-manufacturer" placeholder="e.g., Siemens" value={formManufacturer} onChange={(e) => setFormManufacturer(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-serial">Serial Number</Label>
                <Input id="asset-serial" placeholder="e.g., SN-2024-001" value={formSerialNumber} onChange={(e) => setFormSerialNumber(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="asset-purchase-date">Purchase Date</Label>
                <Input id="asset-purchase-date" type="date" value={formPurchaseDate} onChange={(e) => setFormPurchaseDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-purchase-cost">Purchase Cost</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="asset-purchase-cost" type="number" placeholder="0" value={formPurchaseCost} onChange={(e) => setFormPurchaseCost(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-warranty">Warranty Expiry</Label>
                <Input id="asset-warranty" type="date" value={formWarrantyExpiry} onChange={(e) => setFormWarrantyExpiry(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asset-location">Location</Label>
                <Input id="asset-location" placeholder="e.g., Radiology Room 101" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-assigned">Assigned To</Label>
                <Input id="asset-assigned" placeholder="e.g., Dr. Smith" value={formAssignedTo} onChange={(e) => setFormAssignedTo(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="asset-condition">Condition *</Label>
                <Select value={formCondition} onValueChange={(v) => setFormCondition(v as AssetCondition)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-status">Status *</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as AssetStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="asset-notes">Notes</Label>
              <Textarea id="asset-notes" placeholder="Additional notes..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmit}
              disabled={!formName || formSubmitting}
            >
              {formSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
              {isEditing ? 'Update Asset' : 'Add Asset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={(open) => { if (!open) { setViewDialogOpen(false); setSelectedAsset(null) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              {selectedAsset?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedAsset?.assetId} | {selectedAsset?.category}
            </DialogDescription>
          </DialogHeader>

          {selectedAsset && (
            <Tabs defaultValue="details">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance History</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="text-sm font-medium">{selectedAsset.category}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sub Category</p>
                    <p className="text-sm">{selectedAsset.subCategory || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Model</p>
                    <p className="text-sm">{selectedAsset.model || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Manufacturer</p>
                    <p className="text-sm">{selectedAsset.manufacturer || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Serial Number</p>
                    <p className="text-sm font-mono">{selectedAsset.serialNumber || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Purchase Date</p>
                    <p className="text-sm">{selectedAsset.purchaseDate ? formatDate(selectedAsset.purchaseDate) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Purchase Cost</p>
                    <p className="text-sm font-semibold">{formatCurrency(selectedAsset.purchaseCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Warranty Expiry</p>
                    <p className="text-sm">{selectedAsset.warrantyExpiry ? formatDate(selectedAsset.warrantyExpiry) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm">{selectedAsset.location || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned To</p>
                    <p className="text-sm">{selectedAsset.assignedTo || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Condition</p>
                    <ConditionBadge condition={selectedAsset.condition} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <StatusBadge status={selectedAsset.status} />
                  </div>
                </div>
                {selectedAsset.notes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{selectedAsset.notes}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="maintenance" className="mt-4 space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { setViewDialogOpen(false); handleOpenScheduleMaintenance(selectedAsset.id) }}>
                    <Calendar className="mr-1.5 h-4 w-4" />
                    Schedule Maintenance
                  </Button>
                </div>
                {maintenanceRecords.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Wrench className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">No maintenance records</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Next Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {maintenanceRecords.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell className="text-sm">{formatDate(rec.maintenanceDate)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{rec.type}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{rec.description || '-'}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(rec.cost)}</TableCell>
                            <TableCell>
                              <MaintenanceStatusBadge status={rec.status} />
                            </TableCell>
                            <TableCell className="text-sm">{rec.nextDueDate ? formatDate(rec.nextDueDate) : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={maintenanceDialogOpen} onOpenChange={(open) => { if (!open) setMaintenanceDialogOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-600" />
              Schedule Maintenance
            </DialogTitle>
            <DialogDescription>Record a new maintenance event for an asset</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maint-asset">Asset *</Label>
              <Select value={maintFormAssetId} onValueChange={setMaintFormAssetId}>
                <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                <SelectContent>
                  {assets.filter((a) => a.status !== 'Retired' && a.status !== 'Lost').map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.assetId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maint-date">Date *</Label>
                <Input id="maint-date" type="date" value={maintFormDate} onChange={(e) => setMaintFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maint-type">Type *</Label>
                <Select value={maintFormType} onValueChange={(v) => setMaintFormType(v as MaintenanceType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-description">Description</Label>
              <Textarea id="maint-description" placeholder="Describe the maintenance work..." value={maintFormDescription} onChange={(e) => setMaintFormDescription(e.target.value)} rows={2} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maint-cost">Cost</Label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="maint-cost" type="number" placeholder="0" value={maintFormCost} onChange={(e) => setMaintFormCost(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maint-performed-by">Performed By</Label>
                <Input id="maint-performed-by" placeholder="e.g., ServiceCo" value={maintFormPerformedBy} onChange={(e) => setMaintFormPerformedBy(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maint-next-due">Next Due Date</Label>
              <Input id="maint-next-due" type="date" value={maintFormNextDue} onChange={(e) => setMaintFormNextDue(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleSubmitMaintenance}
              disabled={!maintFormAssetId || !maintFormDate || maintSubmitting}
            >
              {maintSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calendar className="mr-2 h-4 w-4" />}
              Schedule Maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
