import { test, expect } from '@playwright/test'

test.describe('Patient Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="email"]', 'admin@medibill.com')
    await page.fill('input[type="password"]', 'Admin@123')
    await page.click('button[type="submit"]')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60000 })
  })

  test('Register and advance patient visit', async ({ page }) => {
    // 1. Register Patient
    await page.click('text=Patients')
    await page.click('text=Register Patient')
    const patientName = `Test Patient ${Date.now()}`
    await page.fill('input[name="name"]', patientName)
    await page.fill('input[name="phone"]', '9876543210')
    await page.click('button[type="submit"]')
    await expect(page.getByText('Patient registered successfully')).toBeVisible()

    // 2. Start Visit
    await page.click('text=Workflow')
    await page.click('text=Start Visit')
    await page.click('text=Select Patient')
    await page.fill('input[placeholder="Search patients..."]', patientName)
    await page.click(`text=${patientName}`)
    await page.fill('textarea[name="chiefComplaint"]', 'Test complaint')
    await page.click('button:has-text("Start Patient Visit")')
    await expect(page.getByText('Visit started successfully')).toBeVisible()

    // 3. Advance to Triage
    const visitCard = page.locator('div.border.rounded-lg', { hasText: patientName }).first()
    await visitCard.getByRole('button', { name: 'Advance' }).click()
    await expect(page.getByText('Visit advanced to Triage')).toBeVisible()

    // 4. Advance to Waiting
    await visitCard.getByRole('button', { name: 'Advance' }).click()
    await expect(page.getByText('Visit advanced to Waiting')).toBeVisible()

    // 5. Complete Consult and Advance
    await visitCard.getByRole('button', { name: 'Advance' }).click() // To In-Consultation
    await visitCard.getByRole('button', { name: 'Advance' }).click() // To Prescribed (assuming simple advance)

    // 6. Discharge
    await page.click('text=Workflow')
    const card = page.locator('div.border.rounded-lg', { hasText: patientName }).first()
    await card.click() // Open details or menu
    await page.click('text=Discharge Patient')
    await page.click('button:has-text("Confirm Discharge")')
    await expect(page.getByText('Patient discharged successfully')).toBeVisible()
  })
})
