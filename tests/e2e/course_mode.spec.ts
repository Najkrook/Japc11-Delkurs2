import { test, expect } from '@playwright/test';
import { buildAllCourseArenaQuestions } from '../../src/course/multiplayer/arena-questions.ts';

test('Arena displays the actual length of a short focused match', async ({ page }) => {
  const count = buildAllCourseArenaQuestions('week-1').filter(
    (q) => q.category === 'grammar',
  ).length;
  await page.goto('/');
  await page.locator('[data-course-nav="arena"]').click();
  await page.getByRole('button', { name: 'Vecka 1 (L6)', exact: true }).click();
  await page.getByRole('button', { name: 'Grammatik', exact: true }).click();
  await page.getByRole('button', { name: '15 frågor', exact: true }).click();
  await page.locator('[data-arena-action="create-room"]').click();
  await expect(page.locator('[data-arena-action="start-match"]')).toContainText(`${count} frågor`);
});

test('JAPC11 Delkurs 2 standalone app: Vecka för vecka, Te-Form Dojo, Flashcards, and Course Arena work end-to-end', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');

  // 1. Verify standalone JAPC11 Delkurs 2 shell is rendered immediately
  await expect(page.locator('.course-app-shell')).toBeVisible();
  await expect(page.locator('.course-brand-text strong')).toHaveText('JAPC11 · Delkurs 2');
  await expect(page.locator('main h1')).toContainText('Vecka 1 · Lektion 6');

  // 2. Open Te-Form Dojo and answer a verb
  await page
    .getByRole('button', { name: /て-form Dojo/ })
    .first()
    .click();
  await expect(page.locator('main h1')).toContainText('Träna verbens て-form steg för steg');
  await page.getByRole('button', { name: 'かって' }).click();
  await expect(page.locator('.dojo-feedback-box.ok')).toBeVisible();

  // 3. Open standalone Course Arena (Multiplayer for L6-L9)
  await page.locator('[data-course-nav="arena"]').click();
  await expect(page.locator('main h1')).toContainText('Tävla i det nya kursmaterialet');

  // Create a room with a 4-digit room code, add a bot, and start a match
  await page.locator('[data-arena-action="create-room"]').click();
  const roomCodeEl = page.getByTestId('arena-room-code');
  await expect(roomCodeEl).toBeVisible();
  const codeText = await roomCodeEl.textContent();
  expect(codeText).toMatch(/^\d{4}$/);

  await page.locator('[data-bot-toggle="bot-sakura"]').click();
  await page.locator('[data-arena-action="start-match"]').click();

  // Verify live round in Course Arena
  await expect(page.locator('.arena-question-card')).toBeVisible();
  await page.locator('.arena-choice-btn').first().click();

  // 4. Open Extra studier from sidebar, verify Tae Kim Immersion deck & 6 Arcs, study Arc 1
  await page.locator('[data-course-nav="extra"]').click();
  await expect(page.locator('main h1')).toContainText('Extra studier · Tae Kim Anime Immersion');
  await expect(page.locator('.taekim-arc-card')).toHaveCount(6);

  // Start Arc 1 continuous flow
  const firstArcResumeBtn = page.locator('.taekim-arc-card').first().locator('[data-arc-action="start-resume"]');
  await expect(firstArcResumeBtn).toContainText('Starta Arc 1');
  await firstArcResumeBtn.click();

  const ankiCard = page.locator('.taekim-card-stage');
  await expect(ankiCard).toBeVisible();
  await expect(page.locator('.anki-front-text')).toBeVisible();

  // Flip card, rate "Bra"
  await ankiCard.click();
  await expect(page.locator('.anki-card-answer-revealed')).toBeVisible();
  await page.locator('.anki-rate-btn.rate-good').click();

  // Return to Arcs overview - verify Arc 1 button now says "Fortsätt från kort 2"
  await page.locator('.anki-back-nav-btn').click();
  await expect(firstArcResumeBtn).toContainText('Fortsätt från kort 2');

  // Return to main study plan hub
  await page.getByRole('button', { name: '← Tillbaka till studieplanen' }).click();
  await expect(page.locator('main h1')).toContainText('Vecka 1 · Lektion 6');

  expect(errors).toEqual([]);
});
