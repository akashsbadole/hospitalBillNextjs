# MediBill Pro 🏥

**Hospital Management System** — A comprehensive, multi-branch hospital management platform built with Next.js 16, TypeScript, and PostgreSQL.

> Live demo credentials: `admin@medibill.com` / `Admin@123`

---

## Features

| Module | Description |
|---|---|
| **Patient Management** | Registration, demographics, medical history, insurance, document tracking |
| **Appointments** | Schedule, reschedule, cancel with calendar view and time-slot management |
| **Billing & Invoicing** | GST-compliant invoices, CGST/SGST/IGST auto-calculation, HSN/SAC codes, PDF exports |
| **Payments** | Cash, UPI, Card, Net Banking, Wallet + Razorpay & PayPal integration |
| **Prescriptions** | Digital prescriptions with dosage, frequency, and duration tracking |
| **OPD/IPD Workflow** | 10-stage visit lifecycle (Registration → Triage → Consultation → Lab → Billed → Discharged) |
| **Queue Management** | Digital token system with priority levels, call/skip/complete, TV display board |
| **Radiology / Imaging** | X-Ray, MRI, CT, Ultrasound with DICOM UID, radiologist findings |
| **Lab Tests** | 22+ test catalog across Hematology, Biochemistry, Microbiology, Pathology |
| **Blood Bank** | Donor management, donation screening, inventory by blood group, cross-match requests |
| **Ambulance Tracking** | Fleet management, dispatch lifecycle, GPS coordinates, fare tracking |
| **Inventory & Pharmacy** | Medicine catalog, batch/expiry tracking, purchase orders, stock movements |
| **Ward & Bed Management** | 7 ward types, 78 beds with occupancy tracking and daily rates |
| **Insurance / TPA** | Cashless & reimbursement claims, policy tracking, multi-company support |
| **Operation Theatre** | OT scheduling, surgery types (Major/Minor/Micro), anesthesia tracking |
| **Consent Forms** | Digital consent capture with templates and witness management |
| **Doctor Scheduling** | Weekly schedules, availability, leave management, fee overrides |
| **Telemedicine** | Video/audio call sessions with Socket.IO real-time signaling |
| **AI Health Analysis** | Symptom checker, drug interaction analysis (Grok/LLM integration) |
| **Support Center** | Internal ticketing with priorities, categories, and reply threads |
| **Feedback** | Patient satisfaction tracking with ratings and staff response workflow |
| **Referrals** | Internal & external doctor referrals with status tracking |
| **Expenses** | Operational expense tracking by category with approval workflow |
| **Waste Disposal** | Biomedical waste management per BMW color-coding rules |
| **TDS Records** | Tax deduction compliance with PAN, section, quarter tracking |
| **Multi-Branch** | 3 branches seeded with tenant-isolated data |
| **RBAC** | 5 roles: Admin, Receptionist, Doctor, Accountant, Pharmacist |
| **Notifications** | In-app + Twilio SMS + AWS SES email notifications |
| **Audit Trail** | Full action logging with IP, user-agent, and module context |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Language** | TypeScript |
| **Database** | PostgreSQL (NeonDB, Supabase, or self-hosted) |
| **ORM** | Prisma 6 |
| **UI** | shadcn/ui + Radix Primitives + Tailwind CSS 4 |
| **State** | Zustand, React Query (TanStack Query) |
| **Charts** | Recharts |
| **Auth** | bcryptjs + jsonwebtoken |
| **Payments** | Razorpay + PayPal SDK |
| **Real-time** | Socket.IO |
| **AI** | Grok API (via z-ai-web-dev-sdk) |
| **SMS/Email** | Twilio + AWS SES |
| **Testing** | Vitest + Playwright |
| **Container** | Docker & Docker Compose |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (local or cloud — [NeonDB](https://neon.tech) recommended)
- npm or bun

### 1. Clone & Install

```bash
git clone <repo-url>
cd medibill-pro
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your database URL and secrets:

```env
DATABASE_URL=postgresql://user:password@host:5432/medibill?sslmode=require
JWT_SECRET=<random-64-char-string>
ENCRYPTION_KEY=<random-32-char-string>
```

### 3. Setup Database

```bash
# Run migrations
npm run db:migrate

# Seed with realistic demo data (40+ tables)
npm run db:seed
```

### 4. Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Credentials

| Role | Email | Password |
|---|---|---|
| **Admin** | admin@medibill.com | Admin@123 |
| Receptionist | receptionist@medibill.com | password123 |
| Doctor | doctor@medibill.com | password123 |
| Accountant | accountant@medibill.com | password123 |
| Pharmacist | pharmacist@medibill.com | password123 |

Full credentials reference → [docs/credentials.md](docs/credentials.md)

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:all` | Start Next.js + WebSocket server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run db:seed` | Seed database with demo data |
| `npm run db:reset` | Drop and recreate database |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript check |

---

## Documentation

- [Credentials Reference](docs/credentials.md) — All login credentials
- [Features Overview](docs/features-overview.md) — Detailed module descriptions
- [User Guide](docs/user-guide.md) — Workflows, role tasks, troubleshooting

---

## Docker

```bash
docker compose up -d
```

Starts: Next.js app (port 3000), WebSocket server (port 3001), PostgreSQL, and optional video service.

---

## API Routes (105 endpoints)

The application exposes **105 API routes** across all modules:

- `/api/auth/*` — Login, logout, refresh, change-password
- `/api/patients/*` — CRUD + search
- `/api/doctors/*`, `/api/staff/*` — Doctor/staff management
- `/api/appointments/*` — Scheduling
- `/api/billing/*`, `/api/payments/*` — Invoices, payments, gateways
- `/api/prescriptions/*` — Digital prescriptions
- `/api/patient-visits/*` — OPD/IPD workflow (10 stages)
- `/api/medicines/*`, `/api/inventory/*` — Pharmacy & stock
- `/api/lab-tests/*` — Catalog & orders
- `/api/imaging/*` — Radiology studies
- `/api/queue/*` — Digital queue tokens
- `/api/ambulance/*` — Fleet & dispatch
- `/api/blood-bank/*` — Donors, donations, inventory, requests
- `/api/beds/*`, `/api/beds/wards/*` — Ward & bed management
- `/api/insurance/*` — Companies & claims
- `/api/expenses/*` — Operational expenses
- `/api/support/*` — Ticketing system
- `/api/feedback/*` — Patient feedback
- `/api/referrals/*` — Doctor referrals
- `/api/waste/*` — Biomedical waste
- `/api/tds/*` — TDS compliance
- `/api/reports/*`, `/api/export/*` — Analytics & exports
- `/api/settings/*` — Clinic & payment config
- `/api/dashboard` — Aggregated KPIs
- `/api/search` — Global search
- `/api/audit-logs` — Audit trail
- `/api/barcode/*` — Barcode scanning
- `/api/ai/*` — AI health analysis
- `/api/calls/*` — Telemedicine sessions

---

## Architecture

```
┌──────────────────────────────────────────────┐
│                   Browser                      │
├──────────────────────────────────────────────┤
│          Next.js 16 (App Router)               │
│  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Pages  │ │  API      │ │ WebSocket    │   │
│  │ (React) │ │ Routes    │ │ Client       │   │
│  └────┬────┘ └────┬─────┘ └──────┬───────┘   │
│       │           │              │           │
├───────┴───────────┴──────────────┴───────────┤
│         Prisma ORM + PostgreSQL                │
│    (NeonDB / Supabase / Self-hosted)           │
└──────────────────────────────────────────────┘
```

- **Multi-tenancy**: Branch-level data isolation via `branchId` tenant filter
- **RBAC**: Route-level access control with role-based API guards
- **Caching**: In-memory branch cache, React Query for frontend caching
- **Real-time**: Socket.IO for queue updates, notifications
- **Security**: CSRF origin validation, rate limiting, Helmet headers, session invalidation on password change, encryption key rotation

---

## Project Structure

```
src/
├── app/                  # Next.js App Router pages & API routes
│   ├── (auth)/           # Auth pages (login)
│   └── api/              # 105 API route handlers
├── components/           # React components
│   ├── ui/               # shadcn/ui primitives
│   └── ...               # Feature components
├── hooks/                # Custom React hooks
├── lib/                  # Utility libraries
│   ├── auth.ts           # bcrypt + JWT
│   ├── api-auth.ts       # API authentication middleware
│   ├── crypto.ts         # AES-256-CBC with key rotation
│   ├── notifications.ts  # Twilio + SES
│   ├── rate-limiter.ts   # IP-based rate limiting
│   ├── sanitize.ts       # XSS prevention
│   └── socket-server.ts  # Socket.IO server
├── store/                # Zustand stores
└── middleware.ts          # CSRF protection
prisma/
├── schema.prisma         # 40+ models
├── seed.ts               # Demo data seeder
└── migrations/           # PostgreSQL migrations
docs/                     # Documentation
tests/                    # Vitest + Playwright tests
```

---

## Seed Data

The seed script populates **40 tables** with realistic Indian hospital data:

```
branches: 3, users: 8, patients: 20, doctors: 8, staff: 8
appointments: 20, invoices: 15, payments: 17, prescriptions: 8
visits: 12, labTests: 22, labOrders: 11, wards: 7, beds: 78
queueTokens: 15, imagingStudies: 5, ambulances: 4, dispatches: 4
bloodDonors: 6, donations: 6, inventory: 8, requests: 4
suppliers: 3, purchaseOrders: 3, stockMovements: 9
insuranceCompanies: 5, claims: 4, expenses: 10
supportTickets: 7, feedback: 7, referrals: 5
wasteDisposals: 4, tdsRecords: 4, surgeries: 4, consents: 4
notifications: 6
```

Run `npm run db:seed` to reset and re-seed.

---

## License

MIT
