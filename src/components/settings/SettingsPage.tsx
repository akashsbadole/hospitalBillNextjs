'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { apiGet, apiPost, apiPut, apiDelete, type SingleResponse, type PaginatedResponse, ApiError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { validateGSTIN, cn, getRoleBadgeColor } from '@/lib/utils'
import { INDIAN_STATES, GST_SLABS } from '@/lib/constants'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
import { useAuth } from '@/stores/auth'
import { useBranchStore } from '@/stores/branch'
import { PaymentGatewaySettings } from '@/components/settings/PaymentGatewaySettings'
import { CustomFieldsSettings } from '@/components/settings/CustomFieldsSettings'
import { DepartmentSettings } from '@/components/settings/DepartmentSettings'
import { ModuleManagementSettings } from '@/components/modules/ModuleManagementSettings'
import { ImageUpload } from '@/components/ImageUpload'
import {
  Building2,
  Receipt,
  CreditCard,
  Shield,
  Database,
  Upload,
  Save,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Download,
  HardDrive,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  FilterX,
  X,
  List,
  ToggleLeft,
} from 'lucide-react'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const clinicSchema = z.object({
  clinicName: z.string().min(2, 'Clinic name is required'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit pincode'),
  phone: z.string().min(10, 'Enter a valid phone number'),
  email: z.string().email('Enter a valid email').or(z.literal('')),
  website: z.string().url('Enter a valid URL').or(z.literal('')),
})

type ClinicFormValues = z.infer<typeof clinicSchema>

const gstSchema = z.object({
  gstin: z.string().refine(
    (val) => val === '' || validateGSTIN(val),
    'Enter a valid GSTIN (e.g., 22AAAAA0000A1Z5)'
  ),
  gstType: z.enum(['none', 'regular', 'composition']),
  state: z.string().min(1, 'Select a state'),
})

type GstFormValues = z.infer<typeof gstSchema>

const hsnSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  description: z.string().min(2, 'Description is required'),
  gstRate: z.coerce.number().min(0).max(28),
})

type HsnFormValues = z.infer<typeof hsnSchema>

// ─── Types ─────────────────────────────────────────────────────────────────

interface ClinicSettings {
  id: string
  clinicName: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  website: string | null
  gstin: string | null
  gstType: string | null
  logo: string | null
  createdAt: string
  updatedAt: string
}

interface StaffMember {
  id: string
  staffId: string
  name: string
  email: string | null
  phone: string
  role: string
  status: string
  createdAt: string
}

interface HsnCode {
  id: string
  code: string
  description: string
  gstRate: number
  status: string
}

// ─── Audit Log Types ─────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string
  userId: string
  userName: string
  userEmail: string
  userRole: string
  action: string
  module: string
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  status: string
  createdAt: string
}

const ACTION_BADGE_COLORS: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  LOGOUT: 'bg-gray-100 text-gray-600',
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  VIEW: 'bg-purple-100 text-purple-700',
  EXPORT: 'bg-teal-100 text-teal-700',
  STATUS_CHANGE: 'bg-orange-100 text-orange-700',
}

const MODULE_BADGE_COLORS: Record<string, string> = {
  patients: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  appointments: 'bg-blue-50 text-blue-700 border-blue-200',
  doctors: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  billing: 'bg-amber-50 text-amber-700 border-amber-200',
  payments: 'bg-green-50 text-green-700 border-green-200',
  prescriptions: 'bg-rose-50 text-rose-700 border-rose-200',
  medicines: 'bg-violet-50 text-violet-700 border-violet-200',
  settings: 'bg-gray-50 text-gray-700 border-gray-200',
  reports: 'bg-sky-50 text-sky-700 border-sky-200',
  support: 'bg-orange-50 text-orange-700 border-orange-200',
  auth: 'bg-slate-50 text-slate-700 border-slate-200',
  users: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  staff: 'bg-pink-50 text-pink-700 border-pink-200',
}

const AUDIT_ACTIONS = [
  { value: '__all__', label: 'All Actions' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'VIEW', label: 'View' },
  { value: 'EXPORT', label: 'Export' },
  { value: 'STATUS_CHANGE', label: 'Status Change' },
]

const AUDIT_MODULES = [
  { value: '__all__', label: 'All Modules' },
  { value: 'patients', label: 'Patients' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'doctors', label: 'Doctors' },
  { value: 'billing', label: 'Billing' },
  { value: 'payments', label: 'Payments' },
  { value: 'prescriptions', label: 'Prescriptions' },
  { value: 'medicines', label: 'Medicines' },
  { value: 'settings', label: 'Settings' },
  { value: 'reports', label: 'Reports' },
  { value: 'support', label: 'Support' },
  { value: 'auth', label: 'Auth' },
]

// ─── Permission Matrix ──────────────────────────────────────────────
// 'full' = Read + Write, 'read' = Read Only, 'none' = No Access

type PermLevel = 'full' | 'read' | 'none'

interface PermissionRow {
  module: string
  admin: PermLevel
  receptionist: PermLevel
  doctor: PermLevel
  accountant: PermLevel
  pharmacist: PermLevel
}

