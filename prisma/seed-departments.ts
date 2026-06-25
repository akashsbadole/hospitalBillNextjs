import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const DEPARTMENTS = [
  { name: 'General Medicine', code: 'GEN', sortOrder: 1 },
  { name: 'Cardiology', code: 'CARD', sortOrder: 2 },
  { name: 'Orthopedics', code: 'ORTH', sortOrder: 3 },
  { name: 'Pediatrics', code: 'PED', sortOrder: 4 },
  { name: 'Gynecology', code: 'GYN', sortOrder: 5 },
  { name: 'Dermatology', code: 'DERM', sortOrder: 6 },
  { name: 'ENT', code: 'ENT', sortOrder: 7 },
  { name: 'Ophthalmology', code: 'OPHTH', sortOrder: 8 },
  { name: 'Neurology', code: 'NEURO', sortOrder: 9 },
  { name: 'Psychiatry', code: 'PSYCH', sortOrder: 10 },
  { name: 'Radiology', code: 'RAD', sortOrder: 11 },
  { name: 'Pathology', code: 'PATH', sortOrder: 12 },
  { name: 'Urology', code: 'URO', sortOrder: 13 },
  { name: 'Nephrology', code: 'NEPH', sortOrder: 14 },
  { name: 'Gastroenterology', code: 'GASTRO', sortOrder: 15 },
  { name: 'Pulmonology', code: 'PULM', sortOrder: 16 },
  { name: 'Endocrinology', code: 'ENDO', sortOrder: 17 },
  { name: 'Oncology', code: 'ONC', sortOrder: 18 },
  { name: 'Emergency Medicine', code: 'ER', sortOrder: 19 },
  { name: 'Anesthesiology', code: 'ANES', sortOrder: 20 },
  { name: 'Surgery (General)', code: 'SURG', sortOrder: 21 },
  { name: 'ICU / Critical Care', code: 'ICU', sortOrder: 22 },
]

async function main() {
  console.log('Seeding departments...')

  let created = 0
  let skipped = 0

  for (const dept of DEPARTMENTS) {
    const existing = await db.department.findUnique({ where: { name: dept.name } })
    if (existing) {
      skipped++
      continue
    }
    await db.department.create({
      data: {
        name: dept.name,
        code: dept.code,
        description: null,
        sortOrder: dept.sortOrder,
        isActive: true,
      },
    })
    created++
    console.log(`  + ${dept.name} (${dept.code})`)
  }

  console.log(`\nDone. ${created} created, ${skipped} already existed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
