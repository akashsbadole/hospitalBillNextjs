// RBAC — Role-Based Access Control definitions for the Hospital Management System
// Defines which pages and API routes each role can access, plus write permissions.

export type Role = 'Super Admin' | 'Admin' | 'Receptionist' | 'Doctor' | 'Accountant' | 'Pharmacist'

export interface Permission {
  pages: string[]        // which navigation pages this role can access
  apiRoutes: string[]    // which API routes this role can access (prefixes)
  canCreate: boolean     // general create permission
  canUpdate: boolean     // general update permission
  canDelete: boolean     // general delete permission
}

export const ROLE_PERMISSIONS: Record<Role, Permission> = {
  'Super Admin': {
    pages: ['dashboard', 'patients', 'patient-detail', 'appointments', 'doctors', 'workflow', 'ai-analysis', 'ai-imaging', 'telemedicine', 'billing', 'invoice-detail', 'payments', 'insurance', 'prescriptions', 'bed-management', 'inventory', 'lab-tests', 'reports', 'settings', 'support', 'queue', 'ambulance', 'blood-bank', 'imaging', 'barcode-scanner', 'payroll', 'patient-portal', 'nursing-charting', 'discharge-summary', 'diet-management', 'pharmacy-pos', 'compliance', 'asset-management', 'camp-management', 'analytics', 'i18n-admin', 'hl7-fhir'],
    apiRoutes: ['/api'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
  },
  Admin: {
    pages: ['dashboard', 'patients', 'patient-detail', 'appointments', 'doctors', 'workflow', 'ai-analysis', 'ai-imaging', 'telemedicine', 'billing', 'invoice-detail', 'payments', 'insurance', 'prescriptions', 'bed-management', 'inventory', 'lab-tests', 'reports', 'settings', 'support', 'queue', 'ambulance', 'blood-bank', 'imaging', 'barcode-scanner', 'payroll', 'patient-portal', 'nursing-charting', 'discharge-summary', 'diet-management', 'pharmacy-pos', 'compliance', 'asset-management', 'camp-management', 'analytics', 'i18n-admin', 'hl7-fhir'],
    apiRoutes: ['/api/patients', '/api/patient-visits', '/api/appointments', '/api/doctors', '/api/billing', '/api/payments', '/api/prescriptions', '/api/medicines', '/api/inventory', '/api/reports', '/api/settings', '/api/staff', '/api/dashboard', '/api/seed', '/api/support', '/api/audit-logs', '/api/ai', '/api/calls', '/api/insurance', '/api/lab-tests', '/api/beds', '/api/branches', '/api/search', '/api/queue', '/api/ambulance', '/api/blood-bank', '/api/imaging', '/api/barcode', '/api/payroll', '/api/attendance', '/api/shifts', '/api/leaves', '/api/leave-balance', '/api/whatsapp', '/api/medicines/search', '/api/vital-signs', '/api/nursing-notes', '/api/intake-output', '/api/discharge-summary', '/api/diet-orders', '/api/diet-schedules', '/api/pharmacy-sales', '/api/translations', '/api/hl7', '/api/fhir', '/api/compliance', '/api/assets', '/api/camps', '/api/analytics', '/api/portal'],
    canCreate: true,
    canUpdate: true,
    canDelete: true,
  },
  Receptionist: {
    pages: ['dashboard', 'patients', 'patient-detail', 'appointments', 'workflow', 'ai-analysis', 'ai-imaging', 'telemedicine', 'billing', 'invoice-detail', 'payments', 'insurance', 'bed-management', 'support'],
    apiRoutes: ['/api/patients', '/api/patient-visits', '/api/appointments', '/api/billing', '/api/payments', '/api/dashboard', '/api/support', '/api/ai', '/api/calls', '/api/insurance', '/api/lab-tests', '/api/beds', '/api/branches', '/api/search'],
    canCreate: true,
    canUpdate: true,
    canDelete: false,
  },
  Doctor: {
    pages: ['dashboard', 'patients', 'patient-detail', 'appointments', 'workflow', 'ai-analysis', 'ai-imaging', 'telemedicine', 'prescriptions', 'lab-tests', 'support'],
    apiRoutes: ['/api/patients', '/api/patient-visits', '/api/appointments', '/api/prescriptions', '/api/dashboard', '/api/support', '/api/ai', '/api/calls', '/api/lab-tests', '/api/branches', '/api/search'],
    canCreate: true,  // prescriptions, lab orders
    canUpdate: true,  // appointment status, lab results
    canDelete: false,
  },
  Accountant: {
    pages: ['dashboard', 'billing', 'invoice-detail', 'payments', 'reports', 'ai-analysis', 'ai-imaging', 'support'],
    apiRoutes: ['/api/billing', '/api/payments', '/api/reports', '/api/dashboard', '/api/support', '/api/ai', '/api/insurance', '/api/branches', '/api/search'],
    canCreate: true,  // invoices, claims
    canUpdate: true,
    canDelete: false,
  },
  Pharmacist: {
    pages: ['dashboard', 'inventory', 'prescriptions'],
    apiRoutes: ['/api/medicines', '/api/inventory', '/api/prescriptions', '/api/dashboard', '/api/ai', '/api/lab-tests', '/api/branches', '/api/search'],
    canCreate: true,  // medicines
    canUpdate: true,
    canDelete: false,
  },
}

// Helper to check if a role can access a page
export function canAccessPage(role: Role, page: string): boolean {
  return ROLE_PERMISSIONS[role]?.pages.includes(page) ?? false
}

// Helper to check if a role can access an API route
export function canAccessApi(role: Role, route: string): boolean {
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  return perms.apiRoutes.some(apiRoute => route.startsWith(apiRoute))
}

// Helper to check write permission
export function canWrite(role: Role): { create: boolean; update: boolean; delete: boolean } {
  const perms = ROLE_PERMISSIONS[role]
  return {
    create: perms?.canCreate ?? false,
    update: perms?.canUpdate ?? false,
    delete: perms?.canDelete ?? false,
  }
}
