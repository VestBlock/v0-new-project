import { expect, test } from '@playwright/test'

test.setTimeout(90_000)

test.describe('Gate 4C public platform and customer workspace', () => {
  test('homepage explains the four lanes and routes Real Estate to its hub', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Find your next move.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Real Estate', exact: true }).first()).toHaveAttribute('href', '/real-estate')
    await expect(page.getByRole('heading', { name: 'What are you trying to do next?' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Four lanes. One connected account.' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText('See every Deals option')
  })

  test('scenario selector previews the correct role and saves guest continuity', async ({ page }) => {
    await page.goto('/#choose-your-path', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /Find, buy, or finance a property/ }).click()
    await expect(page.getByText('Recommended lane').locator('..').getByText('Real Estate')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Set my property criteria' })).toHaveAttribute('href', '/real-estate')
    await page.getByRole('link', { name: 'Set my property criteria' }).click()
    await expect(page).toHaveURL(/\/real-estate$/)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('vestblock:selected-scenario'))).toBe('property')
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
    await page.goto('/next-move?focus=buy-property', { waitUntil: 'domcontentloaded' })
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

  test('hero has robust media states and reduced-motion fallback', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.vb-material-hero__fallback--desktop')).toBeVisible()
    await expect(page.locator('.vb-material-hero__video')).toBeHidden()
    await context.close()
  })

  test('hero is a framed decision room with four working platform lanes', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.vb-material-hero__scene')).toBeVisible()
    await expect(page.locator('.vb-material-hero__scene')).toHaveCount(1)
    await expect(page.locator('.vb-material-hero__robot')).toBeAttached()
    await page.locator('.vb-material-hero__video').dispatchEvent('loadeddata')
    await expect(page.getByRole('button', { name: /hero scene/i })).toBeVisible()

    const laneNavigation = page.getByRole('navigation', { name: /four platform lanes/i })
    await expect(laneNavigation.getByRole('link')).toHaveCount(4)
    await expect(laneNavigation.getByRole('link', { name: /Capital/ })).toHaveAttribute('href', '/capital')
    await expect(laneNavigation.getByRole('link', { name: /Real Estate/ })).toHaveAttribute('href', '/real-estate')
    await expect(laneNavigation.getByRole('link', { name: /Opportunity/ })).toHaveAttribute('href', '/opportunity')
    await expect(laneNavigation.getByRole('link', { name: /DealVault/ })).toHaveAttribute('href', '/dealvault')

    await page.getByRole('link', { name: /What are you trying to do next/ }).click()
    await expect(page).toHaveURL(/#choose-your-path$/)
    await expect(page.getByRole('heading', { name: 'What are you trying to do next?' })).toBeInViewport()
  })

  test('hero reports a static fallback when motion media fails', async ({ page }) => {
    await page.route(/\/hero\/material-ledger\/(desktop|mobile)\.(webm|mp4)$/, (route) => route.abort())
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.vb-material-hero__scene')).toHaveAttribute('data-media-failed', 'true')
    await expect(page.getByText('Static working reference')).toBeVisible()
    await expect(page.getByRole('button', { name: /hero scene/i })).toHaveCount(0)
    await expect(page.locator('.vb-material-hero__fallback--desktop')).toBeVisible()
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
