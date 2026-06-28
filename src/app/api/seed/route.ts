import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { authenticateRequest } from '@/lib/api-auth'

const VISIT_STAGES = ['Registration', 'Triage', 'Waiting', 'In-Consultation', 'Lab-Ordered', 'Lab-Done', 'Prescribed', 'Billed', 'Paid', 'Discharged'] as const

type VisitStageName = (typeof VISIT_STAGES)[number]

function buildStages(currentStage: VisitStageName, isCompleted: boolean, offsetMinutes?: number) {
  const now = new Date()
  const baseOffset = offsetMinutes ?? 0
  const currentIdx = VISIT_STAGES.indexOf(currentStage)

  return VISIT_STAGES.map((stageName, idx) => {
    const stageTime = new Date(now.getTime() - (VISIT_STAGES.length - idx) * 15 * 60000 + baseOffset)
    if (isCompleted) {
      return {
        stage: stageName,
        status: 'Completed' as const,
        completedAt: stageTime,
      }
    }
    if (idx < currentIdx) {
      return {
        stage: stageName,
        status: 'Completed' as const,
        completedAt: stageTime,
      }
    }
    if (idx === currentIdx) {
      return {
        stage: stageName,
        status: 'Active' as const,
      }
    }
    return {
      stage: stageName,
      status: 'Pending' as const,
    }
  })
}