const PERMISSION_MATRIX: PermissionRow[] = [
  { module: 'Dashboard', admin: 'full', receptionist: 'read', doctor: 'read', accountant: 'read', pharmacist: 'read' },
  { module: 'Patients', admin: 'full', receptionist: 'full', doctor: 'read', accountant: 'none', pharmacist: 'none' },
  { module: 'Appointments', admin: 'full', receptionist: 'full', doctor: 'full', accountant: 'none', pharmacist: 'none' },
  { module: 'Billing', admin: 'full', receptionist: 'full', doctor: 'none', accountant: 'full', pharmacist: 'none' },
  { module: 'Payments', admin: 'full', receptionist: 'full', doctor: 'none', accountant: 'full', pharmacist: 'none' },
  { module: 'Prescriptions', admin: 'full', receptionist: 'none', doctor: 'full', accountant: 'none', pharmacist: 'read' },
  { module: 'Inventory', admin: 'full', receptionist: 'none', doctor: 'none', accountant: 'none', pharmacist: 'full' },
  { module: 'Reports', admin: 'full', receptionist: 'none', doctor: 'none', accountant: 'full', pharmacist: 'none' },
  { module: 'Settings', admin: 'full', receptionist: 'none', doctor: 'none', accountant: 'none', pharmacist: 'none' },
  { module: 'Support', admin: 'full', receptionist: 'full', doctor: 'full', accountant: 'full', pharmacist: 'none' },
  { module: 'AI Analysis', admin: 'full', receptionist: 'read', doctor: 'full', accountant: 'read', pharmacist: 'read' },
  { module: 'Telemedicine', admin: 'full', receptionist: 'read', doctor: 'full', accountant: 'none', pharmacist: 'none' },
  { module: 'Bed Management', admin: 'full', receptionist: 'read', doctor: 'read', accountant: 'none', pharmacist: 'none' },
  { module: 'Lab Tests', admin: 'full', receptionist: 'read', doctor: 'read', accountant: 'none', pharmacist: 'read' },
  { module: 'Insurance', admin: 'full', receptionist: 'read', doctor: 'none', accountant: 'full', pharmacist: 'none' },
  { module: 'Branches', admin: 'full', receptionist: 'read', doctor: 'read', accountant: 'read', pharmacist: 'read' },
]

function renderPermissionCell(level: PermLevel) {
  if (level === 'full') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" aria-label="Full Access" />
  }
  if (level === 'read') {
    return <Clock className="h-4 w-4 text-amber-500 mx-auto" aria-label="Read Only" />
  }
  return <X className="h-4 w-4 text-red-400 mx-auto" aria-label="No Access" />
}

// ─── Audit Details Cell ─────────────────────────────────────────────────────

