import { test, expect } from '@playwright/test'

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="email"]', 'admin@medibill.com')
    await page.fill('input[type="password"]', 'Admin@123')
    await page.click('button[type="submit"]')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60000 })
  })

  test('Add Stock and Check Movement', async ({ page }) => {
    await page.click('text=Inventory')
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()

    await page.click('text=Stock Movements')
    await page.click('text=Add Movement')

    // Select Medicine
    await page.click('text=Select Medicine')
    await page.fill('input[placeholder="Search medicines..."]', 'Paracetamol')
    await page.click('text=Paracetamol 500mg')

    await page.fill('input[name="quantity"]', '50')
    await page.selectOption('select[name="type"]', 'Adjustment')

    await page.click('button:has-text("Save Movement")')
    await expect(page.getByText('Stock movement recorded successfully')).toBeVisible()
  })
})
