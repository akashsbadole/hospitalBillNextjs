# MediBill Pro — Features Overview

## 1. Patient Management
Manage patient records with comprehensive demographics, medical history, insurance details, and document attachments. Supports search by name, phone, or email. Each patient gets a unique `PAT-XXXX` ID.

**Key screens:** Patient List, Patient Profile, Registration

## 2. Doctor & Staff Directory
Directory of all doctors with specializations, qualifications, experience, and consultation fees. Staff records for non-doctor hospital personnel.

**Key screens:** Doctor List, Staff List

## 3. Appointment Scheduling
Schedule, reschedule, and cancel appointments. Supports multiple statuses (Scheduled, Completed, Cancelled, No-Show) and types (Consultation, Follow-up, Emergency). Linked to patient and doctor records.

**Key screens:** Appointment Calendar, Appointment List

## 4. Billing & Invoicing
Generate GST-compliant invoices with line items, automatic CGST/SGST/IGST calculation, HSN/SAC codes, discounts, and round-off. Supports paid, unpaid, partially-paid, and overdue statuses. Invoice PDF generation.

**Key screens:** Invoice List, Create Invoice, Invoice Detail

## 5. Payments & Reconciliation
Record payments against invoices with multiple methods: Cash, UPI, Card, Net Banking, Wallet. Integration with Razorpay and PayPal payment gateways. Receipt generation. Tracks UPI VPA and transaction IDs.

**API endpoints:** `/api/payments/razorpay/*`, `/api/payments/paypal/*`

## 6. Prescriptions
Digital prescriptions with medicine name, dosage, frequency, and duration. Linked to patient visits and doctors. Supports JSON-formatted medication lists.

**Key screens:** Prescription List, Create Prescription

## 7. Patient Visit Workflow
End-to-end OPD/IPD visit management with 10 stages: Registration → Triage → Waiting → In-Consultation → Lab-Ordered → Lab-Done → Prescribed → Billed → Paid → Discharged. Captures vitals (temperature, BP, pulse, SpO2, weight, height) at each stage.

**Key screens:** Visit Dashboard, Stage Progression, Discharge Summary

## 8. Queue Management (Digital Token)
Digital queue token system by department (General Medicine, Cardiology, etc.). Supports priority levels (Normal, Urgent, Emergency, VIP). Call, skip, and complete tokens with counter assignment. Real-time TV-style display board.

**Key screens:** Queue Dashboard, Queue Display Board

## 9. Radiology / Imaging
Manage imaging studies across modalities: X-Ray, MRI, CT, Ultrasound, Mammography, PET, DEXA, Fluoroscopy. Tracks DICOM Study UIDs, accession numbers, radiologist findings, impression, and contrast usage.

**Key screens:** Imaging List, Study Detail, Imaging Queue

## 10. Ambulance Tracking
Manage ambulance fleet with vehicle details, driver information, and equipment inventory. Track dispatches with real-time status flow: Dispatched → Arrived → Patient-Aboard → At-Destination → Completed.

**Key screens:** Ambulance List, Dispatch Timeline

## 11. Blood Bank
Complete blood bank management:
- **Donors:** Registration, donation history, eligibility tracking
- **Donations:** Blood bag tracking, screening tests (HIV, HBV, HCV, Syphilis, Malaria), expiry management
- **Inventory:** Units available by blood group (A+, A-, B+, B-, AB+, AB-, O+, O-), minimum stock alerts
- **Requests:** Cross-match types, urgency levels, issue tracking

**Key screens:** Blood Bank Dashboard, Donors List, Inventory, Requests

## 12. Barcode / RFID Scanning
Scan barcodes on medicines, patients, invoices, equipment, assets, and blood bags. Look up product information by barcode. Scan history with location and user tracking.

**Key screens:** Barcode Scanner, Scan History

## 13. Inventory & Pharmacy
Medicine catalog with batch tracking, expiry management, purchase price/selling price, GST rates, HSN codes, and minimum stock alerts. Stock movements (purchase, sale, return, adjustment, expiry). Supplier management and purchase order workflow.

**Key screens:** Medicine List, Stock Movements, Suppliers, Purchase Orders

## 14. Lab Tests
Comprehensive lab test catalog (22+ tests) across Hematology, Biochemistry, Microbiology, Radiology, and Pathology. Order lab tests during patient visits, track status (Ordered → Sample Collected → Processing → Completed → Reported), record results with normal range comparison.

**Key screens:** Lab Test Catalog, Lab Orders