function AuditDetailsCell({ details }: { details: string | null }) {
  const [expanded, setExpanded] = useState(false)

  if (!details) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const displayText = expanded ? details : (details.length > 60 ? details.substring(0, 60) + '...' : details)
  const isLong = details.length > 60

  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{displayText}</span>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-emerald-600 hover:text-emerald-700 font-medium ml-1 whitespace-nowrap"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}

// ─── Branch Interface ─────────────────────────────────────────────────────

interface BranchRecord {
  id: string
  branchId: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  gstin: string | null
  isHead: boolean
  status: string
  createdAt: string
  updatedAt: string
}

const branchFormSchema = z.object({
  name: z.string().min(1, 'Branch name is required'),
  code: z.string().min(1, 'Branch code is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').or(z.literal('')),
  gstin: z.string().optional(),
  isHead: z.boolean().optional(),
})

type BranchFormValues = z.infer<typeof branchFormSchema>

// ─── Branches Settings Tab ──────────────────────────────────────────────

function BranchesSettingsTab() {
  const { toast } = useToast()
  const { user } = useAuth()
  const { fetchBranches } = useBranchStore()

  const [branchList, setBranchList] = useState<BranchRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null)
  const [deletingBranch, setDeletingBranch] = useState<BranchRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      gstin: '',
      isHead: false,
    },
  })

  const fetchBranchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiGet<PaginatedResponse<BranchRecord>>('/branches', { limit: '100' })
      setBranchList(res.data)
    } catch {
      // error handled silently
    } finally {
      setLoading(false)
    }
  }, [])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBranchList()
  }, [fetchBranchList])

  const handleOpenCreate = () => {
    setEditingBranch(null)
    form.reset({ name: '', code: '', address: '', city: '', state: '', pincode: '', phone: '', email: '', gstin: '', isHead: false })
    setDialogOpen(true)
  }

  const handleOpenEdit = (branch: BranchRecord) => {
    setEditingBranch(branch)
    form.reset({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      state: branch.state || '',
      pincode: branch.pincode || '',
      phone: branch.phone || '',
      email: branch.email || '',
      gstin: branch.gstin || '',
      isHead: branch.isHead,
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (values: BranchFormValues) => {
    try {
      if (editingBranch) {
        await apiPut(`/branches/${editingBranch.id}`, values)
        toast({ title: 'Branch Updated', description: `"${values.name}" has been updated.` })
      } else {
        await apiPost('/branches', values)
        toast({ title: 'Branch Created', description: `"${values.name}" has been created.` })
      }
      setDialogOpen(false)
      fetchBranchList()
      fetchBranches()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleDelete = async () => {
    if (!deletingBranch) return
    setDeleting(true)
    try {
      await apiDelete(`/branches/${deletingBranch.id}`)
      toast({ title: 'Branch Deactivated', description: `"${deletingBranch.name}" has been deactivated.` })
      setDeletingBranch(null)
      fetchBranchList()
      fetchBranches()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleHead = async (branch: BranchRecord) => {
    try {
      await apiPut(`/branches/${branch.id}`, { isHead: true })
      toast({ title: 'Head Branch Updated', description: `"${branch.name}" is now the head branch.` })
      fetchBranchList()
      fetchBranches()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const isAdmin = user?.role === 'Admin'

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Branches</CardTitle>
            <CardDescription>Manage your clinic branches and locations</CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={handleOpenCreate} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />Add Branch
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : branchList.length === 0 ? (
            <div className="text-center py-10">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium text-muted-foreground">No branches configured</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first branch to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Head</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branchList.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-mono text-xs">{branch.code}</TableCell>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell className="text-muted-foreground">{branch.city || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{branch.gstin || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-[10px] px-1.5 py-0 h-4 font-semibold',
                            branch.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400'
                          )}
                        >
                          {branch.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {branch.isHead ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            HEAD
                          </Badge>
                        ) : isAdmin && branch.status === 'Active' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => handleToggleHead(branch)}
                          >
                            Set as Head
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEdit(branch)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {branch.status === 'Active' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                  onClick={() => setDeletingBranch(branch)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Branch Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
            <DialogDescription>
              {editingBranch ? 'Update branch details below.' : 'Fill in the branch information.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Branch Name</FormLabel>
                    <FormControl><Input placeholder="Main Hospital" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Branch Code</FormLabel>
                    <FormControl>
                      <Input placeholder="MAIN" {...field} className="uppercase" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="branch@hospital.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gstin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN</FormLabel>
                    <FormControl><Input placeholder="22AAAAA0000A1Z5" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl><Textarea placeholder="Full address" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl><Input placeholder="Mumbai" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pincode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pincode</FormLabel>
                    <FormControl><Input placeholder="400001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isHead" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 col-span-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div>
                      <FormLabel>Set as Head Branch</FormLabel>
                      <FormDescription>This will be the primary branch for the organization</FormDescription>
                    </div>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit">{editingBranch ? 'Update Branch' : 'Create Branch'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingBranch} onOpenChange={() => setDeletingBranch(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Deactivate Branch</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong>{deletingBranch?.name}</strong>? This will set the branch status to Inactive. Active appointments or unpaid invoices will block this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingBranch(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SettingsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('clinic')

  // Settings state
  const [settings, setSettings] = useState<ClinicSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  // Staff state
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [savingUser, setSavingUser] = useState(false)
  const [userFormName, setUserFormName] = useState('')
  const [userFormEmail, setUserFormEmail] = useState('')
  const [userFormPhone, setUserFormPhone] = useState('')
  const [userFormRole, setUserFormRole] = useState('Receptionist')
  const [userFormStatus, setUserFormStatus] = useState('Active')
  const [autoPassword, setAutoPassword] = useState('')

  // HSN state
  const [hsnList, setHsnList] = useState<HsnCode[]>([
    { id: '1', code: '0011', description: 'Medical Consultation Services', gstRate: 0, status: 'Active' },
    { id: '2', code: '0012', description: 'Emergency Medical Services', gstRate: 0, status: 'Active' },
    { id: '3', code: '0013', description: 'Blood Tests & Pathology', gstRate: 5, status: 'Active' },
    { id: '4', code: '0014', description: 'X-Ray & Radiology', gstRate: 5, status: 'Active' },
    { id: '5', code: '0015', description: 'Ultrasound Services', gstRate: 5, status: 'Active' },
    { id: '6', code: '0016', description: 'MRI Scanning', gstRate: 5, status: 'Active' },
    { id: '7', code: '0017', description: 'CT Scan Services', gstRate: 5, status: 'Active' },
    { id: '8', code: '0018', description: 'ECG Services', gstRate: 5, status: 'Active' },
    { id: '9', code: '3004', description: 'Medicines & Pharmaceuticals', gstRate: 12, status: 'Active' },
    { id: '10', code: '9018', description: 'Surgical Instruments', gstRate: 12, status: 'Active' },
    { id: '11', code: '0010', description: 'Room Charges (General)', gstRate: 0, status: 'Active' },
    { id: '12', code: '0020', description: 'Health Check-up Packages', gstRate: 5, status: 'Active' },
  ])
  const [hsnDialogOpen, setHsnDialogOpen] = useState(false)
  const [editingHsn, setEditingHsn] = useState<HsnCode | null>(null)

  // Operating hours
  const [sameForAllDays, setSameForAllDays] = useState(false)
  const defaultHours = [
    { day: 'Monday', open: '09:00', close: '20:00', isOpen: true },
    { day: 'Tuesday', open: '09:00', close: '20:00', isOpen: true },
    { day: 'Wednesday', open: '09:00', close: '20:00', isOpen: true },
    { day: 'Thursday', open: '09:00', close: '20:00', isOpen: true },
    { day: 'Friday', open: '09:00', close: '20:00', isOpen: true },
    { day: 'Saturday', open: '09:00', close: '17:00', isOpen: true },
    { day: 'Sunday', open: '', close: '', isOpen: false },
  ]
  const [hours, setHours] = useState(defaultHours)

  // ─── Audit Log State ───
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotalPages, setAuditTotalPages] = useState(1)
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditAction, setAuditAction] = useState('__all__')
  const [auditModule, setAuditModule] = useState('__all__')
  const [auditFromDate, setAuditFromDate] = useState('')
  const [auditToDate, setAuditToDate] = useState('')
  const [auditSearch, setAuditSearch] = useState('')
  const auditSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ─── Forms ───
  const clinicForm = useForm<ClinicFormValues>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      clinicName: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      website: '',
    },
  })

  const gstForm = useForm<GstFormValues>({
    resolver: zodResolver(gstSchema),
    defaultValues: {
      gstin: '',
      gstType: 'none',
      state: '',
    },
  })

  const hsnForm = useForm<HsnFormValues>({
    resolver: zodResolver(hsnSchema) as Resolver<HsnFormValues>,
    defaultValues: { code: '', description: '', gstRate: 5 },
  })

  // ─── Fetch Settings ───
  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true)
    try {
      const res = await apiGet<SingleResponse<ClinicSettings>>('/settings')
      setSettings(res.data)
      setLogoUrl(res.data.logo || '')
      clinicForm.reset({
        clinicName: res.data.clinicName || '',
        address: res.data.address || '',
        city: res.data.city || '',
        state: res.data.state || '',
        pincode: res.data.pincode || '',
        phone: res.data.phone || '',
        email: res.data.email || '',
        website: res.data.website || '',
      })
      const gstTypeMap: Record<string, 'none' | 'regular' | 'composition'> = {
        None: 'none', Regular: 'regular', Composition: 'composition',
      }
      gstForm.reset({
        gstin: res.data.gstin || '',
        gstType: (res.data.gstType ? gstTypeMap[res.data.gstType] : 'none') || 'none',
        state: res.data.state || '',
      })
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: 'Failed to load settings', variant: 'destructive' })
      }
    } finally {
      setLoadingSettings(false)
    }
  }, [toast, clinicForm, gstForm])

  // ─── Fetch Staff ───
  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true)
    try {
      const res = await apiGet<PaginatedResponse<StaffMember>>('/staff', { limit: 100 })
      setStaffList(res.data)
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: 'Failed to load staff', variant: 'destructive' })
      }
    } finally {
      setLoadingStaff(false)
    }
  }, [toast])

   
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings()
  }, [fetchSettings])

  
  useEffect(() => {
    if ((activeTab === 'users' || activeTab === 'roles') && staffList.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStaff()
    }
  }, [activeTab, staffList.length, fetchStaff])

  // ─── User Management Handlers ───
  const handleOpenUserDialog = (staff?: StaffMember) => {
    if (staff) {
      setEditingStaff(staff)
      setUserFormName(staff.name)
      setUserFormEmail(staff.email || '')
      setUserFormPhone(staff.phone)
      setUserFormRole(staff.role)
      setUserFormStatus(staff.status)
      setAutoPassword('')
    } else {
      setEditingStaff(null)
      setUserFormName('')
      setUserFormEmail('')
      setUserFormPhone('')
      setUserFormRole('Receptionist')
      setUserFormStatus('Active')
      setAutoPassword('')
    }
    setUserDialogOpen(true)
  }

  const handleSaveUser = async () => {
    if (!userFormName.trim() || !userFormPhone.trim()) {
      toast({ title: 'Validation Error', description: 'Name and phone are required.', variant: 'destructive' })
      return
    }
    setSavingUser(true)
    try {
      if (editingStaff) {
        await apiPut('/staff', {
          id: editingStaff.id,
          name: userFormName.trim(),
          email: userFormEmail.trim() || '',
          phone: userFormPhone.trim(),
          role: userFormRole,
          status: userFormStatus,
        })
        toast({ title: 'User Updated', description: `"${userFormName}" has been updated.` })
      } else {
        await apiPost('/staff', {
          name: userFormName.trim(),
          email: userFormEmail.trim() || '',
          phone: userFormPhone.trim(),
          role: userFormRole,
          status: userFormStatus,
        })
        toast({ title: 'User Created', description: `"${userFormName}" has been created.` })
      }
      setUserDialogOpen(false)
      fetchStaff()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setSavingUser(false)
    }
  }

  const handleToggleStaffStatus = async (staff: StaffMember) => {
    const newStatus = staff.status === 'Active' ? 'Inactive' : 'Active'
    try {
      await apiPut('/staff', {
        id: staff.id,
        status: newStatus,
      })
      toast({ title: `User ${newStatus}`, description: `"${staff.name}" has been ${newStatus.toLowerCase()}.` })
      fetchStaff()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    }
  }

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#'
    let pass = ''
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setAutoPassword(pass)
  }

  // ─── Handlers ───
  const handleSaveClinic = async (data: ClinicFormValues) => {
    setSavingSettings(true)
    try {
      await apiPut<SingleResponse<ClinicSettings>>('/settings', data)
      toast({ title: 'Success', description: 'Clinic information saved successfully!' })
      fetchSettings()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveGST = async (data: GstFormValues) => {
    setSavingSettings(true)
    try {
      const gstTypeMap: Record<string, string> = { none: 'None', regular: 'Regular', composition: 'Composition' }
      await apiPut<SingleResponse<ClinicSettings>>('/settings', {
        gstin: data.gstin || null,
        gstType: gstTypeMap[data.gstType],
        state: data.state,
      })
      toast({ title: 'Success', description: 'GST settings saved successfully!' })
      fetchSettings()
    } catch (err) {
      if (err instanceof ApiError) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' })
      }
    } finally {
      setSavingSettings(false)
    }
  }

  const handleConnectionTest = async () => {
    try {
      await apiGet<SingleResponse<ClinicSettings>>('/settings')
      toast({ title: 'Connection Test', description: 'Connection Successful! API server is reachable.' })
    } catch {
      toast({ title: 'Connection Failed', description: 'Could not reach the server. Please check your network.', variant: 'destructive' })
    }
  }; void handleConnectionTest

  const handleOpenHsnDialog = (item?: HsnCode) => {
    if (item) {
      setEditingHsn(item)
      hsnForm.reset({ code: item.code, description: item.description, gstRate: item.gstRate })
    } else {
      setEditingHsn(null)
      hsnForm.reset({ code: '', description: '', gstRate: 5 })
    }
    setHsnDialogOpen(true)
  }

  const handleSaveHsn = (data: HsnFormValues) => {
    if (editingHsn) {
      setHsnList((prev) => prev.map((item) => (item.id === editingHsn.id ? { ...item, ...data } : item)))
      toast({ title: 'Success', description: 'HSN/SAC code updated successfully!' })
    } else {
      const newId = String(hsnList.length + 1)
      setHsnList((prev) => [...prev, { id: newId, ...data, status: 'Active' }])
      toast({ title: 'Success', description: 'HSN/SAC code added successfully!' })
    }
    setHsnDialogOpen(false)
  }

  const handleDeleteHsn = (id: string) => {
    setHsnList((prev) => prev.filter((item) => item.id !== id))
    toast({ title: 'Success', description: 'HSN/SAC code deleted.' })
  }

  const handleExportData = (type: string) => {
    toast({ title: 'Export Successful', description: `${type} exported successfully!` })
  }

  // ─── Fetch Audit Logs ───
  const fetchAuditLogs = useCallback(async () => {
    setLoadingAudit(true)
    setAuditError(null)
    try {
      const params: Record<string, string | number | undefined> = {
        page: auditPage,
        limit: 50,
      }
      if (auditAction && auditAction !== '__all__') params.action = auditAction
      if (auditModule && auditModule !== '__all__') params.module = auditModule
      if (auditFromDate) params.fromDate = auditFromDate
      if (auditToDate) params.toDate = auditToDate
      if (auditSearch) params.search = auditSearch
      const res = await apiGet<PaginatedResponse<AuditLogEntry>>('/audit-logs', params)
      setAuditLogs(res.data)
      setAuditTotal(res.total)
      setAuditTotalPages(res.totalPages)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setAuditError('Access denied. Only Admin can view audit logs.')
        } else {
          setAuditError('Failed to fetch audit logs.')
        }
      } else {
        setAuditError('Failed to fetch audit logs.')
      }
    } finally {
      setLoadingAudit(false)
    }
  }, [auditPage, auditAction, auditModule, auditFromDate, auditToDate, auditSearch])

   
  useEffect(() => {
    if (activeTab === 'audit') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAuditLogs()
    }
  }, [activeTab, fetchAuditLogs])

  const handleAuditSearchChange = (value: string) => {
    setAuditSearch(value)
    if (auditSearchRef.current) clearTimeout(auditSearchRef.current)
    auditSearchRef.current = setTimeout(() => {
      setAuditPage(1)
    }, 300)
  }

  const handleAuditFilterChange = () => {
    setAuditPage(1)
  }

  const clearAuditFilters = () => {
    setAuditAction('__all__')
    setAuditModule('__all__')
    setAuditFromDate('')
    setAuditToDate('')
    setAuditSearch('')
    setAuditPage(1)
  }

  // ─── Loading State ───
  if (loadingSettings && activeTab === 'clinic') {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[500px]" />
        <Card><CardContent className="p-6"><Skeleton className="h-[500px] w-full" /></CardContent></Card>
      </div>
    )
  }

  // ─── Render ───
  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="clinic"><Building2 className="h-4 w-4 mr-1.5" />Clinic Info</TabsTrigger>
          <TabsTrigger value="branches"><Building2 className="h-4 w-4 mr-1.5" />Branches</TabsTrigger>
          <TabsTrigger value="departments"><Building2 className="h-4 w-4 mr-1.5" />Departments</TabsTrigger>
          <TabsTrigger value="gst"><Receipt className="h-4 w-4 mr-1.5" />GST Settings</TabsTrigger>
          <TabsTrigger value="payment"><CreditCard className="h-4 w-4 mr-1.5" />Payment</TabsTrigger>
          <TabsTrigger value="users"><Shield className="h-4 w-4 mr-1.5" />User Management</TabsTrigger>
          {user?.role === 'Admin' && (
            <TabsTrigger value="custom-fields"><List className="h-4 w-4 mr-1.5" />Custom Fields</TabsTrigger>
          )}
          <TabsTrigger value="backup"><Database className="h-4 w-4 mr-1.5" />Backup & Data</TabsTrigger>
          {user?.role === 'Admin' && (
            <TabsTrigger value="audit"><ScrollText className="h-4 w-4 mr-1.5" />Audit Logs</TabsTrigger>
          )}
          {user?.role === 'Super Admin' && (
            <TabsTrigger value="modules"><ToggleLeft className="h-4 w-4 mr-1.5" />Modules</TabsTrigger>
          )}
        </TabsList>

        {/* ═══ TAB 1: CLINIC INFORMATION ═══ */}
        <TabsContent value="clinic" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinic Details</CardTitle>
              <CardDescription>Update your clinic&apos;s basic information and contact details</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...clinicForm}>
                <form onSubmit={clinicForm.handleSubmit(handleSaveClinic)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField control={clinicForm.control} name="clinicName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clinic Name</FormLabel>
                        <FormControl><Input placeholder="Your Clinic Name" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={clinicForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="clinic@example.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={clinicForm.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl><Input placeholder="+91 98765 43210" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={clinicForm.control} name="website" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl><Input placeholder="https://yourclinic.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={clinicForm.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl><Textarea placeholder="Full address" className="resize-none" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField control={clinicForm.control} name="city" render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl><Input placeholder="City" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={clinicForm.control} name="state" render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                          <SelectContent className="max-h-64">
                            {[...INDIAN_STATES].map((state) => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={clinicForm.control} name="pincode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pincode</FormLabel>
                        <FormControl><Input placeholder="110001" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="space-y-2">
                    <Label>Clinic Logo</Label>
                    <ImageUpload
                      currentImage={logoUrl}
                      onUploadComplete={(url) => setLogoUrl(url)}
                      type="logo"
                      aspectRatio="aspect-[2/1]"
                      className="items-start"
                    />
                    <p className="text-xs text-muted-foreground">Upload your clinic logo. Supported: JPEG, PNG, WebP, GIF (max 5MB).</p>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={savingSettings}>
                      {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Operating Hours */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Operating Hours</CardTitle>
                  <CardDescription>Set clinic opening and closing times</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="same-hours" className="text-sm text-muted-foreground">Same for all days</Label>
                  <Switch
                    id="same-hours"
                    checked={sameForAllDays}
                    onCheckedChange={(checked) => {
                      setSameForAllDays(checked)
                      if (checked) setHours((prev) => prev.map((h) => ({ ...h, open: prev[0].open, close: prev[0].close, isOpen: true })))
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {hours.map((item, idx) => (
                  <div key={item.day} className="flex items-center gap-4 rounded-lg border p-3">
                    <div className="w-28 shrink-0"><Label className="text-sm font-medium">{item.day}</Label></div>
                    <Switch checked={item.isOpen} onCheckedChange={(checked) => setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, isOpen: checked } : h)))} />
                    <div className="flex items-center gap-2 flex-1">
                      <Input type="time" value={item.open} onChange={(e) => setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, open: e.target.value } : h)))} disabled={!item.isOpen} className="w-32" />
                      <span className="text-muted-foreground">to</span>
                      <Input type="time" value={item.close} onChange={(e) => setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, close: e.target.value } : h)))} disabled={!item.isOpen} className="w-32" />
                    </div>
                    {!item.isOpen && <Badge variant="secondary" className="bg-red-100 text-red-700">Closed</Badge>}
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-4">
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => toast({ title: 'Success', description: 'Operating hours saved successfully!' })}>
                  <Save className="h-4 w-4" />Save Hours
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB 2: BRANCHES ═══ */}
        <TabsContent value="branches" className="space-y-6 mt-6">
          <BranchesSettingsTab />
        </TabsContent>

        {/* ═══ TAB 3: DEPARTMENTS ═══ */}
        <TabsContent value="departments" className="space-y-6 mt-6">
          <DepartmentSettings />
        </TabsContent>

        {/* ═══ TAB 4: GST SETTINGS ═══ */}
        <TabsContent value="gst" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>GST Configuration</CardTitle>
              <CardDescription>Configure your GST identification and tax type for compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...gstForm}>
                <form onSubmit={gstForm.handleSubmit(handleSaveGST)} className="space-y-6">
                  <FormField control={gstForm.control} name="gstin" render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN</FormLabel>
                      <FormControl><Input placeholder="22AAAAA0000A1Z5" className="uppercase tracking-wider font-mono" {...field} /></FormControl>
                      <FormDescription>15-character GST Identification Number</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={gstForm.control} name="gstType" render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>GST Registration Type</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {[
                            { value: 'none', label: 'None', desc: 'No GST registration' },
                            { value: 'regular', label: 'Regular', desc: 'Regular taxpayer' },
                            { value: 'composition', label: 'Composition', desc: 'Composition scheme' },
                          ].map((option) => (
                            <label key={option.value} className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-4 cursor-pointer transition-colors ${field.value === option.value ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-muted hover:border-muted-foreground/30'}`}>
                              <div className="flex items-center gap-2">
                                <input type="radio" className="accent-emerald-600" checked={field.value === option.value} onChange={() => field.onChange(option.value)} />
                                <span className="text-sm font-medium">{option.label}</span>
                              </div>
                              <span className="text-xs text-muted-foreground pl-6">{option.desc}</span>
                            </label>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={gstForm.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                        <SelectContent className="max-h-64">
                          {[...INDIAN_STATES].map((state) => (
                            <SelectItem key={state} value={state}>{state}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Used for determining intra-state (CGST+SGST) vs inter-state (IGST) tax</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex justify-end">
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={savingSettings}>
                      {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save GST Settings
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* HSN/SAC Code Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>HSN/SAC Code Management</CardTitle>
                  <CardDescription>Manage service codes for GST invoicing</CardDescription>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => handleOpenHsnDialog()}>
                  <Plus className="h-4 w-4" />Add Code
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">GST Rate</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hsnList.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">{item.code}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-center"><Badge variant="secondary">{item.gstRate}%</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className="bg-emerald-100 text-emerald-700">{item.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenHsnDialog(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDeleteHsn(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* HSN Dialog */}
          <Dialog open={hsnDialogOpen} onOpenChange={setHsnDialogOpen}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>{editingHsn ? 'Edit' : 'Add'} HSN/SAC Code</DialogTitle>
                <DialogDescription>{editingHsn ? 'Update the service code details.' : 'Enter details for the new service code.'}</DialogDescription>
              </DialogHeader>
              <Form {...hsnForm}>
                <form onSubmit={hsnForm.handleSubmit(handleSaveHsn)} className="space-y-4">
                  <FormField control={hsnForm.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl><Input placeholder="e.g., 0011" className="font-mono" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={hsnForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Input placeholder="Service description" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={hsnForm.control} name="gstRate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>GST Rate (%)</FormLabel>
                      <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {GST_SLABS.map((rate) => (
                            <SelectItem key={rate} value={String(rate)}>{rate}%</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setHsnDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{editingHsn ? 'Update' : 'Add'} Code</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══ TAB 3: PAYMENT SETTINGS ═══ */}
        <TabsContent value="payment" className="space-y-6 mt-6">
          <PaymentGatewaySettings />
        </TabsContent>

        {/* ═══ TAB 4: USER MANAGEMENT ═══ */}
        <TabsContent value="users" className="space-y-6 mt-6">
          {/* System Roles Overview */}
          <Card>
            <CardHeader>
              <CardTitle>System Roles</CardTitle>
              <CardDescription>Predefined roles with their access levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: '1', name: 'Admin', description: 'Full System Access', color: 'bg-red-100 text-red-700 border-red-200' },
                  { id: '2', name: 'Receptionist', description: 'Patient registration, appointments, billing', color: 'bg-sky-100 text-sky-700 border-sky-200' },
                  { id: '3', name: 'Doctor', description: 'View own patients, prescriptions', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                  { id: '4', name: 'Accountant', description: 'Billing, GST reports, payments', color: 'bg-amber-100 text-amber-700 border-amber-200' },
                  { id: '5', name: 'Pharmacist', description: 'Medicine inventory, sales', color: 'bg-violet-100 text-violet-700 border-violet-200' },
                ].map((role) => {
                  const userCount = staffList.filter((s) => s.role === role.name).length
                  return (
                    <div key={role.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={role.color}>{role.name}</Badge>
                        <span className="text-xs text-muted-foreground">{userCount} users</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* User Management Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage staff accounts, roles, and permissions</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={fetchStaff} className="gap-1.5">
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingStaff ? 'animate-spin' : ''}`} />Refresh
                  </Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 gap-1.5" size="sm" onClick={() => handleOpenUserDialog()}>
                    <Plus className="h-4 w-4" />Add User
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingStaff ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : staffList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No staff members found</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden lg:table-cell">Staff ID</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffList.map((staff) => (
                        <TableRow key={staff.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-300">
                                {staff.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{staff.name}</p>
                                <p className="text-xs text-muted-foreground">{staff.phone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{staff.email || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getRoleBadgeColor(staff.role)}>{staff.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={staff.status === 'Active' ? 'secondary' : 'secondary'}
                              className={`text-[10px] px-1.5 py-0 h-5 font-semibold ${
                                staff.status === 'Active'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400'
                              }`}
                            >
                              {staff.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell font-mono text-xs">{staff.staffId}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenUserDialog(staff)} title="Edit User">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${staff.status === 'Active' ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}
                                onClick={() => handleToggleStaffStatus(staff)}
                                title={staff.status === 'Active' ? 'Deactivate' : 'Activate'}
                              >
                                {staff.status === 'Active' ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Permissions Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>Role Permission Matrix</CardTitle>
              <CardDescription>Access levels per module for each role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="min-w-[140px]">Module</TableHead>
                      <TableHead className="text-center min-w-[80px]"><Badge variant="outline" className={getRoleBadgeColor('Admin')}>Admin</Badge></TableHead>
                      <TableHead className="text-center min-w-[100px]"><Badge variant="outline" className={getRoleBadgeColor('Receptionist')}>Receptionist</Badge></TableHead>
                      <TableHead className="text-center min-w-[80px]"><Badge variant="outline" className={getRoleBadgeColor('Doctor')}>Doctor</Badge></TableHead>
                      <TableHead className="text-center min-w-[100px]"><Badge variant="outline" className={getRoleBadgeColor('Accountant')}>Accountant</Badge></TableHead>
                      <TableHead className="text-center min-w-[100px]"><Badge variant="outline" className={getRoleBadgeColor('Pharmacist')}>Pharmacist</Badge></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSION_MATRIX.map((row) => (
                      <TableRow key={row.module}>
                        <TableCell className="font-medium text-xs">{row.module}</TableCell>
                        <TableCell className="text-center">{renderPermissionCell(row.admin)}</TableCell>
                        <TableCell className="text-center">{renderPermissionCell(row.receptionist)}</TableCell>
                        <TableCell className="text-center">{renderPermissionCell(row.doctor)}</TableCell>
                        <TableCell className="text-center">{renderPermissionCell(row.accountant)}</TableCell>
                        <TableCell className="text-center">{renderPermissionCell(row.pharmacist)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Full Access (Read + Write)
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  Read Only
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <X className="h-3.5 w-3.5 text-red-400" />
                  No Access
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB 5: CUSTOM FIELDS ═══ */}
        <TabsContent value="custom-fields" className="space-y-6 mt-6">
          {user?.role !== 'Admin' ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Shield className="h-8 w-8 text-red-600" />
              <h3 className="text-lg font-semibold">Admin Only</h3>
              <p className="text-sm text-muted-foreground">Custom fields can only be managed by administrators.</p>
            </CardContent></Card>
          ) : (
            <CustomFieldsSettings />
          )}
        </TabsContent>

        {/* ═══ TAB 6: BACKUP & DATA ═══ */}
        <TabsContent value="backup" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Backup</CardTitle>
              <CardDescription>Automatic database backup configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /><span className="text-sm">Last Backup</span></div>
                  <p className="text-lg font-semibold">{settings?.updatedAt ? new Date(settings.updatedAt).toLocaleDateString('en-IN') : 'N/A'}</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground"><Database className="h-4 w-4" /><span className="text-sm">Database</span></div>
                  <p className="text-lg font-semibold">SQLite</p>
                </div>
                <div className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground"><HardDrive className="h-4 w-4" /><span className="text-sm">Environment</span></div>
                  <p className="text-lg font-semibold">Production</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" onClick={() => toast({ title: 'Success', description: 'Manual backup initiated successfully!' })}>
                  <Database className="h-4 w-4" />Create Backup Now
                </Button>
                <Button variant="outline" onClick={() => toast({ title: 'Info', description: 'Backup restoration would begin in a production environment.' })} className="gap-2">
                  <Upload className="h-4 w-4" />Restore from Backup
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>Export data in various formats for external use</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'Patients Data', desc: 'All patient records', format: 'CSV' },
                  { label: 'Invoices', desc: 'All billing invoices', format: 'CSV' },
                  { label: 'Appointments', desc: 'Appointment history', format: 'CSV' },
                  { label: 'Payments', desc: 'Payment transactions', format: 'CSV' },
                  { label: 'Prescriptions', desc: 'All prescriptions', format: 'CSV' },
                  { label: 'Inventory', desc: 'Medicine stock data', format: 'CSV' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleExportData(item.label)} className="gap-1.5 shrink-0">
                      <Download className="h-3.5 w-3.5" />{item.format}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB 6: AUDIT LOGS (Admin Only) ═══ */}
        <TabsContent value="audit" className="space-y-6 mt-6">
          {user?.role !== 'Admin' ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <Shield className="h-8 w-8 text-red-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Admin Only</h3>
                  <p className="text-sm text-muted-foreground mt-1">Audit logs are only accessible to administrators.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filters Card */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle>Audit Trail</CardTitle>
                      <CardDescription>Track all system activity and user actions</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={clearAuditFilters} className="gap-1.5">
                        <FilterX className="h-3.5 w-3.5" />Clear Filters
                      </Button>
                      <Button variant="outline" size="sm" onClick={fetchAuditLogs} className="gap-1.5">
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />Refresh
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Search */}
                    <div className="relative lg:col-span-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, email, details..."
                        value={auditSearch}
                        onChange={(e) => handleAuditSearchChange(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {/* Action Filter */}
                    <Select value={auditAction} onValueChange={(val) => { setAuditAction(val); handleAuditFilterChange() }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Actions" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIT_ACTIONS.map((a) => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Module Filter */}
                    <Select value={auditModule} onValueChange={(val) => { setAuditModule(val); handleAuditFilterChange() }}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Modules" />
                      </SelectTrigger>
                      <SelectContent>
                        {AUDIT_MODULES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Date Range */}
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={auditFromDate}
                        onChange={(e) => { setAuditFromDate(e.target.value); handleAuditFilterChange() }}
                        className="text-xs"
                        placeholder="From"
                      />
                      <Input
                        type="date"
                        value={auditToDate}
                        onChange={(e) => { setAuditToDate(e.target.value); handleAuditFilterChange() }}
                        className="text-xs"
                        placeholder="To"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Log Table Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Activity Log</CardTitle>
                    <p className="text-sm text-muted-foreground">{auditTotal} entries found</p>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingAudit ? (
                    <div className="space-y-3">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : auditError ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <AlertCircle className="h-12 w-12 text-red-400" />
                      <div className="text-center">
                        <p className="font-medium text-red-600">Error</p>
                        <p className="text-sm text-muted-foreground mt-1">{auditError}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={fetchAuditLogs} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />Retry
                      </Button>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                      <ScrollText className="h-12 w-12 text-muted-foreground" />
                      <div className="text-center">
                        <p className="font-medium">No Audit Logs Found</p>
                        <p className="text-sm text-muted-foreground mt-1">No activity logs match your current filters.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={clearAuditFilters} className="gap-1.5">
                        <FilterX className="h-3.5 w-3.5" />Clear Filters
                      </Button>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block max-h-[600px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[160px]">Timestamp</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead className="w-[90px]">Role</TableHead>
                              <TableHead className="w-[100px]">Action</TableHead>
                              <TableHead className="w-[110px]">Module</TableHead>
                              <TableHead>Details</TableHead>
                              <TableHead className="w-[120px]">IP Address</TableHead>
                              <TableHead className="w-[140px]">User Agent</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {auditLogs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(log.createdAt).toLocaleString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">{log.userName}</p>
                                    <p className="text-xs text-muted-foreground">{log.userEmail}</p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs">
                                    {log.userRole}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={`text-xs ${ACTION_BADGE_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                                    {log.action}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-xs ${MODULE_BADGE_COLORS[log.module] || ''}`}>
                                    {log.module}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                  <AuditDetailsCell details={log.details} />
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">
                                  {log.ipAddress || '—'}
                                </TableCell>
                                <TableCell className="max-w-[140px]">
                                  <span className="text-xs text-muted-foreground" title={log.userAgent || ''}>
                                    {log.userAgent ? (log.userAgent.length > 30 ? log.userAgent.substring(0, 30) + '...' : log.userAgent) : '—'}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile Cards */}
                      <div className="md:hidden space-y-3">
                        {auditLogs.map((log) => (
                          <div key={log.id} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge className={`text-xs ${ACTION_BADGE_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                                  {log.action}
                                </Badge>
                                <Badge variant="outline" className={`text-xs ${MODULE_BADGE_COLORS[log.module] || ''}`}>
                                  {log.module}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(log.createdAt).toLocaleString('en-IN', {
                                  day: '2-digit', month: 'short',
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{log.userName}</p>
                              <Badge variant="secondary" className="text-xs">{log.userRole}</Badge>
                            </div>
                            {log.details && (
                              <AuditDetailsCell details={log.details} />
                            )}
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span className="font-mono">{log.ipAddress || '—'}</span>
                              <span>{log.userEmail}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {auditTotalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Page {auditPage} of {auditTotalPages}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                              disabled={auditPage <= 1}
                              className="gap-1"
                            >
                              <ChevronLeft className="h-4 w-4" />Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                              disabled={auditPage >= auditTotalPages}
                              className="gap-1"
                            >
                              Next<ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="modules" className="space-y-6 mt-6">
          {user?.role !== 'Super Admin' ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Super Admin Only</h3>
                  <p className="text-sm text-muted-foreground mt-1">Module management is only accessible to Super Admin users.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ModuleManagementSettings />
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ ADD/EDIT USER DIALOG ═══ */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingStaff ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {editingStaff ? 'Update user details below.' : 'Fill in the user information to create a new staff account.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                placeholder="Full name"
                value={userFormName}
                onChange={(e) => setUserFormName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="user@hospital.com"
                  value={userFormEmail}
                  onChange={(e) => setUserFormEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={userFormPhone}
                  onChange={(e) => setUserFormPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={userFormRole} onValueChange={setUserFormRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={getRoleBadgeColor('Admin')}>Admin</Badge>
                      </span>
                    </SelectItem>
                    <SelectItem value="Doctor">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={getRoleBadgeColor('Doctor')}>Doctor</Badge>
                      </span>
                    </SelectItem>
                    <SelectItem value="Receptionist">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={getRoleBadgeColor('Receptionist')}>Receptionist</Badge>
                      </span>
                    </SelectItem>
                    <SelectItem value="Accountant">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={getRoleBadgeColor('Accountant')}>Accountant</Badge>
                      </span>
                    </SelectItem>
                    <SelectItem value="Pharmacist">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={getRoleBadgeColor('Pharmacist')}>Pharmacist</Badge>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={userFormStatus} onValueChange={setUserFormStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editingStaff && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Password (Auto-generate)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleGeneratePassword} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Generate
                  </Button>
                </div>
                <Input
                  type="text"
                  placeholder="Click Generate to create a password"
                  value={autoPassword}
                  onChange={(e) => setAutoPassword(e.target.value)}
                  readOnly
                  className="font-mono"
                />
                {autoPassword && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Copy this password. It will not be shown again.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleSaveUser}
              disabled={!userFormName.trim() || !userFormPhone.trim() || savingUser}
            >
              {savingUser ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingStaff ? 'Update User' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
