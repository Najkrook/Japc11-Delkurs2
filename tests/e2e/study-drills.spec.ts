import { test, expect } from '@playwright/test';
import { courseWeeks } from '../../src/course/data/index.ts';
import { createFreshCourseProgress } from '../../src/course/course-state.ts';

test('typed Dojo answers persist mastery and next verb clears input and feedback', async ({
  page,
}) => {
  const progress = { ...createFreshCourseProgress(), activeSubView: 'dojo' };
  await page.addInitScript((data) => {
    localStorage.setItem('japc11-dk2-course-v1-guest', JSON.stringify(data));
  }, progress);
  await page.goto('/');
  await page.getByRole('button', { name: 'Skriv själv', exact: true }).click();
  const first = courseWeeks[0].conjugations[0];
  await page.locator('#dojo-input').fill(` ${first.teFormKanji} `);
  await page.getByRole('button', { name: 'Kontrollera て-form', exact: true }).click();
  await expect(page.locator('.dojo-feedback-box.ok')).toBeVisible();
  await expect(page.locator('#dojo-input')).toBeDisabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('japc11-dk2-course-v1-guest')!),
  );
  expect(saved.masteredDojoIds[first.id]).toBe(true);
  await page.getByRole('button', { name: 'Nästa verb →', exact: true }).click();
  await expect(page.locator('#dojo-input')).toHaveValue('');
  await expect(page.locator('#dojo-input')).toBeEnabled();
  await expect(page.locator('.dojo-feedback-box')).toHaveCount(0);
  await page.locator('#dojo-input').fill('wrong');
  await page.getByRole('button', { name: 'Kontrollera て-form', exact: true }).click();
  await expect(page.locator('.dojo-feedback-box.err')).toBeVisible();
});

test('weekly quiz completes, persists its score and restarts with unanswered first question', async ({
  page,
}) => {
  const progress = { ...createFreshCourseProgress(), activeSubView: 'quiz' };
  await page.addInitScript((data) => {
    localStorage.setItem('japc11-dk2-course-v1-guest', JSON.stringify(data));
  }, progress);
  await page.goto('/');
  const week = courseWeeks[0];
  for (let i = 0; i < week.quiz.length; i++) {
    const question = week.quiz[i];
    await expect(page.locator('.course-quiz-prompt')).toHaveText(question.prompt);
    await page.getByRole('button', { name: question.answer, exact: true }).click();
    await expect(page.locator('.dojo-feedback-box.ok')).toBeVisible();
    await page
      .getByRole('button', {
        name: i < week.quiz.length - 1 ? 'Nästa fråga →' : 'Visa resultat 🏁',
        exact: true,
      })
      .click();
  }
  await expect(page.locator('.course-quiz-score-circle strong')).toHaveText(
    `${week.quiz.length} / ${week.quiz.length}`,
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('japc11-dk2-course-v1-guest')!),
  );
  expect(saved.quizBestResults[week.id].score).toBe(week.quiz.length);
  await page.getByRole('button', { name: '🔄 Gör om testet', exact: true }).click();
  await expect(page.locator('.course-quiz-prompt')).toHaveText(week.quiz[0].prompt);
  await expect(page.locator('.dojo-feedback-box')).toHaveCount(0);
  await expect(page.locator('.dojo-choice-btn').first()).toBeEnabled();
});
