import { expect, test } from '@playwright/test';

const publicFunnels = [
  '/funding',
  '/real-estate-funding',
  '/sell',
  '/buyers',
  '/lenders',
  '/property-analyzer',
];

test.describe('public funnel safety', () => {
  for (const path of publicFunnels) {
    test(`${path} renders an actionable public form`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
      await expect(page.locator('body')).not.toContainText(/application error|internal server error/i);
      if (path === '/real-estate-funding') {
        await page.getByRole('button', { name: /DSCR/ }).first().click();
      }
      expect(await page.locator('input, textarea, select, [role="combobox"]').count()).toBeGreaterThan(0);
      expect(await page.getByRole('button').count()).toBeGreaterThan(0);
    });
  }

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1440, height: 1000 },
  ]) {
    test(`brand routes avoid horizontal overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const path of ['/capital', '/deals', '/opportunities']) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${path} overflow`).toBeLessThanOrEqual(1);
      }
    });
  }

  test('mobile navigation traps focus, closes with Escape, and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const trigger = page.getByRole('button', { name: 'Toggle Menu' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Site navigation' });
    const close = dialog.getByRole('button', { name: 'Close navigation' });
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    expect(
      await dialog.evaluate((element) => element.contains(document.activeElement))
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe('API negative paths do not create customer records', () => {
  const invalidPayloadRoutes = [
    '/api/funding-lead',
    '/api/real-estate-lead',
    '/api/sell-lead',
    '/api/buyers/signup',
    '/api/lenders/signup',
    '/api/property-analyzer',
  ];

  for (const path of invalidPayloadRoutes) {
    test(`${path} rejects an empty payload`, async ({ request }) => {
      const response = await request.post(path, { data: {} });
      expect(response.status()).toBe(400);
    });
  }

  test('retired PayPal endpoint stays disabled', async ({ request }) => {
    const response = await request.post('/api/paypal-webhook', { data: {} });
    expect(response.status()).toBe(410);
  });

  test('Resend webhook rejects unsigned requests before configuration checks', async ({ request }) => {
    const response = await request.post('/api/webhooks/resend', { data: {} });
    expect(response.status()).toBe(400);
  });

  test('protected operational endpoints reject anonymous requests', async ({ request }) => {
    const commandCenter = await request.get('/api/admin/command-center');
    expect(commandCenter.status()).toBe(401);

    const executeSql = await request.post('/api/execute-sql', { data: { sql: 'select 1' } });
    expect(executeSql.status()).toBe(401);

    const jobStatus = await request.get('/api/job-status/test-id');
    expect(jobStatus.status()).toBe(401);
  });

  test('unknown routes return a real 404', async ({ request }) => {
    const response = await request.get('/this-route-must-not-exist-finish-audit');
    expect(response.status()).toBe(404);
  });
});
