'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Menu, Bell, Search, LogOut, User, Shield, Building2, ChevronDown,
  LogIn, Plus, Pencil, Trash2, FileText, Loader2, X, Eye,
  Users, Receipt, ClipboardList, CalendarDays, Stethoscope
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useNavigation } from '@/stores/navigation'
import { useAuth } from '@/stores/auth'
import { useBranchStore } from '@/stores/branch'
import { apiGet } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'

// ── Types ──────────────────────────────────────────────────────────────────

interface SearchPatient {
  id: string
  patientId: string
  name: string
  phone: string
  email: string | null
  bloodGroup: string | null
  gender: string | null
  status: string
}

interface SearchInvoice {
  id: string
  invoiceNumber: string
  date: string
  status: string
  grandTotal: number
  paidAmount: number
  patient: { name: string } | null
}

interface SearchPrescription {
  id: string
  prescriptionId: string
  date: string
  diagnosis: string | null
  patient: { name: string } | null
  doctor: { name: string } | null
}

interface SearchAppointment {
  id: string
  aptId: string
  date: string
  time: string
  status: string
  type: string
  patient: { name: string } | null
  doctor: { name: string } | null
}

interface SearchDoctor {
  id: string
  doctorId: string
  name: string
  specialization: string
  qualification: string | null
  consultationFee: number
  phone: string
  status: string
}

interface SearchResults {
  patients: SearchPatient[]
  invoices: SearchInvoice[]
  prescriptions: SearchPrescription[]
  appointments: SearchAppointment[]
  doctors: SearchDoctor[]
}

interface AuditLog {
  id: string
  action: string
  module: string
  details: string | null
  userName: string
  userRole: string
  createdAt: string
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  patients: 'Patient Management',
  'patient-detail': 'Patient Details',
  appointments: 'Appointments',
  doctors: 'Doctors & Staff',
  billing: 'Billing & Invoices',
  'invoice-detail': 'Invoice Details',
  payments: 'Payments',
  insurance: 'Insurance & Claims',
  inventory: 'Inventory & Pharmacy',
  prescriptions: 'Prescriptions',
  'lab-tests': 'Lab Tests',
  reports: 'Reports & Analytics',
  settings: 'Settings',
}

const ROLE_COLORS: Record<string, string> = {
  Admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Receptionist: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Doctor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Accountant: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Pharmacist: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  Unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Partially Paid': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Overdue: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
}

const APT_STATUS_COLORS: Record<string, string> = {
  Scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'No-Show': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
}

function getActionIcon(action: string) {
  switch (action) {
    case 'LOGIN': return <LogIn className="h-4 w-4" />
    case 'LOGOUT': return <LogIn className="h-4 w-4" />
    case 'CREATE': return <Plus className="h-4 w-4" />
    case 'UPDATE': return <Pencil className="h-4 w-4" />
    case 'DELETE': return <Trash2 className="h-4 w-4" />
    case 'VIEW': return <Eye className="h-4 w-4" />
    case 'EXPORT': return <FileText className="h-4 w-4" />
    default: return <FileText className="h-4 w-4" />
  }
}

function getActionColor(action: string) {
  switch (action) {
    case 'LOGIN': return 'text-emerald-600 dark:text-emerald-400'
    case 'LOGOUT': return 'text-gray-600 dark:text-gray-400'
    case 'CREATE': return 'text-blue-600 dark:text-blue-400'
    case 'UPDATE': return 'text-amber-600 dark:text-amber-400'
    case 'DELETE': return 'text-red-600 dark:text-red-400'
    case 'VIEW': return 'text-purple-600 dark:text-purple-400'
    case 'EXPORT': return 'text-emerald-600 dark:text-emerald-400'
    default: return 'text-gray-600 dark:text-gray-400'
  }
}

