import { describe, it, expect } from 'vitest'

type ModuleItem = {
  moduleKey: string
  label: string
  section: string
  enabled: boolean
  isCore: boolean
}

const ALL_MODULES: ModuleItem[] = [
  { moduleKey: 'dashboard', label: 'Dashboard', section: 'main', enabled: true, isCore: true },
  { moduleKey: 'patients', label: 'Patients', section: 'main', enabled: true, isCore: true },
  { moduleKey: 'workflow', label: 'Workflow', section: 'operations', enabled: true, isCore: false },
  { moduleKey: 'ai-imaging', label: 'AI Imaging', section: 'operations', enabled: true, isCore: false },
  { moduleKey: 'billing', label: 'Billing', section: 'operations', enabled: true, isCore: false },
  { moduleKey: 'payroll', label: 'Payroll', section: 'admin', enabled: true, isCore: false },
  { moduleKey: 'analytics', label: 'Analytics', section: 'admin', enabled: true, isCore: false },
  { moduleKey: 'settings', label: 'Settings', section: 'admin', enabled: true, isCore: true },
]

function getVisibleModules(role: string | null, enabledModules: ModuleItem[], isSuperAdmin: boolean): ModuleItem[] {
  const superAdminPages = ALL_MODULES.map(m => m.moduleKey)
  const adminPages = ['dashboard', 'patients', 'billing', 'payroll', 'settings', 'analytics', 'reports']

  if (isSuperAdmin) {
    return ALL_MODULES.filter(m => enabledModules.some(e => e.moduleKey === m.moduleKey && e.enabled) || m.isCore)
  }
  if (role === 'Admin') {
    return ALL_MODULES.filter(m =>
      adminPages.includes(m.moduleKey) &&
      (enabledModules.some(e => e.moduleKey === m.moduleKey && e.enabled) || m.isCore)
    )
  }
  return []
}

function toggleModule(modules: ModuleItem[], moduleKey: string): ModuleItem[] {
  return modules.map(m =>
    m.moduleKey === moduleKey && !m.isCore ? { ...m, enabled: !m.enabled } : m
  )
}

function isModuleEnabled(modules: ModuleItem[], moduleKey: string): boolean {
  const mod = modules.find(m => m.moduleKey === moduleKey)
  return mod ? mod.enabled : true
}

function getEnabledCount(modules: ModuleItem[]): number {
  return modules.filter(m => m.enabled).length
}

function getDisabledCount(modules: ModuleItem[]): number {
  return modules.filter(m => !m.enabled).length
}

function filterSidebarItems(
  allPages: string[],
  enabledModules: ModuleItem[],
  corePages: string[]
): string[] {
  if (enabledModules.length === 0) return allPages
  return allPages.filter(page =>
    corePages.includes(page) || enabledModules.some(m => m.moduleKey === page && m.enabled)
  )
}

describe('Module Management - Visibility', () => {
  it('should always show core modules', () => {
    const result = getVisibleModules('Super Admin', ALL_MODULES, true)
    expect(result.some(m => m.moduleKey === 'dashboard')).toBe(true)
    expect(result.some(m => m.moduleKey === 'patients')).toBe(true)
  })

  it('should hide disabled non-core modules for super admin', () => {
    const withDisabled = toggleModule(ALL_MODULES, 'ai-imaging')
    const result = getVisibleModules('Super Admin', withDisabled, true)
    expect(result.some(m => m.moduleKey === 'ai-imaging')).toBe(false)
  })

  it('should show nothing for null role', () => {
    const result = getVisibleModules(null, ALL_MODULES, false)
    expect(result).toHaveLength(0)
  })
})

describe('Module Management - Toggle Logic', () => {
  it('should toggle enabled status', () => {
    const toggled = toggleModule(ALL_MODULES, 'billing')
    const billingMod = toggled.find(m => m.moduleKey === 'billing')
    expect(billingMod?.enabled).toBe(false)
  })

  it('should not toggle core modules', () => {
    const toggled = toggleModule(ALL_MODULES, 'dashboard')
    const dashMod = toggled.find(m => m.moduleKey === 'dashboard')
    expect(dashMod?.enabled).toBe(true)
  })

  it('should revert toggle when called twice', () => {
    const once = toggleModule(ALL_MODULES, 'payroll')
    const twice = toggleModule(once, 'payroll')
    const payrollMod = twice.find(m => m.moduleKey === 'payroll')
    expect(payrollMod?.enabled).toBe(true)
  })
})

describe('Module Management - Status Checks', () => {
  it('should return true for enabled module', () => {
    expect(isModuleEnabled(ALL_MODULES, 'dashboard')).toBe(true)
  })

  it('should return true for non-existent module key (default)', () => {
    expect(isModuleEnabled(ALL_MODULES, 'nonexistent')).toBe(true)
  })

  it('should return false for disabled module', () => {
    const mods = toggleModule(ALL_MODULES, 'workflow')
    expect(isModuleEnabled(mods, 'workflow')).toBe(false)
  })

  it('should count enabled and disabled correctly', () => {
    const mods = toggleModule(ALL_MODULES, 'billing')
    expect(getEnabledCount(mods)).toBe(ALL_MODULES.filter(m => m.enabled).length - 1)
    expect(getDisabledCount(mods)).toBe(1)
  })
})

describe('Module Management - Sidebar Filtering', () => {
  const allPages = ['dashboard', 'patients', 'billing', 'payroll', 'ai-imaging', 'inventory', 'settings']
  const corePages = ['dashboard', 'patients', 'settings']

  it('should return all pages when no enabled modules loaded', () => {
    const result = filterSidebarItems(allPages, [], corePages)
    expect(result).toEqual(allPages)
  })

  it('should filter out disabled non-core pages', () => {
    const mods = toggleModule(ALL_MODULES.filter(m => allPages.includes(m.moduleKey)), 'ai-imaging')
    const result = filterSidebarItems(allPages, mods, corePages)
    expect(result).toContain('dashboard')
    expect(result).toContain('patients')
    expect(result).toContain('billing')
    expect(result).not.toContain('ai-imaging')
  })

  it('should keep all core pages regardless of module state', () => {
    const veryDisabled = ALL_MODULES.filter(m => !m.isCore).map(m => ({ ...m, enabled: false }))
    const result = filterSidebarItems(allPages, veryDisabled, corePages)
    for (const core of corePages) {
      expect(result).toContain(core)
    }
  })
})