## 15. Ward & Bed Management
Manage wards (General, Private, ICU, NICU, Emergency, Maternity) with individual bed tracking. Bed types (Standard, Deluxe, Suite, ICU). Daily rate configuration. Assign patients to beds during IPD admission.

**Key screens:** Ward List, Bed Occupancy View

## 16. Insurance & TPA
Manage insurance companies (Private, Government, TPA, Corporate). Process cashless and reimbursement claims with status tracking: Submitted → Pre-Approved → Approved → Processed → Settled → Rejected. Policy number and deduction tracking.

**Key screens:** Insurance Companies, Claims List

## 17. Expenses
Track operational expenses by category: Rent, Utilities, Salary, Equipment, Supplies, Maintenance, Insurance, Miscellaneous. Approval workflow (Pending → Approved → Rejected → Paid).

**Key screens:** Expense List, Create Expense

## 18. Support Center
Internal ticketing system for hospital staff. Categories: General, Billing, Technical, Appointment, Prescription, Inventory, Account. Priorities: Low, Medium, High, Urgent. Ticket replies with internal/external visibility. Rating and resolution tracking.

**Key screens:** Support Tickets, Ticket Detail

## 19. Patient Feedback
Collect patient feedback with ratings (1-5 stars) and categories (Service, Doctor, Facility, Billing, Wait Time, General). Staff response workflow. Track feedback by visit.

**Key screens:** Feedback List

## 20. Referrals
Internal and external doctor referrals. Track referral status: Pending → Accepted → Completed → Cancelled. Reason and notes documentation.

**Key screens:** Referral List

## 21. Waste Disposal
Biomedical waste management per BMW rules. Waste types: Biomedical, Chemical, General, Sharps, Radioactive. Category colors: Red, Yellow, Blue, White, Black. Disposal methods: Autoclave, Incineration, Chemical Treatment, Landfill. Certificate and vehicle tracking.

**Key screens:** Waste Disposal List

## 22. TDS Records
Tax Deducted at Source compliance tracking. Sections: 194C, 194J, 194I, etc. Quarter-wise and fiscal-year tracking. PAN records, challan numbers, and payment status.

**Key screens:** TDS Records

## 23. Operation Theatre & Surgery
Manage operation theatres with type classification (General, Cardiac, Ortho, Neuro). Schedule surgeries (Emergency, Planned, Day-Care) with categories (Major, Minor, Micro). Anesthesia type tracking. Status flow: Scheduled → In-Progress → Completed → Cancelled.

**Key screens:** OT List, Surgery Schedule

## 24. Consent Forms
Pre-defined consent templates (General, Surgery, Blood Transfusion, Anesthesia). Digital consent capture with witness details. Status tracking: Pending → Signed → Declined.

**Key screens:** Consent Templates, Patient Consents

## 25. Doctor Schedules
Weekly scheduling for doctors with configurable time slots, max appointments, and consultation fee overrides. Supports leave and availability management. Effective date ranges.

**Key screens:** Schedule Management

## 26. Telemedicine / Call Sessions
Video and audio call sessions for telemedicine. Integration with external video service. Session scheduling, duration tracking, diagnosis capture, and rating.

**API endpoints:** `/api/calls/*`
**Socket Server:** Port 3001 (WebSocket)

## 27. AI Health Analysis
AI-powered health analysis using Grok/LLM integration. Features: symptom checker, drug interaction analysis, diagnosis suggestions, health risk assessment. Patient context-aware with visit history.

**API endpoints:** `/api/ai/*`

## 28. Notifications
Multi-channel notifications (in-app + SMS/Email via Twilio/SES). Types: payment received, invoice created, appointment scheduled, lab results, low stock alerts, patient registration, feedback received, workflow stage changes.

**Key screens:** Notification Center (bell icon in header)

## 29. Dashboard & Analytics
Role-based dashboard with key metrics: today's appointments, revenue, patient count, bed occupancy, queue status, pending lab tests, low stock alerts. Visual KPIs and charts.

**Key screens:** Dashboard

## 30. Multi-Branch Support
Multi-tenancy with branch-level data isolation. 3 branches seeded: Main (Mumbai HQ), Andheri, Thane. Each branch has its own patients, inventory, staff, and financial records.

## 31. Role-Based Access Control (RBAC)
5 roles: Admin, Receptionist, Doctor, Accountant, Pharmacist. Granular API-level access control. Branch-level restrictions for non-admin users.

## 32. Reports & Exports
Export invoices, patients, payments, and reports in PDF/CSV. GST reports for compliance. Audit log with user, action, module, IP address, and user-agent tracking.

**API endpoints:** `/api/export/*`, `/api/reports/*`
