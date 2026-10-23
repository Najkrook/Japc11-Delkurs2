import { test, expect } from '@playwright/test';

test('real browser loads through callable, retries failed load, and reopens saved restaurant', async ({
  page,
}) => {
  expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBeTruthy();
  await page.goto('/');
  // Use the real Firebase auth observer; this test does not inject a mock app user or service.
  await page.evaluate(async () => {
    const cloudPath = '/src/cloud.ts';
    const { auth } = await import(/* @vite-ignore */ cloudPath);
    const authPath = '/node_modules/.vite/deps/firebase_auth.js';
    const { signInWithCredential, GoogleAuthProvider } = await import(/* @vite-ignore */ authPath);
    await signInWithCredential(
      auth,
      GoogleAuthProvider.credential(
        JSON.stringify({
          sub: 'sushi-browser-' + Date.now(),
          email: 'browser@example.test',
          email_verified: true,
        }),
      ),
    );
  });
  let failLoad = true;
  await page.route('**/europe-west1/sushi', async (route) => {
    if (failLoad && route.request().method() === 'POST') {
      failLoad = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Temporary failure' } }),
      });
    } else await route.continue();
  });
  await page.locator('[data-course-nav="sushi"]').click();
  await expect(page.getByTestId('sushi-load-error')).toBeVisible();
  await expect(page.getByTestId('sushi-cash-register')).toHaveCount(0);
  await page.getByTestId('sushi-load-error').getByRole('button', { name: 'Försök igen' }).click();
  await expect(page.getByTestId('sushi-cash-register')).toBeVisible();
  await expect(page.getByTestId('sushi-load-error')).toHaveCount(0);
  await expect(page.getByTestId('sushi-spendable-balance')).toContainText('¥ 0');
  await page.reload();
  await expect(page.getByTestId('sushi-cash-register')).toBeVisible();
  await expect(page.getByTestId('sushi-spendable-balance')).toContainText('¥ 0');
});
