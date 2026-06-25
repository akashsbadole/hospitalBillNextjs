'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@/stores/auth'
import { useNavigation } from '@/stores/navigation'
import { AppHeader } from '@/components/AppHeader'
import { AppSidebar } from '@/components/AppSidebar'
import { LoginPage } from '@/components/LoginPage'
import { DashboardPage } from '@/components/dashboard/DashboardPage'
import { PatientListPage } from '@/components/patients/PatientListPage'
import { PatientDetailPage } from '@/components/patients/PatientDetailPage'
import { AppointmentListPage } from '@/components/appointments/AppointmentListPage'
import { DoctorListPage } from '@/components/doctors/DoctorListPage'
import { BillingListPage } from '@/components/billing/BillingListPage'
import { InvoiceDetailPage } from '@/components/billing/InvoiceDetailPage'
import { PaymentListPage } from '@/components/payments/PaymentListPage'
import { PrescriptionListPage } from '@/components/prescriptions/PrescriptionListPage'
import { InventoryListPage } from '@/components/inventory/InventoryListPage'
import { BedManagementPage } from '@/components/beds/BedManagementPage'
import { ReportsPage } from '@/components/reports/ReportsPage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { SupportCenterPage } from '@/components/support/SupportCenterPage'
import { InsuranceClaimsPage } from '@/components/insurance/InsuranceClaimsPage'
import { LabTestsPage } from '@/components/labtests/LabTestsPage'
import { PatientWorkflowPage } from '@/components/workflow/PatientWorkflowPage'
import { AiHealthAnalysisPage } from '@/components/ai/AiHealthAnalysisPage'
import { AiImagingPage } from '@/components/ai/AiImagingPage'
import { CallManagementPage } from '@/components/calls/CallManagementPage'
import { QueueManagementPage } from '@/components/queue/QueueManagementPage'
import BarcodeScannerPage from '@/components/barcode/BarcodeScannerPage'
import { AmbulanceManagementPage } from '@/components/ambulance/AmbulanceManagementPage'
import { BloodBankPage } from '@/components/bloodbank/BloodBankPage'
import { ImagingPage } from '@/components/imaging/ImagingPage'
import { OperationTheatrePage } from '@/components/surgery/OperationTheatrePage'
import { PayrollPage } from '@/components/payroll/PayrollPage'
import { NursingChartingPage } from '@/components/nursing/NursingChartingPage'
import { DischargeSummaryPage } from '@/components/discharge/DischargeSummaryPage'
import { DietManagementPage } from '@/components/diet/DietManagementPage'
import { PharmacyPosPage } from '@/components/pharmacy/PharmacyPosPage'
import { PatientPortalPage } from '@/components/portal/PatientPortalPage'
import { AssetManagementPage } from '@/components/assets/AssetManagementPage'
import { CampManagementPage } from '@/components/camps/CampManagementPage'
import { CompliancePage } from '@/components/compliance/CompliancePage'
import { AnalyticsPage } from '@/components/analytics/AnalyticsPage'
import { I18nAdminPage } from '@/components/i18n/I18nAdminPage'
import { Hl7FhirPage } from '@/components/hl7/Hl7FhirPage'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { isAuthenticated, isLoading, checkAuth } = useAuth()
  const { currentPage, pageParams } = useNavigation()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const renderPage = () => {
    const page = (() => {
      switch (currentPage) {
        case 'dashboard':
          return <DashboardPage />
        case 'patients':
          return <PatientListPage />
        case 'patient-detail':
          return <PatientDetailPage />
        case 'appointments':
          return <AppointmentListPage />
        case 'doctors':
          return <DoctorListPage />
        case 'workflow':
          return <PatientWorkflowPage />
        case 'ai-analysis':
          return <AiHealthAnalysisPage />
        case 'ai-imaging':
          return <AiImagingPage />
        case 'telemedicine':
          return <CallManagementPage />
        case 'queue':
          return <QueueManagementPage />
        case 'ambulance':
          return <AmbulanceManagementPage />
        case 'blood-bank':
          return <BloodBankPage />
        case 'imaging':
          return <ImagingPage />
        case 'surgery':
          return <OperationTheatrePage />
        case 'barcode-scanner':
          return <BarcodeScannerPage />
        case 'billing':
          return <BillingListPage />
        case 'invoice-detail':
          return <InvoiceDetailPage />
        case 'payments':
          return <PaymentListPage />
        case 'insurance':
          return <InsuranceClaimsPage />
        case 'prescriptions':
          return <PrescriptionListPage />
        case 'lab-tests':
          return <LabTestsPage />
        case 'inventory':
          return <InventoryListPage />
        case 'bed-management':
          return <BedManagementPage />
        case 'reports':
          return <ReportsPage />
        case 'payroll':
          return <PayrollPage />
        case 'nursing-charting':
          return <NursingChartingPage />
        case 'discharge-summary':
          return <DischargeSummaryPage />
        case 'diet-management':
          return <DietManagementPage />
        case 'pharmacy-pos':
          return <PharmacyPosPage />
        case 'patient-portal':
          return <PatientPortalPage />
        case 'asset-management':
          return <AssetManagementPage />
        case 'camp-management':
          return <CampManagementPage />
        case 'compliance':
          return <CompliancePage />
        case 'analytics':
          return <AnalyticsPage />
        case 'i18n-admin':
          return <I18nAdminPage />
        case 'hl7-fhir':
          return <Hl7FhirPage />
        case 'settings':
          return <SettingsPage />
        case 'support':
          return <SupportCenterPage />
        default:
          return <DashboardPage />
      }
    })()
    return (
      <ErrorBoundary name={currentPage}>
        {page}
      </ErrorBoundary>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <AppSidebar />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <AppHeader />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-4 lg:p-6"
          key={currentPage + JSON.stringify(pageParams)}
          role="main"
          aria-label={`${currentPage} page content`}
          aria-live="polite"
          aria-atomic="true"
        >
          {renderPage()}
        </main>
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {currentPage} page loaded
      </div>
      <KeyboardShortcutsDialog />
    </div>
  )
}
