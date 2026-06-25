import { describe, it, expect } from 'vitest'

// Nursing intake/output balance calculation
function calculateBalance(intakeMl: number, outputMl: number): number {
  return intakeMl - outputMl
}

// Pharmacy sale calculations
function calculatePharmacyTotal(items: Array<{ quantity: number; unitPrice: number }>): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

function calculatePharmacyGrandTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount)
}

// Diet plan validation
function validateDietOrder(dietType: string, mealPlan: string[]): { valid: boolean; reason?: string } {
  const validTypes = ['Normal', 'Diabetic', 'Low Salt', 'Low Fat', 'Liquid', 'Soft', 'Semi-Solid', 'High Protein', 'Renal', 'Cardiac']
  if (!validTypes.includes(dietType)) {
    return { valid: false, reason: `Invalid diet type: ${dietType}` }
  }
  if (mealPlan.length === 0) {
    return { valid: false, reason: 'At least one meal plan must be selected' }
  }
  return { valid: true }
}

// Vital signs interpretation
function interpretBloodPressure(systolic: number, diastolic: number): string {
  if (systolic < 120 && diastolic < 80) return 'Normal'
  if (systolic >= 140 || diastolic >= 90) return 'High (Hypertension)'
  if (systolic >= 120 || diastolic >= 80) return 'Elevated'
  return 'Normal'
}

function interpretSpO2(spo2: number): string {
  if (spo2 >= 95) return 'Normal'
  if (spo2 >= 90) return 'Low (Hypoxia)'
  return 'Critical'
}

// Discharge condition categories
function requiresFollowUp(conditionAtDischarge: string): boolean {
  const followUpNeeded = ['Improved', 'Stable', 'Referred']
  return followUpNeeded.includes(conditionAtDischarge)
}

describe('Nursing Intake/Output Balance', () => {
  it('should calculate positive balance', () => {
    expect(calculateBalance(2500, 2000)).toBe(500)
  })
  it('should calculate negative balance', () => {
    expect(calculateBalance(1500, 2000)).toBe(-500)
  })
  it('should return 0 for equal amounts', () => {
    expect(calculateBalance(2000, 2000)).toBe(0)
  })
})

describe('Pharmacy POS Calculations', () => {
  it('should calculate total for multiple items', () => {
    const items = [
      { quantity: 2, unitPrice: 50 },
      { quantity: 1, unitPrice: 100 },
      { quantity: 3, unitPrice: 25 },
    ]
    expect(calculatePharmacyTotal(items)).toBe(275)
  })

  it('should calculate grand total after discount', () => {
    expect(calculatePharmacyGrandTotal(500, 50)).toBe(450)
  })

  it('should not go below zero with discount', () => {
    expect(calculatePharmacyGrandTotal(100, 200)).toBe(0)
  })

  it('should handle zero discount', () => {
    expect(calculatePharmacyGrandTotal(500, 0)).toBe(500)
  })
})

describe('Diet Order Validation', () => {
  it('should validate correct diet order', () => {
    expect(validateDietOrder('Diabetic', ['Breakfast', 'Lunch', 'Dinner'])).toEqual({ valid: true })
  })

  it('should reject invalid diet type', () => {
    const result = validateDietOrder('Keto', ['Lunch'])
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid')
  })

  it('should reject empty meal plan', () => {
    const result = validateDietOrder('Normal', [])
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('meal plan')
  })
})

describe('Vital Signs Interpretation', () => {
  it('should classify normal BP', () => {
    expect(interpretBloodPressure(110, 70)).toBe('Normal')
  })

  it('should classify hypertension', () => {
    expect(interpretBloodPressure(150, 95)).toBe('High (Hypertension)')
  })

  it('should classify elevated BP', () => {
    expect(interpretBloodPressure(125, 80)).toBe('Elevated')
  })

  it('should classify normal SpO2', () => {
    expect(interpretSpO2(98)).toBe('Normal')
  })

  it('should classify low SpO2', () => {
    expect(interpretSpO2(92)).toBe('Low (Hypoxia)')
  })

  it('should classify critical SpO2', () => {
    expect(interpretSpO2(85)).toBe('Critical')
  })
})

describe('Discharge Follow-up Logic', () => {
  it('should require follow-up for Improved patients', () => {
    expect(requiresFollowUp('Improved')).toBe(true)
  })

  it('should require follow-up for Referred patients', () => {
    expect(requiresFollowUp('Referred')).toBe(true)
  })

  it('should not require follow-up for Recovered patients', () => {
    expect(requiresFollowUp('Recovered')).toBe(false)
  })

  it('should not require follow-up for Expired patients', () => {
    expect(requiresFollowUp('Expired')).toBe(false)
  })
})
