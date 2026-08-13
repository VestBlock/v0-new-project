import { expect, test } from '@playwright/test'

test.describe('Gate 4B.3 universal account journey', () => {
  test('join preserves a valid originating intent and selected roles', async ({ page }) => {
    await page.goto(
      '/join?next=%2Fdashboard%2Fdealvault&intent=buyer&roles=real_estate_buyer&email=buyer%40example.com',
      { waitUntil: 'domcontentloaded' }
    )

    await expect(page.getByRole('heading', { name: 'Keep every next move connected.' })).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue('buyer@example.com')
    await expect(page.getByLabel('Buy or invest in real estate')).toBeChecked()

    const loginHref = await page.getByRole('link', { name: 'Sign in', exact: true }).getAttribute('href')
    expect(loginHref).toContain('next=%2Fdashboard%2Fdealvault')
    expect(loginHref).toContain('intent=buyer')
    expect(loginHref).toContain('roles=real_estate_buyer')
  })

  test('external and auth-loop return targets are rejected', async ({ page }) => {
    await page.goto('/login?next=https%3A%2F%2Fevil.example%2Fsteal', {
      waitUntil: 'domcontentloaded',
    })
    const joinHref = await page.getByRole('link', { name: 'Sign up' }).getAttribute('href')
    expect(joinHref).toBe('/join')

    await page.goto('/join?next=%2Flogin', { waitUntil: 'domcontentloaded' })
    const loginHref = await page.getByRole('link', { name: 'Sign in', exact: true }).getAttribute('href')
    expect(loginHref).toBe('/login')
  })

  test('guest protected-route access returns to the original path', async ({ page }) => {
    await page.goto('/profile?section=roles', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile%3Fsection%3Droles$/)
  })

  test('callback and post-signup reject invalid unauthenticated requests', async ({ page, request }) => {
    await page.goto('/auth/callback?next=%2Fprofile', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login\?auth_error=invalid_link&next=%2Fprofile$/)
    await expect(page.locator('p[role="alert"]')).toContainText('authentication link is invalid')

    const response = await request.post('/api/auth/post-signup', {
      data: { email: 'spoofed@example.com', userId: 'spoofed' },
    })
    expect(response.status()).toBe(401)
  })

  test('mobile join has no horizontal overflow and exposes every role', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto('/join', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Create account and continue' })).toBeVisible()
    await expect(page.getByLabel('Provide financing')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
