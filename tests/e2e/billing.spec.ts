import { test, expect } from '@playwright/test'

test.describe('Billing & Finance Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="email"]', 'admin@medibill.com')
    await page.fill('input[type="password"]', 'Admin@123')
    await page.click('button[type="submit"]')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60000 })
  })

  test('Create Invoice and Process Payment', async ({ page }) => {
    await page.click('text=Billing')
    await page.click('text=Create Invoice')

    // Select Patient
    await page.click('text=Select Patient')
    await page.fill('input[placeholder="Search patients..."]', 'Arjun')
    await page.click('text=Arjun Malhotra')

    // Add Item
    await page.click('text=Add Item')
    await page.fill('input[placeholder="Description"]', 'Consultation Fee')
    await page.fill('input[name="unitPrice"]', '500')

    await page.click('button:has-text("Create Invoice")')
    await expect(page.getByText('Invoice created successfully')).toBeVisible()

    // Process Payment
    await page.click('text=Record Payment')
    await page.selectOption('select[name="method"]', 'Cash')
    await page.click('button:has-text("Confirm Payment")')
    await expect(page.getByText('Payment recorded successfully')).toBeVisible()
  })
})
