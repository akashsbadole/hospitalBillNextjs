-- Full-Text Search setup for MediBill Pro
-- Adds tsvector columns and GIN indexes for PostgreSQL full-text search
-- Replaces ILIKE %...% pattern matching with ranked full-text search

-- ============================================================
-- Helper: language config for medical/english search
-- ============================================================
-- Use 'english' as base; medical terms are treated as simple tokens

-- ============================================================
-- 1. PATIENT full-text search
-- ============================================================
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS fts_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_patient_fts ON "Patient" USING GIN(fts_vector);

CREATE OR REPLACE FUNCTION patient_fts_update() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."patientId", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.phone, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.email, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_fts ON "Patient";
CREATE TRIGGER trg_patient_fts
  BEFORE INSERT OR UPDATE OF name, "patientId", phone, email
  ON "Patient"
  FOR EACH ROW EXECUTE FUNCTION patient_fts_update();

-- Backfill existing rows
UPDATE "Patient" SET fts_vector = setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce("patientId", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(phone, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'C');

-- ============================================================
-- 2. INVOICE full-text search
-- ============================================================
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS fts_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_invoice_fts ON "Invoice" USING GIN(fts_vector);

CREATE OR REPLACE FUNCTION invoice_fts_update() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('english', coalesce(NEW."invoiceNumber", '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_fts ON "Invoice";
CREATE TRIGGER trg_invoice_fts
  BEFORE INSERT OR UPDATE OF "invoiceNumber"
  ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION invoice_fts_update();

UPDATE "Invoice" SET fts_vector = setweight(to_tsvector('english', coalesce("invoiceNumber", '')), 'A');

-- ============================================================
-- 3. PRESCRIPTION full-text search
-- ============================================================
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS fts_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_prescription_fts ON "Prescription" USING GIN(fts_vector);

CREATE OR REPLACE FUNCTION prescription_fts_update() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('english', coalesce(NEW."prescriptionId", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.diagnosis, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prescription_fts ON "Prescription";
CREATE TRIGGER trg_prescription_fts
  BEFORE INSERT OR UPDATE OF "prescriptionId", diagnosis
  ON "Prescription"
  FOR EACH ROW EXECUTE FUNCTION prescription_fts_update();

UPDATE "Prescription" SET fts_vector =
  setweight(to_tsvector('english', coalesce("prescriptionId", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(diagnosis, '')), 'B');

-- ============================================================
-- 4. APPOINTMENT full-text search
-- ============================================================
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS fts_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_appointment_fts ON "Appointment" USING GIN(fts_vector);

CREATE OR REPLACE FUNCTION appointment_fts_update() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('english', coalesce(NEW."aptId", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointment_fts ON "Appointment";
CREATE TRIGGER trg_appointment_fts
  BEFORE INSERT OR UPDATE OF "aptId", notes
  ON "Appointment"
  FOR EACH ROW EXECUTE FUNCTION appointment_fts_update();

UPDATE "Appointment" SET fts_vector =
  setweight(to_tsvector('english', coalesce("aptId", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(notes, '')), 'C');

-- ============================================================
-- 5. DOCTOR full-text search
-- ============================================================
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS fts_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_doctor_fts ON "Doctor" USING GIN(fts_vector);

CREATE OR REPLACE FUNCTION doctor_fts_update() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."doctorId", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.specialization, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.qualification, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doctor_fts ON "Doctor";
CREATE TRIGGER trg_doctor_fts
  BEFORE INSERT OR UPDATE OF name, "doctorId", specialization, qualification
  ON "Doctor"
  FOR EACH ROW EXECUTE FUNCTION doctor_fts_update();

UPDATE "Doctor" SET fts_vector =
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce("doctorId", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(specialization, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(qualification, '')), 'C');

-- ============================================================
-- 6. MEDICINE full-text search
-- ============================================================
ALTER TABLE "Medicine" ADD COLUMN IF NOT EXISTS fts_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_medicine_fts ON "Medicine" USING GIN(fts_vector);

CREATE OR REPLACE FUNCTION medicine_fts_update() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."medicineId", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.manufacturer, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_medicine_fts ON "Medicine";
CREATE TRIGGER trg_medicine_fts
  BEFORE INSERT OR UPDATE OF name, "medicineId", category, manufacturer
  ON "Medicine"
  FOR EACH ROW EXECUTE FUNCTION medicine_fts_update();

UPDATE "Medicine" SET fts_vector =
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce("medicineId", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(manufacturer, '')), 'C');
