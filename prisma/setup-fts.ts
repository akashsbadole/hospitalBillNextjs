import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('[FTS] Setting up full-text search indexes...')

  const tables = ['Patient', 'Invoice', 'Prescription', 'Appointment', 'Doctor', 'Medicine'] as const

  for (const table of tables) {
    console.log(`[FTS] Processing ${table}...`)
    await prisma.$executeRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 0`)
  }

  const sql = `
    -- Helper: create tsvector column if missing and index + trigger
    DO $$ DECLARE
      tbl text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY['Patient','Invoice','Prescription','Appointment','Doctor','Medicine'] LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS fts_vector tsvector', tbl);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I USING GIN(fts_vector)',
          'idx_' || lower(tbl) || '_fts', tbl);
      END LOOP;
    END $$;

    -- Patient
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
    CREATE TRIGGER trg_patient_fts BEFORE INSERT OR UPDATE OF name, "patientId", phone, email ON "Patient" FOR EACH ROW EXECUTE FUNCTION patient_fts_update();
    UPDATE "Patient" SET fts_vector =
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce("patientId", '')), 'A') ||
      setweight(to_tsvector('english', coalesce(phone, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(email, '')), 'C') WHERE fts_vector IS NULL;

    -- Invoice
    CREATE OR REPLACE FUNCTION invoice_fts_update() RETURNS trigger AS $$
    BEGIN
      NEW.fts_vector := setweight(to_tsvector('english', coalesce(NEW."invoiceNumber", '')), 'A');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS trg_invoice_fts ON "Invoice";
    CREATE TRIGGER trg_invoice_fts BEFORE INSERT OR UPDATE OF "invoiceNumber" ON "Invoice" FOR EACH ROW EXECUTE FUNCTION invoice_fts_update();
    UPDATE "Invoice" SET fts_vector = setweight(to_tsvector('english', coalesce("invoiceNumber", '')), 'A') WHERE fts_vector IS NULL;

    -- Prescription
    CREATE OR REPLACE FUNCTION prescription_fts_update() RETURNS trigger AS $$
    BEGIN
      NEW.fts_vector :=
        setweight(to_tsvector('english', coalesce(NEW."prescriptionId", '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.diagnosis, '')), 'B');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS trg_prescription_fts ON "Prescription";
    CREATE TRIGGER trg_prescription_fts BEFORE INSERT OR UPDATE OF "prescriptionId", diagnosis ON "Prescription" FOR EACH ROW EXECUTE FUNCTION prescription_fts_update();
    UPDATE "Prescription" SET fts_vector =
      setweight(to_tsvector('english', coalesce("prescriptionId", '')), 'A') ||
      setweight(to_tsvector('english', coalesce(diagnosis, '')), 'B') WHERE fts_vector IS NULL;

    -- Appointment
    CREATE OR REPLACE FUNCTION appointment_fts_update() RETURNS trigger AS $$
    BEGIN
      NEW.fts_vector :=
        setweight(to_tsvector('english', coalesce(NEW."aptId", '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS trg_appointment_fts ON "Appointment";
    CREATE TRIGGER trg_appointment_fts BEFORE INSERT OR UPDATE OF "aptId", notes ON "Appointment" FOR EACH ROW EXECUTE FUNCTION appointment_fts_update();
    UPDATE "Appointment" SET fts_vector =
      setweight(to_tsvector('english', coalesce("aptId", '')), 'A') ||
      setweight(to_tsvector('english', coalesce(notes, '')), 'C') WHERE fts_vector IS NULL;

    -- Doctor
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
    CREATE TRIGGER trg_doctor_fts BEFORE INSERT OR UPDATE OF name, "doctorId", specialization, qualification ON "Doctor" FOR EACH ROW EXECUTE FUNCTION doctor_fts_update();
    UPDATE "Doctor" SET fts_vector =
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce("doctorId", '')), 'A') ||
      setweight(to_tsvector('english', coalesce(specialization, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(qualification, '')), 'C') WHERE fts_vector IS NULL;

    -- Medicine
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
    CREATE TRIGGER trg_medicine_fts BEFORE INSERT OR UPDATE OF name, "medicineId", category, manufacturer ON "Medicine" FOR EACH ROW EXECUTE FUNCTION medicine_fts_update();
    UPDATE "Medicine" SET fts_vector =
      setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce("medicineId", '')), 'A') ||
      setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(manufacturer, '')), 'C') WHERE fts_vector IS NULL;
  `

  await prisma.$executeRawUnsafe(sql)
  console.log('[FTS] Full-text search setup complete.')
}

main()
  .catch((e) => {
    console.error('[FTS] Error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
