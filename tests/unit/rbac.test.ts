import { describe, it, expect } from 'vitest'
import { canAccessApi, canAccessPage, canWrite, ROLE_PERMISSIONS, type Role } from '@/lib/rbac'

describe('RBAC - Role-Based Access Control', () => {
  describe('canAccessApi', () => {
    it('should allow Admin to access patient routes', () => {
      expect(canAccessApi('Admin', '/api/patients')).toBe(true)
      expect(canAccessApi('Admin', '/api/patients/123')).toBe(true)
    })

    it('should restrict Pharmacist to medicines/inventory routes', () => {
      expect(canAccessApi('Pharmacist', '/api/medicines')).toBe(true)
      expect(canAccessApi('Pharmacist', '/api/inventory')).toBe(true)
      expect(canAccessApi('Pharmacist', '/api/prescriptions')).toBe(true)
      expect(canAccessApi('Pharmacist', '/api/billing')).toBe(false)
      expect(canAccessApi('Pharmacist', '/api/payments')).toBe(false)
    })

    it('should restrict Accountant to billing routes', () => {
      expect(canAccessApi('Accountant', '/api/billing')).toBe(true)
      expect(canAccessApi('Accountant', '/api/payments')).toBe(true)
      expect(canAccessApi('Accountant', '/api/prescriptions')).toBe(false)
    })

    it('should return false for unknown role', () => {
      expect(canAccessApi('UnknownRole' as Role, '/api/patients')).toBe(false)
    })

    it('should use prefix matching (existing behavior)', () => {
      // Admin has /api/patients which matches /api/patients-extra via startsWith
      expect(canAccessApi('Admin', '/api/patients-extra')).toBe(true)
    })
  })

  describe('canAccessPage', () => {
    it('should allow Admin to access all pages', () => {
      expect(canAccessPage('Admin', 'patients')).toBe(true)
      expect(canAccessPage('Admin', 'billing')).toBe(true)
      expect(canAccessPage('Admin', 'settings')).toBe(true)
    })

    it('should restrict Pharmacist pages', () => {
      expect(canAccessPage('Pharmacist', 'dashboard')).toBe(true)
      expect(canAccessPage('Pharmacist', 'inventory')).toBe(true)
      expect(canAccessPage('Pharmacist', 'prescriptions')).toBe(true)
      expect(canAccessPage('Pharmacist', 'billing')).toBe(false)
    })

    it('should restrict Doctor pages', () => {
      expect(canAccessPage('Doctor', 'patients')).toBe(true)
      expect(canAccessPage('Doctor', 'prescriptions')).toBe(true)
      expect(canAccessPage('Doctor', 'settings')).toBe(false)
    })
  })

  describe('canWrite', () => {
    it('should return write permissions for Admin', () => {
      const perms = canWrite('Admin')
      expect(perms.create).toBe(true)
      expect(perms.update).toBe(true)
      expect(perms.delete).toBe(true)
    })

    it('should restrict delete for non-admin roles', () => {
      const perms = canWrite('Doctor')
      expect(perms.create).toBe(true)
      expect(perms.update).toBe(true)
      expect(perms.delete).toBe(false)
    })

    it('should return false for unknown role', () => {
      const perms = canWrite('UnknownRole' as Role)
      expect(perms.create).toBe(false)
      expect(perms.update).toBe(false)
      expect(perms.delete).toBe(false)
    })
  })

  describe('ROLE_PERMISSIONS', () => {
    it('should have permissions for all defined roles', () => {
      const roles: Role[] = ['Super Admin', 'Admin', 'Receptionist', 'Doctor', 'Accountant', 'Pharmacist']
      for (const role of roles) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined()
        expect(ROLE_PERMISSIONS[role].apiRoutes).toBeInstanceOf(Array)
        expect(ROLE_PERMISSIONS[role].pages).toBeInstanceOf(Array)
      }
    })

    it('should have Super Admin with broadest permissions', () => {
      expect(ROLE_PERMISSIONS['Super Admin'].apiRoutes).toContain('/api')
    })

    it('should have Admin with specific route permissions', () => {
      expect(ROLE_PERMISSIONS.Admin.apiRoutes).toContain('/api/patients')
      expect(ROLE_PERMISSIONS.Admin.apiRoutes).toContain('/api/billing')
    })
  })
})
