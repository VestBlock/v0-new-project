import { expect, test, type Page } from '@playwright/test';

function watchRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (error.message.includes('due to access control checks')) return;
    errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      if (message.text().startsWith('Failed to fetch RSC payload')) return;
      const location = message.location().url;
      errors.push(`${message.text()}${location ? ` @ ${location}` : ''}`);
    }
  });
  return errors;
}

test('homepage explains the platform and exposes the three primary paths', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Find your next move.' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Find capital/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Find deals/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore opportunities/i }).first()).toBeVisible();
  await expect(page.getByRole('navigation').first()).toContainText('DealVault');
  expect(errors).toEqual([]);
});

for (const [path, heading] of [
  ['/capital', 'Capital for the move in front of you.'],
  ['/deals', 'Analyze the deal before you chase it.'],
  ['/opportunities', 'Useful options beyond the obvious path.'],
] as const) {
  test(`${path} routes into working VestBlock tools`, async ({ page }) => {
    const errors = watchRuntimeErrors(page);
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.locator('main a[href]').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('DealVault keeps live proof and demo routes visible', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto('/dealvault');
  await expect(page.getByRole('heading', { name: /Cleaner records for deals/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Request Private Demo/i }).first()).toBeVisible();
  await expect(page.getByText(/Live contract layer/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('onboarding and auth present clear, labeled choices without submission', async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto('/get-started');
  await expect(page.getByRole('heading', { name: /Tell us where you're trying to go/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Find capital' })).toBeVisible();

  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();

  await page.goto('/register');
  await expect(page.getByLabel('Full name')).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation is usable, dismissible, and does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = watchRuntimeErrors(page);
  await page.goto('/');

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await page.getByRole('button', { name: 'Toggle Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Site navigation' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Capital' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Site navigation' })).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  expect(errors).toEqual([]);
});

test('reduced motion preserves the homepage content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = watchRuntimeErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find your next move.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Three doors. One platform.' })).toBeVisible();
  expect(errors).toEqual([]);
});
