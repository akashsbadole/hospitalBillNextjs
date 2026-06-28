'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
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
  UtensilsCrossed,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Utensils,
  Cookie,
  Moon,
  Bed,
  Trash2,
  Eye,
  SquarePen,
  Coffee,
  Apple,
} from 'lucide-react'

type DietType = 'Normal' | 'Diabetic' | 'Low Salt' | 'Low Fat' | 'Liquid' | 'Soft' | 'Semi-Solid' | 'High Protein' | 'Renal' | 'Cardiac'
type MealPlan = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'All'
type OrderStatus = 'Active' | 'Completed' | 'Cancelled'
type MealTime = 'Breakfast' | 'Mid-Morning' | 'Lunch' | 'Evening Snacks' | 'Dinner' | 'Bedtime'

interface DietOrder {
  id: string
  orderId: string
  patientId: string
  patientName: string
  dietType: DietType
  mealPlans: MealPlan[]
  preferences: string | null
  allergies: string | null
  instructions: string | null
  startDate: string
  endDate: string | null
  status: OrderStatus
  createdAt: string
  updatedAt: string
}

interface DietMeal {
  id: string
  mealId: string
  orderId: string
  mealTime: MealTime
  items: string
  instructions: string | null
  served: boolean
  servedAt: string | null
  servedBy: string | null
  createdAt: string
}

interface Patient {
  id: string
  patientId: string
  name: string
  phone: string | null
  bedNumber?: string | null
}

