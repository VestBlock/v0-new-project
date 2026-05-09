import { expect, test, type Page } from '@playwright/test';

function isVercelAuthUrl(url: string) {
  return url.startsWith('https://vercel.com/login');
}

async function expectGuestGate(page: Page, path: string, appLoginPattern: RegExp) {
  await page.goto(path);

  if (isVercelAuthUrl(page.url())) {
    await expect(page.getByRole('heading', { name: /log in to vercel/i })).toBeVisible();
    return;
  }

  await expect(page).toHaveURL(appLoginPattern);
}

test.describe('VestBlock smoke coverage', () => {
  test('public growth pages render', async ({ page }) => {
    await page.goto('/visibility-expansion');

    if (isVercelAuthUrl(page.url())) {
      await expect(page.getByRole('heading', { name: /log in to vercel/i })).toBeVisible();
      return;
    }

    await expect(
      page.getByRole('heading', {
        name: /show up in more places when people search for what you sell/i,
      })
    ).toBeVisible();

    await page.goto('/ai-assistant');
    await expect(
      page.getByRole('heading', {
        name: /ai receptionist, booking, and website improvements for service businesses/i,
      })
    ).toBeVisible();

    await page.goto('/funding');
    await expect(
      page.getByRole('heading', { name: /check business funding eligibility free/i })
    ).toBeVisible();
  });

  test('protected flows redirect guests', async ({ page }) => {
    await expectGuestGate(page, '/chat', /\/login\?redirect=%2Fchat$/);
    await expectGuestGate(page, '/credit-upload', /\/login\?redirect=%2Fcredit-upload$/);
    await expectGuestGate(page, '/user-hub', /\/login\?redirect=%2Fuser-hub$/);
    await expectGuestGate(
      page,
      '/dashboard/services',
      /\/login\?redirect=%2Fdashboard%2Fservices$/
    );
  });

  test('health and chat history endpoints behave for guests', async ({ request }) => {
    const health = await request.get('/api/health');

    if (health.status() === 401) {
      const previewGate = await health.text();
      expect(previewGate.toLowerCase()).toContain('vercel');
      return;
    }

    expect([200, 503]).toContain(health.status());
    const healthJson = await health.json();
    expect(['healthy', 'degraded']).toContain(healthJson.status);

    const chatHistory = await request.get('/api/chat/history');
    expect(chatHistory.status()).toBe(401);

    const documents = await request.get('/api/documents');
    expect(documents.status()).toBe(401);

    const deliverables = await request.get('/api/service-deliverables');
    expect(deliverables.status()).toBe(401);
  });
});
