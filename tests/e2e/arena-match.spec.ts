import { test, expect } from '@playwright/test';

test('solo arena advances through five rounds, shows results and starts a fresh match', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('[data-course-nav="arena"]').click();
  await page.getByRole('button', { name: '5 frågor', exact: true }).click();
  await page.locator('[data-arena-action="create-room"]').click();
  await page.locator('[data-arena-action="start-match"]').click();
  for (let round = 1; round <= 5; round++) {
    await expect(page.locator('.arena-round-header-pills')).toContainText(`Runda ${round} av 5`);
    await page.locator('.arena-choice-btn').first().click();
    await expect(page.locator('.arena-timer-pill')).toHaveText('⏱️ Runda klar');
    await page.locator('[data-arena-action="next-round"]').click();
  }
  await expect(page.getByRole('heading', { name: '🏆 Slutställning' })).toBeVisible();
  await expect(page.locator('.course-quiz-review-item')).toHaveCount(5);
  await page.locator('[data-arena-action="rematch"]').click();
  await expect(page.locator('.arena-round-header-pills')).toContainText('Runda 1 av 5');
  await expect(page.locator('.arena-score-chip small')).toContainText('0 p');
  expect(errors).toEqual([]);
});
