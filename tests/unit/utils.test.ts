import { describe, it, expect } from 'vitest'
import { calculateGST, calculateInvoiceGST, formatCurrency, validateGSTIN } from '@/lib/utils'

describe('calculateGST', () => {
  it('should calculate intra-state GST correctly for 18% slab', () => {
    const result = calculateGST(1000, 18, false)
    expect(result.cgst).toBe(90)
    expect(result.sgst).toBe(90)
    expect(result.igst).toBe(0)
    expect(result.totalGst).toBe(180)
    expect(result.grandTotal).toBe(1180)
  })

  it('should calculate inter-state GST correctly', () => {
    const result = calculateGST(1000, 18, true)
    expect(result.cgst).toBe(0)
    expect(result.sgst).toBe(0)
    expect(result.igst).toBe(180)
    expect(result.totalGst).toBe(180)
    expect(result.grandTotal).toBe(1180)
  })

  it('should return 0 GST for 0% slab', () => {
    const result = calculateGST(500, 0)
    expect(result.totalGst).toBe(0)
    expect(result.grandTotal).toBe(500)
  })

  it('should handle 5% GST correctly', () => {
    const result = calculateGST(400, 5)
    expect(result.cgst).toBe(10)
    expect(result.sgst).toBe(10)
    expect(result.totalGst).toBe(20)
    expect(result.grandTotal).toBe(420)
  })
})

describe('calculateInvoiceGST', () => {
  it('should calculate totals for multiple items', () => {
    const items = [
      { unitPrice: 600, quantity: 1, gstRate: 0 },
      { unitPrice: 400, quantity: 1, gstRate: 5 },
    ]
    const result = calculateInvoiceGST(items)
    expect(result.subtotal).toBe(1000)
    expect(result.totalGst).toBe(20)
    expect(result.grandTotal).toBe(1020)
  })
})

describe('formatCurrency', () => {
  it('should format in Indian number system', () => {
    expect(formatCurrency(1000)).toContain('1,000')
    expect(formatCurrency(100000)).toContain('1,00,000')
  })
})

describe('validateGSTIN', () => {
  it('should validate correct GSTIN format', () => {
    expect(validateGSTIN('29ABCDE1234F1Z5')).toBe(true)
  })

  it('should reject invalid GSTIN', () => {
    expect(validateGSTIN('invalid')).toBe(false)
    expect(validateGSTIN('')).toBe(false)
  })
})