async function seedPatientVisits(
  db: import('@prisma/client').PrismaClient,
  patients: Array<{ id: string; patientId: string }>,
  doctors: Array<{ id: string; doctorId: string }>,
) {
  const visits = [
    // ACTIVE VISITS
    // VIS-0001: In-Consultation
    {
      visitId: 'VIS-0001', patientIdx: 0, doctorIdx: 0, stage: 'In-Consultation' as VisitStageName, status: 'Active' as const,
      temperature: '99.2°F', bloodPressure: '130/85', pulse: '78 bpm', oxygenLevel: '97%', weight: '72 kg', height: '170 cm',
      chiefComplaint: 'Persistent headache for 3 days', visitType: 'OPD', department: 'General Medicine', completed: false,
    },
    // VIS-0002: In-Consultation
    {
      visitId: 'VIS-0002', patientIdx: 1, doctorIdx: 1, stage: 'In-Consultation' as VisitStageName, status: 'Active' as const,
      temperature: '98.6°F', bloodPressure: '140/90', pulse: '82 bpm', oxygenLevel: '98%', weight: '65 kg', height: '162 cm',
      chiefComplaint: 'Chest pain and shortness of breath', visitType: 'OPD', department: 'Cardiology', completed: false,
    },
    // VIS-0003: Lab-Ordered
    {
      visitId: 'VIS-0003', patientIdx: 4, doctorIdx: 4, stage: 'Lab-Ordered' as VisitStageName, status: 'Active' as const,
      temperature: '98.4°F', bloodPressure: '125/80', pulse: '70 bpm', oxygenLevel: '99%', weight: '85 kg', height: '168 cm',
      chiefComplaint: 'High blood sugar levels, fatigue', visitType: 'OPD', department: 'Pediatrics', completed: false,
    },
    // VIS-0004: Lab-Ordered
    {
      visitId: 'VIS-0004', patientIdx: 5, doctorIdx: 5, stage: 'Lab-Ordered' as VisitStageName, status: 'Active' as const,
      temperature: '98.8°F', bloodPressure: '118/75', pulse: '76 bpm', oxygenLevel: '98%', weight: '62 kg', height: '158 cm',
      chiefComplaint: 'Routine prenatal checkup, mild swelling', visitType: 'OPD', department: 'Gynecology', completed: false,
    },
    // VIS-0005: Lab-Done
    {
      visitId: 'VIS-0005', patientIdx: 9, doctorIdx: 1, stage: 'Lab-Done' as VisitStageName, status: 'Active' as const,
      temperature: '97.9°F', bloodPressure: '150/95', pulse: '88 bpm', oxygenLevel: '96%', weight: '78 kg', height: '175 cm',
      chiefComplaint: 'Recurring chest pain, ECG abnormal', visitType: 'OPD', department: 'Cardiology', completed: false,
    },
    // VIS-0006: Prescribed
    {
      visitId: 'VIS-0006', patientIdx: 3, doctorIdx: 3, stage: 'Prescribed' as VisitStageName, status: 'Active' as const,
      temperature: '98.5°F', bloodPressure: '110/70', pulse: '72 bpm', oxygenLevel: '99%', weight: '55 kg', height: '165 cm',
      chiefComplaint: 'Severe skin rash on arms and neck', visitType: 'OPD', department: 'Dermatology', completed: false,
    },
    // VIS-0007: Billed
    {
      visitId: 'VIS-0007', patientIdx: 6, doctorIdx: 6, stage: 'Billed' as VisitStageName, status: 'Active' as const,
      temperature: '99.1°F', bloodPressure: '120/78', pulse: '74 bpm', oxygenLevel: '98%', weight: '68 kg', height: '172 cm',
      chiefComplaint: 'Ear pain and hearing difficulty', visitType: 'OPD', department: 'ENT', completed: false,
    },
    // VIS-0008: Paid (ready for discharge)
    {
      visitId: 'VIS-0008', patientIdx: 7, doctorIdx: 7, stage: 'Paid' as VisitStageName, status: 'Active' as const,
      temperature: '98.3°F', bloodPressure: '115/72', pulse: '68 bpm', oxygenLevel: '99%', weight: '58 kg', height: '160 cm',
      chiefComplaint: 'Blurred vision, frequent headaches', visitType: 'OPD', department: 'Ophthalmology', completed: false,
    },
    // COMPLETED VISITS (Discharged)
    // VIS-0009: Completed
    {
      visitId: 'VIS-0009', patientIdx: 2, doctorIdx: 2, stage: 'Discharged' as VisitStageName, status: 'Completed' as const,
      temperature: '98.7°F', bloodPressure: '128/82', pulse: '75 bpm', oxygenLevel: '98%', weight: '82 kg', height: '174 cm',
      chiefComplaint: 'Left knee pain and stiffness', visitType: 'OPD', department: 'Orthopedics', completed: true,
    },
    // VIS-0010: Completed
    {
      visitId: 'VIS-0010', patientIdx: 8, doctorIdx: 0, stage: 'Discharged' as VisitStageName, status: 'Completed' as const,
      temperature: '98.9°F', bloodPressure: '145/92', pulse: '80 bpm', oxygenLevel: '97%', weight: '76 kg', height: '171 cm',
      chiefComplaint: 'High BP, dizziness in mornings', visitType: 'OPD', department: 'General Medicine', completed: true,
    },
    // VIS-0011: Completed
    {
      visitId: 'VIS-0011', patientIdx: 10, doctorIdx: 2, stage: 'Discharged' as VisitStageName, status: 'Completed' as const,
      temperature: '99.5°F', bloodPressure: '122/78', pulse: '84 bpm', oxygenLevel: '98%', weight: '75 kg', height: '169 cm',
      chiefComplaint: 'Lower back pain radiating to leg', visitType: 'OPD', department: 'Orthopedics', completed: true,
    },
  ]

  for (const v of visits) {
    if (v.patientIdx >= patients.length || v.doctorIdx >= doctors.length) continue
    await db.patientVisit.create({
      data: {
        visitId: v.visitId,
        patientId: patients[v.patientIdx].id,
        doctorId: doctors[v.doctorIdx].id,
        stage: v.stage,
        status: v.status,
        temperature: v.temperature,
        bloodPressure: v.bloodPressure,
        pulse: v.pulse,
        oxygenLevel: v.oxygenLevel,
        weight: v.weight,
        height: v.height,
        chiefComplaint: v.chiefComplaint,
        notes: `Visit type: ${v.visitType}, Department: ${v.department}`,
        stages: {
          create: buildStages(v.stage, v.completed),
        },
      },
    })
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.authenticated || auth.role !== 'Admin') {
      return NextResponse.json(
        { error: 'Admin authentication required' },
        { status: 403 }
      )
    }

    // Always seed users if they don't exist (even if other data exists)
    const existingUsers = await db.user.count()
    if (existingUsers === 0) {
      const users = [
        { name: 'Admin User', email: 'admin@medibill.com', password: 'admin123', role: 'Admin', phone: '9820000001' },
        { name: 'Pooja Mehta', email: 'receptionist@medibill.com', password: 'pass123', role: 'Receptionist', phone: '9820000002' },
        { name: 'Dr. Rajesh Sharma', email: 'doctor@medibill.com', password: 'pass123', role: 'Doctor', phone: '9820000003' },
        { name: 'Sanjay Verma', email: 'accountant@medibill.com', password: 'pass123', role: 'Accountant', phone: '9820000004' },
        { name: 'Kavita Joshi', email: 'pharmacist@medibill.com', password: 'pass123', role: 'Pharmacist', phone: '9820000005' },
      ]

      for (let i = 0; i < users.length; i++) {
        const u = users[i]
        await db.user.create({
          data: {
            userId: `USR-${String(i + 1).padStart(4, '0')}`,
            name: u.name,
            email: u.email,
            password: await hashPassword(u.password),
            role: u.role,
            phone: u.phone,
          },
        })
      }
    }

    // Check if patient data already exists
    const existingPatients = await db.patient.count()
    if (existingPatients > 0) {
      // Patients exist — check if visits need seeding
      const existingVisits = await db.patientVisit.count()
      if (existingVisits > 0) {
        const userCount = await db.user.count()
        return NextResponse.json({
          message: 'Data already seeded. Database already contains patient records and visits.',
          existingRecords: existingPatients,
          visits: existingVisits,
          users: userCount,
        })
      }
      // Patients exist but visits don't — seed visits and return
      const allPatients = await db.patient.findMany({ select: { id: true, patientId: true } })
      const allDoctors = await db.doctor.findMany({ select: { id: true, doctorId: true } })
      await seedPatientVisits(db, allPatients, allDoctors)
      const userCount = await db.user.count()
      const visitCount = await db.patientVisit.count()
      return NextResponse.json({
        message: 'Visits seeded successfully into existing database.',
        existingRecords: existingPatients,
        visits: visitCount,
        users: userCount,
      })
    }

    // ========== CLINIC SETTINGS ==========
    await db.clinicSettings.create({
      data: {
        clinicName: 'Sai Multispecialty Hospital',
        address: '42, Nehru Nagar, MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        phone: '+91-22-2345-6789',
        email: 'info@saihospital.in',
        website: 'www.saihospital.in',
        gstin: '27AABCS1429B1Z5',
        gstType: 'Regular',
      },
    })

    // ========== DOCTORS ==========
    const doctors = [
      { name: 'Dr. Rajesh Sharma', email: 'rajesh.sharma@saihospital.in', phone: '9820123456', specialization: 'General Medicine', qualification: 'MBBS, MD', experience: 15, consultationFee: 600 },
      { name: 'Dr. Priya Patel', email: 'priya.patel@saihospital.in', phone: '9820123457', specialization: 'Cardiology', qualification: 'MBBS, DM Cardiology', experience: 12, consultationFee: 1000 },
      { name: 'Dr. Amit Kumar Gupta', email: 'amit.gupta@saihospital.in', phone: '9820123458', specialization: 'Orthopedics', qualification: 'MBBS, MS Ortho', experience: 18, consultationFee: 800 },
      { name: 'Dr. Sneha Reddy', email: 'sneha.reddy@saihospital.in', phone: '9820123459', specialization: 'Dermatology', qualification: 'MBBS, MD Dermatology', experience: 10, consultationFee: 700 },
      { name: 'Dr. Vikram Singh', email: 'vikram.singh@saihospital.in', phone: '9820123460', specialization: 'Pediatrics', qualification: 'MBBS, MD Pediatrics', experience: 14, consultationFee: 600 },
      { name: 'Dr. Anjali Deshmukh', email: 'anjali.deshmukh@saihospital.in', phone: '9820123461', specialization: 'Gynecology', qualification: 'MBBS, MS OBGYN', experience: 16, consultationFee: 800 },
      { name: 'Dr. Suresh Iyer', email: 'suresh.iyer@saihospital.in', phone: '9820123462', specialization: 'ENT', qualification: 'MBBS, MS ENT', experience: 11, consultationFee: 600 },
      { name: 'Dr. Meera Nair', email: 'meera.nair@saihospital.in', phone: '9820123463', specialization: 'Ophthalmology', qualification: 'MBBS, MS Ophthalmology', experience: 13, consultationFee: 700 },
    ]

    const createdDoctors: Array<{ id: string; doctorId: string }> = []
    for (let i = 0; i < doctors.length; i++) {
      const d = doctors[i]
      const doc = await db.doctor.create({
        data: {
          doctorId: `DOC-${String(i + 1).padStart(4, '0')}`,
          ...d,
          bio: `Experienced ${d.specialization} specialist with ${d.experience} years of practice.`,
        },
      })
      createdDoctors.push({ id: doc.id, doctorId: doc.doctorId })
    }

    // ========== STAFF ==========
    const staffData = [
      { name: 'Ramesh Kulkarni', email: 'ramesh.k@saihospital.in', phone: '9820150001', role: 'Admin' },
      { name: 'Pooja Mehta', email: 'pooja.m@saihospital.in', phone: '9820150002', role: 'Receptionist' },
      { name: 'Sanjay Verma', email: 'sanjay.v@saihospital.in', phone: '9820150003', role: 'Accountant' },
      { name: 'Kavita Joshi', email: 'kavita.j@saihospital.in', phone: '9820150004', role: 'Pharmacist' },
      { name: 'Deepak Patil', email: 'deepak.p@saihospital.in', phone: '9820150005', role: 'Nurse' },
      { name: 'Neha Agarwal', email: 'neha.a@saihospital.in', phone: '9820150006', role: 'Lab Technician' },
    ]

    for (let i = 0; i < staffData.length; i++) {
      await db.staff.create({
        data: {
          staffId: `STF-${String(i + 1).padStart(4, '0')}`,
          ...staffData[i],
        },
      })
    }

    // ========== PATIENTS ==========
    const patients = [
      { name: 'Arjun Malhotra', email: 'arjun.m@email.com', phone: '9987610001', dateOfBirth: '1985-03-15', gender: 'Male', bloodGroup: 'B+', address: '12, Linking Road, Bandra', city: 'Mumbai', state: 'Maharashtra', pincode: '400050', aadhaarNumber: '8234 5678 9012', emergencyContact: 'Sunita Malhotra', emergencyPhone: '9987610010', allergies: ['Penicillin'], insuranceProvider: 'Star Health', insuranceNumber: 'SH-456789' },
      { name: 'Deepa Krishnan', email: 'deepa.k@email.com', phone: '9987610002', dateOfBirth: '1990-07-22', gender: 'Female', bloodGroup: 'A+', address: '34, Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040', emergencyContact: 'Ravi Krishnan', emergencyPhone: '9987610011', allergies: [], insuranceProvider: 'ICICI Lombard', insuranceNumber: 'IL-789012' },
      { name: 'Mohammed Faizan', email: 'faizan.m@email.com', phone: '9987610003', dateOfBirth: '1978-11-05', gender: 'Male', bloodGroup: 'O+', address: '56, Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034', emergencyContact: 'Fatima Begum', emergencyPhone: '9987610012', allergies: ['Sulfa drugs'], insuranceProvider: null, insuranceNumber: null },
      { name: 'Shalini Gupta', email: 'shalini.g@email.com', phone: '9987610004', dateOfBirth: '1995-01-18', gender: 'Female', bloodGroup: 'AB+', address: '78, Connaught Place', city: 'New Delhi', state: 'Delhi', pincode: '110001', emergencyContact: 'Anil Gupta', emergencyPhone: '9987610013', allergies: [], insuranceProvider: 'HDFC Ergo', insuranceNumber: 'HE-345678' },
      { name: 'Rajendra Yadav', email: 'rajendra.y@email.com', phone: '9987610005', dateOfBirth: '1970-09-30', gender: 'Male', bloodGroup: 'A-', address: '90, Lalbagh Road', city: 'Bangalore', state: 'Karnataka', pincode: '560027', emergencyContact: 'Saroj Yadav', emergencyPhone: '9987610014', allergies: ['Aspirin', 'Ibuprofen'], insuranceProvider: 'New India Assurance', insuranceNumber: 'NIA-567890' },
      { name: 'Anita Pereira', email: 'anita.p@email.com', phone: '9987610006', dateOfBirth: '1988-04-12', gender: 'Female', bloodGroup: 'O-', address: '23, St. Inez', city: 'Panaji', state: 'Goa', pincode: '403001', emergencyContact: 'Carlos Pereira', emergencyPhone: '9987610015', allergies: [], insuranceProvider: null, insuranceNumber: null },
      { name: 'Vikash Choudhary', email: 'vikash.c@email.com', phone: '9987610007', dateOfBirth: '1982-12-08', gender: 'Male', bloodGroup: 'B-', address: '45, MI Road', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', emergencyContact: 'Kamla Devi', emergencyPhone: '9987610016', allergies: ['Codeine'], insuranceProvider: 'Bajaj Allianz', insuranceNumber: 'BA-234567' },
      { name: 'Pallavi Desai', email: 'pallavi.d@email.com', phone: '9987610008', dateOfBirth: '1993-06-25', gender: 'Female', bloodGroup: 'A+', address: '67, FC Road', city: 'Pune', state: 'Maharashtra', pincode: '411004', emergencyContact: 'Sunil Desai', emergencyPhone: '9987610017', allergies: [], insuranceProvider: 'Star Health', insuranceNumber: 'SH-890123' },
      { name: 'Suresh Menon', email: 'suresh.m@email.com', phone: '9987610009', dateOfBirth: '1975-02-14', gender: 'Male', bloodGroup: 'AB-', address: '89, MG Road', city: 'Kochi', state: 'Kerala', pincode: '682011', emergencyContact: 'Lakshmi Menon', emergencyPhone: '9987610018', allergies: ['Latex'], insuranceProvider: 'United India Insurance', insuranceNumber: 'UII-678901' },
      { name: 'Ritu Saxena', email: 'ritu.s@email.com', phone: '9987610010', dateOfBirth: '1991-08-19', gender: 'Female', bloodGroup: 'B+', address: '12, Hazratganj', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001', emergencyContact: 'Prakash Saxena', emergencyPhone: '9987610019', allergies: [], insuranceProvider: null, insuranceNumber: null },
      { name: 'Nikhil Bhatt', email: 'nikhil.b@email.com', phone: '9987610011', dateOfBirth: '1986-10-03', gender: 'Male', bloodGroup: 'O+', address: '34, CG Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380006', emergencyContact: 'Rekha Bhatt', emergencyPhone: '9987610020', allergies: [], insuranceProvider: 'IFFCO Tokio', insuranceNumber: 'IT-123456' },
      { name: 'Kavitha Rajan', email: 'kavitha.r@email.com', phone: '9987610012', dateOfBirth: '1989-05-27', gender: 'Female', bloodGroup: 'A-', address: '56, Mount Road', city: 'Chennai', state: 'Tamil Nadu', pincode: '600002', emergencyContact: 'Mohan Rajan', emergencyPhone: '9987610021', allergies: ['Morphine'], insuranceProvider: 'ICICI Lombard', insuranceNumber: 'IL-456123' },
      { name: 'Arunachalam Murugan', email: 'arun.m@email.com', phone: '9987610013', dateOfBirth: '1968-07-10', gender: 'Male', bloodGroup: 'B+', address: '78, T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017', emergencyContact: 'Meenakshi Murugan', emergencyPhone: '9987610022', allergies: [], insuranceProvider: null, insuranceNumber: null },
      { name: 'Swati Kapoor', email: 'swati.k@email.com', phone: '9987610014', dateOfBirth: '1992-03-08', gender: 'Female', bloodGroup: 'AB+', address: '90, Sector 17', city: 'Chandigarh', state: 'Punjab', pincode: '160017', emergencyContact: 'Rahul Kapoor', emergencyPhone: '9987610023', allergies: [], insuranceProvider: 'Religare Health', insuranceNumber: 'RH-789456' },
      { name: 'Dhruv Sharma', email: 'dhruv.s@email.com', phone: '9987610015', dateOfBirth: '1983-11-22', gender: 'Male', bloodGroup: 'O-', address: '23, Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016', emergencyContact: 'Shikha Sharma', emergencyPhone: '9987610024', allergies: ['Penicillin', 'Sulfa drugs'], insuranceProvider: null, insuranceNumber: null },
      { name: 'Meena Kumari', email: 'meena.k@email.com', phone: '9987610016', dateOfBirth: '1979-01-30', gender: 'Female', bloodGroup: 'A+', address: '45, GPO', city: 'Patna', state: 'Bihar', pincode: '800001', emergencyContact: 'Ram Kumar', emergencyPhone: '9987610025', allergies: [], insuranceProvider: 'National Insurance', insuranceNumber: 'NI-012345' },
      { name: 'Tarun Bhatia', email: 'tarun.b@email.com', phone: '9987610017', dateOfBirth: '1987-09-14', gender: 'Male', bloodGroup: 'B-', address: '67, Residency Road', city: 'Indore', state: 'Madhya Pradesh', pincode: '452001', emergencyContact: 'Sushma Bhatia', emergencyPhone: '9987610026', allergies: ['Iodine contrast'], insuranceProvider: 'HDFC Ergo', insuranceNumber: 'HE-901234' },
      { name: 'Lakshmi Iyer', email: 'lakshmi.i@email.com', phone: '9987610018', dateOfBirth: '1994-04-05', gender: 'Female', bloodGroup: 'O+', address: '89, Besant Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600090', emergencyContact: 'Ganesh Iyer', emergencyPhone: '9987610027', allergies: [], insuranceProvider: 'Star Health', insuranceNumber: 'SH-234567' },
      { name: 'Pradeep Singh Rawat', email: 'pradeep.r@email.com', phone: '9987610019', dateOfBirth: '1972-06-18', gender: 'Male', bloodGroup: 'A+', address: '12, Rajpur Road', city: 'Dehradun', state: 'Uttarakhand', pincode: '248001', emergencyContact: 'Kamla Rawat', emergencyPhone: '9987610028', allergies: [], insuranceProvider: 'New India Assurance', insuranceNumber: 'NIA-345678' },
      { name: 'Nisha Agarwal', email: 'nisha.a@email.com', phone: '9987610020', dateOfBirth: '1996-12-01', gender: 'Female', bloodGroup: 'AB-', address: '34, Civil Lines', city: 'Nagpur', state: 'Maharashtra', pincode: '440001', emergencyContact: 'Vijay Agarwal', emergencyPhone: '9987610029', allergies: ['Aspirin'], insuranceProvider: null, insuranceNumber: null },
    ]

    const createdPatients: Array<{ id: string; patientId: string }> = []
    for (let i = 0; i < patients.length; i++) {
      const p = patients[i]
      const patient = await db.patient.create({
        data: {
          patientId: `PAT-${String(i + 1).padStart(4, '0')}`,
          name: p.name,
          email: p.email || null,
          phone: p.phone,
          dateOfBirth: p.dateOfBirth || null,
          gender: p.gender || null,
          bloodGroup: p.bloodGroup || null,
          address: p.address || null,
          city: p.city || null,
          state: p.state || null,
          pincode: p.pincode || null,
          aadhaarNumber: p.aadhaarNumber || null,
          emergencyContact: p.emergencyContact || null,
          emergencyPhone: p.emergencyPhone || null,
          allergies: p.allergies.length > 0 ? JSON.stringify(p.allergies) : null,
          insuranceProvider: p.insuranceProvider || null,
          insuranceNumber: p.insuranceNumber || null,
        },
      })
      createdPatients.push({ id: patient.id, patientId: patient.patientId })
    }

    // ========== MEDICINES ==========
    const medicines = [
      { name: 'Paracetamol 500mg', category: 'Tablet', manufacturer: 'Cipla Ltd', batchNumber: 'CPL-2024-001', expiryDate: '2026-06-30', purchasePrice: 15, sellingPrice: 25, stock: 500, minStock: 100, gstRate: 12, hsnCode: '30049099' },
      { name: 'Amoxicillin 250mg', category: 'Capsule', manufacturer: 'Sun Pharma', batchNumber: 'SPH-2024-012', expiryDate: '2025-12-31', purchasePrice: 35, sellingPrice: 55, stock: 300, minStock: 80, gstRate: 12, hsnCode: '30041099' },
      { name: 'Omeprazole 20mg', category: 'Capsule', manufacturer: 'Dr. Reddys', batchNumber: 'DRD-2024-008', expiryDate: '2026-03-15', purchasePrice: 22, sellingPrice: 40, stock: 400, minStock: 100, gstRate: 12, hsnCode: '30049099' },
      { name: 'Metformin 500mg', category: 'Tablet', manufacturer: 'Lupin Ltd', batchNumber: 'LUP-2024-015', expiryDate: '2026-09-30', purchasePrice: 18, sellingPrice: 32, stock: 600, minStock: 150, gstRate: 12, hsnCode: '30049099' },
      { name: 'Cetirizine 10mg', category: 'Tablet', manufacturer: 'Mankind Pharma', batchNumber: 'MNP-2024-020', expiryDate: '2026-01-31', purchasePrice: 8, sellingPrice: 15, stock: 800, minStock: 200, gstRate: 12, hsnCode: '30049099' },
      { name: 'Azithromycin 500mg', category: 'Tablet', manufacturer: 'Zydus Cadila', batchNumber: 'ZCD-2024-005', expiryDate: '2025-08-31', purchasePrice: 45, sellingPrice: 72, stock: 200, minStock: 50, gstRate: 12, hsnCode: '30041099' },
      { name: 'Cough Syrup (Benadryl)', category: 'Syrup', manufacturer: 'Johnson & Johnson', batchNumber: 'JJ-2024-003', expiryDate: '2025-10-15', purchasePrice: 55, sellingPrice: 85, stock: 150, minStock: 40, gstRate: 12, hsnCode: '30049099' },
      { name: 'Insulin Glargine 100IU/ml', category: 'Injection', manufacturer: 'Novo Nordisk', batchNumber: 'NNO-2024-007', expiryDate: '2025-11-30', purchasePrice: 280, sellingPrice: 420, stock: 50, minStock: 15, gstRate: 5, hsnCode: '30049099' },
      { name: 'Amlodipine 5mg', category: 'Tablet', manufacturer: 'Torrent Pharma', batchNumber: 'TRT-2024-011', expiryDate: '2026-07-31', purchasePrice: 12, sellingPrice: 22, stock: 700, minStock: 150, gstRate: 12, hsnCode: '30049099' },
      { name: 'Pantoprazole 40mg', category: 'Tablet', manufacturer: 'Alkem Labs', batchNumber: 'ALK-2024-009', expiryDate: '2026-04-30', purchasePrice: 20, sellingPrice: 38, stock: 450, minStock: 100, gstRate: 12, hsnCode: '30049099' },
      { name: 'Diclofenac Gel 30g', category: 'Topical', manufacturer: 'Novartis', batchNumber: 'NVS-2024-006', expiryDate: '2026-02-28', purchasePrice: 65, sellingPrice: 95, stock: 120, minStock: 30, gstRate: 12, hsnCode: '30049099' },
      { name: 'Salbutamol Inhaler', category: 'Inhaler', manufacturer: 'Cipla Ltd', batchNumber: 'CPL-2024-014', expiryDate: '2025-09-30', purchasePrice: 120, sellingPrice: 175, stock: 80, minStock: 20, gstRate: 5, hsnCode: '30049099' },
      { name: 'Ibuprofen 400mg', category: 'Tablet', manufacturer: 'Abbott', batchNumber: 'ABB-2024-002', expiryDate: '2026-05-31', purchasePrice: 10, sellingPrice: 18, stock: 550, minStock: 120, gstRate: 12, hsnCode: '30049099' },
      { name: 'Dolo 650 (Paracetamol)', category: 'Tablet', manufacturer: 'Micro Labs', batchNumber: 'MLB-2024-018', expiryDate: '2026-08-31', purchasePrice: 28, sellingPrice: 42, stock: 900, minStock: 200, gstRate: 12, hsnCode: '30049099' },
      { name: 'Vitamin D3 60K IU', category: 'Capsule', manufacturer: 'USV Ltd', batchNumber: 'USV-2024-004', expiryDate: '2026-12-31', purchasePrice: 32, sellingPrice: 52, stock: 350, minStock: 80, gstRate: 12, hsnCode: '30049099' },
      { name: 'Montelukast 10mg', category: 'Tablet', manufacturer: 'Cipla Ltd', batchNumber: 'CPL-2024-016', expiryDate: '2026-03-31', purchasePrice: 25, sellingPrice: 45, stock: 280, minStock: 70, gstRate: 12, hsnCode: '30049099' },
      { name: 'ORS Powder (Electral)', category: 'Powder', manufacturer: 'FDC Ltd', batchNumber: 'FDC-2024-010', expiryDate: '2026-10-31', purchasePrice: 18, sellingPrice: 28, stock: 400, minStock: 100, gstRate: 5, hsnCode: '30049099' },
      { name: 'Metronidazole 400mg', category: 'Tablet', manufacturer: 'Sun Pharma', batchNumber: 'SPH-2024-013', expiryDate: '2026-01-15', purchasePrice: 14, sellingPrice: 24, stock: 350, minStock: 80, gstRate: 12, hsnCode: '30041099' },
      { name: 'Atorvastatin 10mg', category: 'Tablet', manufacturer: 'Zydus Cadila', batchNumber: 'ZCD-2024-017', expiryDate: '2026-06-30', purchasePrice: 16, sellingPrice: 30, stock: 500, minStock: 120, gstRate: 12, hsnCode: '30049099' },
      { name: 'Brufen 400 (Ibuprofen)', category: 'Tablet', manufacturer: 'Abbott', batchNumber: 'ABB-2024-019', expiryDate: '2026-09-15', purchasePrice: 22, sellingPrice: 38, stock: 300, minStock: 60, gstRate: 12, hsnCode: '30049099' },
    ]

    const createdMedicines: Array<{ id: string; medicineId: string }> = []
    for (let i = 0; i < medicines.length; i++) {
      const m = medicines[i]
      const med = await db.medicine.create({
        data: {
          medicineId: `MED-${String(i + 1).padStart(4, '0')}`,
          ...m,
        },
      })
      createdMedicines.push({ id: med.id, medicineId: med.medicineId })
    }

    // Helper: get a date string N days from today
    const getDate = (daysFromNow: number) => {
      const d = new Date()
      d.setDate(d.getDate() + daysFromNow)
      return d.toISOString().split('T')[0]
    }

    // ========== APPOINTMENTS ==========
    const appointmentData = [
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
      { patientIdx: 0, doctorIdx: 1, date: getDate(2), time: '09:00', status: 'Scheduled', type: 'Consultation', notes: 'Cardiac referral' },
      { patientIdx: 3, doctorIdx: 4, date: getDate(2), time: '10:00', status: 'Scheduled', type: 'Follow-up', notes: 'Pediatric follow-up' },
      { patientIdx: 8, doctorIdx: 6, date: getDate(3), time: '09:30', status: 'Scheduled', type: 'Consultation', notes: 'Throat infection' },
      { patientIdx: 11, doctorIdx: 3, date: getDate(3), time: '11:00', status: 'Scheduled', type: 'Follow-up', notes: 'Dermatology follow-up' },
      { patientIdx: 16, doctorIdx: 0, date: getDate(4), time: '14:00', status: 'Scheduled', type: 'Follow-up', notes: 'General check-up' },
    ]

    const createdAppointments: Array<{ id: string; patientId: string; doctorId: string }> = []
    for (let i = 0; i < appointmentData.length; i++) {
      const a = appointmentData[i]
      const appointment = await db.appointment.create({
        data: {
          aptId: `APT-${String(i + 1).padStart(4, '0')}`,
          patientId: createdPatients[a.patientIdx].id,
          doctorId: createdDoctors[a.doctorIdx].id,
          date: a.date,
          time: a.time,
          status: a.status,
          type: a.type,
          notes: a.notes,
        },
      })
      createdAppointments.push({
        id: appointment.id,
        patientId: createdPatients[a.patientIdx].id,
        doctorId: createdDoctors[a.doctorIdx].id,
      })
    }

    // ========== INVOICES ==========
    const invoiceTemplates = [
      {
        patientIdx: 2, doctorIdx: 2, items: [
          { description: 'Orthopedic Consultation', hsnCode: '0011', quantity: 1, unitPrice: 800, gstRate: 0, type: 'Service' },
          { description: 'X-Ray - Left Knee', hsnCode: '0014', quantity: 1, unitPrice: 500, gstRate: 5, type: 'Lab Test' },
          { description: 'Physiotherapy Session', hsnCode: '0011', quantity: 3, unitPrice: 400, gstRate: 0, type: 'Service' },
        ],
        discount: 100,
      },
      {
        patientIdx: 3, doctorIdx: 3, items: [
          { description: 'Dermatology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 700, gstRate: 0, type: 'Service' },
          { description: 'Skin Allergy Test', hsnCode: '0019', quantity: 1, unitPrice: 1200, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 0,
      },
      {
        patientIdx: 4, doctorIdx: 4, items: [
          { description: 'Pediatric Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' },
          { description: 'HbA1c Test', hsnCode: '0013', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' },
          { description: 'Fasting Blood Sugar', hsnCode: '0013', quantity: 1, unitPrice: 150, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 50,
      },
      {
        patientIdx: 5, doctorIdx: 5, items: [
          { description: 'Gynecology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 800, gstRate: 0, type: 'Service' },
          { description: 'Ultrasound - Pelvic', hsnCode: '0015', quantity: 1, unitPrice: 1500, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 0,
      },
      {
        patientIdx: 6, doctorIdx: 6, items: [
          { description: 'ENT Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' },
          { description: 'Ear Wax Removal', hsnCode: '0011', quantity: 1, unitPrice: 300, gstRate: 0, type: 'Service' },
        ],
        discount: 0,
      },
      {
        patientIdx: 7, doctorIdx: 7, items: [
          { description: 'Ophthalmology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 700, gstRate: 0, type: 'Service' },
          { description: 'Visual Acuity Test', hsnCode: '0013', quantity: 1, unitPrice: 200, gstRate: 5, type: 'Lab Test' },
          { description: 'Retinal Examination', hsnCode: '0013', quantity: 1, unitPrice: 800, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 100,
      },
      {
        patientIdx: 8, doctorIdx: 0, items: [
          { description: 'General Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' },
          { description: 'Complete Blood Count', hsnCode: '0013', quantity: 1, unitPrice: 400, gstRate: 5, type: 'Lab Test' },
          { description: 'Lipid Profile', hsnCode: '0013', quantity: 1, unitPrice: 600, gstRate: 5, type: 'Lab Test' },
          { description: 'ECG', hsnCode: '0018', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 150,
      },
      {
        patientIdx: 9, doctorIdx: 1, items: [
          { description: 'Cardiology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 1000, gstRate: 0, type: 'Service' },
          { description: 'ECG', hsnCode: '0018', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' },
          { description: 'Echocardiogram', hsnCode: '0015', quantity: 1, unitPrice: 2500, gstRate: 5, type: 'Lab Test' },
          { description: 'Treadmill Test', hsnCode: '0018', quantity: 1, unitPrice: 2000, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 200,
      },
      {
        patientIdx: 12, doctorIdx: 0, items: [
          { description: 'General Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' },
          { description: 'Full Body Health Checkup', hsnCode: '0020', quantity: 1, unitPrice: 3500, gstRate: 5, type: 'Package' },
        ],
        discount: 500,
      },
      {
        patientIdx: 13, doctorIdx: 4, items: [
          { description: 'Pediatric Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' },
          { description: 'Vaccination (MMR)', hsnCode: '3004', quantity: 1, unitPrice: 450, gstRate: 5, type: 'Medicine' },
          { description: 'Vaccination (Hepatitis B)', hsnCode: '3004', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Medicine' },
        ],
        discount: 0,
      },
      {
        patientIdx: 16, doctorIdx: 1, items: [
          { description: 'Cardiology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 1000, gstRate: 0, type: 'Service' },
          { description: 'Holter Monitor', hsnCode: '0018', quantity: 1, unitPrice: 1800, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 100,
      },
      {
        patientIdx: 17, doctorIdx: 7, items: [
          { description: 'Ophthalmology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 700, gstRate: 0, type: 'Service' },
          { description: 'Visual Field Test', hsnCode: '0013', quantity: 1, unitPrice: 500, gstRate: 5, type: 'Lab Test' },
          { description: 'OCT Scan', hsnCode: '0015', quantity: 1, unitPrice: 1200, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 0,
      },
      {
        patientIdx: 14, doctorIdx: 6, items: [
          { description: 'ENT Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' },
          { description: 'Nasal Endoscopy', hsnCode: '0014', quantity: 1, unitPrice: 1500, gstRate: 5, type: 'Lab Test' },
          { description: 'CT Scan - PNS', hsnCode: '0017', quantity: 1, unitPrice: 3500, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 200,
      },
      {
        patientIdx: 11, doctorIdx: 3, items: [
          { description: 'Dermatology Consultation', hsnCode: '0011', quantity: 1, unitPrice: 700, gstRate: 0, type: 'Service' },
          { description: 'Chemical Peel', hsnCode: '0011', quantity: 1, unitPrice: 2000, gstRate: 5, type: 'Service' },
        ],
        discount: 0,
      },
      {
        patientIdx: 18, doctorIdx: 0, items: [
          { description: 'General Consultation', hsnCode: '0011', quantity: 1, unitPrice: 600, gstRate: 0, type: 'Service' },
          { description: 'Thyroid Profile Test', hsnCode: '0013', quantity: 1, unitPrice: 500, gstRate: 5, type: 'Lab Test' },
          { description: 'Vitamin D Test', hsnCode: '0013', quantity: 1, unitPrice: 400, gstRate: 5, type: 'Lab Test' },
          { description: 'Vitamin B12 Test', hsnCode: '0013', quantity: 1, unitPrice: 350, gstRate: 5, type: 'Lab Test' },
        ],
        discount: 85,
      },
    ]

    const createdInvoices: Array<{ id: string; patientId: string; grandTotal: number }> = []
    for (let i = 0; i < invoiceTemplates.length; i++) {
      const invT = invoiceTemplates[i]
      const patientId = createdPatients[invT.patientIdx].id
      const invDate = getDate(-Math.floor(i * 0.8) - 1)
      const dueDate = getDate(-Math.floor(i * 0.8) + 14)

      // Calculate totals
      let subtotal = 0
      let totalCgst = 0
      let totalSgst = 0

      const itemsData = invT.items.map(item => {
        const lineTotal = item.unitPrice * item.quantity
        const gstAmount = (lineTotal * item.gstRate) / 100
        const halfGst = gstAmount / 2

        subtotal += lineTotal
        totalCgst += halfGst
        totalSgst += halfGst

        return {
          description: item.description,
          hsnCode: item.hsnCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          gstRate: item.gstRate,
          gstAmount: parseFloat(gstAmount.toFixed(2)),
          total: parseFloat((lineTotal + gstAmount).toFixed(2)),
          type: item.type,
        }
      })

      const totalGst = totalCgst + totalSgst
      const grandTotal = parseFloat((subtotal + totalGst - (invT.discount || 0)).toFixed(2))

      const invoice = await db.invoice.create({
        data: {
          invoiceNumber: `INV-${String(i + 1).padStart(4, '0')}`,
          patientId,
          date: invDate,
          dueDate,
          status: 'Paid',
          subtotal: parseFloat(subtotal.toFixed(2)),
          cgst: parseFloat(totalCgst.toFixed(2)),
          sgst: parseFloat(totalSgst.toFixed(2)),
          igst: 0,
          totalGst: parseFloat(totalGst.toFixed(2)),
          grandTotal,
          discount: invT.discount || 0,
          paidAmount: grandTotal,
          items: { create: itemsData },
        },
      })

      createdInvoices.push({ id: invoice.id, patientId: invoice.patientId, grandTotal: invoice.grandTotal })
    }

    // ========== PAYMENTS ==========
    const paymentMethods = ['Cash', 'UPI', 'Card', 'Net Banking', 'Wallet']
    let paymentCount = 0

    for (const invoice of createdInvoices) {
      // Most invoices are fully paid
      if (paymentCount < 15) {
        const method = paymentMethods[paymentCount % paymentMethods.length]
        await db.payment.create({
          data: {
            paymentId: `PAY-${String(paymentCount + 1).padStart(4, '0')}`,
            invoiceId: invoice.id,
            patientId: invoice.patientId,
            amount: invoice.grandTotal,
            method,
            status: 'Success',
          },
        })
        paymentCount++
      }
    }

    // Create a few partially paid invoices
    const partialInvoiceIndices = [5, 8]
    for (const idx of partialInvoiceIndices) {
      const inv = createdInvoices[idx]
      if (inv) {
        // Reduce paid amount to create partially paid status
        const partialAmount = parseFloat((inv.grandTotal * 0.5).toFixed(2))
        await db.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: partialAmount,
            status: 'Partially Paid',
          },
        })

        await db.payment.create({
          data: {
            paymentId: `PAY-${String(paymentCount + 1).padStart(4, '0')}`,
            invoiceId: inv.id,
            patientId: inv.patientId,
            amount: partialAmount,
            method: 'Cash',
            status: 'Success',
          },
        })
        paymentCount++
      }
    }

    // Create some outstanding invoices (unpaid)
    const unpaidInvoiceIndices = [12, 13]
    for (const idx of unpaidInvoiceIndices) {
      const inv = createdInvoices[idx]
      if (inv) {
        await db.invoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: 0,
            status: 'Unpaid',
          },
        })
      }
    }

    // Create a few extra payments for variety
    const extraPayments = [
      { invoiceIdx: 0, amount: 1000, method: 'UPI' },
      { invoiceIdx: 1, amount: 500, method: 'Card' },
      { invoiceIdx: 3, amount: 800, method: 'Cash' },
      { invoiceIdx: 6, amount: 1200, method: 'Net Banking' },
      { invoiceIdx: 10, amount: 1500, method: 'Wallet' },
    ]

    for (const ep of extraPayments) {
      if (ep.invoiceIdx < createdInvoices.length) {
        const inv = createdInvoices[ep.invoiceIdx]
        await db.payment.create({
          data: {
            paymentId: `PAY-${String(paymentCount + 1).padStart(4, '0')}`,
            invoiceId: inv.id,
            patientId: inv.patientId,
            amount: ep.amount,
            method: ep.method,
            status: 'Success',
          },
        })
        paymentCount++
      }
    }

    // ========== PRESCRIPTIONS ==========
    const prescriptionData = [
      {
        patientIdx: 2, doctorIdx: 2, date: getDate(-6), diagnosis: 'Osteoarthritis - Left Knee',
        notes: [
          { medicine: 'Ibuprofen 400mg', dosage: '1 tablet', frequency: 'Twice daily after meals', duration: '7 days' },
          { medicine: 'Diclofenac Gel', dosage: 'Apply thin layer', frequency: 'Twice daily on affected area', duration: '14 days' },
          { medicine: 'Pantoprazole 40mg', dosage: '1 tablet', frequency: 'Once daily before breakfast', duration: '7 days' },
        ],
      },
      {
        patientIdx: 3, doctorIdx: 3, date: getDate(-3), diagnosis: 'Allergic Contact Dermatitis',
        notes: [
          { medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', duration: '14 days' },
          { medicine: 'Montelukast 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', duration: '14 days' },
          { medicine: 'Calamine Lotion', dosage: 'Apply', frequency: 'As needed on rash', duration: '14 days' },
        ],
      },
      {
        patientIdx: 4, doctorIdx: 4, date: getDate(-4), diagnosis: 'Type 2 Diabetes Mellitus',
        notes: [
          { medicine: 'Metformin 500mg', dosage: '1 tablet', frequency: 'Twice daily after meals', duration: '30 days' },
          { medicine: 'Insulin Glargine', dosage: '16 IU', frequency: 'Once daily at bedtime', duration: '30 days' },
        ],
      },
      {
        patientIdx: 5, doctorIdx: 5, date: getDate(-5), diagnosis: 'Pregnancy - 28 weeks',
        notes: [
          { medicine: 'Iron + Folic Acid', dosage: '1 tablet', frequency: 'Once daily', duration: '60 days' },
          { medicine: 'Calcium 500mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '60 days' },
          { medicine: 'Vitamin D3 60K IU', dosage: '1 capsule', frequency: 'Once weekly', duration: '8 weeks' },
        ],
      },
      {
        patientIdx: 6, doctorIdx: 6, date: getDate(-5), diagnosis: 'Acute Otitis Media',
        notes: [
          { medicine: 'Amoxicillin 250mg', dosage: '1 capsule', frequency: 'Three times daily', duration: '7 days' },
          { medicine: 'Paracetamol 500mg', dosage: '1 tablet', frequency: 'Three times daily as needed for pain', duration: '5 days' },
        ],
      },
      {
        patientIdx: 7, doctorIdx: 7, date: getDate(-6), diagnosis: 'Myopia - Bilateral',
        notes: [
          { medicine: 'Prescription glasses', dosage: '-2.5D both eyes', frequency: 'Constant use', duration: '1 year' },
        ],
      },
      {
        patientIdx: 8, doctorIdx: 0, date: getDate(-7), diagnosis: 'Essential Hypertension',
        notes: [
          { medicine: 'Amlodipine 5mg', dosage: '1 tablet', frequency: 'Once daily morning', duration: '30 days' },
          { medicine: 'Atorvastatin 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', duration: '30 days' },
          { medicine: 'Diet modification', dosage: 'Low salt diet', frequency: 'Daily', duration: 'Lifelong' },
        ],
      },
      {
        patientIdx: 9, doctorIdx: 1, date: getDate(-8), diagnosis: 'Coronary Artery Disease',
        notes: [
          { medicine: 'Ecosprin 75mg', dosage: '1 tablet', frequency: 'Once daily after meals', duration: 'Lifelong' },
          { medicine: 'Atorvastatin 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', duration: 'Lifelong' },
          { medicine: 'Metoprolol 50mg', dosage: '1 tablet', frequency: 'Twice daily', duration: '30 days' },
        ],
      },
      {
        patientIdx: 14, doctorIdx: 6, date: getDate(-10), diagnosis: 'Chronic Sinusitis',
        notes: [
          { medicine: 'Amoxicillin 250mg', dosage: '1 capsule', frequency: 'Three times daily', duration: '10 days' },
          { medicine: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once daily', duration: '14 days' },
          { medicine: 'Salbutamol Inhaler', dosage: '2 puffs', frequency: 'Three times daily', duration: '14 days' },
        ],
      },
      {
        patientIdx: 11, doctorIdx: 3, date: getDate(-9), diagnosis: 'Acne Vulgaris',
        notes: [
          { medicine: 'Azithromycin 500mg', dosage: '1 tablet', frequency: 'Once daily for 3 days per week', duration: '6 weeks' },
          { medicine: 'Clindamycin Gel', dosage: 'Apply thin layer', frequency: 'Twice daily on affected area', duration: '6 weeks' },
        ],
      },
      {
        patientIdx: 12, doctorIdx: 0, date: getDate(-9), diagnosis: 'Routine Health Check - Normal',
        notes: [
          { medicine: 'Vitamin D3 60K IU', dosage: '1 capsule', frequency: 'Once weekly', duration: '8 weeks' },
          { medicine: 'ORS Powder', dosage: 'As needed', frequency: 'For dehydration', duration: 'As needed' },
        ],
      },
      {
        patientIdx: 17, doctorIdx: 7, date: getDate(-12), diagnosis: 'Glaucoma - Suspect',
        notes: [
          { medicine: 'Timolol 0.5% Eye Drops', dosage: '1 drop', frequency: 'Twice daily both eyes', duration: '30 days' },
          { medicine: 'Follow-up after 1 month', dosage: 'Eye pressure monitoring', frequency: 'Monthly', duration: 'Ongoing' },
        ],
      },
    ]

    for (let i = 0; i < prescriptionData.length; i++) {
      const p = prescriptionData[i]
      await db.prescription.create({
        data: {
          prescriptionId: `PRX-${String(i + 1).padStart(4, '0')}`,
          patientId: createdPatients[p.patientIdx].id,
          doctorId: createdDoctors[p.doctorIdx].id,
          date: p.date,
          diagnosis: p.diagnosis,
          notes: JSON.stringify(p.notes),
        },
      })
    }

    // ========== PATIENT VISITS ==========
    await seedPatientVisits(db, createdPatients, createdDoctors)

    const visitCount = await db.patientVisit.count()
    return NextResponse.json({
      message: 'Database seeded successfully with sample data!',
      summary: {
        users: 5,
        clinicSettings: 1,
        doctors: doctors.length,
        staff: staffData.length,
        patients: patients.length,
        appointments: appointmentData.length,
        invoices: invoiceTemplates.length,
        payments: paymentCount,
        prescriptions: prescriptionData.length,
        medicines: medicines.length,
        visits: visitCount,
      },
    })
  } catch (error) {
    console.error('Error seeding database:', error)
    return NextResponse.json(
      { error: 'Failed to seed database', details: String(error) },
      { status: 500 }
    )
  }
}
