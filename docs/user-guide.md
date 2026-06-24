# MediBill Pro — User Guide

## Getting Started

### Accessing the Application
1. Open your browser and navigate to the application URL
2. You'll see the login page with email and password fields
3. Enter your credentials (see [Credentials](credentials.md))
4. Click **Login**

### Login Credentials
| Role | Email | Password |
|---|---|---|
| System Admin | admin@medibill.com | Admin@123 |
| Receptionist | receptionist@medibill.com | password123 |
| Doctor | doctor@medibill.com | password123 |
| Accountant | accountant@medibill.com | password123 |
| Pharmacist | pharmacist@medibill.com | password123 |

### Dashboard Overview
After login, you'll see the dashboard showing:
- **Today's Appointments** — count and upcoming slots
- **Revenue Overview** — today's collections and pending
- **Patient Queue** — current waiting patients by department
- **Bed Occupancy** — available vs occupied beds
- **Notifications** — recent alerts and updates
- **Quick Actions** — common tasks (New Patient, New Appointment, etc.)

### Navigation
Use the sidebar on the left to navigate between modules:
- **Dashboard** — Main overview
- **Patients** — Patient management
- **Appointments** — Schedule management
- **Billing** — Invoices and payments
- **Prescriptions** — Medication orders
- **Inventory** — Medicines and supplies
- **Queue** — Digital token system
- **Lab Tests** — Test catalog and orders
- **Imaging** — Radiology studies
- **Blood Bank** — Donor and inventory management
- **Ambulance** — Fleet and dispatch tracking
- **OT & Surgery** — Operation theatre management
- **Settings** — Clinic configuration

**Keyboard Shortcuts:**
| Shortcut | Action |
|---|---|
| Ctrl+1-8 | Navigate to sidebar items 1-8 |
| Ctrl+G | Focus global search |
| ? | Show keyboard shortcuts help |

---

## Common Workflows

### 1. Register a New Patient
1. Click **Patients** in the sidebar
2. Click **Add Patient** button
3. Fill in patient details (name, phone, date of birth, gender, blood group, address)
4. Add optional info: emergency contact, allergies, insurance, Aadhaar
5. Click **Save** — patient is registered with a unique PAT-XXXX ID

### 2. Schedule an Appointment
1. Click **Appointments** in the sidebar
2. Click **New Appointment**
3. Search and select the patient
4. Select the doctor, date, and time slot
5. Choose appointment type (Consultation/Follow-up/Emergency)
6. Click **Schedule**

### 3. Start a Patient Visit (OPD Workflow)
The visit workflow guides patients through 10 stages:

1. **Registration** — Receptionist registers patient arrival
2. **Triage** — Nurse records vitals (temperature, BP, pulse, SpO2, weight)
3. **Waiting** — Patient waits for doctor
4. **In-Consultation** — Doctor examines patient
5. **Lab-Ordered** — Doctor orders lab tests (if needed)
6. **Lab-Done** — Lab results available
7. **Prescribed** — Doctor writes prescription
8. **Billed** — Invoice generated
9. **Paid** — Payment recorded
10. **Discharged** — Visit completed

To advance a visit stage, click the **Advance Stage** button on the visit detail page.

### 4. Generate an Invoice
1. Go to **Billing** → **New Invoice**
2. Select the patient
3. Add line items (services, medicines, lab tests)
4. Each item auto-calculates GST based on the GST rate
5. Apply discount if needed (flat or percentage)
6. Review the grand total
7. Click **Generate Invoice**
8. Invoice PDF can be downloaded from the invoice detail page

### 5. Record a Payment
1. Open the invoice from **Billing**
2. Click **Record Payment**
3. Enter amount and select payment method (Cash, UPI, Card, Net Banking, Wallet)
4. For UPI payments, enter VPA and transaction ID
5. Click **Submit** — payment is recorded and invoice status updates

### 6. Write a Prescription
1. Go to **Prescriptions** → **New Prescription**
2. Select patient and doctor
3. Enter diagnosis
4. Add medicines with:
   - Medicine name
   - Dosage (e.g., "1 tablet")
   - Frequency (e.g., "Twice daily after meals")
   - Duration (e.g., "7 days")
5. Add multiple medicines as needed
6. Click **Save**

