'use client'

import React, { useMemo } from 'react'
import { useNavigation, type Page } from '@/stores/navigation'
import { useAuth } from '@/stores/auth'
import { canAccessPage } from '@/lib/rbac'
import type { Role } from '@/lib/rbac'
import { useEnabledModules } from '@/hooks/use-enabled-modules'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  Activity,
  Brain,
  Microscope,
  Video,
  Receipt,
  Pill,
  FileText,
  CreditCard,
  BedDouble,
  BarChart3,
  Settings,
  CircleHelp,
  X,
  LogOut,
  Shield,
  ShieldCheck,
  FlaskConical,
  TicketCheck,
  Truck,
  Droplets,
  ScanLine,
  DollarSign,
  ScanBarcode,
  Syringe,
  UserCheck,
  HeartPulse,
  ClipboardCheck,
  UtensilsCrossed,
  ShoppingCart,
  ClipboardList,
  Wrench,
  Tent,
  BarChart4,
  Languages,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  icon: React.ElementType
  page: Page
  section: 'main' | 'operations' | 'admin'
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard', section: 'main' },
  { label: 'Patients', icon: Users, page: 'patients', section: 'main' },
  { label: 'Appointments', icon: CalendarDays, page: 'appointments', section: 'main' },
  { label: 'Doctors', icon: Stethoscope, page: 'doctors', section: 'main' },
  { label: 'Workflow', icon: Activity, page: 'workflow', section: 'operations' },
  { label: 'AI Analysis', icon: Brain, page: 'ai-analysis', section: 'operations' },
  { label: 'AI Imaging', icon: Microscope, page: 'ai-imaging', section: 'operations' },
  { label: 'Telemedicine', icon: Video, page: 'telemedicine', section: 'operations' },
  { label: 'Billing', icon: Receipt, page: 'billing', section: 'operations' },
  { label: 'Payments', icon: CreditCard, page: 'payments', section: 'operations' },
  { label: 'Insurance', icon: ShieldCheck, page: 'insurance', section: 'operations' },
  { label: 'Prescriptions', icon: FileText, page: 'prescriptions', section: 'operations' },
  { label: 'Lab Tests', icon: FlaskConical, page: 'lab-tests', section: 'operations' },
  { label: 'Bed Management', icon: BedDouble, page: 'bed-management', section: 'operations' },
  { label: 'Inventory', icon: Pill, page: 'inventory', section: 'operations' },
  { label: 'Queue', icon: TicketCheck, page: 'queue', section: 'operations' },
  { label: 'Ambulance', icon: Truck, page: 'ambulance', section: 'operations' },
  { label: 'Blood Bank', icon: Droplets, page: 'blood-bank', section: 'operations' },
  { label: 'Radiology', icon: ScanLine, page: 'imaging', section: 'operations' },
  { label: 'Operation Theatre', icon: Syringe, page: 'surgery', section: 'operations' },
  { label: 'Barcode Scanner', icon: ScanBarcode, page: 'barcode-scanner', section: 'operations' },
  { label: 'Reports', icon: BarChart3, page: 'reports', section: 'admin' },
  { label: 'Payroll', icon: DollarSign, page: 'payroll', section: 'admin' },
  { label: 'Nursing Charting', icon: HeartPulse, page: 'nursing-charting', section: 'operations' },
  { label: 'Discharge Summary', icon: ClipboardCheck, page: 'discharge-summary', section: 'operations' },
  { label: 'Diet Management', icon: UtensilsCrossed, page: 'diet-management', section: 'operations' },
  { label: 'Pharmacy POS', icon: ShoppingCart, page: 'pharmacy-pos', section: 'operations' },
  { label: 'Patient Portal', icon: UserCheck, page: 'patient-portal', section: 'admin' },
  { label: 'Asset Management', icon: Wrench, page: 'asset-management', section: 'admin' },
  { label: 'Camp Management', icon: Tent, page: 'camp-management', section: 'admin' },
  { label: 'Compliance', icon: ClipboardList, page: 'compliance', section: 'admin' },
  { label: 'Analytics', icon: BarChart4, page: 'analytics', section: 'admin' },
  { label: 'i18n Translations', icon: Languages, page: 'i18n-admin', section: 'admin' },
  { label: 'HL7/FHIR', icon: Radio, page: 'hl7-fhir', section: 'admin' },
  { label: 'Settings', icon: Settings, page: 'settings', section: 'admin' },
  { label: 'Support Center', icon: CircleHelp, page: 'support', section: 'admin' },
]

const SECTION_LABELS: Record<string, string> = {
  main: 'Main',
  operations: 'Operations',
  admin: 'Admin',
}

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  Receptionist: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Doctor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Accountant: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Pharmacist: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

export function AppSidebar() {
  const { currentPage, sidebarOpen, setCurrentPage, setSidebarOpen } = useNavigation()
  const { user, logout } = useAuth()

  const role = user?.role as Role | undefined
  const { modules: enabledModules } = useEnabledModules()

  // Filter nav items based on role permissions + module enabled status
  const visibleItems = ALL_NAV_ITEMS.filter((item) => {
    if (role && !canAccessPage(role, item.page)) return false
    // Main section is always visible; operations/admin check module state
    if (item.section === 'main') return true
    return enabledModules.length === 0 || enabledModules.some((m) => m.moduleKey === item.page)
  })

  // Group by section
  const sections = ['main', 'operations', 'admin']
  const groupedItems = sections
    .map((section) => ({
      section,
      label: SECTION_LABELS[section],
      items: visibleItems.filter((item) => item.section === section),
    }))
    .filter((group) => group.items.length > 0)

  const handleNavClick = (page: Page) => {
    // Double-check RBAC before navigating
    if (role && !canAccessPage(role, page)) return
    setCurrentPage(page)
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r bg-card transition-transform duration-300 lg:relative lg:z-0 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">MediBill Pro</h1>
              <p className="text-[10px] text-muted-foreground">Hospital Management</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 py-4">
          {groupedItems.map((group, groupIdx) => (
            <React.Fragment key={group.section}>
              {groupIdx > 0 && <Separator className="my-4" />}
              <div className="space-y-1">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <NavItemButton
                    key={item.page}
                    item={item}
                    isActive={currentPage === item.page}
                    onClick={() => handleNavClick(item.page)}
                  />
                ))}
              </div>
            </React.Fragment>
          ))}
        </ScrollArea>

        {/* Footer - User Info */}
        <div className="border-t p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 w-full text-left hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-sm font-bold shrink-0">
                  {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {role && (
                      <Badge
                        variant="secondary"
                        className={cn('text-[10px] px-1.5 py-0 h-4 font-semibold', ROLE_COLORS[role] || '')}
                      >
                        {role}
                      </Badge>
                    )}
                    {!role && <span className="text-[10px] text-muted-foreground">Unknown role</span>}
                  </div>
                </div>
                <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                <Badge
                  variant="secondary"
                  className={cn('mt-1 text-[10px] px-1.5 py-0 h-4 font-semibold', role && ROLE_COLORS[role])}
                >
                  {role || 'Unknown Role'}
                </Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400 focus:text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  )
}

function NavItemButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', isActive && 'text-emerald-600 dark:text-emerald-400')} />
      {item.label}
    </button>
  )
}
