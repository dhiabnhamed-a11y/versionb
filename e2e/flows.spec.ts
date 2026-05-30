import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

const PROJECT_NAME = `E2E Project ${Date.now()}`
const TASK_TITLE = `E2E Task ${Date.now()}`

test('3. Create a new project', async ({ page }) => {
  await page.goto('/dashboard/admin/projects')
  await page.waitForLoadState('networkidle')

  // Wait for page to finish loading (skeleton cards disappear)
  await page.waitForTimeout(1500)

  // Click "New Project" (or "New Campaign" for agency)
  await page.getByRole('button', { name: /New (Project|Campaign|Brief)/i }).click()
  await page.waitForSelector('.modal-backdrop', { state: 'visible', timeout: 5_000 })

  // Handle any required selects (room for INDUSTRY, category+client for AGENCY)
  const requiredSelects = page.locator('.modal select[required]')
  const requiredCount = await requiredSelects.count()
  for (let i = 0; i < requiredCount; i++) {
    const options = requiredSelects.nth(i).locator('option:not([value=""])')
    const optCount = await options.count()
    if (optCount > 0) {
      const value = await options.first().getAttribute('value')
      if (value) await requiredSelects.nth(i).selectOption(value)
    }
  }

  // Fill project name
  await page.locator('.modal input[placeholder*="e.g."]').fill(PROJECT_NAME)

  // Submit
  await page.locator('.modal button[type="submit"]').click()

  // Wait for modal to close (success)
  await page.waitForSelector('.modal-backdrop', { state: 'hidden', timeout: 15_000 })
})

test('4. Create a task inside a project', async ({ page }) => {
  await page.goto('/dashboard/admin/tasks')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // Click "New Task" (or "New Brief")
  await page.getByRole('button', { name: /New (Task|Brief)/i }).click()
  await page.waitForSelector('.modal-backdrop', { state: 'visible', timeout: 5_000 })

  // Select the first non-empty project
  const projectSelect = page.locator('.modal select').first()
  const projectOptions = projectSelect.locator('option:not([value=""])')
  const projectCount = await projectOptions.count()

  if (projectCount === 0) {
    // No project exists — create one inline
    await page.locator('.modal-backdrop').click({ position: { x: 0, y: 0 } })
    await page.waitForSelector('.modal-backdrop', { state: 'hidden', timeout: 3_000 }).catch(() => {})

    await page.goto('/dashboard/admin/projects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    await page.getByRole('button', { name: /New (Project|Campaign|Brief)/i }).click()
    await page.waitForSelector('.modal-backdrop', { state: 'visible', timeout: 5_000 })

    const reqSelects = page.locator('.modal select[required]')
    const reqCount = await reqSelects.count()
    for (let i = 0; i < reqCount; i++) {
      const opts = reqSelects.nth(i).locator('option:not([value=""])')
      const optN = await opts.count()
      if (optN > 0) {
        const val = await opts.first().getAttribute('value')
        if (val) await reqSelects.nth(i).selectOption(val)
      }
    }

    await page.locator('.modal input[placeholder*="e.g."]').fill(`Task Test Project ${Date.now()}`)
    await page.locator('.modal button[type="submit"]').click()
    await page.waitForSelector('.modal-backdrop', { state: 'hidden', timeout: 15_000 })

    // Re-open the tasks page and the modal
    await page.goto('/dashboard/admin/tasks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await page.getByRole('button', { name: /New (Task|Brief)/i }).click()
    await page.waitForSelector('.modal-backdrop', { state: 'visible', timeout: 5_000 })
  }

  // Select first project in the dropdown
  await projectSelect.selectOption({ index: 1 })

  // Fill task title
  await page.getByPlaceholder(/Task title|e\.g\. Homepage/i).fill(TASK_TITLE)

  // Submit
  await page.locator('.modal button[type="submit"]').click()

  // Wait for modal to close
  await page.waitForSelector('.modal-backdrop', { state: 'hidden', timeout: 15_000 })
})

test('5. Navigate to billing/checkout page', async ({ page }) => {
  await page.goto('/billing')
  await page.waitForLoadState('networkidle')

  // Verify the billing page title is visible
  await expect(page.getByRole('heading', { name: /Billing/i })).toBeVisible({ timeout: 15_000 })

  // Verify "Upgrade plan" link exists
  await expect(page.getByRole('link', { name: /Upgrade plan/i })).toBeVisible()

  // Verify click navigates to upgrade page
  await page.getByRole('link', { name: /Upgrade plan/i }).click()
  await expect(page).toHaveURL(/\/billing\/upgrade/, { timeout: 10_000 })
})
