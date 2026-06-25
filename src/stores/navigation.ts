import { create } from 'zustand'

export type Page =
  | 'dashboard'
  | 'patients'
  | 'patient-detail'
  | 'appointments'
  | 'doctors'
  | 'workflow'
  | 'ai-analysis'
  | 'telemedicine'
  | 'billing'
  | 'invoice-detail'
  | 'inventory'
  | 'bed-management'
  | 'prescriptions'
  | 'payments'
  | 'insurance'
  | 'lab-tests'
  | 'reports'
  | 'settings'
  | 'support'
  | 'queue'
  | 'ambulance'
  | 'blood-bank'
  | 'imaging'
  | 'barcode-scanner'
  | 'surgery'
  | 'payroll'
  | 'patient-portal'
  | 'nursing-charting'
  | 'discharge-summary'
  | 'diet-management'
  | 'pharmacy-pos'
  | 'compliance'
  | 'asset-management'
  | 'camp-management'
  | 'analytics'
  | 'i18n-admin'
  | 'hl7-fhir'

interface NavigationState {
  currentPage: Page
  pageParams: Record<string, string>
  sidebarOpen: boolean
  setCurrentPage: (page: Page, params?: Record<string, string>) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  currentPage: 'dashboard',
  pageParams: {},
  sidebarOpen: true,
  setCurrentPage: (page, params = {}) =>
    set({ currentPage: page, pageParams: params }),
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
