import { expect, test } from '@playwright/test'
import path from 'node:path'

const route = '/dev/gate-4b2-prototype'
const evidenceDir = path.join(process.cwd(), 'output/playwright/gate-4b2-final')

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-320', width: 320, height: 844 },
]

for (const viewport of viewports) {
  test(`${viewport.name} has no overflow or console errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.setViewportSize(viewport)
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Make your next move with the right context.' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
    await page.screenshot({ path: path.join(evidenceDir, `${viewport.name}.png`), fullPage: false })
  })
}

test('guidance states follow visitor progress and scenarios remain local', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Define the outcome before choosing a service.')).toBeVisible()

  await page.locator('#choose-your-next-move').scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(evidenceDir, 'hero-to-scenario-handoff.png'), fullPage: false })

  const choices = [
    ['Fund or grow a business', 'Fund or grow a business'],
    ['Find, buy, or finance a property', 'Find, buy, or finance a property'],
    ['Sell a property', 'Sell a property'],
    ['Improve credit, income, or readiness', 'Improve credit, income, or readiness'],
    ['Offer capital, inventory, or professional services', 'Offer capital, inventory, or professional services'],
  ]
  for (const [button, heading] of choices) {
    await page.getByRole('button', { name: new RegExp(button) }).click()
    await expect(page.locator('.g42-route-preview h3')).toHaveText(heading)
  }
  await page.locator('.g42-route-preview a').click()
  await expect(page).toHaveURL(new RegExp(`${route}$`))
  await expect(page.locator('.g42-prototype-notice')).not.toBeEmpty()
})

test('mobile navigation traps focus and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  const menuButton = page.getByRole('button', { name: 'Open navigation' })
  await page.waitForTimeout(1000)
  await menuButton.click()
  await expect(menuButton).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('dialog', { name: 'Prototype navigation menu' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Prototype navigation menu' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
})

test('motion control pauses and resumes the owned scene', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  const control = page.getByRole('button', { name: 'Pause hero video' })
  await expect(control).toBeEnabled()
  await control.click()
  await expect.poll(() => page.locator('.g42-hero-video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(true)
  const playControl = page.getByRole('button', { name: 'Play hero video' })
  await expect(playControl).toBeVisible()
  await playControl.evaluate((button: HTMLButtonElement) => button.click())
  await expect.poll(() => page.locator('.g42-hero-video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(false)
})

test('reduced motion uses the still composition', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.g42-hero-poster')).toBeVisible()
  await expect(page.locator('.g42-hero-video')).toBeHidden()
  await page.screenshot({ path: path.join(evidenceDir, 'reduced-motion-mobile.png'), fullPage: false })
  await context.close()
})
