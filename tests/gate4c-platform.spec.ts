import { expect, test } from '@playwright/test'

test.setTimeout(90_000)

test.describe('Gate 4C public platform and customer workspace', () => {
  test('homepage explains the three paths and routes each public hub', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Find your next move.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Capital', exact: true }).first()).toHaveAttribute('href', '/capital')
    await expect(page.getByRole('link', { name: 'Deals', exact: true }).first()).toHaveAttribute('href', '/real-estate')
    await expect(page.getByRole('link', { name: 'Opportunity', exact: true }).first()).toHaveAttribute('href', '/opportunity')
    await expect(page.getByRole('heading', { name: 'Where do you want to move forward?' })).toBeVisible()
    await expect(page.getByText('Three paths · one coordinated platform')).toBeVisible()
  })

  test('path selector previews Deals and saves guest continuity', async ({ page }) => {
    await page.goto('/#choose-your-path', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Deals/ }).click()
    await expect(page.getByRole('heading', { name: 'Evaluate, finance, buy, or sell real estate' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Explore real estate deals/ })).toHaveAttribute('href', '/real-estate')
    await page.getByRole('link', { name: /Explore real estate deals/ }).click()
    await expect(page).toHaveURL(/\/real-estate$/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('vestblock:selected-homepage-goal'))).toBe('deals')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('vestblock:active-lane'))).toBe('real-estate')
  })

  for (const route of [
    { path: '/capital', heading: /Build a clearer path to the capital/ },
    { path: '/real-estate', heading: /Bring buyers, sellers, capital/ },
    { path: '/opportunity', heading: /Turn a goal into an ordered/ },
    { path: '/dealvault', heading: /Cleaner records for deals/ },
  ]) {
    test(`${route.path} is a meaningful guest hub`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible()
      await expect(page.getByRole('link').filter({ hasText: /workspace|demo|roadmap|path/i }).first()).toBeVisible()
    })
  }

  test('questionnaire resumes non-sensitive planning fields without contact data', async ({ page }) => {
    await page.goto('/next-move?focus=buy-property', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Continue/ }).click()
    await page.getByLabel('Main obstacle').fill('Need a clear acquisition plan')
    await page.getByLabel('Useful context (optional)').fill('Duplex in Milwaukee')
    await page.waitForTimeout(650)
    const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('vestblock:next-move-draft') || '{}'))
    expect(draft.focus).toBe('buy-property')
    expect(draft.mainObstacle).toBe('Need a clear acquisition plan')
    expect(draft).not.toHaveProperty('email')
    expect(draft).not.toHaveProperty('phone')
    expect(draft).not.toHaveProperty('firstName')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByLabel('Main obstacle')).toHaveValue('Need a clear acquisition plan')
    await expect(page.getByLabel('Useful context (optional)')).toHaveValue('Duplex in Milwaukee')
  })

  test('workspace and its API preserve return intent for guests', async ({ page, request }) => {
    await page.goto('/workspace?section=criteria', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login\?redirect=%2Fworkspace%3Fsection%3Dcriteria$/)
    const response = await request.patch('/api/workspace', { data: { activeLane: 'capital' } })
    expect(response.status()).toBe(401)
  })

  test('hero keeps a static decision example when reduced motion is requested', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.vb-decision-console')).toBeVisible()
    await expect(page.getByText('Example next-step plan')).toBeVisible()
    await expect(page.getByRole('link', { name: /Get my free next-step plan/ }).first()).toHaveAttribute('href', '/next-move')
    await context.close()
  })

  test('hero is a framed next-step example with a working three-path handoff', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.vb-decision-console')).toBeVisible()
    await expect(page.locator('.vb-decision-console')).toHaveCount(1)
    await expect(page.getByText('Prepare for business capital')).toBeVisible()
    await page.getByRole('link', { name: /Explore the three paths/ }).click()
    await expect(page).toHaveURL(/#choose-your-path$/)
    await expect(page.getByRole('heading', { name: 'Where do you want to move forward?' })).toBeInViewport()
  })

  test('public surfaces have no horizontal overflow at phone and tablet widths', async ({ page }) => {
    for (const width of [390, 1024]) {
      await page.setViewportSize({ width, height: 900 })
      for (const route of ['/', '/capital', '/real-estate', '/opportunity']) {
        await page.goto(route, { waitUntil: 'domcontentloaded' })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${route} at ${width}px`).toBe(0)
      }
    }
  })
})
