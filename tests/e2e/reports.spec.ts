import { test, expect } from '@playwright/test'

test.describe('Reports & Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.fill('input[type="email"]', 'admin@medibill.com')
    await page.fill('input[type="password"]', 'Admin@123')
    await page.click('button[type="submit"]')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60000 })
  })

  test('View and Export Financial Report', async ({ page }) => {
    await page.click('text=Reports')
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()

    await page.click('text=Financial Report')
    await expect(page.getByText('Revenue Summary')).toBeVisible()

    // Check export buttons exist
    await expect(page.getByRole('button', { name: /Export/i })).toBeVisible()
  })
})
