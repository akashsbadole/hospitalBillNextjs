import { describe, it, expect } from 'vitest'
import {
  generateDischargeId,
  generateDietOrderId,
  generatePharmacySaleId,
  generateCampId,
  generateCampRegId,
  generateAssetId,
  generateReportId,
} from '@/lib/utils'

describe('generateDischargeId', () => {
  it('should return DCS-0001 when no last number', () => {
    expect(generateDischargeId(null)).toBe('DCS-0001')
  })
  it('should increment from DCS-0001', () => {
    expect(generateDischargeId('DCS-0001')).toBe('DCS-0002')
  })
  it('should handle DCS-0099', () => {
    expect(generateDischargeId('DCS-0099')).toBe('DCS-0100')
  })
})

describe('generateDietOrderId', () => {
  it('should return DIT-0001 when no last number', () => {
    expect(generateDietOrderId(null)).toBe('DIT-0001')
  })
  it('should increment correctly', () => {
    expect(generateDietOrderId('DIT-0042')).toBe('DIT-0043')
  })
})

describe('generatePharmacySaleId', () => {
  it('should return PSA-0001 when no last number', () => {
    expect(generatePharmacySaleId(null)).toBe('PSA-0001')
  })
  it('should increment correctly', () => {
    expect(generatePharmacySaleId('PSA-0100')).toBe('PSA-0101')
  })
})

describe('generateCampId', () => {
  it('should return CAMP-0001 when no last number', () => {
    expect(generateCampId(null)).toBe('CAMP-0001')
  })
  it('should increment correctly', () => {
    expect(generateCampId('CAMP-0099')).toBe('CAMP-0100')
  })
})

describe('generateCampRegId', () => {
  it('should return CREG-0001 when no last number', () => {
    expect(generateCampRegId(null)).toBe('CREG-0001')
  })
  it('should increment correctly', () => {
    expect(generateCampRegId('CREG-0001')).toBe('CREG-0002')
  })
})

describe('generateAssetId', () => {
  it('should return AST-0001 when no last number', () => {
    expect(generateAssetId(null)).toBe('AST-0001')
  })
  it('should increment correctly', () => {
    expect(generateAssetId('AST-0500')).toBe('AST-0501')
  })
})

describe('generateReportId', () => {
  it('should return RPT-0001 when no last number', () => {
    expect(generateReportId(null)).toBe('RPT-0001')
  })
  it('should increment correctly', () => {
    expect(generateReportId('RPT-0001')).toBe('RPT-0002')
  })
})
