import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test.describe('unified VestBlock experience', () => {
  test('home uses a stable branded hero and customer language', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: /find your next move/i })).toBeVisible();
    await expect(page.getByAltText('VestBlock VB monogram')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByText(/machinery|existing workflow|rebrand/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  for (const route of [
    { path: '/capital', heading: /capital for the move/i },
    { path: '/deals', heading: /enter the deal/i },
    { path: '/opportunities', heading: /useful options/i },
  ]) {
    test(`${route.path} explains inputs and next steps`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
      await expect(page.getByText('What you provide', { exact: true })).toBeVisible();
      await expect(page.getByText('What happens next', { exact: true })).toBeVisible();
      await expect(page.getByText('Proof and boundaries', { exact: true })).toBeVisible();
    });
  }

  test('Get Started is a three-choice decision path', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/get-started', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: /what do you need to move forward/i })).toBeVisible();
    await expect(page.locator('main article')).toHaveCount(3);
    await expectNoHorizontalOverflow(page);
  });

  test('DealVault and auth stay inside the mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dealvault', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: /pick up where you left off/i })).toBeVisible();
    await expect(page.locator('a button, button a')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
