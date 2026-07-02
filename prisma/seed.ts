import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const getDate = (daysFromNow: number): string => {
  const d = new Date(); d.setDate(d.getDate() + daysFromNow); return d.toISOString().split('T')[0]
}

const VISIT_STAGES = ['Registration', 'Triage', 'Waiting', 'In-Consultation', 'Lab-Ordered', 'Lab-Done', 'Prescribed', 'Billed', 'Paid', 'Discharged'] as const
type VisitStageName = (typeof VISIT_STAGES)[number]

function buildStages(currentStage: VisitStageName, isCompleted: boolean, offsetMinutes = 0) {
  const now = new Date()
  return VISIT_STAGES.map((stageName, idx) => {
    const stageTime = new Date(now.getTime() - (VISIT_STAGES.length - idx) * 15 * 60000 + offsetMinutes)
    if (isCompleted) return { stage: stageName, status: 'Completed' as const, completedAt: stageTime }
    if (idx < VISIT_STAGES.indexOf(currentStage)) return { stage: stageName, status: 'Completed' as const, completedAt: stageTime }
    if (idx === VISIT_STAGES.indexOf(currentStage)) return { stage: stageName, status: 'Active' as const }
    return { stage: stageName, status: 'Pending' as const }
  })
}

async function main() {
  console.log('Seeding database...')

  const existingUsers = await db.user.count()
  if (existingUsers > 0) {
    console.log('Database already has data — skipping full seed.')
    return
  }

  const passwordHash = await bcrypt.hash('password123', 12)
  const adminHash = await bcrypt.hash('Admin@123', 12)

  // ==================== BRANCHES ====================
  const branches = [
    { branchId: 'BRN-0001', name: 'Sai Multispecialty Hospital - Main Branch', code: 'MAIN', address: '42, Nehru Nagar, MG Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', phone: '+91-22-2345-6789', email: 'info@saihospital.in', gstin: '27AABCS1429B1Z5', isHead: true },
    { branchId: 'BRN-0002', name: 'Sai Multispecialty Hospital - Andheri', code: 'ANDHERI', address: '12, SV Road, Andheri West', city: 'Mumbai', state: 'Maharashtra', pincode: '400058', phone: '+91-22-2684-1234', email: 'andheri@saihospital.in', gstin: '27AABCS1429B1Z6', isHead: false },
    { branchId: 'BRN-0003', name: 'Sai Multispecialty Hospital - Thane', code: 'THANE', address: '45, Ghodbunder Road, Thane West', city: 'Thane', state: 'Maharashtra', pincode: '400601', phone: '+91-22-2546-7890', email: 'thane@saihospital.in', gstin: '27AABCS1429B1Z7', isHead: false },
  ]
  for (const b of branches) {
    await db.branch.create({ data: b })
  }
  const branchIds = (await db.branch.findMany({ orderBy: { branchId: 'asc' } })).map(b => b.id)

  // ==================== USERS (Credentials: admin@medibill.com / Admin@123, others / password123) ====================
  const usersData = [
    { userId: 'USR-0001', name: 'Super Admin', email: 'superadmin@medibill.com', password: adminHash, role: 'Super Admin', phone: '9820000000', branchIdx: 0 },
    { userId: 'USR-0002', name: 'Admin User', email: 'admin@medibill.com', password: adminHash, role: 'Admin', phone: '9820000001', branchIdx: 0 },
    { userId: 'USR-0003', name: 'Pooja Mehta', email: 'receptionist@medibill.com', password: passwordHash, role: 'Receptionist', phone: '9820000002', branchIdx: 0 },
    { userId: 'USR-0004', name: 'Dr. Rajesh Sharma', email: 'doctor@medibill.com', password: passwordHash, role: 'Doctor', phone: '9820000003', branchIdx: 0 },
    { userId: 'USR-0005', name: 'Sanjay Verma', email: 'accountant@medibill.com', password: passwordHash, role: 'Accountant', phone: '9820000004', branchIdx: 0 },
    { userId: 'USR-0006', name: 'Kavita Joshi', email: 'pharmacist@medibill.com', password: passwordHash, role: 'Pharmacist', phone: '9820000005', branchIdx: 0 },
    { userId: 'USR-0007', name: 'Neha Agarwal', email: 'neha.a@saihospital.in', password: passwordHash, role: 'Receptionist', phone: '9820150006', branchIdx: 1 },
    { userId: 'USR-0008', name: 'Deepak Patil', email: 'deepak.p@saihospital.in', password: passwordHash, role: 'Pharmacist', phone: '9820150007', branchIdx: 1 },
    { userId: 'USR-0009', name: 'Meera Sharma', email: 'meera.s@saihospital.in', password: passwordHash, role: 'Accountant', phone: '9820150008', branchIdx: 2 },
  ]
  const userRecords: Array<{ id: string; userId: string }> = []
  for (const u of usersData) {
    const { branchIdx, ...userFields } = u
    const rec = await db.user.create({ data: { ...userFields, branchId: branchIds[branchIdx] } })
    userRecords.push({ id: rec.id, userId: rec.userId })
  }
  console.log('Users seeded')

  // ==================== CLINIC SETTINGS ====================
  await db.clinicSettings.create({
    data: { clinicName: 'Sai Multispecialty Hospital', address: '42, Nehru Nagar, MG Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001', phone: '+91-22-2345-6789', email: 'info@saihospital.in', website: 'www.saihospital.in', gstin: '27AABCS1429B1Z5', gstType: 'Regular' },
  })

  // ==================== DOCTORS ====================
  const doctorsData = [
    { name: 'Dr. Rajesh Sharma', email: 'rajesh.sharma@saihospital.in', phone: '9820123456', specialization: 'General Medicine', qualification: 'MBBS, MD', experience: 15, consultationFee: 600 },
    { name: 'Dr. Priya Patel', email: 'priya.patel@saihospital.in', phone: '9820123457', specialization: 'Cardiology', qualification: 'MBBS, DM Cardiology', experience: 12, consultationFee: 1000 },
    { name: 'Dr. Amit Kumar Gupta', email: 'amit.gupta@saihospital.in', phone: '9820123458', specialization: 'Orthopedics', qualification: 'MBBS, MS Ortho', experience: 18, consultationFee: 800 },
    { name: 'Dr. Sneha Reddy', email: 'sneha.reddy@saihospital.in', phone: '9820123459', specialization: 'Dermatology', qualification: 'MBBS, MD Dermatology', experience: 10, consultationFee: 700 },
    { name: 'Dr. Vikram Singh', email: 'vikram.singh@saihospital.in', phone: '9820123460', specialization: 'Pediatrics', qualification: 'MBBS, MD Pediatrics', experience: 14, consultationFee: 600 },
    { name: 'Dr. Anjali Deshmukh', email: 'anjali.deshmukh@saihospital.in', phone: '9820123461', specialization: 'Gynecology', qualification: 'MBBS, MS OBGYN', experience: 16, consultationFee: 800 },
    { name: 'Dr. Suresh Iyer', email: 'suresh.iyer@saihospital.in', phone: '9820123462', specialization: 'ENT', qualification: 'MBBS, MS ENT', experience: 11, consultationFee: 600 },
    { name: 'Dr. Meera Nair', email: 'meera.nair@saihospital.in', phone: '9820123463', specialization: 'Ophthalmology', qualification: 'MBBS, MS Ophthalmology', experience: 13, consultationFee: 700 },
  ]
  const doctorRecords: Array<{ id: string; doctorId: string }> = []
  for (let i = 0; i < doctorsData.length; i++) {
    const d = doctorsData[i]
    const doc = await db.doctor.create({ data: { doctorId: `DOC-${String(i + 1).padStart(4, '0')}`, ...d, bio: `Experienced ${d.specialization} specialist with ${d.experience} years of practice.` } })
    doctorRecords.push({ id: doc.id, doctorId: doc.doctorId })
  }
  console.log('Doctors seeded')

  // ==================== STAFF ====================
  const staffData = [
    { name: 'Ramesh Kulkarni', email: 'ramesh.k@saihospital.in', phone: '9820150001', role: 'Admin' },
    { name: 'Pooja Mehta', email: 'pooja.m@saihospital.in', phone: '9820150002', role: 'Receptionist' },
    { name: 'Sanjay Verma', email: 'sanjay.v@saihospital.in', phone: '9820150003', role: 'Accountant' },
    { name: 'Kavita Joshi', email: 'kavita.j@saihospital.in', phone: '9820150004', role: 'Pharmacist' },
    { name: 'Deepak Patil', email: 'deepak.p@saihospital.in', phone: '9820150005', role: 'Nurse' },
    { name: 'Neha Agarwal', email: 'neha.a@saihospital.in', phone: '9820150006', role: 'Lab Technician' },
    { name: 'Siddharth Rao', email: 'siddharth.r@saihospital.in', phone: '9820150007', role: 'Radiologist' },
    { name: 'Priyanka Singh', email: 'priyanka.s@saihospital.in', phone: '9820150008', role: 'Blood Bank Technician' },
  ]
  for (let i = 0; i < staffData.length; i++) {
    await db.staff.create({ data: { staffId: `STF-${String(i + 1).padStart(4, '0')}`, ...staffData[i] } })
  }
  console.log('Staff seeded')

  // ==================== PATIENTS ====================
  const patientsData = [
    { name: 'Arjun Malhotra', email: 'arjun.m@email.com', phone: '9987610001', dateOfBirth: '1985-03-15', gender: 'Male', bloodGroup: 'B+', address: '12, Linking Road, Bandra', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', aadhaarNumber: '823456789012', emergencyContact: 'Sunita Malhotra', emergencyPhone: '9987610010', allergies: JSON.stringify(['Penicillin']), insuranceProvider: 'Star Health', insuranceNumber: 'SH-456789', maritalStatus: 'Married', occupation: 'Software Engineer' },
    { name: 'Deepa Krishnan', email: 'deepa.k@email.com', phone: '9987610002', dateOfBirth: '1990-07-22', gender: 'Female', bloodGroup: 'A+', address: '34, Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', emergencyContact: 'Rajan Krishnan', emergencyPhone: '9987610011', insuranceProvider: 'ICICI Lombard', insuranceNumber: 'IL-789012', maritalStatus: 'Married', occupation: 'Teacher' },
    { name: 'Mohammed Faizan', email: 'faizan.m@email.com', phone: '9987610003', dateOfBirth: '1978-11-05', gender: 'Male', bloodGroup: 'O+', address: '56, Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', allergies: JSON.stringify(['Sulfa drugs']), emergencyContact: 'Ayesha Faizan', emergencyPhone: '9987610012', maritalStatus: 'Married', occupation: 'Business Owner' },
    { name: 'Shalini Gupta', email: 'shalini.g@email.com', phone: '9987610004', dateOfBirth: '1995-01-18', gender: 'Female', bloodGroup: 'AB+', address: '78, Connaught Place', city: 'New Delhi', state: 'Delhi', pincode: '110001', insuranceProvider: 'HDFC Ergo', insuranceNumber: 'HE-345678', maritalStatus: 'Single', occupation: 'Graphic Designer' },
    { name: 'Rajendra Yadav', email: 'rajendra.y@email.com', phone: '9987610005', dateOfBirth: '1970-09-30', gender: 'Male', bloodGroup: 'A-', address: '90, Lalbagh Road', city: 'Bangalore', state: 'Karnataka', pincode: '560027', allergies: JSON.stringify(['Aspirin', 'Ibuprofen']), insuranceProvider: 'New India Assurance', insuranceNumber: 'NIA-567890', maritalStatus: 'Married', occupation: 'Bank Manager' },
    { name: 'Anita Pereira', email: 'anita.p@email.com', phone: '9987610006', dateOfBirth: '1988-04-12', gender: 'Female', bloodGroup: 'O-', address: '23, St. Inez', city: 'Panaji', state: 'Goa', pincode: '403001', maritalStatus: 'Single', occupation: 'Hotel Manager' },
    { name: 'Vikash Choudhary', email: 'vikash.c@email.com', phone: '9987610007', dateOfBirth: '1982-12-08', gender: 'Male', bloodGroup: 'B-', address: '45, MI Road', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', allergies: JSON.stringify(['Codeine']), insuranceProvider: 'Bajaj Allianz', insuranceNumber: 'BA-234567', maritalStatus: 'Married', occupation: 'Chartered Accountant' },
    { name: 'Pallavi Desai', email: 'pallavi.d@email.com', phone: '9987610008', dateOfBirth: '1993-06-25', gender: 'Female', bloodGroup: 'A+', address: '67, FC Road', city: 'Pune', state: 'Maharashtra', pincode: '411004', insuranceProvider: 'Star Health', insuranceNumber: 'SH-890123', maritalStatus: 'Single', occupation: 'Doctor' },
    { name: 'Suresh Menon', email: 'suresh.m@email.com', phone: '9987610009', dateOfBirth: '1975-02-14', gender: 'Male', bloodGroup: 'AB-', address: '89, MG Road', city: 'Kochi', state: 'Kerala', pincode: '682011', allergies: JSON.stringify(['Latex']), insuranceProvider: 'United India Insurance', insuranceNumber: 'UII-678901', maritalStatus: 'Married', occupation: 'Marine Engineer' },
    { name: 'Ritu Saxena', email: 'ritu.s@email.com', phone: '9987610010', dateOfBirth: '1991-08-19', gender: 'Female', bloodGroup: 'B+', address: '12, Hazratganj', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001', maritalStatus: 'Married', occupation: 'Lawyer' },
    { name: 'Nikhil Bhatt', email: 'nikhil.b@email.com', phone: '9987610011', dateOfBirth: '1986-10-03', gender: 'Male', bloodGroup: 'O+', address: '34, CG Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380006', insuranceProvider: 'IFFCO Tokio', insuranceNumber: 'IT-123456', maritalStatus: 'Married', occupation: 'Architect' },
    { name: 'Kavitha Rajan', email: 'kavitha.r@email.com', phone: '9987610012', dateOfBirth: '1989-05-27', gender: 'Female', bloodGroup: 'A-', address: '56, Mount Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600002', allergies: JSON.stringify(['Morphine']), insuranceProvider: 'ICICI Lombard', insuranceNumber: 'IL-456123', maritalStatus: 'Single', occupation: 'Pharmacist' },
    { name: 'Arunachalam Murugan', email: 'arun.m@email.com', phone: '9987610013', dateOfBirth: '1968-07-10', gender: 'Male', bloodGroup: 'B+', address: '78, T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017', maritalStatus: 'Married', occupation: 'Retired' },
    { name: 'Swati Kapoor', email: 'swati.k@email.com', phone: '9987610014', dateOfBirth: '1992-03-08', gender: 'Female', bloodGroup: 'AB+', address: '90, Sector 17', city: 'Chandigarh', state: 'Punjab', pincode: '160017', insuranceProvider: 'Religare Health', insuranceNumber: 'RH-789456', maritalStatus: 'Married', occupation: 'Professor' },
    { name: 'Dhruv Sharma', email: 'dhruv.s@email.com', phone: '9987610015', dateOfBirth: '1983-11-22', gender: 'Male', bloodGroup: 'O-', address: '23, Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016', allergies: JSON.stringify(['Penicillin', 'Sulfa drugs']), maritalStatus: 'Single', occupation: 'Journalist' },
    { name: 'Meena Kumari', email: 'meena.k@email.com', phone: '9987610016', dateOfBirth: '1979-01-30', gender: 'Female', bloodGroup: 'A+', address: '45, GPO', city: 'Patna', state: 'Bihar', pincode: '800001', insuranceProvider: 'National Insurance', insuranceNumber: 'NI-012345', maritalStatus: 'Married', occupation: 'School Principal' },
    { name: 'Tarun Bhatia', email: 'tarun.b@email.com', phone: '9987610017', dateOfBirth: '1987-09-14', gender: 'Male', bloodGroup: 'B-', address: '67, Residency Road', city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', allergies: JSON.stringify(['Iodine contrast']), insuranceProvider: 'HDFC Ergo', insuranceNumber: 'HE-901234', maritalStatus: 'Married', occupation: 'Business Analyst' },
    { name: 'Lakshmi Iyer', email: 'lakshmi.i@email.com', phone: '9987610018', dateOfBirth: '1994-04-05', gender: 'Female', bloodGroup: 'O+', address: '89, Besant Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600090', insuranceProvider: 'Star Health', insuranceNumber: 'SH-234567', maritalStatus: 'Single', occupation: 'Nurse' },
    { name: 'Pradeep Singh Rawat', email: 'pradeep.r@email.com', phone: '9987610019', dateOfBirth: '1972-06-18', gender: 'Male', bloodGroup: 'A+', address: '12, Rajpur Road', city: 'Dehradun', state: 'Uttarakhand', pincode: '248001', insuranceProvider: 'New India Assurance', insuranceNumber: 'NIA-345678', maritalStatus: 'Married', occupation: 'Government Officer' },
    { name: 'Nisha Agarwal', email: 'nisha.a@email.com', phone: '9987610020', dateOfBirth: '1996-12-01', gender: 'Female', bloodGroup: 'AB-', address: '34, Civil Lines', city: 'Nagpur', state: 'Maharashtra', pincode: '440001', allergies: JSON.stringify(['Aspirin']), maritalStatus: 'Single', occupation: 'Software Developer' },
  ]
  const patientRecords: Array<{ id: string; patientId: string }> = []
  for (let i = 0; i < patientsData.length; i++) {
    const p = patientsData[i]
    const patient = await db.patient.create({
      data: {
        patientId: `PAT-${String(i + 1).padStart(4, '0')}`,
        name: p.name, email: p.email || null, phone: p.phone,
        dateOfBirth: p.dateOfBirth || null, gender: p.gender || null, bloodGroup: p.bloodGroup || null,
        address: p.address || null, city: p.city || null, state: p.state || null, pincode: p.pincode || null,
        aadhaarNumber: p.aadhaarNumber || null, emergencyContact: p.emergencyContact || null,
        emergencyPhone: p.emergencyPhone || null,
        allergies: p.allergies || null,
        insuranceProvider: p.insuranceProvider || null, insuranceNumber: p.insuranceNumber || null,
        maritalStatus: p.maritalStatus || null, occupation: p.occupation || null,
        branchId: branchIds[i % 3],
      },
    })
    patientRecords.push({ id: patient.id, patientId: patient.patientId })
  }
  console.log('Patients seeded')

  // ==================== MEDICINES ====================
  const medicinesData = [
    { name: 'Paracetamol 500mg', category: 'Tablet', manufacturer: 'Cipla Ltd', batchNumber: 'CPL-2024-001', expiryDate: '2026-06-30', purchasePrice: 15, sellingPrice: 25, stock: 500, minStock: 100, gstRate: 12, hsnCode: '30049099', barcode: '8901104001004' },
    { name: 'Amoxicillin 250mg', category: 'Capsule', manufacturer: 'Sun Pharma', batchNumber: 'SPH-2024-012', expiryDate: '2025-12-31', purchasePrice: 35, sellingPrice: 55, stock: 300, minStock: 80, gstRate: 12, hsnCode: '30041099', barcode: '8901123456789' },
    { name: 'Omeprazole 20mg', category: 'Capsule', manufacturer: 'Dr. Reddys', batchNumber: 'DRD-2024-008', expiryDate: '2026-03-15', purchasePrice: 22, sellingPrice: 40, stock: 400, minStock: 100, gstRate: 12, hsnCode: '30049099', barcode: '8901234567890' },
    { name: 'Metformin 500mg', category: 'Tablet', manufacturer: 'Lupin Ltd', batchNumber: 'LUP-2024-015', expiryDate: '2026-09-30', purchasePrice: 18, sellingPrice: 32, stock: 600, minStock: 150, gstRate: 12, hsnCode: '30049099', barcode: '8901345678901' },
    { name: 'Cetirizine 10mg', category: 'Tablet', manufacturer: 'Mankind Pharma', batchNumber: 'MNP-2024-020', expiryDate: '2026-01-31', purchasePrice: 8, sellingPrice: 15, stock: 800, minStock: 200, gstRate: 12, hsnCode: '30049099', barcode: '8901456789012' },
    { name: 'Azithromycin 500mg', category: 'Tablet', manufacturer: 'Zydus Cadila', batchNumber: 'ZCD-2024-005', expiryDate: '2025-08-31', purchasePrice: 45, sellingPrice: 72, stock: 200, minStock: 50, gstRate: 12, hsnCode: '30041099', barcode: '8901567890123' },
    { name: 'Cough Syrup (Benadryl)', category: 'Syrup', manufacturer: 'Johnson & Johnson', batchNumber: 'JJ-2024-003', expiryDate: '2025-10-15', purchasePrice: 55, sellingPrice: 85, stock: 150, minStock: 40, gstRate: 12, hsnCode: '30049099', barcode: '8901678901234' },
    { name: 'Insulin Glargine 100IU/ml', category: 'Injection', manufacturer: 'Novo Nordisk', batchNumber: 'NNO-2024-007', expiryDate: '2025-11-30', purchasePrice: 280, sellingPrice: 420, stock: 50, minStock: 15, gstRate: 5, hsnCode: '30043919', barcode: '8901789012345' },
    { name: 'Amlodipine 5mg', category: 'Tablet', manufacturer: 'Torrent Pharma', batchNumber: 'TRT-2024-011', expiryDate: '2026-07-31', purchasePrice: 12, sellingPrice: 22, stock: 700, minStock: 150, gstRate: 12, hsnCode: '30049099', barcode: '8901890123456' },
    { name: 'Pantoprazole 40mg', category: 'Tablet', manufacturer: 'Alkem Labs', batchNumber: 'ALK-2024-009', expiryDate: '2026-04-30', purchasePrice: 20, sellingPrice: 38, stock: 450, minStock: 100, gstRate: 12, hsnCode: '30049099', barcode: '8901901234567' },
    { name: 'Diclofenac Gel 30g', category: 'Topical', manufacturer: 'Novartis', batchNumber: 'NVS-2024-006', expiryDate: '2026-02-28', purchasePrice: 65, sellingPrice: 95, stock: 120, minStock: 30, gstRate: 12, hsnCode: '30049099', barcode: '8902012345678' },
    { name: 'Salbutamol Inhaler', category: 'Inhaler', manufacturer: 'Cipla Ltd', batchNumber: 'CPL-2024-014', expiryDate: '2025-09-30', purchasePrice: 120, sellingPrice: 175, stock: 80, minStock: 20, gstRate: 5, hsnCode: '30049099', barcode: '8902123456789' },
    { name: 'Ibuprofen 400mg', category: 'Tablet', manufacturer: 'Abbott', batchNumber: 'ABB-2024-002', expiryDate: '2026-05-31', purchasePrice: 10, sellingPrice: 18, stock: 550, minStock: 120, gstRate: 12, hsnCode: '30049099', barcode: '8902234567890' },
    { name: 'Dolo 650 (Paracetamol)', category: 'Tablet', manufacturer: 'Micro Labs', batchNumber: 'MLB-2024-018', expiryDate: '2026-08-31', purchasePrice: 28, sellingPrice: 42, stock: 900, minStock: 200, gstRate: 12, hsnCode: '30049099', barcode: '8902345678901' },
    { name: 'Vitamin D3 60K IU', category: 'Capsule', manufacturer: 'USV Ltd', batchNumber: 'USV-2024-004', expiryDate: '2026-12-31', purchasePrice: 32, sellingPrice: 52, stock: 350, minStock: 80, gstRate: 12, hsnCode: '30049099', barcode: '8902456789012' },
    { name: 'Montelukast 10mg', category: 'Tablet', manufacturer: 'Cipla Ltd', batchNumber: 'CPL-2024-016', expiryDate: '2026-03-31', purchasePrice: 25, sellingPrice: 45, stock: 280, minStock: 70, gstRate: 12, hsnCode: '30049099', barcode: '8902567890123' },
    { name: 'ORS Powder (Electral)', category: 'Powder', manufacturer: 'FDC Ltd', batchNumber: 'FDC-2024-010', expiryDate: '2026-10-31', purchasePrice: 18, sellingPrice: 28, stock: 400, minStock: 100, gstRate: 5, hsnCode: '30049099', barcode: '8902678901234' },
    { name: 'Metronidazole 400mg', category: 'Tablet', manufacturer: 'Sun Pharma', batchNumber: 'SPH-2024-013', expiryDate: '2026-01-15', purchasePrice: 14, sellingPrice: 24, stock: 350, minStock: 80, gstRate: 12, hsnCode: '30041099', barcode: '8902789012345' },
    { name: 'Atorvastatin 10mg', category: 'Tablet', manufacturer: 'Zydus Cadila', batchNumber: 'ZCD-2024-017', expiryDate: '2026-06-30', purchasePrice: 16, sellingPrice: 30, stock: 500, minStock: 120, gstRate: 12, hsnCode: '30049099', barcode: '8902890123456' },
    { name: 'Brufen 400 (Ibuprofen)', category: 'Tablet', manufacturer: 'Abbott', batchNumber: 'ABB-2024-019', expiryDate: '2026-09-15', purchasePrice: 22, sellingPrice: 38, stock: 300, minStock: 60, gstRate: 12, hsnCode: '30049099', barcode: '8902901234567' },
  ]
  for (let i = 0; i < medicinesData.length; i++) {
    const m = medicinesData[i]
    await db.medicine.create({ data: { medicineId: `MED-${String(i + 1).padStart(4, '0')}`, ...m } })
  }
  console.log('Medicines seeded')

  // ==================== APPOINTMENTS ====================
  const appointmentData: Array<{ patientIdx: number; doctorIdx: number; date: string; time: string; status: string; type: string; notes: string | null }> = [
    { patientIdx: 0, doctorIdx: 0, date: getDate(0), time: '09:00', status: 'Scheduled', type: 'Consultation', notes: 'Follow-up for fever' },
    { patientIdx: 1, doctorIdx: 1, date: getDate(0), time: '09:30', status: 'Scheduled', type: 'Consultation', notes: 'Cardiac check-up' },
    { patientIdx: 2, doctorIdx: 2, date: getDate(0), time: '10:00', status: 'Completed', type: 'Consultation', notes: 'Knee pain evaluation' },
    { patientIdx: 3, doctorIdx: 3, date: getDate(-1), time: '11:00', status: 'Completed', type: 'Consultation', notes: 'Skin rash treatment' },
    { patientIdx: 4, doctorIdx: 4, date: getDate(-1), time: '14:00', status: 'Completed', type: 'Follow-up', notes: 'Diabetes management' },
    { patientIdx: 5, doctorIdx: 5, date: getDate(-2), time: '09:00', status: 'Completed', type: 'Consultation', notes: 'Prenatal check-up' },
    { patientIdx: 6, doctorIdx: 6, date: getDate(-2), time: '10:30', status: 'Completed', type: 'Consultation', notes: 'Ear infection' },
    { patientIdx: 7, doctorIdx: 7, date: getDate(-3), time: '11:00', status: 'Completed', type: 'Consultation', notes: 'Eye examination' },
    { patientIdx: 8, doctorIdx: 0, date: getDate(-3), time: '15:00', status: 'Completed', type: 'Follow-up', notes: 'Blood pressure review' },
    { patientIdx: 9, doctorIdx: 1, date: getDate(-4), time: '09:00', status: 'Completed', type: 'Consultation', notes: 'Chest pain evaluation' },
    { patientIdx: 10, doctorIdx: 2, date: getDate(-5), time: '10:00', status: 'No-Show', type: 'Consultation', notes: null },
    { patientIdx: 11, doctorIdx: 3, date: getDate(-5), time: '14:00', status: 'Completed', type: 'Follow-up', notes: 'Acne treatment review' },
    { patientIdx: 12, doctorIdx: 0, date: getDate(-6), time: '09:30', status: 'Completed', type: 'Consultation', notes: 'General health check-up' },
    { patientIdx: 13, doctorIdx: 4, date: getDate(-7), time: '10:00', status: 'Completed', type: 'Consultation', notes: 'Child vaccination' },
    { patientIdx: 14, doctorIdx: 6, date: getDate(-7), time: '11:00', status: 'Completed', type: 'Consultation', notes: 'Sinusitis treatment' },
    { patientIdx: 15, doctorIdx: 5, date: getDate(-8), time: '14:00', status: 'Cancelled', type: 'Follow-up', notes: null },
    { patientIdx: 16, doctorIdx: 1, date: getDate(-9), time: '09:00', status: 'Completed', type: 'Consultation', notes: 'ECG and cardiac evaluation' },
    { patientIdx: 17, doctorIdx: 7, date: getDate(-10), time: '10:30', status: 'Completed', type: 'Consultation', notes: 'Vision test' },
    { patientIdx: 18, doctorIdx: 0, date: getDate(1), time: '10:00', status: 'Scheduled', type: 'Follow-up', notes: 'Lab results review' },
    { patientIdx: 19, doctorIdx: 2, date: getDate(1), time: '11:00', status: 'Scheduled', type: 'Consultation', notes: 'Back pain evaluation' },
  ]
  for (let i = 0; i < appointmentData.length; i++) {
    const a = appointmentData[i]
    await db.appointment.create({ data: { aptId: `APT-${String(i + 1).padStart(4, '0')}`, patientId: patientRecords[a.patientIdx].id, doctorId: doctorRecords[a.doctorIdx].id, date: a.date, time: a.time, status: a.status, type: a.type, notes: a.notes } })
  }
  console.log('Appointments seeded')

  // ==================== INVOICES & PAYMENTS ====================
  interface InvoiceTemplate { patientIdx: number; doctorIdx: number; items: { description: string; hsnCode: string; quantity: number; unitPrice: number; gstRate: number; type: string }[]; discount: number }
  const invoiceTemplates: InvoiceTemplate[] = [
    { patientIdx: 2, doctorIdx: 2, items: [{ description: 'Orthopedic Consultation', hsnCode: '0011', quantity: 1, unitPrice: 800, gstRate: 0, type: 'Service' }, { description: 'X-Ray - Left Knee', hsnCode: '0014', quantity: 1, unitPrice: 500, gstRate: 5, type: 'Lab Test' }, { description: 'Physiotherapy Session', hsnCode: '0011', quantity: 3, unitPrice: 400, gstRate: 0, type: 'Service' }], discount: 100 },
    { patientIdx: 3, doctorIdx: 3, items: [{ description: 'Dermatology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 700, gstRate: 0, type: 'Service' }, { description: 'Skin Allergy Test', hsnCode: '0019', quantity: 1, unitPrice: 1200, gstRate: 5, type: 'Lab Test' }], discount: 0 },
    { patientIdx: 4, doctorIdx: 4, items: [{ description: 'Pediatric Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' }, { description: 'HbA1c Test', hsnCode: '0013', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' }, { description: 'Fasting Blood Sugar', hsnCode: '0013', quantity: 1, unitPrice: 150, gstRate: 5, type: 'Lab Test' }], discount: 50 },
    { patientIdx: 5, doctorIdx: 5, items: [{ description: 'Gynecology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 800, gstRate: 0, type: 'Service' }, { description: 'Ultrasound - Pelvic', hsnCode: '0015', quantity: 1, unitPrice: 1500, gstRate: 5, type: 'Lab Test' }], discount: 0 },
    { patientIdx: 6, doctorIdx: 6, items: [{ description: 'ENT Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' }, { description: 'Ear Wax Removal', hsnCode: '0011', quantity: 1, unitPrice: 300, gstRate: 0, type: 'Service' }], discount: 0 },
    { patientIdx: 7, doctorIdx: 7, items: [{ description: 'Ophthalmology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 700, gstRate: 0, type: 'Service' }, { description: 'Visual Acuity Test', hsnCode: '0013', quantity: 1, unitPrice: 200, gstRate: 5, type: 'Lab Test' }, { description: 'Retinal Examination', hsnCode: '0013', quantity: 1, unitPrice: 800, gstRate: 5, type: 'Lab Test' }], discount: 100 },
    { patientIdx: 8, doctorIdx: 0, items: [{ description: 'General Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' }, { description: 'Complete Blood Count', hsnCode: '0013', quantity: 1, unitPrice: 400, gstRate: 5, type: 'Lab Test' }, { description: 'Lipid Profile', hsnCode: '0013', quantity: 1, unitPrice: 600, gstRate: 5, type: 'Lab Test' }, { description: 'ECG', hsnCode: '0018', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' }], discount: 150 },
    { patientIdx: 9, doctorIdx: 1, items: [{ description: 'Cardiology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 1000, gstRate: 0, type: 'Service' }, { description: 'ECG', hsnCode: '0018', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' }, { description: 'Echocardiogram', hsnCode: '0015', quantity: 1, unitPrice: 2500, gstRate: 5, type: 'Lab Test' }, { description: 'Treadmill Test', hsnCode: '0018', quantity: 1, unitPrice: 2000, gstRate: 5, type: 'Lab Test' }], discount: 200 },
    { patientIdx: 12, doctorIdx: 0, items: [{ description: 'General Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' }, { description: 'Full Body Health Checkup', hsnCode: '0020', quantity: 1, unitPrice: 3500, gstRate: 5, type: 'Package' }], discount: 500 },
    { patientIdx: 13, doctorIdx: 4, items: [{ description: 'Pediatric Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' }, { description: 'Vaccination (MMR)', hsnCode: '3004', quantity: 1, unitPrice: 450, gstRate: 5, type: 'Medicine' }, { description: 'Vaccination (Hepatitis B)', hsnCode: '3004', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Medicine' }], discount: 0 },
    { patientIdx: 16, doctorIdx: 1, items: [{ description: 'Cardiology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 1000, gstRate: 0, type: 'Service' }, { description: 'Holter Monitor', hsnCode: '0018', quantity: 1, unitPrice: 1800, gstRate: 5, type: 'Lab Test' }], discount: 100 },
    { patientIdx: 17, doctorIdx: 7, items: [{ description: 'Ophthalmology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 700, gstRate: 0, type: 'Service' }, { description: 'Visual Field Test', hsnCode: '0013', quantity: 1, unitPrice: 500, gstRate: 5, type: 'Lab Test' }, { description: 'OCT Scan', hsnCode: '0015', quantity: 1, unitPrice: 1200, gstRate: 5, type: 'Lab Test' }], discount: 0 },
    { patientIdx: 14, doctorIdx: 6, items: [{ description: 'ENT Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' }, { description: 'Nasal Endoscopy', hsnCode: '0014', quantity: 1, unitPrice: 1500, gstRate: 5, type: 'Lab Test' }, { description: 'CT Scan - PNS', hsnCode: '0017', quantity: 1, unitPrice: 3500, gstRate: 5, type: 'Lab Test' }], discount: 200 },
    { patientIdx: 11, doctorIdx: 3, items: [{ description: 'Dermatology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 700, gstRate: 0, type: 'Service' }, { description: 'Chemical Peel', hsnCode: '0011', quantity: 1, unitPrice: 2000, gstRate: 5, type: 'Service' }], discount: 0 },
    { patientIdx: 18, doctorIdx: 0, items: [{ description: 'General Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' }, { description: 'Thyroid Profile Test', hsnCode: '0013', quantity: 1, unitPrice: 500, gstRate: 5, type: 'Lab Test' }, { description: 'Vitamin D Test', hsnCode: '0013', quantity: 1, unitPrice: 400, gstRate: 5, type: 'Lab Test' }, { description: 'Vitamin B12 Test', hsnCode: '0013', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' }], discount: 85 },
  ]
  const createdInvoices: Array<{ id: string; patientId: string; grandTotal: number }> = []
  for (let i = 0; i < invoiceTemplates.length; i++) {
    const invT = invoiceTemplates[i]
    const patientId = patientRecords[invT.patientIdx].id
    const invDate = getDate(-Math.floor(i * 0.8) - 1)
    const dueDate = getDate(-Math.floor(i * 0.8) + 14)
    let subtotal = 0; let totalCgst = 0; let totalSgst = 0
    const itemsData = invT.items.map(item => {
      const lineTotal = item.unitPrice * item.quantity; const gstAmount = (lineTotal * item.gstRate) / 100; const halfGst = gstAmount / 2
      subtotal += lineTotal; totalCgst += halfGst; totalSgst += halfGst
      return { description: item.description, hsnCode: item.hsnCode, quantity: item.quantity, unitPrice: item.unitPrice, gstRate: item.gstRate, gstAmount: parseFloat(gstAmount.toFixed(2)), total: parseFloat((lineTotal + gstAmount).toFixed(2)), type: item.type }
    })
    const totalGst = totalCgst + totalSgst; const grandTotal = parseFloat((subtotal + totalGst - (invT.discount || 0)).toFixed(2))
    const invoice = await db.invoice.create({ data: { invoiceNumber: `INV-${String(i + 1).padStart(4, '0')}`, patientId, date: invDate, dueDate, status: 'Paid', subtotal: parseFloat(subtotal.toFixed(2)), cgst: parseFloat(totalCgst.toFixed(2)), sgst: parseFloat(totalSgst.toFixed(2)), igst: 0, totalGst: parseFloat(totalGst.toFixed(2)), grandTotal, discount: invT.discount || 0, paidAmount: grandTotal, items: { create: itemsData } } })
    createdInvoices.push({ id: invoice.id, patientId: invoice.patientId, grandTotal: invoice.grandTotal })
  }
  const paymentMethods = ['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet']
  let paymentCount = 0
  for (const invoice of createdInvoices) {
    if (paymentCount < 15) { const method = paymentMethods[paymentCount % paymentMethods.length]; await db.payment.create({ data: { paymentId: `PAY-${String(paymentCount + 1).padStart(4, '0')}`, invoiceId: invoice.id, patientId: invoice.patientId, amount: invoice.grandTotal, method, status: 'Success' } }); paymentCount++ }
  }
  for (const idx of [5, 8]) {
    const inv = createdInvoices[idx]
    if (inv) { const partialAmount = parseFloat((inv.grandTotal * 0.5).toFixed(2)); await db.invoice.update({ where: { id: inv.id }, data: { paidAmount: partialAmount, status: 'Partially Paid' } }); await db.payment.create({ data: { paymentId: `PAY-${String(paymentCount + 1).padStart(4, '0')}`, invoiceId: inv.id, patientId: inv.patientId, amount: partialAmount, method: 'Cash', status: 'Success' } }); paymentCount++ }
  }
  for (const idx of [12, 13]) {
    const inv = createdInvoices[idx]
    if (inv) { await db.invoice.update({ where: { id: inv.id }, data: { paidAmount: 0, status: 'Unpaid' } }) }
  }
  console.log('Invoices & payments seeded')

  // ==================== PRESCRIPTIONS ====================
  const prescriptionData = [
    { patientIdx: 2, doctorIdx: 2, date: getDate(-6), diagnosis: 'Osteoarthritis - Left Knee', notes: [{ medicine: 'Ibuprofen 400mg', dosage: '1 tablet', frequency: 'Twice daily after meals', duration: '7 days' }, { medicine: 'Diclofenac Gel', dosage: 'Apply thin layer', frequency: 'Twice daily on affected area', duration: '14 days' }, { medicine: 'Pantoprazole 40mg', dosage: '1 tablet', frequency: 'Once daily before breakfast', duration: '7 days' }] },
    { patientIdx: 3, doctorIdx: 3, date: getDate(-3), diagnosis: 'Allergic Contact Dermatitis', notes: [{ medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', duration: '14 days' }, { medicine: 'Montelukast 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', duration: '14 days' }] },
    { patientIdx: 4, doctorIdx: 4, date: getDate(-4), diagnosis: 'Type 2 Diabetes Mellitus', notes: [{ medicine: 'Metformin 500mg', dosage: '1 tablet', frequency: 'Twice daily after meals', duration: '30 days' }, { medicine: 'Insulin Glargine', dosage: '16 IU', frequency: 'Once daily at bedtime', duration: '30 days' }] },
    { patientIdx: 6, doctorIdx: 6, date: getDate(-5), diagnosis: 'Acute Otitis Media', notes: [{ medicine: 'Amoxicillin 250mg', dosage: '1 capsule', frequency: 'Three times daily', duration: '7 days' }, { medicine: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Three times daily as needed for pain', duration: '5 days' }] },
    { patientIdx: 8, doctorIdx: 0, date: getDate(-7), diagnosis: 'Essential Hypertension', notes: [{ medicine: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily morning', duration: '30 days' }, { medicine: 'Atorvastatin 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', duration: '30 days' }] },
    { patientIdx: 9, doctorIdx: 1, date: getDate(-8), diagnosis: 'Coronary Artery Disease', notes: [{ medicine: 'Ecosprin 75mg', dosage: '1 tablet', frequency: 'Once daily after meals', duration: 'Lifelong' }, { medicine: 'Atorvastatin 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', duration: 'Lifelong' }, { medicine: 'Metoprolol 50mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '30 days' }] },
    { patientIdx: 14, doctorIdx: 6, date: getDate(-10), diagnosis: 'Chronic Sinusitis', notes: [{ medicine: 'Amoxicillin 250mg', dosage: '1 capsule', frequency: 'Three times daily', duration: '10 days' }, { medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once daily', duration: '14 days' }] },
    { patientIdx: 12, doctorIdx: 0, date: getDate(-9), diagnosis: 'Vitamin D Deficiency', notes: [{ medicine: 'Vitamin D3 60K IU', dosage: '1 capsule', frequency: 'Once weekly', duration: '8 weeks' }] },
  ]
  for (let i = 0; i < prescriptionData.length; i++) {
    const p = prescriptionData[i]
    await db.prescription.create({ data: { prescriptionId: `PRX-${String(i + 1).padStart(4, '0')}`, patientId: patientRecords[p.patientIdx].id, doctorId: doctorRecords[p.doctorIdx].id, date: p.date, diagnosis: p.diagnosis, notes: JSON.stringify(p.notes) } })
  }
  console.log('Prescriptions seeded')

  // ==================== PATIENT VISITS ====================
  const visitData = [
    { visitId: 'VIS-0001', patientIdx: 0, doctorIdx: 0, stage: 'In-Consultation' as VisitStageName, status: 'Active' as const, temperature: '99.2°F', bloodPressure: '130/85', pulse: '78 bpm', oxygenLevel: '97%', weight: '72 kg', height: '170 cm', chiefComplaint: 'Persistent headache for 3 days', visitType: 'OPD', department: 'General Medicine', completed: false },
    { visitId: 'VIS-0002', patientIdx: 1, doctorIdx: 1, stage: 'In-Consultation' as VisitStageName, status: 'Active' as const, temperature: '98.6°F', bloodPressure: '140/90', pulse: '82 bpm', oxygenLevel: '98%', weight: '65 kg', height: '162 cm', chiefComplaint: 'Chest pain and shortness of breath', visitType: 'OPD', department: 'Cardiology', completed: false },
    { visitId: 'VIS-0003', patientIdx: 4, doctorIdx: 4, stage: 'Lab-Ordered' as VisitStageName, status: 'Active' as const, temperature: '98.4°F', bloodPressure: '125/80', pulse: '70 bpm', oxygenLevel: '99%', weight: '85 kg', height: '168 cm', chiefComplaint: 'High blood sugar levels, fatigue', visitType: 'OPD', department: 'Pediatrics', completed: false },
    { visitId: 'VIS-0004', patientIdx: 5, doctorIdx: 5, stage: 'Lab-Ordered' as VisitStageName, status: 'Active' as const, temperature: '98.8°F', bloodPressure: '118/75', pulse: '76 bpm', oxygenLevel: '98%', weight: '62 kg', height: '158 cm', chiefComplaint: 'Routine prenatal checkup, mild swelling', visitType: 'OPD', department: 'Gynecology', completed: false },
    { visitId: 'VIS-0005', patientIdx: 9, doctorIdx: 1, stage: 'Lab-Done' as VisitStageName, status: 'Active' as const, temperature: '97.9°F', bloodPressure: '150/95', pulse: '88 bpm', oxygenLevel: '96%', weight: '78 kg', height: '175 cm', chiefComplaint: 'Recurring chest pain, ECG abnormal', visitType: 'OPD', department: 'Cardiology', completed: false },
    { visitId: 'VIS-0006', patientIdx: 3, doctorIdx: 3, stage: 'Prescribed' as VisitStageName, status: 'Active' as const, temperature: '98.5°F', bloodPressure: '110/70', pulse: '72 bpm', oxygenLevel: '99%', weight: '55 kg', height: '165 cm', chiefComplaint: 'Severe skin rash on arms and neck', visitType: 'OPD', department: 'Dermatology', completed: false },
    { visitId: 'VIS-0007', patientIdx: 6, doctorIdx: 6, stage: 'Billed' as VisitStageName, status: 'Active' as const, temperature: '99.1°F', bloodPressure: '120/78', pulse: '74 bpm', oxygenLevel: '98%', weight: '68 kg', height: '172 cm', chiefComplaint: 'Ear pain and hearing difficulty', visitType: 'OPD', department: 'ENT', completed: false },
    { visitId: 'VIS-0008', patientIdx: 7, doctorIdx: 7, stage: 'Paid' as VisitStageName, status: 'Active' as const, temperature: '98.3°F', bloodPressure: '115/72', pulse: '68 bpm', oxygenLevel: '99%', weight: '58 kg', height: '160 cm', chiefComplaint: 'Blurred vision, frequent headaches', visitType: 'OPD', department: 'Ophthalmology', completed: false },
    { visitId: 'VIS-0009', patientIdx: 2, doctorIdx: 2, stage: 'Discharged' as VisitStageName, status: 'Completed' as const, temperature: '98.7°F', bloodPressure: '128/82', pulse: '75 bpm', oxygenLevel: '98%', weight: '82 kg', height: '174 cm', chiefComplaint: 'Left knee pain and stiffness', visitType: 'OPD', department: 'Orthopedics', completed: true },
    { visitId: 'VIS-0010', patientIdx: 8, doctorIdx: 0, stage: 'Discharged' as VisitStageName, status: 'Completed' as const, temperature: '98.9°F', bloodPressure: '145/92', pulse: '80 bpm', oxygenLevel: '97%', weight: '76 kg', height: '171 cm', chiefComplaint: 'High BP, dizziness in mornings', visitType: 'OPD', department: 'General Medicine', completed: true },
    { visitId: 'VIS-0011', patientIdx: 10, doctorIdx: 2, stage: 'Discharged' as VisitStageName, status: 'Completed' as const, temperature: '99.5°F', bloodPressure: '122/78', pulse: '84 bpm', oxygenLevel: '98%', weight: '75 kg', height: '169 cm', chiefComplaint: 'Lower back pain radiating to leg', visitType: 'OPD', department: 'Orthopedics', completed: true },
    { visitId: 'VIS-0012', patientIdx: 11, doctorIdx: 3, stage: 'Waiting' as VisitStageName, status: 'Active' as const, temperature: '98.2°F', bloodPressure: '118/76', pulse: '72 bpm', oxygenLevel: '99%', weight: '60 kg', height: '163 cm', chiefComplaint: 'Acne breakout on face', visitType: 'OPD', department: 'Dermatology', completed: false },
  ]
  for (const v of visitData) {
    if (v.patientIdx >= patientRecords.length || v.doctorIdx >= doctorRecords.length) continue
    await db.patientVisit.create({
      data: {
        visitId: v.visitId, patientId: patientRecords[v.patientIdx].id, doctorId: doctorRecords[v.doctorIdx].id,
        stage: v.stage, status: v.status, temperature: v.temperature, bloodPressure: v.bloodPressure,
        pulse: v.pulse, oxygenLevel: v.oxygenLevel, weight: v.weight, height: v.height,
        chiefComplaint: v.chiefComplaint, notes: `Visit type: ${v.visitType}, Department: ${v.department}`,
        stages: { create: buildStages(v.stage, v.completed) },
      },
    })
  }
  console.log('Patient visits seeded')
  const allVisits = await db.patientVisit.findMany({ orderBy: { visitId: 'asc' } })

  // ==================== DOCTOR SCHEDULES ====================
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  for (let di = 0; di < doctorRecords.length; di++) {
    const docId = doctorRecords[di].id
    const baseFee = doctorsData[di].consultationFee
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const startH = 9 + (di % 3) * 2
      await db.doctorSchedule.create({
        data: {
          scheduleId: `SCH-${String(di * 6 + dayIdx + 1).padStart(4, '0')}`,
          doctorId: docId,
          dayOfWeek: days[dayIdx],
          startTime: `${startH.toString().padStart(2, '0')}:00`,
          endTime: `${(startH + 5).toString().padStart(2, '0')}:00`,
          maxAppointments: 20,
          consultationFee: baseFee,
          isAvailable: dayIdx < 6,
          status: 'Active',
        },
      })
    }
  }
  console.log('Doctor schedules seeded')

  // ==================== LAB TEST CATALOG & ORDERS ====================
  const labTestsData = [
    { name: 'Complete Blood Count (CBC)', category: 'Hematology', description: 'Measures RBC, WBC, Hemoglobin, Hematocrit & Platelets', normalRange: 'See report', unit: 'Various', price: 400, gstRate: 5, hsnCode: '0013' },
    { name: 'Fasting Blood Sugar (FBS)', category: 'Biochemistry', description: 'Blood glucose level after 8-12 hours fasting', normalRange: '70-100 mg/dL', unit: 'mg/dL', price: 150, gstRate: 5, hsnCode: '0013' },
    { name: 'HbA1c', category: 'Biochemistry', description: 'Average blood sugar over 3 months', normalRange: '<5.7%', unit: '%', price: 350, gstRate: 5, hsnCode: '0013' },
    { name: 'Lipid Profile', category: 'Biochemistry', description: 'Cholesterol, HDL, LDL, Triglycerides', normalRange: 'See report', unit: 'mg/dL', price: 600, gstRate: 5, hsnCode: '0013' },
    { name: 'Thyroid Profile (T3, T4, TSH)', category: 'Biochemistry', description: 'Thyroid function panel', normalRange: 'TSH: 0.4-4.0 mIU/L', unit: 'Various', price: 500, gstRate: 5, hsnCode: '0013' },
    { name: 'Liver Function Test (LFT)', category: 'Biochemistry', description: 'ALT, AST, ALP, Bilirubin, Albumin', normalRange: 'See report', unit: 'Various', price: 550, gstRate: 5, hsnCode: '0013' },
    { name: 'Renal Function Test (RFT)', category: 'Biochemistry', description: 'Creatinine, BUN, Uric Acid, Electrolytes', normalRange: 'See report', unit: 'Various', price: 450, gstRate: 5, hsnCode: '0013' },
    { name: 'Urine Routine & Microscopy', category: 'Pathology', description: 'Physical, chemical & microscopic exam of urine', normalRange: 'See report', unit: 'N/A', price: 200, gstRate: 5, hsnCode: '0013' },
    { name: 'ECG (Electrocardiogram)', category: 'Radiology', description: 'Electrical activity of the heart', normalRange: 'Normal sinus rhythm', unit: 'N/A', price: 350, gstRate: 5, hsnCode: '0018' },
    { name: 'Chest X-Ray', category: 'Radiology', description: 'X-Ray imaging of the chest', normalRange: 'Normal lung fields', unit: 'N/A', price: 500, gstRate: 5, hsnCode: '0014' },
    { name: 'Ultrasound Abdomen', category: 'Radiology', description: 'Ultrasound of the abdominal region', normalRange: 'Normal study', unit: 'N/A', price: 1500, gstRate: 5, hsnCode: '0015' },
    { name: 'Vitamin D (25-OH)', category: 'Biochemistry', description: 'Vitamin D level', normalRange: '30-100 ng/mL', unit: 'ng/mL', price: 1200, gstRate: 5, hsnCode: '0013' },
    { name: 'Vitamin B12', category: 'Biochemistry', description: 'Cobalamin level', normalRange: '200-900 pg/mL', unit: 'pg/mL', price: 800, gstRate: 5, hsnCode: '0013' },
    { name: 'Dengue NS1 Antigen', category: 'Microbiology', description: 'Dengue fever antigen test', normalRange: 'Negative', unit: 'N/A', price: 600, gstRate: 5, hsnCode: '0013' },
    { name: 'Malaria Antigen', category: 'Microbiology', description: 'Malaria parasite detection', normalRange: 'Negative', unit: 'N/A', price: 350, gstRate: 5, hsnCode: '0013' },
    { name: 'HIV Rapid Test', category: 'Microbiology', description: 'HIV 1 & 2 antibody test', normalRange: 'Non-reactive', unit: 'N/A', price: 400, gstRate: 5, hsnCode: '0013' },
    { name: 'HBsAg (Hepatitis B)', category: 'Microbiology', description: 'Hepatitis B surface antigen', normalRange: 'Negative', unit: 'N/A', price: 350, gstRate: 5, hsnCode: '0013' },
    { name: 'HCV (Hepatitis C)', category: 'Microbiology', description: 'Hepatitis C antibody', normalRange: 'Non-reactive', unit: 'N/A', price: 450, gstRate: 5, hsnCode: '0013' },
    { name: 'CRP (C-Reactive Protein)', category: 'Biochemistry', description: 'Inflammatory marker', normalRange: '<6 mg/L', unit: 'mg/L', price: 300, gstRate: 5, hsnCode: '0013' },
    { name: 'ESR', category: 'Hematology', description: 'Erythrocyte Sedimentation Rate', normalRange: '1-20 mm/hr', unit: 'mm/hr', price: 150, gstRate: 5, hsnCode: '0013' },
    { name: 'Full Body Health Checkup', category: 'Biochemistry', description: 'Comprehensive 65+ parameter health checkup', normalRange: 'See report', unit: 'N/A', price: 3500, gstRate: 5, hsnCode: '0020' },
    { name: 'Cardiac Health Package', category: 'Biochemistry', description: 'Cardiac risk markers including Lipid, hsCRP, ECG', normalRange: 'See report', unit: 'N/A', price: 2500, gstRate: 5, hsnCode: '0020' },
  ]
  const labTestRecords: Array<{ id: string; testId: string }> = []
  for (let i = 0; i < labTestsData.length; i++) {
    const lt = labTestsData[i]
    const rec = await db.labTestCatalog.create({ data: { testId: `LT-${String(i + 1).padStart(4, '0')}`, ...lt } })
    labTestRecords.push({ id: rec.id, testId: rec.testId })
  }
  console.log('Lab test catalog seeded')

  // Lab orders
  const labOrderTests = [
    { visitIdx: 2, patientIdx: 4, doctorIdx: 4, testIdx: 0 },
    { visitIdx: 2, patientIdx: 4, doctorIdx: 4, testIdx: 2 },
    { visitIdx: 3, patientIdx: 5, doctorIdx: 5, testIdx: 10 },
    { visitIdx: 4, patientIdx: 9, doctorIdx: 1, testIdx: 8 },
    { visitIdx: 4, patientIdx: 9, doctorIdx: 1, testIdx: 3 },
    { visitIdx: 4, patientIdx: 9, doctorIdx: 1, testIdx: 20 },
    { visitIdx: 0, patientIdx: 0, doctorIdx: 0, testIdx: 0 },
    { visitIdx: 0, patientIdx: 0, doctorIdx: 0, testIdx: 1 },
    { visitIdx: 7, patientIdx: 7, doctorIdx: 7, testIdx: 0 },
    { visitIdx: 7, patientIdx: 7, doctorIdx: 7, testIdx: 13 },
    { visitIdx: 11, patientIdx: 11, doctorIdx: 3, testIdx: 9 },
  ]
  let loCount = 0
  for (const lo of labOrderTests) {
    if (lo.visitIdx >= allVisits.length) continue
    const visit = allVisits[lo.visitIdx]
    loCount++
    await db.labTestOrder.create({
      data: {
        orderId: `LTO-${String(loCount).padStart(4, '0')}`,
        visitId: visit.id,
        patientId: patientRecords[lo.patientIdx].id,
        testId: labTestRecords[lo.testIdx].id,
        doctorId: doctorRecords[lo.doctorIdx].id,
        status: loCount <= 5 ? 'Completed' : 'Ordered',
        results: loCount <= 5 ? JSON.stringify([{ parameter: 'Result', value: 'Normal', unit: '', normalRange: 'Normal', isAbnormal: false }]) : null,
      },
    })
  }
  console.log('Lab orders seeded')

  // ==================== WARDS & BEDS ====================
  const wardsData = [
    { name: 'General Ward', floor: 1, status: 'Active' },
    { name: 'Private Ward', floor: 2, status: 'Active' },
    { name: 'Semi-Private Ward', floor: 2, status: 'Active' },
    { name: 'ICU', floor: 3, status: 'Active' },
    { name: 'NICU', floor: 3, status: 'Active' },
    { name: 'Emergency Ward', floor: 1, status: 'Active' },
    { name: 'Maternity Ward', floor: 4, status: 'Active' },
  ]
  const wardRecords: Array<{ id: string; wardId: string }> = []
  for (let i = 0; i < wardsData.length; i++) {
    const w = wardsData[i]
    const ward = await db.ward.create({ data: { wardId: `WRD-${String(i + 1).padStart(4, '0')}`, ...w } })
    wardRecords.push({ id: ward.id, wardId: ward.wardId })
  }

  const bedTypes = ['Standard', 'Standard', 'Standard', 'Deluxe', 'Suite', 'ICU Bed', 'ICU Bed']
  const dailyRates = [500, 2500, 1200, 3500, 5000, 8000, 2000]
  const bedCounts = [20, 10, 15, 8, 3, 10, 12]
  for (let wi = 0; wi < wardRecords.length; wi++) {
    for (let bi = 0; bi < bedCounts[wi]; bi++) {
      await db.bed.create({
        data: {
          bedId: `BED-${String(wi * 100 + bi + 1).padStart(4, '0')}`,
          wardId: wardRecords[wi].id,
          bedNumber: `${wi + 1}0${String(bi + 1).padStart(2, '0')}`,
          bedType: bedTypes[wi],
          dailyRate: dailyRates[wi],
          status: bi < 3 ? 'Occupied' : 'Available',
          currentPatientId: bi < 3 ? patientRecords[bi].id : null,
          currentVisitId: bi < 3 ? allVisits[bi]?.id : null,
        },
      })
    }
  }
  console.log('Wards & beds seeded')

  // ==================== INSURANCE COMPANIES & CLAIMS ====================
  const insuranceCompanies = [
    { name: 'Star Health Insurance', type: 'Private', contactPerson: 'Rajesh Kumar', phone: '1800-123-4567', email: 'claims@starhealth.in', gstin: '29AAACS1234B1Z8' },
    { name: 'ICICI Lombard', type: 'Private', contactPerson: 'Priya Sharma', phone: '1800-234-5678', email: 'claims@icicilombard.com', gstin: '27AACCI5678B1Z9' },
    { name: 'New India Assurance', type: 'Government', contactPerson: 'Suresh Babu', phone: '1800-345-6789', email: 'claims@newindia.co.in', gstin: '33AACCN9012B1Z0' },
    { name: 'HDFC Ergo', type: 'Private', contactPerson: 'Anita Desai', phone: '1800-456-7890', email: 'claims@hdfcergo.com', gstin: '27AACCH3456B1Z1' },
    { name: 'Bajaj Allianz', type: 'Private', contactPerson: 'Vikram Joshi', phone: '1800-567-8901', email: 'claims@bajajallianz.com', gstin: '27AACCB7890B1Z2' },
  ]
  const insuranceRecords: Array<{ id: string }> = []
  for (let i = 0; i < insuranceCompanies.length; i++) {
    const ins = insuranceCompanies[i]
    const rec = await db.insuranceCompany.create({ data: { companyId: `INS-${String(i + 1).padStart(4, '0')}`, ...ins } })
    insuranceRecords.push({ id: rec.id })
  }

  const claimStatuses = ['Submitted', 'Pre-Approved', 'Approved', 'Processed', 'Settled']
  for (let i = 0; i < 6; i++) {
    const pi = i % patientRecords.length
    const patient = patientRecords[pi]
    const patientData = patientsData[pi]
    if (!patientData.insuranceNumber) continue
    await db.insuranceClaim.create({
      data: {
        claimId: `CLM-${String(i + 1).padStart(4, '0')}`,
        patientId: patient.id,
        insuranceCompanyId: insuranceRecords[i % insuranceRecords.length].id,
        invoiceId: createdInvoices[i]?.id || null,
        policyNumber: patientData.insuranceNumber || `POL-${String(pi + 1).padStart(4, '0')}`,
        claimType: i % 2 === 0 ? 'Cashless' : 'Reimbursement',
        status: claimStatuses[i % 5],
        approvedAmount: 5000 + i * 1000,
        settledAmount: i < 4 ? 4000 + i * 1000 : 0,
        remarks: i < 4 ? 'Processed within TAT' : 'Documents under review',
        submittedAt: new Date(Date.now() - (i + 1) * 86400000),
        approvedAt: i < 4 ? new Date(Date.now() - i * 86400000) : null,
        settledAt: i < 3 ? new Date(Date.now() - (i - 1) * 86400000) : null,
      },
    })
  }
  console.log('Insurance companies & claims seeded')

  // ==================== EXPENSES ====================
  const expensesData = [
    { title: 'Monthly Rent - Main Building', category: 'Rent', amount: 250000, date: getDate(-30), status: 'Paid' },
    { title: 'Electricity Bill - June', category: 'Utilities', amount: 45000, date: getDate(-15), status: 'Paid' },
    { title: 'Medical Equipment Maintenance', category: 'Equipment', amount: 35000, date: getDate(-10), status: 'Approved' },
    { title: 'Staff Salaries - June 2024', category: 'Salary', amount: 850000, date: getDate(-5), status: 'Paid' },
    { title: 'Office Supplies', category: 'Supplies', amount: 8500, date: getDate(-3), status: 'Approved' },
    { title: 'Water Bill', category: 'Utilities', amount: 12000, date: getDate(-7), status: 'Pending' },
    { title: 'HVAC Repair - ICU Wing', category: 'Maintenance', amount: 28000, date: getDate(-12), status: 'Paid' },
    { title: 'Medical Gas Cylinders', category: 'Supplies', amount: 18000, date: getDate(-8), status: 'Approved' },
    { title: 'Insurance Premium - Q2', category: 'Insurance', amount: 95000, date: getDate(-20), status: 'Paid' },
    { title: 'Sanitary Pad Disposal Units', category: 'Supplies', amount: 12000, date: getDate(-6), status: 'Pending' },
  ]
  for (let i = 0; i < expensesData.length; i++) {
    const e = expensesData[i]
    await db.expense.create({
      data: {
        expenseId: `EXP-${String(i + 1).padStart(4, '0')}`,
        title: e.title, category: e.category, amount: e.amount, date: e.date, status: e.status,
        createdById: userRecords[0].id,
      },
    })
  }
  console.log('Expenses seeded')

  // ==================== SUPPORT TICKETS ====================
  const ticketData = [
    { subject: 'Unable to generate invoice', description: 'Getting error when trying to generate invoice for patient PAT-0005', category: 'Technical', priority: 'High', status: 'Open', createdByIdx: 1, assignedToIdx: 0 },
    { subject: 'Request for new user account', description: 'Need create account for new receptionist at Andheri branch', category: 'Account', priority: 'Medium', status: 'In Progress', createdByIdx: 5, assignedToIdx: 0 },
    { subject: 'Billing module query', description: 'Need clarification on GST calculation for package deals', category: 'Billing', priority: 'Medium', status: 'Open', createdByIdx: 3, assignedToIdx: null },
    { subject: 'Lab test results not displaying', description: 'Lab results for VIS-0003 are not visible on the dashboard', category: 'Technical', priority: 'Urgent', status: 'Closed', createdByIdx: 1, assignedToIdx: 0, resolution: 'Cache cleared, results now displaying correctly' },
    { subject: 'Inventory stock discrepancy', description: 'Actual stock for Paracetamol 500mg shows 450 but system shows 500', category: 'Inventory', priority: 'Low', status: 'Resolved', createdByIdx: 4, assignedToIdx: 0, resolution: 'Audit performed, stock corrected to 450 units' },
    { subject: 'Appointment scheduling error', description: 'Double booking possible - two patients assigned same time slot for Dr. Priya Patel', category: 'Appointment', priority: 'High', status: 'In Progress', createdByIdx: 1, assignedToIdx: 0 },
    { subject: 'Prescription printing issue', description: 'Prescription PDF not including medicine dosage instructions', category: 'Prescription', priority: 'Medium', status: 'Open', createdByIdx: 2, assignedToIdx: null },
  ]
  for (let i = 0; i < ticketData.length; i++) {
    const t = ticketData[i]
    const ticket = await db.supportTicket.create({
      data: {
        ticketId: `TKT-${String(i + 1).padStart(4, '0')}`,
        subject: t.subject, description: t.description, category: t.category, priority: t.priority, status: t.status,
        createdById: userRecords[t.createdByIdx].id,
        assignedToId: t.assignedToIdx !== null ? userRecords[t.assignedToIdx].id : null,
        resolution: t.resolution || null,
      },
    })
    // Add a reply for closed/resolved tickets
    if (t.status === 'Closed' || t.status === 'Resolved') {
      await db.supportReply.create({
        data: {
          ticketId: ticket.id,
          userId: userRecords[0].id,
          userName: 'Admin User',
          userRole: 'Admin',
          message: t.resolution || 'Issue has been resolved.',
          isInternal: false,
        },
      })
    }
  }
  console.log('Support tickets seeded')

  // ==================== PATIENT FEEDBACK ====================
  const feedbackData = [
    { patientIdx: 0, visitIdx: 0, rating: 4, category: 'Doctor', comment: 'Dr. Sharma was very thorough and patient. Explained everything clearly.' },
    { patientIdx: 3, visitIdx: 5, rating: 5, category: 'Service', comment: 'Excellent service at the dermatology department. Very satisfied.' },
    { patientIdx: 5, visitIdx: 3, rating: 4, category: 'Doctor', comment: 'Dr. Anjali is wonderful. Made me feel very comfortable during the prenatal visit.' },
    { patientIdx: 6, visitIdx: 6, rating: 3, category: 'Wait Time', comment: 'Had to wait 45 minutes past appointment time. Needs improvement.' },
    { patientIdx: 7, visitIdx: 7, rating: 5, category: 'Facility', comment: 'Very clean and modern facility. Impressed with the eye care center.' },
    { patientIdx: 8, visitIdx: 8, rating: 4, category: 'Billing', comment: 'Billing was smooth and the staff helped with insurance claim.' },
    { patientIdx: 2, visitIdx: 8, rating: 5, category: 'Doctor', comment: 'Dr. Amit Gupta did an excellent job with my knee. Pain much better now.' },
  ]
  for (let i = 0; i < feedbackData.length; i++) {
    const f = feedbackData[i]
    const visit = allVisits[f.visitIdx]
    if (!visit) continue
    await db.patientFeedback.create({
      data: {
        feedbackId: `FB-${String(i + 1).padStart(4, '0')}`,
        patientId: patientRecords[f.patientIdx].id,
        visitId: visit.id,
        rating: f.rating, category: f.category, comment: f.comment,
        status: f.rating >= 4 ? 'Reviewed' : 'New',
      },
    })
  }
  console.log('Feedback seeded')

  // ==================== REFERRALS ====================
  const referralData = [
    { patientIdx: 0, fromIdx: 0, toIdx: 1, reason: 'Patient showing cardiac symptoms during general checkup', department: 'Cardiology', status: 'Accepted' },
    { patientIdx: 8, fromIdx: 0, toIdx: 1, reason: 'Persistent hypertension despite medication', department: 'Cardiology', status: 'Completed' },
    { patientIdx: 2, fromIdx: 2, toIdx: 4, reason: 'Orthopedic patient needs pediatric evaluation for growth plate issue', department: 'Pediatrics', status: 'Completed' },
    { patientIdx: 9, fromIdx: 0, toIdx: 6, reason: 'Patient with throat infection needs ENT evaluation', department: 'ENT', status: 'Pending' },
    { patientIdx: 12, fromIdx: 0, toIdx: 2, reason: 'Chronic lower back pain requiring orthopedic consultation', department: 'Orthopedics', status: 'Pending' },
  ]
  for (let i = 0; i < referralData.length; i++) {
    const r = referralData[i]
    await db.referral.create({
      data: {
        referralId: `REF-${String(i + 1).padStart(4, '0')}`,
        patientId: patientRecords[r.patientIdx].id,
        fromDoctorId: doctorRecords[r.fromIdx].id,
        toDoctorId: doctorRecords[r.toIdx]?.id || null,
        department: r.department, reason: r.reason, status: r.status,
      },
    })
  }
  console.log('Referrals seeded')

  // ==================== WASTE DISPOSAL ====================
  const wasteData = [
    { wasteType: 'Biomedical', category: 'Yellow', quantity: 12.5, disposalMethod: 'Incineration', date: getDate(-15), agencyName: 'Eco-Waste Solutions', vehicleNo: 'MH-02-AB-1234', certificateNo: 'BMW-2024-7890', status: 'Completed' },
    { wasteType: 'Sharps', category: 'White', quantity: 5.2, disposalMethod: 'Autoclave', date: getDate(-10), agencyName: 'BioMed Disposal Co.', vehicleNo: 'MH-04-CD-5678', status: 'Completed' },
    { wasteType: 'Chemical', category: 'Red', quantity: 8.0, disposalMethod: 'Chemical Treatment', date: getDate(-5), agencyName: 'ChemSafe Ltd', status: 'Processed' },
    { wasteType: 'General', category: 'Blue', quantity: 20.0, disposalMethod: 'Landfill', date: getDate(-2), status: 'Pending' },
  ]
  for (let i = 0; i < wasteData.length; i++) {
    const w = wasteData[i]
    await db.wasteDisposal.create({
      data: {
        disposalId: `WST-${String(i + 1).padStart(4, '0')}`,
        wasteType: w.wasteType, category: w.category, quantity: w.quantity, disposalMethod: w.disposalMethod, date: w.date,
        agencyName: w.agencyName || null, vehicleNo: w.vehicleNo || null, certificateNo: w.certificateNo || null,
        status: w.status, createdById: userRecords[0].id,
      },
    })
  }
  console.log('Waste disposal seeded')

  // ==================== TDS RECORDS ====================
  const tdsData = [
    { recipientName: 'Sunil Construction Co.', panNumber: 'AAECS1234D', amount: 500000, tdsRate: 1, tdsAmount: 5000, section: '194C', quarter: 'Q1', fiscalYear: '2024-25', dueDate: getDate(-10), paidDate: getDate(-8), challanNo: 'CIN-240700001', status: 'Paid' },
    { recipientName: 'Aarav IT Solutions', panNumber: 'AAEFG5678H', amount: 120000, tdsRate: 10, tdsAmount: 12000, section: '194J', quarter: 'Q1', fiscalYear: '2024-25', dueDate: getDate(-10), paidDate: getDate(-7), challanNo: 'CIN-240700002', status: 'Paid' },
    { recipientName: 'Mumbai Rentals Pvt Ltd', panNumber: 'AAEHI9012J', amount: 250000, tdsRate: 10, tdsAmount: 25000, section: '194I', quarter: 'Q2', fiscalYear: '2024-25', dueDate: getDate(20), status: 'Pending' },
    { recipientName: 'Dr. Mahesh Consultants', panNumber: 'AAEKL3456M', amount: 80000, tdsRate: 10, tdsAmount: 8000, section: '194J', quarter: 'Q2', fiscalYear: '2024-25', dueDate: getDate(30), status: 'Pending' },
  ]
  for (let i = 0; i < tdsData.length; i++) {
    const t = tdsData[i]
    await db.tdsRecord.create({
      data: {
        recordId: `TDS-${String(i + 1).padStart(4, '0')}`,
        panNumber: t.panNumber, recipientName: t.recipientName, amount: t.amount, tdsRate: t.tdsRate,
        tdsAmount: t.tdsAmount, section: t.section, quarter: t.quarter, fiscalYear: t.fiscalYear,
        dueDate: t.dueDate, paidDate: t.paidDate || null, challanNo: t.challanNo || null,
        status: t.status, createdById: userRecords[0].id,
      },
    })
  }
  console.log('TDS records seeded')

  // ==================== OPERATION THEATRES & SURGERIES ====================
  const otData = [
    { name: 'OT-1 General Surgery', type: 'General', floor: '3' },
    { name: 'OT-2 Cardiac Suite', type: 'Cardiac', floor: '3' },
    { name: 'OT-3 Ortho/Nero', type: 'Ortho', floor: '4' },
    { name: 'OT-4 Day Care', type: 'General', floor: '4' },
  ]
  const otRecords: Array<{ id: string }> = []
  for (let i = 0; i < otData.length; i++) {
    const ot = otData[i]
    const rec = await db.operationTheatre.create({ data: { otId: `OT-${String(i + 1).padStart(4, '0')}`, name: ot.name, type: ot.type, floor: ot.floor } })
    otRecords.push({ id: rec.id })
  }

  const surgeryData = [
    { patientIdx: 2, doctorIdx: 2, otIdx: 0, type: 'Planned', category: 'Major', anesthesiaType: 'Spinal', status: 'Completed', scheduledDate: getDate(-20), scheduledTime: '09:00', diagnosis: 'Ligament tear left knee', procedure: 'ACL Reconstruction Surgery' },
    { patientIdx: 9, doctorIdx: 1, otIdx: 1, type: 'Emergency', category: 'Major', anesthesiaType: 'General', status: 'Completed', scheduledDate: getDate(-15), scheduledTime: '14:30', diagnosis: 'Left main coronary artery stenosis', procedure: 'Coronary Angioplasty with Stent Placement' },
    { patientIdx: 15, doctorIdx: 5, otIdx: 3, type: 'Planned', category: 'Minor', anesthesiaType: 'Local', status: 'Scheduled', scheduledDate: getDate(5), scheduledTime: '10:00', diagnosis: 'Cervical polyp', procedure: 'Polypectomy' },
    { patientIdx: 6, doctorIdx: 6, otIdx: 0, type: 'Planned', category: 'Minor', anesthesiaType: 'Local', status: 'Scheduled', scheduledDate: getDate(3), scheduledTime: '11:00', diagnosis: 'Chronic tonsillitis', procedure: 'Tonsillectomy' },
  ]
  for (let i = 0; i < surgeryData.length; i++) {
    const s = surgeryData[i]
    await db.surgery.create({
      data: {
        surgeryId: `SGR-${String(i + 1).padStart(4, '0')}`,
        patientId: patientRecords[s.patientIdx].id,
        doctorId: doctorRecords[s.doctorIdx].id,
        otId: otRecords[s.otIdx]?.id || null,
        type: s.type, category: s.category, anesthesiaType: s.anesthesiaType, status: s.status,
        scheduledDate: s.scheduledDate, scheduledTime: s.scheduledTime, diagnosis: s.diagnosis, procedure: s.procedure,
      },
    })
  }
  console.log('Operation theatres & surgeries seeded')

  // ==================== CONSENT TEMPLATES & PATIENT CONSENTS ====================
  const consentTemplates = [
    { name: 'General Consent Form', type: 'General', content: 'I, [Patient Name], hereby consent to receive medical treatment at Sai Multispecialty Hospital. I understand the nature of the proposed treatment and the associated risks. I have been given the opportunity to ask questions and all my queries have been satisfactorily answered.', version: '1.0' },
    { name: 'Surgery Consent Form', type: 'Surgery', content: 'I, [Patient Name], hereby consent to undergo the surgical procedure [Procedure Name] as explained by Dr. [Doctor Name]. I understand the risks including but not limited to bleeding, infection, anesthesia complications, and the possibility of incomplete treatment.', version: '1.1' },
    { name: 'Blood Transfusion Consent', type: 'Blood Transfusion', content: 'I, [Patient Name], consent to receive blood transfusion as part of my medical treatment. I have been informed about the potential risks including transfusion reactions and infections. I understand that all blood products are screened as per standard protocols.', version: '1.0' },
    { name: 'Anesthesia Consent', type: 'Anesthesia', content: 'I, [Patient Name], consent to administration of [Anesthesia Type] anesthesia for my procedure. I understand there are risks including allergic reactions, breathing difficulties, and in rare cases, more serious complications.', version: '1.0' },
  ]
  const templateRecords: Array<{ id: string }> = []
  for (const ct of consentTemplates) {
    const rec = await db.consentTemplate.create({ data: ct })
    templateRecords.push({ id: rec.id })
  }

  const consentData = [
    { patientIdx: 2, templateIdx: 0, visitIdx: 6, status: 'Signed', witnessName: 'Sunita Malhotra', witnessRelation: 'Spouse' },
    { patientIdx: 2, templateIdx: 1, visitIdx: 8, status: 'Signed', witnessName: 'Sunita Malhotra', witnessRelation: 'Spouse' },
    { patientIdx: 9, templateIdx: 2, visitIdx: 4, status: 'Signed', witnessName: 'Anita Pereira', witnessRelation: 'Sister' },
    { patientIdx: 5, templateIdx: 3, visitIdx: 3, status: 'Signed', witnessName: 'Rajesh Menon', witnessRelation: 'Spouse' },
  ]
  for (const c of consentData) {
    const visit = allVisits[c.visitIdx]
    if (!visit) continue
    await db.patientConsent.create({
      data: {
        patientId: patientRecords[c.patientIdx].id,
        visitId: visit.id,
        templateId: templateRecords[c.templateIdx].id,
        consentDate: getDate(-10),
        status: c.status, witnessName: c.witnessName, witnessRelation: c.witnessRelation,
      },
    })
  }
  console.log('Consent forms seeded')

  // ==================== QUEUE MANAGEMENT ====================
  const departments = ['General Medicine', 'Cardiology', 'Orthopedics', 'Dermatology', 'Pediatrics', 'Gynecology', 'ENT', 'Ophthalmology']
  const queueStatuses = ['Waiting', 'Called', 'In-Consultation', 'Completed']
  for (let i = 0; i < 15; i++) {
    const pi = i % patientRecords.length
    const visit = allVisits[i] || null
    const depIdx = i % departments.length
    const status = queueStatuses[i < 8 ? i % 4 : 3]
    await db.queueToken.create({
      data: {
        tokenId: `Q-${String(i + 1).padStart(4, '0')}`,
        patientId: patientRecords[pi].id,
        visitId: visit?.id || null,
        department: departments[depIdx],
        tokenNumber: i + 1,
        priority: i < 2 ? 'Emergency' : i < 4 ? 'Urgent' : i < 6 ? 'VIP' : 'Normal',
        status,
        counterNumber: status !== 'Waiting' ? `${depIdx + 1}01` : null,
        calledAt: status !== 'Waiting' ? new Date(Date.now() - (15 - i) * 60000) : null,
        completedAt: status === 'Completed' ? new Date() : null,
      },
    })
  }
  console.log('Queue tokens seeded')

  // ==================== IMAGING STUDIES ====================
  const imagingData = [
    { patientIdx: 2, doctorIdx: 2, modality: 'X-Ray', bodyPart: 'Left Knee', status: 'Reported', clinicalHistory: 'Trauma during sports 2 weeks ago', findings: 'Normal alignment, no fracture seen. Mild joint space narrowing noted.', impression: 'Early degenerative changes in medial compartment', imagesCount: 2, technique: 'AP and Lateral views' },
    { patientIdx: 5, doctorIdx: 5, modality: 'Ultrasound', bodyPart: 'Pelvis', status: 'Reported', clinicalHistory: '28 weeks pregnant, routine scan', findings: 'Single live intrauterine fetus. Cephalic presentation. Placenta anterior. AFI normal.', impression: 'Normal obstetric scan for 28 weeks gestation', imagesCount: 4, technique: 'Transabdominal', contrastUsed: false },
    { patientIdx: 9, doctorIdx: 1, modality: 'CT', bodyPart: 'Chest', status: 'Completed', clinicalHistory: 'Chest pain, abnormal ECG', findings: 'No pulmonary embolism. Mild cardiomegaly noted.', impression: 'Cardiomegaly. No acute chest pathology.', imagesCount: 6, technique: 'Contrast-enhanced CT chest', contrastUsed: true, contrastType: 'Iohexol (Omnipaque)' },
    { patientIdx: 8, doctorIdx: 0, modality: 'MRI', bodyPart: 'Brain', status: 'Ordered', clinicalHistory: 'Chronic headaches, dizziness', impression: 'Study in progress', imagesCount: 0, technique: 'MRI Brain with contrast' },
    { patientIdx: 14, doctorIdx: 6, modality: 'X-Ray', bodyPart: 'PNS (Sinus)', status: 'Scheduled', clinicalHistory: 'Chronic sinusitis evaluation', imagesCount: 0, technique: 'Water\'s view' },
  ]
  for (let i = 0; i < imagingData.length; i++) {
    const im = imagingData[i]
    const visit = allVisits[i] || null
    await db.imagingStudy.create({
      data: {
        studyId: `IMG-${String(i + 1).padStart(4, '0')}`,
        patientId: patientRecords[im.patientIdx].id,
        doctorId: doctorRecords[im.doctorIdx]?.id || null,
        visitId: visit?.id || null,
        modality: im.modality, bodyPart: im.bodyPart, status: im.status,
        clinicalHistory: im.clinicalHistory || null, findings: im.findings || null, impression: im.impression || null,
        technique: im.technique || null, contrastUsed: im.contrastUsed || false, contrastType: im.contrastType || null,
        imagesCount: im.imagesCount, dicomStudyUid: `1.2.826.0.1.3680043.2.1154.${String(i + 1).padStart(10, '0')}`,
        accessionNumber: `ACC-${String(i + 1).padStart(6, '0')}`,
      },
    })
  }
  console.log('Imaging studies seeded')

  // ==================== AMBULANCE & DISPATCHES ====================
  const ambulancesData = [
    { vehicleNumber: 'MH-01-AB-1234', driverName: 'Ramesh Singh', driverPhone: '9876500001', type: 'Basic', equipment: JSON.stringify(['Stretcher', 'First Aid Kit', 'Oxygen Cylinder']) },
    { vehicleNumber: 'MH-01-CD-5678', driverName: 'Suresh Kumar', driverPhone: '9876500002', type: 'Advanced', equipment: JSON.stringify(['Defibrillator', 'Ventilator', 'Monitor', 'Suction Machine', 'Oxygen Cylinder', 'Spine Board']) },
    { vehicleNumber: 'MH-01-EF-9012', driverName: 'Mahesh Patel', driverPhone: '9876500003', type: 'ICU', equipment: JSON.stringify(['Full ICU Setup', 'Ventilator', 'Defibrillator', 'Infusion Pump', 'Multi-parameter Monitor']) },
    { vehicleNumber: 'MH-01-GH-3456', driverName: 'Dinesh Verma', driverPhone: '9876500004', type: 'Basic', status: 'Maintenance', equipment: JSON.stringify(['Stretcher', 'First Aid Kit']) },
  ]
  const ambulanceRecords: Array<{ id: string }> = []
  for (let i = 0; i < ambulancesData.length; i++) {
    const a = ambulancesData[i]
    const rec = await db.ambulance.create({
      data: {
        ambulanceId: `AMB-${String(i + 1).padStart(4, '0')}`,
        vehicleNumber: a.vehicleNumber, driverName: a.driverName, driverPhone: a.driverPhone,
        type: a.type, status: a.status || 'Available', equipment: a.equipment || null,
      },
    })
    ambulanceRecords.push({ id: rec.id })
  }

  const dispatchData = [
    { ambulanceIdx: 0, patientIdx: 0, pickupAddress: '12, Linking Road, Bandra, Mumbai', destination: 'Sai Hospital, Nehru Nagar', dispatchType: 'Emergency', status: 'Completed', distanceKm: 8.5, fare: 0, paymentStatus: 'Waived', notes: 'Emergency call via 102 - cardiac symptoms' },
    { ambulanceIdx: 1, patientIdx: 14, pickupAddress: '23, Park Street, Kolkata', destination: 'Sai Hospital, Thane', dispatchType: 'Transfer', status: 'At-Destination', distanceKm: 15.2, fare: 2500, paymentStatus: 'Pending', notes: 'Inter-hospital transfer from Nightingale Hospital' },
    { ambulanceIdx: 2, patientIdx: 9, pickupAddress: '12, Hazratganj, Lucknow', destination: 'Sai Hospital, Main Branch', dispatchType: 'Emergency', status: 'Arrived', distanceKm: 5.0, fare: 0, paymentStatus: 'Waived', notes: 'Road accident victim' },
    { ambulanceIdx: 1, patientIdx: 8, pickupAddress: '90, Lalbagh Road, Bangalore', destination: 'Sai Hospital, Main Branch', dispatchType: 'Discharge', status: 'Dispatched', distanceKm: 3.2, fare: 800, paymentStatus: 'Pending', notes: 'Patient discharge to home' },
  ]
  for (let i = 0; i < dispatchData.length; i++) {
    const d = dispatchData[i]
    const ambulance = ambulanceRecords[d.ambulanceIdx]
    if (!ambulance) continue
    const now = new Date()
    const dispatchedAt = new Date(now.getTime() - (dispatchData.length - i) * 3600000)
    await db.ambulanceDispatch.create({
      data: {
        dispatchId: `DIS-${String(i + 1).padStart(4, '0')}`,
        ambulanceId: ambulance.id,
        patientId: patientRecords[d.patientIdx]?.id || null,
        pickupAddress: d.pickupAddress, destination: d.destination, dispatchType: d.dispatchType, status: d.status,
        dispatchedAt, distanceKm: d.distanceKm, fare: d.fare, paymentStatus: d.paymentStatus, notes: d.notes,
      },
    })
  }
  console.log('Ambulance & dispatches seeded')

  // ==================== BLOOD BANK ====================
  const donorsData = [
    { name: 'Rahul Verma', phone: '9876510001', email: 'rahul.v@email.com', bloodGroup: 'O+', gender: 'Male', dateOfBirth: '1990-05-15', weight: 72, totalDonations: 5 },
    { name: 'Sunita Joshi', phone: '9876510002', email: 'sunita.j@email.com', bloodGroup: 'A+', gender: 'Female', dateOfBirth: '1992-08-22', weight: 58, totalDonations: 3 },
    { name: 'Amit Saxena', phone: '9876510003', email: 'amit.s@email.com', bloodGroup: 'B+', gender: 'Male', dateOfBirth: '1988-12-03', weight: 75, totalDonations: 8 },
    { name: 'Priya Nair', phone: '9876510004', email: 'priya.n@email.com', bloodGroup: 'AB+', gender: 'Female', dateOfBirth: '1995-03-18', weight: 62, totalDonations: 2 },
    { name: 'Vikram Yadav', phone: '9876510005', email: 'vikram.y@email.com', bloodGroup: 'O-', gender: 'Male', dateOfBirth: '1985-07-28', weight: 80, totalDonations: 10 },
    { name: 'Laxmi Devi', phone: '9876510006', email: 'laxmi.d@email.com', bloodGroup: 'A-', gender: 'Female', dateOfBirth: '1993-11-11', weight: 55, totalDonations: 1 },
  ]
  const donorRecords: Array<{ id: string }> = []
  for (let i = 0; i < donorsData.length; i++) {
    const d = donorsData[i]
    const donor = await db.bloodDonor.create({
      data: {
        donorId: `DON-${String(i + 1).padStart(4, '0')}`,
        name: d.name, phone: d.phone, email: d.email || null, bloodGroup: d.bloodGroup, gender: d.gender || null,
        dateOfBirth: d.dateOfBirth || null, weight: d.weight || null, totalDonations: d.totalDonations,
        status: 'Active',
      },
    })
    donorRecords.push({ id: donor.id })
  }

  for (let i = 0; i < donorRecords.length; i++) {
    const donationDate = new Date(Date.now() - (i + 1) * 120 * 86400000)
    await db.bloodDonation.create({
      data: {
        donationId: `DONA-${String(i + 1).padStart(4, '0')}`,
        donorId: donorRecords[i].id,
        donationDate,
        bloodGroup: donorsData[i].bloodGroup,
        quantity: 350 + (i % 2) * 100,
        hemoglobin: 13.5 + i * 0.3,
        bloodPressure: '120/80',
        pulse: '76 bpm',
        bloodBagId: `BAG-2024-${String(i + 1).padStart(4, '0')}`,
        testResults: JSON.stringify({ HIV: 'Negative', HBV: 'Negative', HCV: 'Negative', Syphilis: 'Non-reactive', Malaria: 'Negative' }),
        status: 'Approved',
        expiryDate: new Date(donationDate.getTime() + 42 * 86400000),
      },
    })
  }
  console.log('Blood donors & donations seeded')

  // Blood inventory
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  const unitsAvailable = [25, 8, 30, 10, 12, 5, 40, 15]
  for (let i = 0; i < bloodGroups.length; i++) {
    await db.bloodInventory.create({
      data: { bloodGroup: bloodGroups[i], unitsAvailable: unitsAvailable[i], minStock: 5 },
    })
  }

  // Blood requests
  const bloodRequests = [
    { patientIdx: 8, doctorIdx: 0, bloodGroup: 'A+', unitsRequired: 2, urgency: 'Emergency', reason: 'Post-surgery blood loss', status: 'Approved' },
    { patientIdx: 5, doctorIdx: 5, bloodGroup: 'O-', unitsRequired: 1, urgency: 'Normal', reason: 'Anemia during pregnancy', status: 'Issued' },
    { patientIdx: 9, doctorIdx: 1, bloodGroup: 'B+', unitsRequired: 3, urgency: 'Urgent', reason: 'GI bleeding', status: 'Pending' },
    { patientIdx: 10, doctorIdx: 2, bloodGroup: 'AB+', unitsRequired: 2, urgency: 'Normal', reason: 'Elective surgery preparation', status: 'Pending' },
  ]
  for (let i = 0; i < bloodRequests.length; i++) {
    const br = bloodRequests[i]
    await db.bloodRequest.create({
      data: {
        requestId: `BLDREQ-${String(i + 1).padStart(4, '0')}`,
        patientId: patientRecords[br.patientIdx].id,
        doctorId: doctorRecords[br.doctorIdx].id,
        bloodGroup: br.bloodGroup, unitsRequired: br.unitsRequired, urgency: br.urgency,
        reason: br.reason || null, status: br.status,
      },
    })
  }
  console.log('Blood inventory & requests seeded')

  // ==================== SUPPLIER, PURCHASE ORDERS & STOCK MOVEMENTS ====================
  const suppliersData = [
    { name: 'MediSupply Distributors', contact: 'Vikas Agarwal', email: 'orders@medisupply.in', gstin: '27AABCM1234B1Z3' },
    { name: 'PharmaLink Industries', contact: 'Rohit Mehta', email: 'sales@pharmalink.in', gstin: '27AABCP5678B1Z4' },
    { name: 'HealthCare Logistics', contact: 'Anil Kapoor', email: 'info@hclogistics.in', gstin: '27AABCH9012B1Z5' },
  ]
  const supplierRecords: Array<{ id: string }> = []
  for (let i = 0; i < suppliersData.length; i++) {
    const s = suppliersData[i]
    const rec = await db.supplier.create({ data: { supplierId: `SUP-${String(i + 1).padStart(4, '0')}`, name: s.name, contact: s.contact, email: s.email, gstin: s.gstin } })
    supplierRecords.push({ id: rec.id })
  }

  const medicines = await db.medicine.findMany()
  const poData = [
    { supplierIdx: 0, items: [{ medicineIdx: 0, qty: 500, price: 14 }, { medicineIdx: 4, qty: 1000, price: 7 }, { medicineIdx: 12, qty: 600, price: 9 }] },
    { supplierIdx: 1, items: [{ medicineIdx: 1, qty: 300, price: 32 }, { medicineIdx: 5, qty: 200, price: 42 }, { medicineIdx: 17, qty: 400, price: 12 }] },
    { supplierIdx: 2, items: [{ medicineIdx: 7, qty: 60, price: 260 }, { medicineIdx: 9, qty: 500, price: 18 }, { medicineIdx: 14, qty: 400, price: 30 }] },
  ]
  let poCount = 0
  let smCount = 0
  for (const po of poData) {
    poCount++
    let totalAmount = 0
    const items = po.items.map(item => {
      const med = medicines[item.medicineIdx]
      if (!med) return null
      const total = item.price * item.qty
      totalAmount += total
      return { medicineId: med.id, quantity: item.qty, unitPrice: item.price, total }
    }).filter(Boolean) as { medicineId: string; quantity: number; unitPrice: number; total: number }[]

    const purchaseOrder = await db.purchaseOrder.create({
      data: {
        poId: `PO-${String(poCount).padStart(4, '0')}`,
        supplierId: supplierRecords[po.supplierIdx].id,
        status: 'Received', orderDate: getDate(-30), totalAmount,
        items: { create: items },
      },
    })

    for (const item of items) {
      smCount++
      await db.stockMovement.create({
        data: {
          movementId: `SM-${String(smCount).padStart(4, '0')}`,
          medicineId: item.medicineId,
          type: 'Purchase',
          quantity: item.quantity,
          referenceId: purchaseOrder.poId,
          notes: `Purchase Order ${purchaseOrder.poId}`,
        },
      })
    }
  }
  console.log('Suppliers, purchase orders & stock movements seeded')

  // ==================== NOTIFICATIONS ====================
  const notificationTypes = ['payment_received', 'appointment_scheduled', 'lab_completed', 'patient_registered', 'low_stock', 'feedback_received']
  const notificationMessages = [
    'Payment of Rs. 2,500 received from Arjun Malhotra',
    'New appointment scheduled by Deepa Krishnan for tomorrow 9:30 AM',
    'Lab results for Rajendra Yadav are now available',
    'New patient Nisha Agarwal registered at Thane branch',
    'Low stock alert: Insulin Glargine - only 15 units remaining',
    'New feedback received from Mohammed Faizan - Rating: 4/5',
  ]
  for (let i = 0; i < notificationTypes.length; i++) {
    await db.notification.create({
      data: {
        userId: userRecords[i % userRecords.length].id,
        type: notificationTypes[i],
        title: notificationTypes[i].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        message: notificationMessages[i],
        read: i < 3,
      },
    })
  }
  console.log('Notifications seeded')

  // ==================== MODULE SETTINGS ====================
  const existingModules = await db.moduleSetting.count()
  if (existingModules === 0) {
    const modules = [
      // Main
      { moduleKey: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', section: 'main', isCore: true, description: 'Main dashboard with key metrics and KPIs' },
      { moduleKey: 'patients', label: 'Patients', icon: 'Users', section: 'main', isCore: true, description: 'Patient registration, records, and history' },
      { moduleKey: 'appointments', label: 'Appointments', icon: 'CalendarDays', section: 'main', isCore: true, description: 'Appointment scheduling and calendar' },
      { moduleKey: 'doctors', label: 'Doctors', icon: 'Stethoscope', section: 'main', isCore: true, description: 'Doctor profiles and schedules' },
      // Operations
      { moduleKey: 'workflow', label: 'Workflow', icon: 'Activity', section: 'operations', isCore: false, description: 'Patient visit workflow and stage tracking' },
      { moduleKey: 'ai-analysis', label: 'AI Analysis', icon: 'Brain', section: 'operations', isCore: false, description: 'AI-powered symptom analysis and diagnosis suggestions' },
      { moduleKey: 'ai-imaging', label: 'AI Imaging', icon: 'Microscope', section: 'operations', isCore: false, description: 'AI medical image analysis (X-ray, CT, MRI, etc.)' },
      { moduleKey: 'telemedicine', label: 'Telemedicine', icon: 'Video', section: 'operations', isCore: false, description: 'Video consultation and remote patient care' },
      { moduleKey: 'billing', label: 'Billing', icon: 'Receipt', section: 'operations', isCore: false, description: 'Invoice generation and GST-compliant billing' },
      { moduleKey: 'payments', label: 'Payments', icon: 'CreditCard', section: 'operations', isCore: false, description: 'Payment collection and reconciliation' },
      { moduleKey: 'insurance', label: 'Insurance', icon: 'ShieldCheck', section: 'operations', isCore: false, description: 'Insurance claims, pre-auth, and policy management' },
      { moduleKey: 'prescriptions', label: 'Prescriptions', icon: 'FileText', section: 'operations', isCore: false, description: 'E-prescriptions with medicine management' },
      { moduleKey: 'lab-tests', label: 'Lab Tests', icon: 'FlaskConical', section: 'operations', isCore: false, description: 'Lab test catalog, orders, and results' },
      { moduleKey: 'bed-management', label: 'Bed Management', icon: 'BedDouble', section: 'operations', isCore: false, description: 'Ward and bed allocation tracking' },
      { moduleKey: 'inventory', label: 'Inventory', icon: 'Pill', section: 'operations', isCore: false, description: 'Medicine and supply inventory management' },
      { moduleKey: 'queue', label: 'Queue', icon: 'TicketCheck', section: 'operations', isCore: false, description: 'Patient queue and token management' },
      { moduleKey: 'ambulance', label: 'Ambulance', icon: 'Truck', section: 'operations', isCore: false, description: 'Ambulance fleet and dispatch management' },
      { moduleKey: 'blood-bank', label: 'Blood Bank', icon: 'Droplets', section: 'operations', isCore: false, description: 'Blood donor registry and inventory management' },
      { moduleKey: 'imaging', label: 'Radiology', icon: 'ScanLine', section: 'operations', isCore: false, description: 'Radiology imaging study management' },
      { moduleKey: 'surgery', label: 'Operation Theatre', icon: 'Syringe', section: 'operations', isCore: false, description: 'OT scheduling and surgery management' },
      { moduleKey: 'barcode-scanner', label: 'Barcode Scanner', icon: 'ScanBarcode', section: 'operations', isCore: false, description: 'Barcode scanning for inventory and assets' },
      { moduleKey: 'nursing-charting', label: 'Nursing Charting', icon: 'HeartPulse', section: 'operations', isCore: false, description: 'Nursing notes, vitals, and intake/output' },
      { moduleKey: 'discharge-summary', label: 'Discharge Summary', icon: 'ClipboardCheck', section: 'operations', isCore: false, description: 'IPD discharge summary generation' },
      { moduleKey: 'diet-management', label: 'Diet Management', icon: 'UtensilsCrossed', section: 'operations', isCore: false, description: 'Diet orders, meal schedules, kitchen tracking' },
      { moduleKey: 'pharmacy-pos', label: 'Pharmacy POS', icon: 'ShoppingCart', section: 'operations', isCore: false, description: 'Walk-in pharmacy point of sale' },
      { moduleKey: 'patient-portal', label: 'Patient Portal', icon: 'UserCheck', section: 'operations', isCore: false, description: 'Patient self-service portal' },
      // Admin
      { moduleKey: 'reports', label: 'Reports', icon: 'BarChart3', section: 'admin', isCore: false, description: 'Custom report generation and export' },
      { moduleKey: 'payroll', label: 'Payroll', icon: 'DollarSign', section: 'admin', isCore: false, description: 'Staff payroll processing and management' },
      { moduleKey: 'asset-management', label: 'Asset Management', icon: 'Wrench', section: 'admin', isCore: false, description: 'Hospital equipment and asset tracking' },
      { moduleKey: 'camp-management', label: 'Camp Management', icon: 'Tent', section: 'admin', isCore: false, description: 'Health camp registration and screening' },
      { moduleKey: 'compliance', label: 'Compliance', icon: 'ClipboardList', section: 'admin', isCore: false, description: 'NABH/JCI compliance tracking and audits' },
      { moduleKey: 'analytics', label: 'Analytics', icon: 'BarChart4', section: 'admin', isCore: false, description: 'Advanced analytics dashboards and widgets' },
      { moduleKey: 'i18n-admin', label: 'i18n Translations', icon: 'Languages', section: 'admin', isCore: false, description: 'Multi-language translation management' },
      { moduleKey: 'hl7-fhir', label: 'HL7/FHIR', icon: 'Radio', section: 'admin', isCore: false, description: 'HL7 and FHIR interoperability logs' },
      { moduleKey: 'settings', label: 'Settings', icon: 'Settings', section: 'admin', isCore: true, description: 'System settings and configuration' },
      { moduleKey: 'support', label: 'Support Center', icon: 'CircleHelp', section: 'admin', isCore: false, description: 'Internal support ticket system' },
    ]

    await db.moduleSetting.createMany({ data: modules })
    console.log(`${modules.length} module settings seeded`)
  } else {
    console.log('Module settings already exist — skipping')
  }

  // ==================== FINAL REPORT ====================
  const counts = {
    branches: await db.branch.count(),
    users: await db.user.count(),
    patients: await db.patient.count(),
    doctors: await db.doctor.count(),
    staff: await db.staff.count(),
    appointments: await db.appointment.count(),
    invoices: await db.invoice.count(),
    payments: await db.payment.count(),
    medicines: await db.medicine.count(),
    prescriptions: await db.prescription.count(),
    visits: await db.patientVisit.count(),
    schedules: await db.doctorSchedule.count(),
    labTests: await db.labTestCatalog.count(),
    labOrders: await db.labTestOrder.count(),
    wards: await db.ward.count(),
    beds: await db.bed.count(),
    insuranceCompanies: await db.insuranceCompany.count(),
    insuranceClaims: await db.insuranceClaim.count(),
    expenses: await db.expense.count(),
    supportTickets: await db.supportTicket.count(),
    feedback: await db.patientFeedback.count(),
    referrals: await db.referral.count(),
    wasteDisposals: await db.wasteDisposal.count(),
    tdsRecords: await db.tdsRecord.count(),
    operationTheatres: await db.operationTheatre.count(),
    surgeries: await db.surgery.count(),
    consentTemplates: await db.consentTemplate.count(),
    patientConsents: await db.patientConsent.count(),
    queueTokens: await db.queueToken.count(),
    imagingStudies: await db.imagingStudy.count(),
    ambulances: await db.ambulance.count(),
    ambulanceDispatches: await db.ambulanceDispatch.count(),
    bloodDonors: await db.bloodDonor.count(),
    bloodDonations: await db.bloodDonation.count(),
    bloodInventory: await db.bloodInventory.count(),
    bloodRequests: await db.bloodRequest.count(),
    suppliers: await db.supplier.count(),
    purchaseOrders: await db.purchaseOrder.count(),
    stockMovements: await db.stockMovement.count(),
    notifications: await db.notification.count(),
  }
  console.log('\n========== SEED COMPLETE ==========')
  console.log(JSON.stringify(counts, null, 2))
  console.log('\nCredentials:')
  console.log('  Super Admin:  superadmin@medibill.com / Admin@123')
  console.log('  Admin:       admin@medibill.com / Admin@123')
  console.log('  Receptionist: receptionist@medibill.com / password123')
  console.log('  Doctor:       doctor@medibill.com / password123')
  console.log('  Accountant:   accountant@medibill.com / password123')
  console.log('  Pharmacist:   pharmacist@medibill.com / password123')
  console.log('  All other users: <email> / password123')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
