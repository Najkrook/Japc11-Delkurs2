import { test, expect } from '@playwright/test';
import { courseWeeks } from '../../src/course/data/index.ts';
import { createFreshCourseProgress } from '../../src/course/course-state.ts';

test('remaining cards advance without skipping and end with an empty state', async ({ page }) => {
  const week = courseWeeks[0];
  const progress = createFreshCourseProgress();
  progress.activeSubView = 'vocab';
  for (const word of week.vocab.slice(3)) progress.masteredVocabIds[word.id] = true;
  await page.addInitScript((data) => {
    localStorage.setItem('japc11-dk2-course-v1-guest', JSON.stringify(data));
  }, progress);
  await page.goto('/');
  await page.getByRole('button', { name: 'Kvar att lära (3)', exact: true }).click();
  for (const word of week.vocab.slice(0, 3)) {
    await expect(page.locator('.course-flashcard-jp')).toHaveText(word.kanji || word.kana);
    await page.getByRole('button', { name: '✓ Jag kan detta!', exact: true }).click();
  }
  await expect(page.getByText('Alla kapitlets glosor är bemästrade.')).toBeVisible();
  await expect(page.locator('.course-flashcard')).toHaveCount(0);
  await page.getByRole('button', { name: /Hela ordlistan/ }).click();
  await expect(page.locator('.course-vocab-row')).toHaveCount(0);
  await page.getByRole('button', { name: `Alla (${week.vocab.length})`, exact: true }).click();
  await expect(page.locator('.course-vocab-row')).toHaveCount(week.vocab.length);
});

test('empty word category does not fall back to all words', async ({ page }) => {
  const week = courseWeeks.find((w) => !w.vocab.some((v) => v.category === 'verb-irr'))!;
  expect(week).toBeTruthy();
  const progress = createFreshCourseProgress();
  progress.activeWeekId = week.id;
  progress.activeSubView = 'vocab';
  await page.addInitScript((data) => {
    localStorage.setItem('japc11-dk2-course-v1-guest', JSON.stringify(data));
  }, progress);
  await page.goto('/');
  await page.getByRole('button', { name: 'Oregelbundna verb', exact: true }).click();
  await expect(page.getByText('Inga glosor matchar det valda filtret.')).toBeVisible();
  await expect(page.locator('.course-flashcard')).toHaveCount(0);
});
