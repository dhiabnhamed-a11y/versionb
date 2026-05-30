import { test as setup } from '@playwright/test'

const AUTH_FILE = '.auth/user.json'

setup('authenticate as demo user', async ({ page }) => {
  await page.goto('/login')
  await page.waitForSelector('#login-email', { state: 'visible' })
  await page.fill('#login-email', 'owner@taskforce.com')
  await page.fill('#login-password', 'password123')
  await page.click('#login-submit')
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 })
  await page.context().storageState({ path: AUTH_FILE })
})