const DIET_TYPES: DietType[] = ['Normal', 'Diabetic', 'Low Salt', 'Low Fat', 'Liquid', 'Soft', 'Semi-Solid', 'High Protein', 'Renal', 'Cardiac']
const MEAL_PLANS: MealPlan[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks']
const MEAL_TIMES: MealTime[] = ['Breakfast', 'Mid-Morning', 'Lunch', 'Evening Snacks', 'Dinner', 'Bedtime']

const MEAL_TIME_ICONS: Record<MealTime, React.ElementType> = {
  Breakfast: Coffee,
  'Mid-Morning': Apple,
  Lunch: Utensils,
  'Evening Snacks': Cookie,
  Dinner: Moon,
  Bedtime: Bed,
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, { className: string; icon: React.ElementType }> = {
  Active: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800', icon: CheckCircle2 },
  Completed: { className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', icon: Clock },
  Cancelled: { className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800', icon: XCircle },
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { className, icon: Icon } = ORDER_STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={`gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
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

export function DietManagementPage() {
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState('orders')
  const [patientSearch, setPatientSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [showPatientDropdown, setShowPatientDropdown] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [orders, setOrders] = useState<DietOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const limit = 20

  const [orderDialogOpen, setOrderDialogOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<DietOrder | null>(null)
  const [formPatientId, setFormPatientId] = useState('')
  const [, setFormPatientName] = useState('')
  const [formDietType, setFormDietType] = useState<DietType>('Normal')
  const [formMealPlans, setFormMealPlans] = useState<MealPlan[]>([])
  const [formPreferences, setFormPreferences] = useState('')
  const [formAllergies, setFormAllergies] = useState('')
  const [formInstructions, setFormInstructions] = useState('')
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0])
  const [formEndDate, setFormEndDate] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<DietOrder | null>(null)

  const [meals, setMeals] = useState<DietMeal[]>([])
  const [mealsLoading, setMealsLoading] = useState(false)
  const [mealDialogOpen, setMealDialogOpen] = useState(false)
  const [formMealTime, setFormMealTime] = useState<MealTime>('Breakfast')
  const [formMealItems, setFormMealItems] = useState('')
  const [formMealInstructions, setFormMealInstructions] = useState('')
  const [mealSubmitting, setMealSubmitting] = useState(false)

  const fetchOrders = useCallback(async (search?: string) => {
    setOrdersLoading(true)
    setOrdersError(null)
    try {
      const params: Record<string, string | number> = { page, limit }
      if (search) params.search = search
      const res = await apiGet<PaginatedResponse<DietOrder>>('/diet-orders', params)
      setOrders(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 0) {
        setOrdersError(err.message)
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setOrdersLoading(false)
    }
  }, [page, toast])

   
  useEffect(() => {
    if (activeTab === 'orders') // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders()
  }, [fetchOrders, activeTab])

  const searchPatients = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([])
      return
    }
    try {
      const res = await apiGet<PaginatedResponse<Patient>>('/patients', { search: q, limit: 10 })
      setSearchResults(res.data)
      setShowPatientDropdown(true)
    } catch {
      setSearchResults([])
    }
  }, [])

  const handlePatientSearchChange = (value: string) => {
    setPatientSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => searchPatients(value), 300)
  }

  const selectPatient = (patient: Patient) => {
    setFormPatientId(patient.id)
    setFormPatientName(patient.name)
    setPatientSearch(patient.name)
    setShowPatientDropdown(false)
  }

  const handleOpenNewOrder = () => {
    setEditingOrder(null)
    setFormPatientId('')
    setFormPatientName('')
    setPatientSearch('')
    setFormDietType('Normal')
    setFormMealPlans([])
    setFormPreferences('')
    setFormAllergies('')
    setFormInstructions('')
    setFormStartDate(new Date().toISOString().split('T')[0])
    setFormEndDate('')
    setOrderDialogOpen(true)
  }

  const handleEditOrder = (order: DietOrder) => {
    setEditingOrder(order)
    setFormPatientId(order.patientId)
    setFormPatientName(order.patientName)
    setPatientSearch(order.patientName)
    setFormDietType(order.dietType)
    setFormMealPlans(order.mealPlans)
    setFormPreferences(order.preferences || '')
    setFormAllergies(order.allergies || '')
    setFormInstructions(order.instructions || '')
    setFormStartDate(order.startDate.split('T')[0])
    setFormEndDate(order.endDate ? order.endDate.split('T')[0] : '')
    setOrderDialogOpen(true)
  }

  const toggleMealPlan = (plan: MealPlan) => {
    if (plan === 'All') {
      if (formMealPlans.length === MEAL_PLANS.length) {
        setFormMealPlans([])
      } else {
        setFormMealPlans([...MEAL_PLANS])
      }
      return
    }
    setFormMealPlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan]
    )
  }

  const handleSubmitOrder = async () => {
    if (!formPatientId || !formDietType || !formStartDate) {
      toast({ title: 'Error', description: 'Patient, diet type, and start date are required', variant: 'destructive' })
      return
    }
    if (formMealPlans.length === 0) {
      toast({ title: 'Error', description: 'Select at least one meal plan', variant: 'destructive' })
      return
    }
    setFormSubmitting(true)
    try {
      const payload = {
        patientId: formPatientId,
        dietType: formDietType,
        mealPlans: formMealPlans,
        preferences: formPreferences || undefined,
        allergies: formAllergies || undefined,
        instructions: formInstructions || undefined,
        startDate: formStartDate,
        endDate: formEndDate || undefined,
      }

      if (editingOrder) {
        await apiPut<SingleResponse<DietOrder>>(`/diet-orders/${editingOrder.id}`, payload)
        toast({ title: 'Success', description: 'Diet order updated successfully!' })
      } else {
        await apiPost<SingleResponse<DietOrder>>('/diet-orders', payload)
        toast({ title: 'Success', description: 'Diet order created successfully!' })
      }
      setOrderDialogOpen(false)
      fetchOrders()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleUpdateStatus = async (order: DietOrder, status: OrderStatus) => {
    try {
      await apiPut<SingleResponse<DietOrder>>(`/diet-orders/${order.id}`, { status })
      toast({ title: 'Success', description: `Order ${status.toLowerCase()} successfully!` })
      fetchOrders()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleSelectOrder = (order: DietOrder) => {
    setSelectedOrder(order)
    setActiveTab('meals')
  }

  const fetchMeals = useCallback(async () => {
    if (!selectedOrder) return
    setMealsLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<DietMeal>>(`/diet-orders/${selectedOrder.id}/meals`)
      setMeals(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setMealsLoading(false)
    }
  }, [selectedOrder, toast])

   
  useEffect(() => {
    if (activeTab === 'meals' && selectedOrder) // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMeals()
  }, [activeTab, selectedOrder, fetchMeals])

  const handleOpenAddMeal = () => {
    setFormMealTime('Breakfast')
    setFormMealItems('')
    setFormMealInstructions('')
    setMealDialogOpen(true)
  }

  const handleSubmitMeal = async () => {
    if (!selectedOrder || !formMealItems) {
      toast({ title: 'Error', description: 'Meal items are required', variant: 'destructive' })
      return
    }
    setMealSubmitting(true)
    try {
      await apiPost<SingleResponse<DietMeal>>(`/diet-orders/${selectedOrder.id}/meals`, {
        mealTime: formMealTime,
        items: formMealItems,
        instructions: formMealInstructions || undefined,
      })
      toast({ title: 'Success', description: 'Meal added successfully!' })
      setMealDialogOpen(false)
      fetchMeals()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setMealSubmitting(false)
    }
  }

  const handleMarkServed = async (meal: DietMeal) => {
    try {
      await apiPut<SingleResponse<DietMeal>>(`/diet-orders/${selectedOrder!.id}/meals/${meal.id}`, { served: true })
      toast({ title: 'Success', description: 'Meal marked as served!' })
      fetchMeals()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleDeleteMeal = async (meal: DietMeal) => {
    try {
      await apiDelete(`/diet-orders/${selectedOrder!.id}/meals/${meal.id}`)
      toast({ title: 'Success', description: 'Meal removed' })
      fetchMeals()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const mealsByTime = MEAL_TIMES.map((time) => ({
    time,
    meals: meals.filter((m) => m.mealTime === time),
    icon: MEAL_TIME_ICONS[time],
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Diet Management</h1>
          <p className="text-sm text-muted-foreground">Manage IPD patient diet orders and meal schedules</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            value={patientSearch}
            onChange={(e) => {
              setPatientSearch(e.target.value)
              handlePatientSearchChange(e.target.value)
            }}
            onFocus={() => searchResults.length > 0 && setShowPatientDropdown(true)}
            onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
            className="pl-9"
          />
          {showPatientDropdown && searchResults.length > 0 && (
            <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
              <CardContent className="p-2">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                    onMouseDown={() => selectPatient(p)}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.patientId}{p.bedNumber ? ` | Bed: ${p.bedNumber}` : ''}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders" className="gap-1.5">
            <UtensilsCrossed className="h-4 w-4" />
            Active Diet Orders
          </TabsTrigger>
          <TabsTrigger value="meals" className="gap-1.5" disabled={!selectedOrder}>
            <Calendar className="h-4 w-4" />
            Meal Schedule
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {ordersLoading ? 'Loading...' : `Showing ${orders.length} of ${total} orders`}
                </p>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleOpenNewOrder}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Diet Order
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {ordersError ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <AlertTriangle className="h-12 w-12 text-red-400" />
                  <p className="text-sm text-muted-foreground">{ordersError}</p>
                  <Button variant="outline" onClick={() => fetchOrders()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              ) : ordersLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-h-[560px] overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Diet Type</TableHead>
                        <TableHead>Meal Plan</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Preferences / Allergies</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                            <UtensilsCrossed className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            No diet orders found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                            <TableCell>
                              <p className="font-medium">{order.patientName}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{order.dietType}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {order.mealPlans.map((plan) => (
                                  <Badge key={plan} variant="outline" className="text-[10px] px-1.5 py-0">
                                    {plan}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {formatDate(order.startDate)}
                                {order.endDate && <span> → {formatDate(order.endDate)}</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs space-y-0.5">
                                {order.preferences && <p className="text-muted-foreground">Pref: {order.preferences}</p>}
                                {order.allergies && <p className="text-red-600">Allergy: {order.allergies}</p>}
                                {!order.preferences && !order.allergies && <span className="text-muted-foreground">-</span>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <OrderStatusBadge status={order.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="View Meals" onClick={() => handleSelectOrder(order)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => handleEditOrder(order)}>
                                  <SquarePen className="h-4 w-4" />
                                </Button>
                                {order.status === 'Active' && (
                                  <>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Complete" onClick={() => handleUpdateStatus(order, 'Completed')}>
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Cancel" onClick={() => handleUpdateStatus(order, 'Cancelled')}>
                                      <XCircle className="h-4 w-4" />
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

        <TabsContent value="meals">
          {selectedOrder ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <UtensilsCrossed className="h-5 w-5 text-emerald-600" />
                        Meal Schedule — {selectedOrder.patientName}
                      </CardTitle>
                      <CardDescription>
                        {selectedOrder.dietType} diet | {selectedOrder.orderId}
                        {selectedOrder.preferences && ` | ${selectedOrder.preferences}`}
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={handleOpenAddMeal}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Meal
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {mealsByTime.map(({ time, meals: timeMeals, icon: Icon }) => (
                  <Card key={time}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{time}</CardTitle>
                          <CardDescription className="text-xs">{timeMeals.length > 0 ? `${timeMeals.filter((m) => m.served).length}/${timeMeals.length} served` : 'No meals'}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {mealsLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-3 w-3/4" />
                            <Skeleton className="h-8 w-20" />
                          </div>
                        ))
                      ) : timeMeals.length === 0 ? (
                        <div className="flex flex-col items-center py-6 text-muted-foreground">
                          <Icon className="h-8 w-8 mb-2 opacity-30" />
                          <p className="text-xs">No meals scheduled</p>
                        </div>
                      ) : (
                        timeMeals.map((meal) => (
                          <div key={meal.id} className={`rounded-lg border p-3 space-y-2 ${meal.served ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800' : ''}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{meal.items}</p>
                                {meal.instructions && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{meal.instructions}</p>
                                )}
                              </div>
                              {meal.served ? (
                                <Badge variant="outline" className="shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Served
                                </Badge>
                              ) : (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleMarkServed(meal)}>
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Serve
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteMeal(meal)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {meal.servedAt && (
                              <p className="text-[10px] text-muted-foreground">
                                Served at {formatDateTime(meal.servedAt)}
                                {meal.servedBy ? ` by ${meal.servedBy}` : ''}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4 opacity-30" />
                <p className="text-lg font-medium text-muted-foreground">Select a diet order to view meal schedule</p>
                <p className="text-sm text-muted-foreground mt-1">Go to Active Diet Orders tab and click on an order</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={orderDialogOpen} onOpenChange={(open) => { if (!open) setOrderDialogOpen(false) }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-emerald-600" />
              {editingOrder ? 'Edit Diet Order' : 'New Diet Order'}
            </DialogTitle>
            <DialogDescription>
              {editingOrder ? `Update diet order for ${editingOrder.patientName}` : 'Create a new diet order for an IPD patient'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patient by name or ID..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value)
                    handlePatientSearchChange(e.target.value)
                  }}
                  onFocus={() => searchResults.length > 0 && setShowPatientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
                  className="pl-9"
                />
                {showPatientDropdown && searchResults.length > 0 && (
                  <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg">
                    <CardContent className="p-2 max-h-48 overflow-y-auto">
                      {searchResults.map((p) => (
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
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="diet-type">Diet Type *</Label>
                <Select value={formDietType} onValueChange={(v) => setFormDietType(v as DietType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIET_TYPES.map((dt) => (
                      <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Meal Plans *</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={formMealPlans.length === MEAL_PLANS.length}
                      onCheckedChange={() => toggleMealPlan('All' as MealPlan)}
                    />
                    All
                  </label>
                  {MEAL_PLANS.map((plan) => (
                    <label key={plan} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox
                        checked={formMealPlans.includes(plan)}
                        onCheckedChange={() => toggleMealPlan(plan)}
                      />
                      {plan}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferences">Preferences</Label>
              <Input
                id="preferences"
                placeholder="e.g., Vegetarian, Jain, No onion-garlic"
                value={formPreferences}
                onChange={(e) => setFormPreferences(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Input
                id="allergies"
                placeholder="e.g., Nuts, Dairy, Gluten"
                value={formAllergies}
                onChange={(e) => setFormAllergies(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea
                id="instructions"
                placeholder="Special dietary instructions..."
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date *</Label>
                <Input id="start-date" type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input id="end-date" type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmitOrder}
              disabled={!formPatientId || formMealPlans.length === 0 || formSubmitting}
            >
              {formSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UtensilsCrossed className="mr-2 h-4 w-4" />}
              {editingOrder ? 'Update Order' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mealDialogOpen} onOpenChange={(open) => { if (!open) setMealDialogOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Add Meal
            </DialogTitle>
            <DialogDescription>
              Add a meal to {selectedOrder?.patientName}&apos;s schedule
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meal-time">Meal Time *</Label>
              <Select value={formMealTime} onValueChange={(v) => setFormMealTime(v as MealTime)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_TIMES.map((mt) => (
                    <SelectItem key={mt} value={mt}>{mt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meal-items">Items *</Label>
              <Textarea
                id="meal-items"
                placeholder="e.g., Roti, Dal, Rice, Salad"
                value={formMealItems}
                onChange={(e) => setFormMealItems(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meal-instructions">Instructions</Label>
              <Textarea
                id="meal-instructions"
                placeholder="Preparation or serving instructions..."
                value={formMealInstructions}
                onChange={(e) => setFormMealInstructions(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMealDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSubmitMeal}
              disabled={!formMealItems || mealSubmitting}
            >
              {mealSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add Meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
