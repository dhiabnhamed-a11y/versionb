import { test, expect } from '@playwright/test'

let testEmail: string
let testPassword: string

test.describe.configure({ mode: 'serial' })

test('1. User signup with email/password', async ({ page }) => {
  testEmail = `e2e-${Date.now()}@example.com`
  testPassword = 'TestPass123!'

  await page.goto('/signup')
  await page.waitForLoadState('networkidle')

  // ----- Welcome: "Start AI setup" -----
  await page.getByRole('button', { name: /Start AI setup/i }).click()
  await page.waitForTimeout(600)

  // ----- Smart Onboarding (7 questions) -----
  // Q1: operating model (single-select)
  await page.getByRole('button', { name: /General business operations/i }).click()
  await page.waitForTimeout(600)

  // Q2: core work (single-select, depends on Q1)
  await page.getByRole('button', { name: /Client delivery and project/i }).click()
  await page.waitForTimeout(600)

  // Q3: team size (single-select)
  await page.getByRole('button', { name: /2 to 10 people/i }).click()
  await page.waitForTimeout(600)

  // Q4: pressure points (multi-select, pick 2 then Continue)
  await page.getByRole('button', { name: /Project and work delivery/i }).click()
  await page.getByRole('button', { name: /Team coordination/i }).click()
  await page.getByRole('button', { name: /Continue/i }).click()
  await page.waitForTimeout(600)

  // Q5: discipline level (single-select)
  await page.getByRole('button', { name: /Standard business operations/i }).click()
  await page.waitForTimeout(600)

  // Q6: day-one systems (multi-select, pick 2 then Continue)
  await page.getByRole('button', { name: /Projects, clients, and approvals/i }).click()
  await page.getByRole('button', { name: /Service queues/i }).click()
  await page.getByRole('button', { name: /Continue/i }).click()
  await page.waitForTimeout(600)

  // Q7: priorities (rank, pick 2 then Continue)
  await page.getByRole('button', { name: /Clarity/i }).click()
  await page.getByRole('button', { name: /Reliability/i }).click()
  await page.getByRole('button', { name: /Continue/i }).click()
  await page.waitForTimeout(600)

  // ----- Recommendation -----
  await page.getByRole('button', { name: /Set up my/i }).click()

  // ----- Generation (auto-completes ~5s) -----
  // Wait for the setup form to render
  await page.waitForSelector('input[autocomplete="name"]', { timeout: 30_000 })

  // ----- Setup Form -----
  await page.locator('input[autocomplete="name"]').fill('E2E Test User')
  await page.locator('input[autocomplete="email"]').fill(testEmail)
  await page.locator('input[autocomplete="new-password"]').fill(testPassword)
  await page.locator('input[autocomplete="organization"]').fill('E2E Test Company')

  const checkboxes = page.locator('input[type="checkbox"]')
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()

  await page.getByRole('button', { name: /Continue/i }).click()
  await page.waitForTimeout(1000)

  // ----- Team Step -----
  await page.getByRole('button', { name: /Skip for now/i }).click()
  await page.waitForTimeout(600)

  // ----- Plan Step -----
  await page.getByRole('button', { name: /Start free trial instead/i }).click()
  await page.waitForTimeout(600)

  // ----- Success -----
  await page.getByRole('button', { name: /Enter Workspace|Enter ERP Workspace/i }).click()
  await page.waitForURL(/\/login/, { timeout: 15_000 })
})

test('2. User login with new credentials', async ({ page }) => {
  await page.goto('/login')
  await page.waitForSelector('#login-email', { state: 'visible' })

  await page.fill('#login-email', testEmail)
  await page.fill('#login-password', testPassword)
  await page.click('#login-submit')

  // Should either reach dashboard or see a registration-pending notice
  await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout: 20_000 }),
    expect(page.locator('.auth-alert-info')).toBeVisible({ timeout: 10_000 }),
  ])
})
