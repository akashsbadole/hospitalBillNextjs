import { describe, it, expect } from 'vitest'

// Payroll calculation helpers (same logic as used in API routes)
function calculateGrossEarnings(input: {
  basicSalary: number
  hra: number
  conveyance: number
  medicalAllowance: number
  specialAllowance: number
  overtimePay: number
  bonus: number
}): number {
  return (
    input.basicSalary +
    input.hra +
    input.conveyance +
    input.medicalAllowance +
    input.specialAllowance +
    input.overtimePay +
    input.bonus
  )
}

function calculateTotalDeductions(input: {
  pfDeduction: number
  esiDeduction: number
  professionalTax: number
  incomeTax: number
  loanDeduction: number
  otherDeductions: number
}): number {
  return (
    input.pfDeduction +
    input.esiDeduction +
    input.professionalTax +
    input.incomeTax +
    input.loanDeduction +
    input.otherDeductions
  )
}

function calculateNetPay(grossEarnings: number, totalDeductions: number): number {
  return grossEarnings - totalDeductions
}

function calculateAttendanceHours(checkIn: string, checkOut: string): number {
  const [inH, inM] = checkIn.split(':').map(Number)
  const [outH, outM] = checkOut.split(':').map(Number)
  const inMinutes = inH * 60 + inM
  const outMinutes = outH * 60 + outM
  return Math.round((outMinutes - inMinutes) / 60 * 100) / 100
}

function calculateLeaveDays(fromDate: string, toDate: string): number {
  const from = new Date(fromDate + 'T00:00:00')
  const to = new Date(toDate + 'T00:00:00')
  const diffTime = Math.abs(to.getTime() - from.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}

describe('Payroll Calculation', () => {
  it('should calculate gross earnings correctly', () => {
    const earnings = calculateGrossEarnings({
      basicSalary: 30000,
      hra: 15000,
      conveyance: 1600,
      medicalAllowance: 1250,
      specialAllowance: 2000,
      overtimePay: 500,
      bonus: 0,
    })
    expect(earnings).toBe(50350)
  })

  it('should handle zero earnings', () => {
    const earnings = calculateGrossEarnings({
      basicSalary: 0,
      hra: 0,
      conveyance: 0,
      medicalAllowance: 0,
      specialAllowance: 0,
      overtimePay: 0,
      bonus: 0,
    })
    expect(earnings).toBe(0)
  })

  it('should calculate total deductions correctly', () => {
    const deductions = calculateTotalDeductions({
      pfDeduction: 3600,
      esiDeduction: 500,
      professionalTax: 200,
      incomeTax: 3000,
      loanDeduction: 2000,
      otherDeductions: 0,
    })
    expect(deductions).toBe(9300)
  })

  it('should handle zero deductions', () => {
    const deductions = calculateTotalDeductions({
      pfDeduction: 0,
      esiDeduction: 0,
      professionalTax: 0,
      incomeTax: 0,
      loanDeduction: 0,
      otherDeductions: 0,
    })
    expect(deductions).toBe(0)
  })

  it('should calculate net pay correctly', () => {
    const gross = 50350
    const deductions = 9300
    expect(calculateNetPay(gross, deductions)).toBe(41050)
  })

  it('should handle net pay when deductions exceed gross', () => {
    const gross = 10000
    const deductions = 15000
    expect(calculateNetPay(gross, deductions)).toBe(-5000)
  })

  it('should calculate full payroll end-to-end', () => {
    const earnings = calculateGrossEarnings({
      basicSalary: 25000,
      hra: 12500,
      conveyance: 1600,
      medicalAllowance: 1250,
      specialAllowance: 1500,
      overtimePay: 0,
      bonus: 5000,
    })
    const deductions = calculateTotalDeductions({
      pfDeduction: 3000,
      esiDeduction: 400,
      professionalTax: 200,
      incomeTax: 2000,
      loanDeduction: 0,
      otherDeductions: 500,
    })
    const netPay = calculateNetPay(earnings, deductions)

    expect(earnings).toBe(46850)
    expect(deductions).toBe(6100)
    expect(netPay).toBe(40750)
  })
})

describe('Attendance Hours Calculation', () => {
  it('should calculate 8 hours from 09:00 to 17:00', () => {
    expect(calculateAttendanceHours('09:00', '17:00')).toBe(8)
  })

  it('should calculate 9.5 hours from 08:30 to 18:00', () => {
    expect(calculateAttendanceHours('08:30', '18:00')).toBe(9.5)
  })

  it('should calculate 4 hours for half day', () => {
    expect(calculateAttendanceHours('09:00', '13:00')).toBe(4)
  })

  it('should handle partial hours correctly', () => {
    expect(calculateAttendanceHours('09:15', '17:45')).toBe(8.5)
  })
})

describe('Leave Days Calculation', () => {
  it('should return 1 for same day', () => {
    expect(calculateLeaveDays('2024-01-15', '2024-01-15')).toBe(1)
  })

  it('should return 3 for a 3-day leave', () => {
    expect(calculateLeaveDays('2024-01-15', '2024-01-17')).toBe(3)
  })

  it('should return 7 for a week-long leave', () => {
    expect(calculateLeaveDays('2024-01-15', '2024-01-21')).toBe(7)
  })

  it('should handle month boundary', () => {
    expect(calculateLeaveDays('2024-01-30', '2024-02-01')).toBe(3)
  })

  it('should handle year boundary', () => {
    expect(calculateLeaveDays('2024-12-30', '2025-01-02')).toBe(4)
  })
})