### 7. Issue a Queue Token
1. Go to **Queue** in the sidebar
2. Click **Issue Token**
3. Select patient and department
4. Choose priority (Normal/Urgent/Emergency/VIP)
5. Token is issued with a number and appears on the waiting list
6. Use **Call Next** to call the next waiting patient
7. The **Display Board** view shows the current queue on large screens/TVs

### 8. Order Lab Tests
1. Open a patient visit
2. Go to the **Lab Orders** section
3. Click **Order Test**
4. Select tests from the catalog (CBC, Blood Sugar, Lipid Profile, etc.)
5. Tests appear in the lab queue with status "Ordered"
6. When results are available, update status to "Completed" and enter results

### 9. Manage Medicine Inventory
1. Go to **Inventory** → **Medicines**
2. View stock levels, batch numbers, and expiry dates
3. Low-stock items are highlighted in red
4. To add stock: Create a **Purchase Order** from **Suppliers**
5. Receive the order to automatically update stock and create a stock movement record

### 10. Use the Blood Bank
1. **Donors Tab** — Register new donors, view donation history
2. **Inventory Tab** — Check available units by blood group
3. **Requests Tab** — Process blood requests:
   - Select patient, doctor, blood group
   - Set urgency (Normal/Urgent/Emergency)
   - Track status: Pending → Approved → Crossmatched → Issued
4. **Donations Tab** — Record new donations with screening test results

### 11. Dispatch an Ambulance
1. Go to **Ambulance**
2. Click **New Dispatch**
3. Select the ambulance vehicle
4. Enter pickup location and destination
5. Set dispatch type (Emergency/Transfer/Discharge)
6. Dispatch tracks through: Dispatched → Arrived → Patient-Aboard → At-Destination → Completed

### 12. Track Radiology / Imaging
1. Go to **Imaging**
2. View all studies ordered across modalities
3. Click a study to see details: clinical history, findings, impression
4. Update status as the study progresses: Ordered → Scheduled → In-Progress → Completed → Reviewed → Reported

---

## Role-Specific Tasks

### Admin
- Full access to all modules
- User management (create/edit staff accounts)
- Clinic settings configuration
- Report generation and export
- Support ticket assignment and resolution

### Receptionist
- Register new patients
- Schedule appointments
- Issue queue tokens
- Start patient visits
- Manage support tickets (create/reply)

### Doctor
- View appointments and patient visits
- Record consultation notes and diagnosis
- Order lab tests and imaging studies
- Write prescriptions
- View patient history and past visits
- Refer patients to other doctors

### Accountant
- Generate and manage invoices
- Record payments
- Manage expenses
- TDS record keeping
- GST report generation
- Payment gateway settings (API keys)
- View financial reports

### Pharmacist
- Manage medicine inventory
- Process purchase orders
- View prescriptions
- Track stock movements
- Manage suppliers
- Monitor low-stock alerts

---

## Troubleshooting

### Login Issues
- Ensure Caps Lock is off
- Check that you're using the correct email and password
- Passwords are case-sensitive
- Contact admin if account is locked

### Slow Performance
- Large datasets may take a moment to load
- Use the search bar for specific patients/invoices
- Apply date filters on report pages
- Check your internet connection

### Data Export
- Go to the **Reports** section
- Select the report type (Patients, Invoices, Payments, GST)
- Choose date range
- Click **Export** to download as PDF or CSV

### Getting Help
- Use the **Support** module to create a support ticket
- Tickets can be categorized by issue type
- Track ticket status and responses
- Admin will be notified of new tickets

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` through `Ctrl+8` | Navigate to first 8 sidebar items |
| `Ctrl+G` | Focus the global search bar |
| `?` (question mark) | Toggle keyboard shortcuts help dialog |
| `Tab` | Navigate to skip-to-content link (first focusable element) |

## Security Notes
- Always log out when leaving your workstation
- Passwords are hashed with bcrypt (12 rounds)
- Session tokens expire after 24 hours
- API requests are rate-limited (5 req/min for login)
- All changes are logged in the audit trail
- Password changes invalidate all existing sessions

## System Requirements
- Modern web browser (Chrome 90+, Firefox 88+, Edge 90+, Safari 14+)
- Internet connection
- Screen resolution: 1280x720 or higher recommended
- For video calls: camera, microphone, and WebRTC-compatible browser
