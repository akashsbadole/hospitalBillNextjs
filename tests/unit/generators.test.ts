import { describe, it, expect } from 'vitest'
import {
  generatePayrollId,
  generateShiftId,
  generateLeaveId,
  generatePolicyId,
  generatePreAuthId,
  generateWhatsAppId,
} from '@/lib/utils'

describe('generatePayrollId', () => {
  it('should return PAYR-0001 when no last number', () => {
    expect(generatePayrollId(null)).toBe('PAYR-0001')
  })

  it('should increment from PAYR-0001', () => {
    expect(generatePayrollId('PAYR-0001')).toBe('PAYR-0002')
  })

  it('should increment from PAYR-0099', () => {
    expect(generatePayrollId('PAYR-0099')).toBe('PAYR-0100')
  })

  it('should handle large numbers', () => {
    expect(generatePayrollId('PAYR-9999')).toBe('PAYR-10000')
  })
})

describe('generateShiftId', () => {
  it('should return SFT-0001 when no last number', () => {
    expect(generateShiftId(null)).toBe('SFT-0001')
  })

  it('should increment from SFT-0001', () => {
    expect(generateShiftId('SFT-0001')).toBe('SFT-0002')
  })

  it('should increment from SFT-0500', () => {
    expect(generateShiftId('SFT-0500')).toBe('SFT-0501')
  })
})

describe('generateLeaveId', () => {
  it('should return LEV-0001 when no last number', () => {
    expect(generateLeaveId(null)).toBe('LEV-0001')
  })

  it('should increment from LEV-0042', () => {
    expect(generateLeaveId('LEV-0042')).toBe('LEV-0043')
  })
})

describe('generatePolicyId', () => {
  it('should return POL-0001 when no last number', () => {
    expect(generatePolicyId(null)).toBe('POL-0001')
  })

  it('should increment from POL-0100', () => {
    expect(generatePolicyId('POL-0100')).toBe('POL-0101')
  })

  it('should handle single digit padding', () => {
    expect(generatePolicyId('POL-0009')).toBe('POL-0010')
  })
})

describe('generatePreAuthId', () => {
  it('should return PRA-0001 when no last number', () => {
    expect(generatePreAuthId(null)).toBe('PRA-0001')
  })

  it('should increment from PRA-0001', () => {
    expect(generatePreAuthId('PRA-0001')).toBe('PRA-0002')
  })
})

describe('generateWhatsAppId', () => {
  it('should return WAM-0001 when no last number', () => {
    expect(generateWhatsAppId(null)).toBe('WAM-0001')
  })

  it('should increment from WAM-0001', () => {
    expect(generateWhatsAppId('WAM-0001')).toBe('WAM-0002')
  })
})
