import { test, expect } from '@playwright/test';
import { createFreshCourseProgress } from '../../src/course/course-state.ts';

test('the course works while every sushi navigation entry stays hidden', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/JAPC11/);
  await expect(page.locator('main h1')).toContainText('Kapitel 6');
  await expect(page.locator('[data-course-nav^="sushi"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Glosor', exact: true }).first().click();
  await expect(page).toHaveURL(/#\/vecka\/week-1\/vocab$/);
  await expect(page.locator('.course-top-link.active')).toContainText('Glosor');
  await page.locator('[data-course-nav="extra-top"]').click();
  await expect(page.locator('main h1')).toContainText('Extra studier');
  await expect(page.locator('.taekim-arc-card')).toHaveCount(6);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('direct links and all former preview overrides cannot open the production restaurant', async ({
  page,
}) => {
  const sushiRequests: string[] = [];
  page.on('request', (request) => {
    if (/sushi-view|\/sprites\/sushi\//.test(request.url())) sushiRequests.push(request.url());
  });
  await page.addInitScript(() => {
    (window as unknown as { __SUSHI_ENTRY_ENABLED: boolean }).__SUSHI_ENTRY_ENABLED = true;
    sessionStorage.setItem('japc11-sushi-entry', 'true');
  });
  for (const path of [
    '/#/sushi',
    '/?sushi=1#/restaurang',
    '/?sushi=true#/sushigame',
    '/#/vecka/week-2/sushi',
    '/#/vecka/week-2/restaurang',
    '/#/week-2/sushigame',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/#\/vecka\/week-[12]$/);
    await expect(page.locator('main h1')).toContainText('Kapitel');
    await expect(page.locator('[data-course-nav^="sushi"], .sushi-shell')).toHaveCount(0);
  }
  // The same guard applies when an already-open course tab follows an old link.
  await page.evaluate(() => {
    location.hash = '#/restaurang';
  });
  await expect(page).toHaveURL(/#\/vecka\/week-2$/);
  await expect(page.locator('.sushi-shell')).toHaveCount(0);
  expect(sushiRequests).toEqual([]);
});

test('saved restaurant navigation returns to the course without losing study progress', async ({
  page,
}) => {
  const progress = createFreshCourseProgress();
  progress.activeWeekId = 'week-4';
  progress.activeSubView = 'sushi';
  progress.masteredVocabIds['w1-v01'] = true;
  progress.masteredKanjiIds['w1-k01'] = true;
  progress.updatedAt = 123456789;
  await page.addInitScript((saved) => {
    localStorage.setItem('japc11-dk2-course-v1-guest', JSON.stringify(saved));
  }, progress);
  await page.goto('/');
  await expect(page).toHaveURL(/#\/vecka\/week-4$/);
  await expect(page.locator('main h1')).toContainText('Kapitel 9');
  await expect(page.locator('.sushi-shell')).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('japc11-dk2-course-v1-guest')!),
  );
  expect(saved.activeSubView).toBe('hub');
  expect(saved.activeWeekId).toBe('week-4');
  expect(saved.masteredVocabIds).toEqual({ 'w1-v01': true });
  expect(saved.masteredKanjiIds).toEqual({ 'w1-k01': true });
});
