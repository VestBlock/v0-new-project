import { expect, test } from '@playwright/test'

test.setTimeout(90_000)

test.describe('Gate 4C public platform and customer workspace', () => {
  test('homepage explains the three paths and routes each public hub', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#homepage-hero-title')).toHaveText('Find your next move.')
    await expect(page.locator('main h1')).toHaveCount(1)

    const hero = page.locator('#homepage-hero-title').locator('xpath=ancestor::section[1]')
    await expect(hero.locator('a[data-home-primary-cta]')).toHaveAttribute('href', '/next-move')

    const directory = page.locator('#choose-your-path')
    await expect(directory).toBeVisible()
    for (const path of [
      { id: 'funding', label: 'Funding', href: '/capital' },
      { id: 'real-estate', label: 'Deals', href: '/real-estate' },
      { id: 'opportunity', label: 'Opportunity', href: '/opportunity' },
    ]) {
      const card = directory.locator(`[data-home-path="${path.id}"]`)
      await expect(card).toBeVisible()
      await expect(card).toContainText(path.label, { ignoreCase: true })
      await expect(card.locator(`a[href="${path.href}"]`).first()).toBeVisible()
    }
  })

  test('all three homepage paths remain visible on mobile and route directly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/#choose-your-path', { waitUntil: 'networkidle' })

    const directory = page.locator('#choose-your-path')
    const cards = directory.locator('[data-home-path]')
    await expect(cards).toHaveCount(3)
    for (let index = 0; index < 3; index += 1) await expect(cards.nth(index)).toBeVisible()

    await directory.locator('[data-home-path="real-estate"] a[href="/real-estate"]').first().click()
    await expect(page).toHaveURL(/\/real-estate$/)
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

  test('homepage preserves its full story with motion reduced', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#homepage-hero-title')).toHaveText('Find your next move.')
    await expect(page.locator('[data-home-steps]')).toBeVisible()
    await expect(page.locator('a[data-home-primary-cta]').first()).toHaveAttribute('href', '/next-move')
    await page.waitForTimeout(250)
    const runningAnimations = await page.evaluate(() => (
      document.querySelector('main')?.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length || 0
    ))
    expect(runningAnimations).toBe(0)
    await context.close()
  })

  test('homepage story moves from paths to explanation, boundaries, DealVault, and one next step', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const sections = [
      '#choose-your-path',
      '[data-home-steps]',
      '[data-home-trust]',
      '[data-home-dealvault]',
      '[data-home-final-cta]',
    ]

    for (const selector of sections) await expect(page.locator(selector)).toBeVisible()
    const explicitSteps = page.locator('[data-home-steps] [data-home-step]')
    if (await explicitSteps.count()) {
      await expect(explicitSteps).toHaveCount(3)
    } else {
      await expect(page.locator('[data-home-steps] ol').first().locator(':scope > li')).toHaveCount(3)
    }
    await expect(page.locator('[data-home-dealvault]')).toContainText('DealVault')
    await expect(page.locator('[data-home-dealvault] a[href^="/dealvault"]').first()).toBeVisible()
    await expect(page.locator('[data-home-final-cta] a[data-home-primary-cta]')).toHaveAttribute('href', '/next-move')

    const inNarrativeOrder = await page.evaluate((orderedSelectors) => {
      const positions = orderedSelectors.map((selector) => {
        const element = document.querySelector(selector)
        return element ? element.getBoundingClientRect().top + window.scrollY : undefined
      })
      return positions.every((position, index) => {
        if (typeof position !== 'number') return false
        if (index === 0) return true
        const previous = positions[index - 1]
        return typeof previous === 'number' && position > previous
      })
    }, sections)
    expect(inNarrativeOrder).toBe(true)
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
