// Zod validation schemas for all API inputs
import { z } from 'zod'

// Shared pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// Patient schemas
export const createPatientSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits').max(15),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode').optional().or(z.literal('')),
  aadhaarNumber: z.string().regex(/^\d{4}\s?\d{4}\s?\d{4}$/, 'Invalid Aadhaar').optional().or(z.literal('')),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  pastTreatments: z.array(z.string()).optional(),
  insuranceProvider: z.string().optional(),
  insuranceNumber: z.string().optional(),
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed']).optional(),
  occupation: z.string().optional(),
})

export const updatePatientSchema = createPatientSchema.partial()

// Doctor schemas
export const createDoctorSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  phone: z.string().trim().min(10, 'Phone is required').max(15),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  specialization: z.string().trim().min(2, 'Specialization is required'),
  qualification: z.string().optional(),
  experience: z.coerce.number().int().min(0).default(0),
  consultationFee: z.coerce.number().min(0).default(0),
  bio: z.string().optional(),
})

// Appointment schemas
export const createAppointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (use YYYY-MM-DD)'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format (use HH:MM)'),
  duration: z.coerce.number().int().min(15).max(240).default(30),
  type: z.enum(['Consultation', 'Follow-up', 'Emergency']).default('Consultation'),
  notes: z.string().optional(),
})

// Invoice schemas
export const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required'),
  hsnCode: z.string().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Price cannot be negative'),
  gstRate: z.number().min(0).max(28, 'GST rate must be 0-28%'),
  type: z.enum(['Service', 'Medicine', 'Lab Test', 'Room Charge', 'Package']).default('Service'),
})

export const createInvoiceSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  discount: z.number().min(0, 'Discount cannot be negative').default(0),
})

// Payment schemas
export const createPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  patientId: z.string().min(1, 'Patient is required'),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet', 'Razorpay']),
})

// Medicine schemas
export const createMedicineSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  category: z.string().optional(),
  manufacturer: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  purchasePrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(10),
  gstRate: z.coerce.number().min(0).max(28).default(12),
  hsnCode: z.string().optional(),
})

// Prescription schemas
export const prescriptionMedicineSchema = z.object({
  medicine: z.string().min(1, 'Medicine name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  duration: z.string().min(1, 'Duration is required'),
})

export const createPrescriptionSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().min(1, 'Doctor is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  diagnosis: z.string().optional(),
  notes: z.array(prescriptionMedicineSchema).optional(),
})

// Settings schema
export const updateSettingsSchema = z.object({
  clinicName: z.string().trim().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  website: z.string().optional(),
  gstin: z.string().regex(
    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
    'Invalid GSTIN format'
  ).optional().or(z.literal('')),
  gstType: z.enum(['None', 'Regular', 'Composition']).optional(),
})

// Staff schema
export const createStaffSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  phone: z.string().trim().min(10, 'Phone is required').max(15),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  role: z.enum(['Admin', 'Receptionist', 'Accountant', 'Pharmacist', 'Lab Technician', 'Nurse']),
})

// Insurance Company schemas
export const createInsuranceCompanySchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(300),
  type: z.enum(['TPA', 'Government', 'Private', 'Corporate']).default('TPA'),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  gstin: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

export const updateInsuranceCompanySchema = createInsuranceCompanySchema.partial()

// Insurance Claim schemas
export const createInsuranceClaimSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  insuranceCompanyId: z.string().min(1, 'Insurance company is required'),
  invoiceId: z.string().optional(),
  policyNumber: z.string().trim().min(1, 'Policy number is required'),
  claimType: z.enum(['Cashless', 'Reimbursement']).default('Cashless'),
  remarks: z.string().optional(),
})

export const updateInsuranceClaimSchema = z.object({
  status: z.enum(['Submitted', 'Pre-Approved', 'Approved', 'Processed', 'Settled', 'Rejected']).optional(),
  approvedAmount: z.number().min(0).optional(),
  settledAmount: z.number().min(0).optional(),
  deductionAmount: z.number().min(0).optional(),
  remarks: z.string().optional(),
  invoiceId: z.string().optional(),
})

// Lab Test Catalog schemas
export const createLabTestCatalogSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(300),
  category: z.enum(['Hematology', 'Biochemistry', 'Microbiology', 'Radiology', 'Pathology']),
  description: z.string().optional(),
  normalRange: z.string().optional(),
  unit: z.string().optional(),
  price: z.number().min(0, 'Price cannot be negative').default(0),
  gstRate: z.number().min(0).max(28).default(5),
  hsnCode: z.string().trim().optional(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
})

export const updateLabTestCatalogSchema = createLabTestCatalogSchema.partial()

// Lab Test Order schemas
export const labTestResultSchema = z.object({
  parameter: z.string().min(1, 'Parameter name is required'),
  value: z.string().min(1, 'Value is required'),
  unit: z.string().optional(),
  normalRange: z.string().optional(),
  isAbnormal: z.boolean().default(false),
})

export const createLabTestOrderSchema = z.object({
  visitId: z.string().min(1, 'Visit is required'),
  patientId: z.string().min(1, 'Patient is required'),
  testId: z.string().min(1, 'Test is required'),
  doctorId: z.string().optional(),
})

export const updateLabTestOrderSchema = z.object({
  status: z.enum(['Ordered', 'Sample Collected', 'Processing', 'Completed', 'Reported']).optional(),
  results: z.array(labTestResultSchema).optional(),
  notes: z.string().optional(),
  reportUrl: z.string().optional(),
})

// Imaging / Radiology schemas
export const MODALITIES = ['X-Ray', 'MRI', 'CT', 'Ultrasound', 'Mammography', 'PET', 'DEXA', 'Fluoroscopy'] as const
export const BODY_PARTS = ['Chest', 'Head', 'Abdomen', 'Spine', 'Pelvis', 'Upper Limb', 'Lower Limb', 'Neck', 'Whole Body'] as const
export const IMAGING_STATUSES = ['Ordered', 'Scheduled', 'In-Progress', 'Completed', 'Reviewed', 'Reported'] as const

export const createImagingStudySchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  doctorId: z.string().optional(),
  visitId: z.string().optional(),
  modality: z.enum(MODALITIES),
  bodyPart: z.enum(BODY_PARTS),
  clinicalHistory: z.string().optional(),
  contrastUsed: z.boolean().default(false),
  contrastType: z.string().optional(),
  notes: z.string().optional(),
})

export const updateImagingStudySchema = z.object({
  status: z.enum(IMAGING_STATUSES).optional(),
  scheduledAt: z.string().datetime().optional(),
  performedAt: z.string().datetime().optional(),
  reportedAt: z.string().datetime().optional(),
  findings: z.string().optional(),
  impression: z.string().optional(),
  technique: z.string().optional(),
  radiologistId: z.string().optional(),
  imagesCount: z.coerce.number().int().min(0).optional(),
  reportUrl: z.string().optional(),
  imagesUrl: z.string().optional(),
  notes: z.string().optional(),
  contrastUsed: z.boolean().optional(),
  contrastType: z.string().optional(),
})

// Helper to validate and return parsed data or throw
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const flatErrors = result.error.flatten().fieldErrors
    const allMessages = Object.values(flatErrors).flat()
    const firstError = allMessages[0] as string | undefined
    throw new Error(firstError || 'Validation failed')
  }
  return result.data
}