function getActionBgColor(action: string) {
  switch (action) {
    case 'LOGIN': return 'bg-emerald-50 dark:bg-emerald-950/50'
    case 'LOGOUT': return 'bg-gray-50 dark:bg-gray-950/50'
    case 'CREATE': return 'bg-blue-50 dark:bg-blue-950/50'
    case 'UPDATE': return 'bg-amber-50 dark:bg-amber-950/50'
    case 'DELETE': return 'bg-red-50 dark:bg-red-950/50'
    case 'VIEW': return 'bg-purple-50 dark:bg-purple-950/50'
    case 'EXPORT': return 'bg-emerald-50 dark:bg-emerald-950/50'
    default: return 'bg-gray-50 dark:bg-gray-950/50'
  }
}

function formatActionDescription(log: AuditLog): string {
  try {
    const details = log.details ? JSON.parse(log.details) : null
    const entityName = details?.name || details?.patientId || details?.invoiceNumber || details?.aptId || details?.prescriptionId || ''
    const actionMap: Record<string, string> = {
      LOGIN: 'Logged in',
      LOGOUT: 'Logged out',
      CREATE: `Created ${log.module.slice(0, -1)}${entityName ? ` ${entityName}` : ''}`,
      UPDATE: `Updated ${log.module.slice(0, -1)}${entityName ? ` ${entityName}` : ''}`,
      DELETE: `Deleted ${log.module.slice(0, -1)}${entityName ? ` ${entityName}` : ''}`,
      VIEW: `Viewed ${log.module}`,
      EXPORT: `Exported ${log.module} report`,
      STATUS_CHANGE: `Changed status for ${log.module.slice(0, -1)}${entityName ? ` ${entityName}` : ''}`,
    }
    return actionMap[log.action] || `${log.action} on ${log.module}`
  } catch {
    return `${log.action} on ${log.module}`
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export function AppHeader() {
  const { currentPage, pageParams, toggleSidebar, setCurrentPage } = useNavigation()
  const { user, logout } = useAuth()
  const { branches, selectedBranchId, loading, fetchBranches, selectBranch } = useBranchStore()

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Notification state
  const [notifications, setNotifications] = useState<AuditLog[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const notifPollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (branches.length === 0 && !loading) {
      fetchBranches()
    }
  }, [branches.length, loading, fetchBranches])

  const title = PAGE_TITLES[currentPage] || 'Dashboard'
  const role = user?.role || ''

  const selectedBranch = selectedBranchId
    ? branches.find((b) => b.id === selectedBranchId)
    : null

  const showBranchSwitcher = branches.length > 1

  // ── Search Functions ────────────────────────────────────────────────────

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    setSearchLoading(true)
    try {
      const results = await apiGet<SearchResults>('/search', { q: query, limit: 5 })
      setSearchResults(results)
    } catch {
      setSearchResults(null)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value)
    }, 300)
  }, [performSearch])

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setSearchQuery('')
    setSearchResults(null)
  }, [])

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (searchOpen) {
          setSearchOpen(false)
        } else {
          openSearch()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, openSearch])

  // Navigate to search result
  const handleSearchSelect = useCallback((type: string, item: { id: string }) => {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults(null)
    switch (type) {
      case 'patient':
        setCurrentPage('patient-detail', { id: item.id })
        break
      case 'invoice':
        setCurrentPage('invoice-detail', { id: item.id })
        break
      case 'prescription':
        setCurrentPage('prescriptions')
        break
      case 'appointment':
        setCurrentPage('appointments')
        break
      case 'doctor':
        setCurrentPage('doctors')
        break
    }
  }, [setCurrentPage])

  // ── Notification Functions ──────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true)
    try {
      const res = await apiGet<{ data: AuditLog[] }>('/audit-logs', { limit: 10, page: 1 })
      setNotifications(res.data || [])
    } catch {
      // Non-admin users will get 403, silently ignore
      setNotifications([])
    } finally {
      setNotifLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Poll every 30 seconds
  useEffect(() => {
    notifPollRef.current = setInterval(() => {
      fetchNotifications()
    }, 30000)
    return () => {
      if (notifPollRef.current) clearInterval(notifPollRef.current)
    }
  }, [fetchNotifications])

  const handleViewAllNotifications = useCallback(() => {
    setNotifOpen(false)
    setCurrentPage('reports')
    // The reports page should show audit trail tab — we can set a param
    // Using setCurrentPage doesn't support extra params, so navigate normally
  }, [setCurrentPage])

  const unreadCount = notifications.length

  // ── Count total results for empty state ─────────────────────────────────
  const totalResults = searchResults
    ? searchResults.patients.length +
      searchResults.invoices.length +
      searchResults.prescriptions.length +
      searchResults.appointments.length +
      searchResults.doctors.length
    : 0

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {pageParams?.id && (
          <p className="text-xs text-muted-foreground">ID: {pageParams.id}</p>
        )}
      </div>

      {/* Branch Switcher */}
      {showBranchSwitcher && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2 h-9">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="max-w-[120px] truncate text-sm">
                {selectedBranch ? selectedBranch.name : 'All Branches'}
              </span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => selectBranch(null)}
              className={cn(
                'cursor-pointer',
                !selectedBranchId && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              )}
            >
              <Building2 className="h-4 w-4 mr-2" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">All Branches</span>
                <span className="text-xs text-muted-foreground">Combined view</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {branches
              .filter((b) => b.status === 'Active')
              .map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  onClick={() => selectBranch(branch.id)}
                  className={cn(
                    'cursor-pointer',
                    selectedBranchId === branch.id && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  )}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{branch.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {branch.city ? `${branch.city}` : branch.code}
                      {branch.isHead && (
                        <Badge variant="secondary" className="ml-1.5 text-[9px] px-1 py-0 h-3.5 font-semibold">
                          HEAD
                        </Badge>
                      )}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Search Trigger */}
      <Button
        variant="outline"
        size="sm"
        className="hidden md:flex items-center gap-2 h-9 w-64 justify-start text-muted-foreground font-normal"
        onClick={openSearch}
      >
        <Search className="h-4 w-4" />
        <span className="text-sm">Search patients, invoices...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Mobile search button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={openSearch}
      >
        <Search className="h-5 w-5" />
      </Button>

      {/* ── Notifications ────────────────────────────────────────────────── */}
      <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setNotifications([])}
            >
              Mark all read
            </Button>
          </div>

          {/* Notification List */}
          <ScrollArea className="max-h-[360px]">
            {notifLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Recent activity will appear here</p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((log, index) => (
                  <div key={log.id}>
                    {index > 0 && <Separator className="my-1 opacity-50" />}
                    <div className="flex gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors">
                      <div className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-full shrink-0 mt-0.5',
                        getActionBgColor(log.action),
                        getActionColor(log.action)
                      )}>
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground truncate">
                            {log.userName}
                          </span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-[9px] px-1 py-0 h-3.5 font-medium',
                              ROLE_COLORS[log.userRole] || 'bg-gray-100 text-gray-700'
                            )}
                          >
                            {log.userRole}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {formatActionDescription(log)}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <>
              <Separator />
              <div className="px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 dark:text-emerald-400 dark:hover:text-emerald-300"
                  onClick={handleViewAllNotifications}
                >
                  View All → Reports &gt; Audit Trail
                </Button>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full overflow-hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold">
              {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'U'}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-sm font-bold shrink-0">
              {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
              {role && (
                <Badge
                  variant="secondary"
                  className={cn('mt-1 text-[10px] px-1.5 py-0 h-4 font-semibold', ROLE_COLORS[role] || '')}
                >
                  <Shield className="h-2.5 w-2.5 mr-0.5" />
                  {role}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="gap-2 text-red-600 dark:text-red-400 focus:text-red-600">
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Global Search Dialog (Command Palette) ───────────────────────── */}
      <Dialog open={searchOpen} onOpenChange={(open) => {
        setSearchOpen(open)
        if (!open) {
          setSearchQuery('')
          setSearchResults(null)
        }
      }}>
        <DialogContent
          className="sm:max-w-[640px] p-0 overflow-hidden gap-0"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>Search patients, invoices, prescriptions, appointments, doctors</DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              data-global-search
              placeholder="Search patients, invoices, prescriptions, appointments, doctors... (Ctrl+G)"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="flex-1 h-12 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {searchLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            )}
            {searchQuery && !searchLoading && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults(null) }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Search Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {!searchQuery ? (
              <div className="py-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Type to search across all records</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Use <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">↑↓</kbd> to navigate,{' '}
                  <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">Enter</kbd> to select
                </p>
              </div>
            ) : searchLoading && !searchResults ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults && totalResults === 0 ? (
              <div className="py-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No results found for &quot;{searchQuery}&quot;</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Try different keywords</p>
              </div>
            ) : searchResults ? (
              <div className="py-1">
                {/* Patients */}
                {searchResults.patients.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30">
                      <Users className="h-3.5 w-3.5" />
                      Patients
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-auto font-normal">
                        {searchResults.patients.length}
                      </Badge>
                    </div>
                    {searchResults.patients.map((patient) => (
                      <button
                        key={patient.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                        onClick={() => handleSearchSelect('patient', patient)}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold shrink-0">
                          {patient.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{patient.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{patient.patientId}</span>
                            {patient.phone && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="text-xs text-muted-foreground">{patient.phone}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {patient.bloodGroup && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-semibold bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                            {patient.bloodGroup}
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Invoices */}
                {searchResults.invoices.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-t">
                      <Receipt className="h-3.5 w-3.5" />
                      Invoices
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-auto font-normal">
                        {searchResults.invoices.length}
                      </Badge>
                    </div>
                    {searchResults.invoices.map((invoice) => (
                      <button
                        key={invoice.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                        onClick={() => handleSearchSelect('invoice', invoice)}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 shrink-0">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{invoice.invoiceNumber}</p>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5 py-0 h-5 font-semibold',
                                INVOICE_STATUS_COLORS[invoice.status] || 'bg-gray-100 text-gray-700'
                              )}
                            >
                              {invoice.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {invoice.patient?.name || 'Unknown'}
                            </span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs font-medium text-foreground">
                              ₹{invoice.grandTotal.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Prescriptions */}
                {searchResults.prescriptions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-t">
                      <ClipboardList className="h-3.5 w-3.5" />
                      Prescriptions
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-auto font-normal">
                        {searchResults.prescriptions.length}
                      </Badge>
                    </div>
                    {searchResults.prescriptions.map((presc) => (
                      <button
                        key={presc.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                        onClick={() => handleSearchSelect('prescription', presc)}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">
                          <ClipboardList className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{presc.prescriptionId}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {presc.patient?.name || 'Unknown'}
                            </span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">{presc.date}</span>
                            {presc.doctor && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="text-xs text-muted-foreground">{presc.doctor.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Appointments */}
                {searchResults.appointments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-t">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Appointments
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-auto font-normal">
                        {searchResults.appointments.length}
                      </Badge>
                    </div>
                    {searchResults.appointments.map((apt) => (
                      <button
                        key={apt.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                        onClick={() => handleSearchSelect('appointment', apt)}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 shrink-0">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{apt.aptId}</p>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5 py-0 h-5 font-semibold',
                                APT_STATUS_COLORS[apt.status] || 'bg-gray-100 text-gray-700'
                              )}
                            >
                              {apt.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {apt.patient?.name || 'Unknown'}
                            </span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">{apt.doctor?.name || 'Unknown'}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">{apt.date} {apt.time}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Doctors */}
                {searchResults.doctors.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/30 border-t">
                      <Stethoscope className="h-3.5 w-3.5" />
                      Doctors
                      <Badge variant="secondary" className="h-4 px-1 text-[9px] ml-auto font-normal">
                        {searchResults.doctors.length}
                      </Badge>
                    </div>
                    {searchResults.doctors.map((doc) => (
                      <button
                        key={doc.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                        onClick={() => handleSearchSelect('doctor', doc)}
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-xs font-bold shrink-0">
                          {doc.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{doc.specialization}</span>
                            {doc.qualification && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="text-xs text-muted-foreground">{doc.qualification}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            ₹{doc.consultationFee.toLocaleString('en-IN')}
                          </span>
                          <p className="text-[10px] text-muted-foreground">Consultation</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer hint */}
          {searchResults && totalResults > 0 && (
            <div className="flex items-center justify-center gap-4 border-t px-3 py-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border bg-muted text-[9px] font-mono">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border bg-muted text-[9px] font-mono">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border bg-muted text-[9px] font-mono">esc</kbd>
                Close
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  )
}
