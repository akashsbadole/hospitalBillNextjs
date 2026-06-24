-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "branchId" TEXT,
    "dateOfBirth" TEXT,
    "gender" TEXT,
    "bloodGroup" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "aadhaarNumber" TEXT,
    "emergencyContact" TEXT,
    "emergencyPhone" TEXT,
    "allergies" TEXT,
    "pastTreatments" TEXT,
    "insuranceProvider" TEXT,
    "insuranceNumber" TEXT,
    "maritalStatus" TEXT,
    "occupation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "qualification" TEXT,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "consultationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "aptId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "type" TEXT NOT NULL DEFAULT 'Consultation',
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "dueDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Unpaid',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalGst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountType" TEXT NOT NULL DEFAULT 'flat',
    "roundOff" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsnCode" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'Service',

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'Cash',
    "razorpayPaymentId" TEXT,
    "razorpayOrderId" TEXT,
    "razorpaySignature" TEXT,
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "upiVpa" TEXT,
    "upiTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Success',
    "receiptNumber" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "diagnosis" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "manufacturer" TEXT,
    "batchNumber" TEXT,
    "expiryDate" TEXT,
    "purchasePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellingPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 10,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "hsnCode" TEXT,
    "barcode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "orderDate" TEXT NOT NULL,
    "expectedDate" TEXT,
    "notes" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Admin',
    "phone" TEXT,
    "avatar" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "lastLogin" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicSettings" (
    "id" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL DEFAULT 'My Hospital / Clinic',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "gstin" TEXT,
    "gstType" TEXT NOT NULL DEFAULT 'None',
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "resolution" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientVisit" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "doctorId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Registration',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "temperature" TEXT,
    "bloodPressure" TEXT,
    "pulse" TEXT,
    "oxygenLevel" TEXT,
    "weight" TEXT,
    "height" TEXT,
    "chiefComplaint" TEXT,
    "visitType" TEXT NOT NULL DEFAULT 'OPD',
    "department" TEXT,
    "roomNumber" TEXT,
    "admissionDate" TEXT,
    "dischargeDate" TEXT,
    "attendingDoctorId" TEXT,
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitStage" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnalysis" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Health Analysis',
    "input" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'Grok',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "visitId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "callType" TEXT NOT NULL DEFAULT 'Video',
    "scheduledAt" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "diagnosis" TEXT,
    "followUpNotes" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL,
    "razorpayEnabled" BOOLEAN NOT NULL DEFAULT false,
    "razorpayKeyId" TEXT,
    "razorpayKeySecret" TEXT,
    "razorpayMode" TEXT NOT NULL DEFAULT 'Test',
    "paypalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paypalClientId" TEXT,
    "paypalClientSecret" TEXT,
    "paypalMode" TEXT NOT NULL DEFAULT 'Sandbox',
    "paypalCurrency" TEXT NOT NULL DEFAULT 'USD',
    "upiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "upiVpa" TEXT,
    "upiMerchantName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceCompany" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TPA',
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "insuranceCompanyId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "policyNumber" TEXT NOT NULL,
    "claimType" TEXT NOT NULL DEFAULT 'Cashless',
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "approvedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "settledAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestCatalog" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "normalRange" TEXT,
    "unit" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gstRate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "hsnCode" TEXT DEFAULT '0013',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabTestCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTestOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "doctorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Ordered',
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "results" TEXT,
    "notes" TEXT,
    "reportUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabTestOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "bedNumber" TEXT NOT NULL,
    "bedType" TEXT NOT NULL DEFAULT 'Standard',
    "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "currentPatientId" TEXT,
    "currentVisitId" TEXT,
    "admittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "paidBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientFeedback" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 3,
    "category" TEXT NOT NULL DEFAULT 'General',
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New',
    "response" TEXT,
    "respondedById" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fromDoctorId" TEXT NOT NULL,
    "toDoctorId" TEXT,
    "toExternalDoctor" TEXT,
    "department" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteDisposal" (
    "id" TEXT NOT NULL,
    "disposalId" TEXT NOT NULL,
    "wasteType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disposalMethod" TEXT NOT NULL,
    "disposedById" TEXT,
    "disposedAt" TIMESTAMP(3),
    "date" TEXT NOT NULL,
    "vehicleNo" TEXT,
    "agencyName" TEXT,
    "certificateNo" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "WasteDisposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TdsRecord" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "panNumber" TEXT,
    "recipientName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "tdsRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tdsAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "section" TEXT NOT NULL DEFAULT '194C',
    "quarter" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "dueDate" TEXT,
    "paidDate" TEXT,
    "challanNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "TdsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSchedule" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxAppointments" INTEGER NOT NULL DEFAULT 20,
    "consultationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "effectiveFrom" TEXT,
    "effectiveTo" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationTheatre" (
    "id" TEXT NOT NULL,
    "otId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'General',
    "floor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "branchId" TEXT,

    CONSTRAINT "OperationTheatre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Surgery" (
    "id" TEXT NOT NULL,
    "surgeryId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "otId" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "anesthesiaType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "scheduledDate" TEXT,
    "scheduledTime" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "diagnosis" TEXT,
    "procedure" TEXT,
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Surgery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientConsent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "templateId" TEXT NOT NULL,
    "consentDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "witnessName" TEXT,
    "witnessRelation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueueToken" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "department" TEXT NOT NULL,
    "tokenNumber" INTEGER NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "status" TEXT NOT NULL DEFAULT 'Waiting',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "counterNumber" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagingStudy" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "visitId" TEXT,
    "modality" TEXT NOT NULL,
    "bodyPart" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Ordered',
    "clinicalHistory" TEXT,
    "findings" TEXT,
    "impression" TEXT,
    "technique" TEXT,
    "contrastUsed" BOOLEAN NOT NULL DEFAULT false,
    "contrastType" TEXT,
    "radiologistId" TEXT,
    "imagesCount" INTEGER NOT NULL DEFAULT 0,
    "dicomStudyUid" TEXT,
    "accessionNumber" TEXT,
    "reportUrl" TEXT,
    "imagesUrl" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledAt" TIMESTAMP(3),
    "performedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3),
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagingStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ambulance" (
    "id" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "driverPhone" TEXT NOT NULL,
    "driverLicense" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Basic',
    "status" TEXT NOT NULL DEFAULT 'Available',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "equipment" TEXT,
    "hospitalBranch" TEXT,
    "insuranceValidUntil" TIMESTAMP(3),
    "fitnessValidUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ambulance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmbulanceDispatch" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "patientId" TEXT,
    "pickupAddress" TEXT,
    "destination" TEXT,
    "dispatchType" TEXT NOT NULL DEFAULT 'Emergency',
    "status" TEXT NOT NULL DEFAULT 'Dispatched',
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrivedAt" TIMESTAMP(3),
    "patientAboardAt" TIMESTAMP(3),
    "destinationAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "distanceKm" DOUBLE PRECISION,
    "fare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmbulanceDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodDonor" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "patientId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "bloodGroup" TEXT NOT NULL,
    "gender" TEXT,
    "dateOfBirth" TEXT,
    "weight" DOUBLE PRECISION,
    "lastDonation" TIMESTAMP(3),
    "totalDonations" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "medicalNotes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodDonor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodDonation" (
    "id" TEXT NOT NULL,
    "donationId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "donationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bloodGroup" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 350,
    "hemoglobin" DOUBLE PRECISION,
    "bloodPressure" TEXT,
    "pulse" TEXT,
    "temperature" TEXT,
    "bloodBagId" TEXT,
    "testResults" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Screened',
    "expiryDate" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "discardReason" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodDonation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodInventory" (
    "id" TEXT NOT NULL,
    "bloodGroup" TEXT NOT NULL,
    "unitsAvailable" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "bloodGroup" TEXT NOT NULL,
    "unitsRequired" INTEGER NOT NULL,
    "urgency" TEXT NOT NULL DEFAULT 'Normal',
    "reason" TEXT,
    "crossMatchType" TEXT NOT NULL DEFAULT 'Type & Screen',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "approvedBy" TEXT,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3),
    "notes" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarcodeScan" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "location" TEXT,
    "scannedById" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarcodeScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "linkId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_branchId_key" ON "Branch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_patientId_key" ON "Patient"("patientId");

-- CreateIndex
CREATE INDEX "Patient_name_idx" ON "Patient"("name");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");

-- CreateIndex
CREATE INDEX "Patient_email_idx" ON "Patient"("email");

-- CreateIndex
CREATE INDEX "Patient_branchId_idx" ON "Patient"("branchId");

-- CreateIndex
CREATE INDEX "Patient_status_idx" ON "Patient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Doctor_doctorId_key" ON "Doctor"("doctorId");

-- CreateIndex
CREATE INDEX "Doctor_name_idx" ON "Doctor"("name");

-- CreateIndex
CREATE INDEX "Doctor_specialization_idx" ON "Doctor"("specialization");

-- CreateIndex
CREATE INDEX "Doctor_phone_idx" ON "Doctor"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_staffId_key" ON "Staff"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_aptId_key" ON "Appointment"("aptId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_patientId_idx" ON "Invoice"("patientId");

-- CreateIndex
CREATE INDEX "Invoice_date_idx" ON "Invoice"("date");

-- CreateIndex
CREATE INDEX "Invoice_branchId_idx" ON "Invoice"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentId_key" ON "Payment"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_prescriptionId_key" ON "Prescription"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_medicineId_key" ON "Medicine"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_barcode_key" ON "Medicine"("barcode");

-- CreateIndex
CREATE INDEX "Medicine_name_idx" ON "Medicine"("name");

-- CreateIndex
CREATE INDEX "Medicine_category_idx" ON "Medicine"("category");

-- CreateIndex
CREATE INDEX "Medicine_manufacturer_idx" ON "Medicine"("manufacturer");

-- CreateIndex
CREATE INDEX "Medicine_expiryDate_idx" ON "Medicine"("expiryDate");

-- CreateIndex
CREATE INDEX "Medicine_stock_idx" ON "Medicine"("stock");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_supplierId_key" ON "Supplier"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poId_key" ON "PurchaseOrder"("poId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_movementId_key" ON "StockMovement"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_ticketId_key" ON "SupportTicket"("ticketId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_category_idx" ON "SupportTicket"("category");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "SupportTicket_createdById_idx" ON "SupportTicket"("createdById");

-- CreateIndex
CREATE INDEX "SupportTicket_branchId_idx" ON "SupportTicket"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientVisit_visitId_key" ON "PatientVisit"("visitId");

-- CreateIndex
CREATE INDEX "PatientVisit_patientId_idx" ON "PatientVisit"("patientId");

-- CreateIndex
CREATE INDEX "PatientVisit_stage_idx" ON "PatientVisit"("stage");

-- CreateIndex
CREATE INDEX "PatientVisit_status_idx" ON "PatientVisit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AiAnalysis_analysisId_key" ON "AiAnalysis"("analysisId");

-- CreateIndex
CREATE INDEX "AiAnalysis_patientId_idx" ON "AiAnalysis"("patientId");

-- CreateIndex
CREATE INDEX "AiAnalysis_type_idx" ON "AiAnalysis"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CallSession_sessionId_key" ON "CallSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CallSession_visitId_key" ON "CallSession"("visitId");

-- CreateIndex
CREATE INDEX "CallSession_patientId_idx" ON "CallSession"("patientId");

-- CreateIndex
CREATE INDEX "CallSession_doctorId_idx" ON "CallSession"("doctorId");

-- CreateIndex
CREATE INDEX "CallSession_status_idx" ON "CallSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceCompany_companyId_key" ON "InsuranceCompany"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InsuranceClaim_claimId_key" ON "InsuranceClaim"("claimId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_patientId_idx" ON "InsuranceClaim"("patientId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_insuranceCompanyId_idx" ON "InsuranceClaim"("insuranceCompanyId");

-- CreateIndex
CREATE INDEX "InsuranceClaim_status_idx" ON "InsuranceClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestCatalog_testId_key" ON "LabTestCatalog"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "LabTestOrder_orderId_key" ON "LabTestOrder"("orderId");

-- CreateIndex
CREATE INDEX "LabTestOrder_visitId_idx" ON "LabTestOrder"("visitId");

-- CreateIndex
CREATE INDEX "LabTestOrder_patientId_idx" ON "LabTestOrder"("patientId");

-- CreateIndex
CREATE INDEX "LabTestOrder_status_idx" ON "LabTestOrder"("status");

-- CreateIndex
CREATE INDEX "LabTestOrder_testId_idx" ON "LabTestOrder"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_wardId_key" ON "Ward"("wardId");

-- CreateIndex
CREATE UNIQUE INDEX "Bed_bedId_key" ON "Bed"("bedId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_expenseId_key" ON "Expense"("expenseId");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_branchId_idx" ON "Expense"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientFeedback_feedbackId_key" ON "PatientFeedback"("feedbackId");

-- CreateIndex
CREATE INDEX "PatientFeedback_patientId_idx" ON "PatientFeedback"("patientId");

-- CreateIndex
CREATE INDEX "PatientFeedback_rating_idx" ON "PatientFeedback"("rating");

-- CreateIndex
CREATE INDEX "PatientFeedback_status_idx" ON "PatientFeedback"("status");

-- CreateIndex
CREATE INDEX "PatientFeedback_branchId_idx" ON "PatientFeedback"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referralId_key" ON "Referral"("referralId");

-- CreateIndex
CREATE INDEX "Referral_patientId_idx" ON "Referral"("patientId");

-- CreateIndex
CREATE INDEX "Referral_fromDoctorId_idx" ON "Referral"("fromDoctorId");

-- CreateIndex
CREATE INDEX "Referral_status_idx" ON "Referral"("status");

-- CreateIndex
CREATE INDEX "Referral_branchId_idx" ON "Referral"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "WasteDisposal_disposalId_key" ON "WasteDisposal"("disposalId");

-- CreateIndex
CREATE INDEX "WasteDisposal_wasteType_idx" ON "WasteDisposal"("wasteType");

-- CreateIndex
CREATE INDEX "WasteDisposal_date_idx" ON "WasteDisposal"("date");

-- CreateIndex
CREATE INDEX "WasteDisposal_status_idx" ON "WasteDisposal"("status");

-- CreateIndex
CREATE INDEX "WasteDisposal_branchId_idx" ON "WasteDisposal"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "TdsRecord_recordId_key" ON "TdsRecord"("recordId");

-- CreateIndex
CREATE INDEX "TdsRecord_section_idx" ON "TdsRecord"("section");

-- CreateIndex
CREATE INDEX "TdsRecord_fiscalYear_idx" ON "TdsRecord"("fiscalYear");

-- CreateIndex
CREATE INDEX "TdsRecord_quarter_idx" ON "TdsRecord"("quarter");

-- CreateIndex
CREATE INDEX "TdsRecord_status_idx" ON "TdsRecord"("status");

-- CreateIndex
CREATE INDEX "TdsRecord_branchId_idx" ON "TdsRecord"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSchedule_scheduleId_key" ON "DoctorSchedule"("scheduleId");

-- CreateIndex
CREATE INDEX "DoctorSchedule_doctorId_idx" ON "DoctorSchedule"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorSchedule_dayOfWeek_idx" ON "DoctorSchedule"("dayOfWeek");

-- CreateIndex
CREATE INDEX "DoctorSchedule_status_idx" ON "DoctorSchedule"("status");

-- CreateIndex
CREATE INDEX "DoctorSchedule_branchId_idx" ON "DoctorSchedule"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationTheatre_otId_key" ON "OperationTheatre"("otId");

-- CreateIndex
CREATE INDEX "OperationTheatre_status_idx" ON "OperationTheatre"("status");

-- CreateIndex
CREATE INDEX "OperationTheatre_branchId_idx" ON "OperationTheatre"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Surgery_surgeryId_key" ON "Surgery"("surgeryId");

-- CreateIndex
CREATE INDEX "Surgery_patientId_idx" ON "Surgery"("patientId");

-- CreateIndex
CREATE INDEX "Surgery_doctorId_idx" ON "Surgery"("doctorId");

-- CreateIndex
CREATE INDEX "Surgery_status_idx" ON "Surgery"("status");

-- CreateIndex
CREATE INDEX "Surgery_scheduledDate_idx" ON "Surgery"("scheduledDate");

-- CreateIndex
CREATE INDEX "Surgery_branchId_idx" ON "Surgery"("branchId");

-- CreateIndex
CREATE INDEX "ConsentTemplate_type_idx" ON "ConsentTemplate"("type");

-- CreateIndex
CREATE INDEX "ConsentTemplate_isActive_idx" ON "ConsentTemplate"("isActive");

-- CreateIndex
CREATE INDEX "PatientConsent_patientId_idx" ON "PatientConsent"("patientId");

-- CreateIndex
CREATE INDEX "PatientConsent_templateId_idx" ON "PatientConsent"("templateId");

-- CreateIndex
CREATE INDEX "PatientConsent_status_idx" ON "PatientConsent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QueueToken_tokenId_key" ON "QueueToken"("tokenId");

-- CreateIndex
CREATE INDEX "QueueToken_department_status_idx" ON "QueueToken"("department", "status");

-- CreateIndex
CREATE INDEX "QueueToken_status_idx" ON "QueueToken"("status");

-- CreateIndex
CREATE INDEX "QueueToken_branchId_idx" ON "QueueToken"("branchId");

-- CreateIndex
CREATE INDEX "QueueToken_tokenNumber_idx" ON "QueueToken"("tokenNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ImagingStudy_studyId_key" ON "ImagingStudy"("studyId");

-- CreateIndex
CREATE INDEX "ImagingStudy_patientId_idx" ON "ImagingStudy"("patientId");

-- CreateIndex
CREATE INDEX "ImagingStudy_modality_idx" ON "ImagingStudy"("modality");

-- CreateIndex
CREATE INDEX "ImagingStudy_status_idx" ON "ImagingStudy"("status");

-- CreateIndex
CREATE INDEX "ImagingStudy_branchId_idx" ON "ImagingStudy"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Ambulance_ambulanceId_key" ON "Ambulance"("ambulanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Ambulance_vehicleNumber_key" ON "Ambulance"("vehicleNumber");

-- CreateIndex
CREATE INDEX "Ambulance_status_idx" ON "Ambulance"("status");

-- CreateIndex
CREATE INDEX "Ambulance_type_idx" ON "Ambulance"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AmbulanceDispatch_dispatchId_key" ON "AmbulanceDispatch"("dispatchId");

-- CreateIndex
CREATE INDEX "AmbulanceDispatch_ambulanceId_idx" ON "AmbulanceDispatch"("ambulanceId");

-- CreateIndex
CREATE INDEX "AmbulanceDispatch_status_idx" ON "AmbulanceDispatch"("status");

-- CreateIndex
CREATE INDEX "AmbulanceDispatch_dispatchType_idx" ON "AmbulanceDispatch"("dispatchType");

-- CreateIndex
CREATE INDEX "AmbulanceDispatch_branchId_idx" ON "AmbulanceDispatch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BloodDonor_donorId_key" ON "BloodDonor"("donorId");

-- CreateIndex
CREATE INDEX "BloodDonor_bloodGroup_idx" ON "BloodDonor"("bloodGroup");

-- CreateIndex
CREATE INDEX "BloodDonor_status_idx" ON "BloodDonor"("status");

-- CreateIndex
CREATE INDEX "BloodDonor_branchId_idx" ON "BloodDonor"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BloodDonation_donationId_key" ON "BloodDonation"("donationId");

-- CreateIndex
CREATE INDEX "BloodDonation_donorId_idx" ON "BloodDonation"("donorId");

-- CreateIndex
CREATE INDEX "BloodDonation_bloodGroup_idx" ON "BloodDonation"("bloodGroup");

-- CreateIndex
CREATE INDEX "BloodDonation_status_idx" ON "BloodDonation"("status");

-- CreateIndex
CREATE INDEX "BloodDonation_expiryDate_idx" ON "BloodDonation"("expiryDate");

-- CreateIndex
CREATE INDEX "BloodDonation_branchId_idx" ON "BloodDonation"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BloodInventory_bloodGroup_key" ON "BloodInventory"("bloodGroup");

-- CreateIndex
CREATE INDEX "BloodInventory_bloodGroup_idx" ON "BloodInventory"("bloodGroup");

-- CreateIndex
CREATE UNIQUE INDEX "BloodRequest_requestId_key" ON "BloodRequest"("requestId");

-- CreateIndex
CREATE INDEX "BloodRequest_patientId_idx" ON "BloodRequest"("patientId");

-- CreateIndex
CREATE INDEX "BloodRequest_bloodGroup_idx" ON "BloodRequest"("bloodGroup");

-- CreateIndex
CREATE INDEX "BloodRequest_status_idx" ON "BloodRequest"("status");

-- CreateIndex
CREATE INDEX "BloodRequest_urgency_idx" ON "BloodRequest"("urgency");

-- CreateIndex
CREATE INDEX "BloodRequest_branchId_idx" ON "BloodRequest"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeScan_scanId_key" ON "BarcodeScan"("scanId");

-- CreateIndex
CREATE INDEX "BarcodeScan_barcode_idx" ON "BarcodeScan"("barcode");

-- CreateIndex
CREATE INDEX "BarcodeScan_entityType_entityId_idx" ON "BarcodeScan"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BarcodeScan_scannedById_idx" ON "BarcodeScan"("scannedById");

-- CreateIndex
CREATE INDEX "BarcodeScan_branchId_idx" ON "BarcodeScan"("branchId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReply" ADD CONSTRAINT "SupportReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportReply" ADD CONSTRAINT "SupportReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientVisit" ADD CONSTRAINT "PatientVisit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitStage" ADD CONSTRAINT "VisitStage_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSession" ADD CONSTRAINT "CallSession_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_insuranceCompanyId_fkey" FOREIGN KEY ("insuranceCompanyId") REFERENCES "InsuranceCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTestCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTestOrder" ADD CONSTRAINT "LabTestOrder_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_currentPatientId_fkey" FOREIGN KEY ("currentPatientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_currentVisitId_fkey" FOREIGN KEY ("currentVisitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFeedback" ADD CONSTRAINT "PatientFeedback_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_fromDoctorId_fkey" FOREIGN KEY ("fromDoctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_toDoctorId_fkey" FOREIGN KEY ("toDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteDisposal" ADD CONSTRAINT "WasteDisposal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteDisposal" ADD CONSTRAINT "WasteDisposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdsRecord" ADD CONSTRAINT "TdsRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TdsRecord" ADD CONSTRAINT "TdsRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationTheatre" ADD CONSTRAINT "OperationTheatre_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surgery" ADD CONSTRAINT "Surgery_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surgery" ADD CONSTRAINT "Surgery_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surgery" ADD CONSTRAINT "Surgery_otId_fkey" FOREIGN KEY ("otId") REFERENCES "OperationTheatre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Surgery" ADD CONSTRAINT "Surgery_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConsent" ADD CONSTRAINT "PatientConsent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConsentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueToken" ADD CONSTRAINT "QueueToken_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueToken" ADD CONSTRAINT "QueueToken_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueToken" ADD CONSTRAINT "QueueToken_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingStudy" ADD CONSTRAINT "ImagingStudy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingStudy" ADD CONSTRAINT "ImagingStudy_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagingStudy" ADD CONSTRAINT "ImagingStudy_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "PatientVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbulanceDispatch" ADD CONSTRAINT "AmbulanceDispatch_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "Ambulance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbulanceDispatch" ADD CONSTRAINT "AmbulanceDispatch_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmbulanceDispatch" ADD CONSTRAINT "AmbulanceDispatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodDonation" ADD CONSTRAINT "BloodDonation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "BloodDonor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodDonation" ADD CONSTRAINT "BloodDonation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequest" ADD CONSTRAINT "BloodRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarcodeScan" ADD CONSTRAINT "BarcodeScan_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarcodeScan" ADD CONSTRAINT "BarcodeScan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
