// App-wide constants for dropdowns, options, and reference data

export const SPECIALIZATIONS = [
  'General Medicine',
  'Cardiology',
  'Orthopedics',
  'Dermatology',
  'Pediatrics',
  'Gynecology',
  'ENT',
  'Ophthalmology',
  'Neurology',
  'Psychiatry',
  'Radiology',
  'Urology',
] as const

export const STAFF_ROLES = [
  'Admin',
  'Receptionist',
  'Accountant',
  'Pharmacist',
  'Lab Technician',
  'Nurse',
] as const

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const

export const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed'] as const

export const MEDICINE_CATEGORIES = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Cream',
  'Drops',
  'Inhaler',
  'Powder',
  'Topical',
] as const

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Puducherry',
] as const

export const GST_SLABS = [0, 5, 12, 18, 28] as const

export const QUICK_SERVICES = [
  { name: 'General Consultation', hsnCode: '0011', price: 600, gstRate: 0, type: 'Service' as const },
  { name: 'Specialist Consultation', hsnCode: '0011', price: 1000, gstRate: 0, type: 'Service' as const },
  { name: 'Follow-up Consultation', hsnCode: '0011', price: 400, gstRate: 0, type: 'Service' as const },
  { name: 'Blood Test - CBC', hsnCode: '0013', price: 400, gstRate: 5, type: 'Lab Test' as const },
  { name: 'Blood Test - Lipid Profile', hsnCode: '0013', price: 600, gstRate: 5, type: 'Lab Test' as const },
  { name: 'Blood Test - HbA1c', hsnCode: '0013', price: 350, gstRate: 5, type: 'Lab Test' as const },
  { name: 'X-Ray', hsnCode: '0014', price: 500, gstRate: 5, type: 'Lab Test' as const },
  { name: 'Ultrasound', hsnCode: '0015', price: 1500, gstRate: 5, type: 'Lab Test' as const },
  { name: 'ECG', hsnCode: '0018', price: 350, gstRate: 5, type: 'Lab Test' as const },
  { name: 'MRI', hsnCode: '0016', price: 5000, gstRate: 5, type: 'Lab Test' as const },
  { name: 'CT Scan', hsnCode: '0017', price: 3500, gstRate: 5, type: 'Lab Test' as const },
  { name: 'Health Checkup Package', hsnCode: '0020', price: 3500, gstRate: 5, type: 'Package' as const },
  { name: 'Room Charge - General', hsnCode: '0010', price: 1000, gstRate: 0, type: 'Room Charge' as const },
  { name: 'Room Charge - Private', hsnCode: '0010', price: 2500, gstRate: 0, type: 'Room Charge' as const },
  { name: 'Room Charge - ICU', hsnCode: '0010', price: 5000, gstRate: 0, type: 'Room Charge' as const },
] as const

export const APPOINTMENT_TYPES = ['Consultation', 'Follow-up', 'Emergency'] as const

export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const

export const VALID_PATIENT_STATUSES = ['Active', 'Inactive', 'Archived'] as const
export const VALID_APPOINTMENT_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'No-Show'] as const
export const VALID_INVOICE_STATUSES = ['Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'] as const
export const VALID_PAYMENT_STATUSES = ['Pending', 'Success', 'Failed', 'Refunded'] as const
export const VALID_PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet', 'Razorpay', 'PayPal'] as const
export const VALID_DOCTOR_STATUSES = ['Active', 'Inactive'] as const
export const VALID_MEDICINE_STATUSES = ['Active', 'Inactive'] as const
export const VALID_STAFF_STATUSES = ['Active', 'Inactive'] as const

// Workflow stages
export const WORKFLOW_STAGES = [
  'Registration', 'Triage', 'Waiting', 'In-Consultation',
  'Lab-Ordered', 'Lab-Done', 'Prescribed', 'Billed', 'Paid', 'Discharged',
] as const

export const VALID_VISIT_STATUSES = ['Active', 'Completed', 'Cancelled'] as const
export const VALID_VISIT_STAGE_STATUSES = ['Pending', 'Active', 'Completed', 'Skipped'] as const
export const VALID_CALL_STATUSES = ['Scheduled', 'In-Progress', 'Completed', 'Missed', 'Cancelled'] as const
export const VALID_CALL_TYPES = ['Video', 'Audio', 'Chat'] as const
export const AI_ANALYSIS_TYPES = ['Health Analysis', 'Symptom Check', 'Drug Interaction', 'Diagnosis Suggestion'] as const
