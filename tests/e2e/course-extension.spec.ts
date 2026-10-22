import { test, expect } from '@playwright/test';
import { courseWeeks } from '../../src/course/data/index.ts';
import { createFreshCourseProgress } from '../../src/course/course-state.ts';

test('all seven week tabs are reachable and preview stays accessible on desktop and mobile', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Local Vite mode and localhost OAuth configuration produce these known warnings.
    const expectedLocalWarning =
      m.type() === 'warning' &&
      (m.text().startsWith('Lit is in dev mode.') ||
        m.text().startsWith('Info: The current domain is not authorized for OAuth operations.'));
    if ((m.type() === 'error' || m.type() === 'warning') && !expectedLocalWarning)
      errors.push(m.text());
  });
  await page.goto('/');
  await expect(page).toHaveTitle(/JAPC11/);
  const tabs = page.getByRole('tablist', { name: 'Välj kapitel', exact: true }).getByRole('tab');
  await expect(tabs).toHaveCount(7);
  for (const week of courseWeeks) {
    const tab = tabs.filter({ hasText: `Kapitel ${week.lessonNumber}` });
    if (week.isPreview) await expect(tab).toHaveClass(/preview/);
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(page).toHaveURL(new RegExp(`#/vecka/${week.id}$`));
    await expect(page.locator('main h1')).toContainText(
      `Kapitel ${week.lessonNumber}`,
    );
    await expect(page.locator('main')).toContainText(`Genki I Kapitel ${week.lessonNumber}`);
    if (week.isPreview)
      await expect(page.locator('.course-badge-preview')).toHaveText('Förhandsvisning');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.locator('main h1').scrollIntoViewIfNeeded();
  if (process.env.COURSE_SCREENSHOT_DIR) {
    await page.screenshot({
      path: `${process.env.COURSE_SCREENSHOT_DIR}/${testInfo.project.name}-week7.png`,
    });
  }
  expect(errors).toEqual([]);
});

for (const week of courseWeeks.slice(4)) {
  test(`${week.id}: preview exercises open, Dojo progress survives reload, old mastery survives`, async ({
    page,
  }) => {
    const old = createFreshCourseProgress();
    old.masteredVocabIds['w1-v01'] = true;
    await page.addInitScript((data) => {
      if (!localStorage.getItem('japc11-dk2-course-v1-guest')) {
        localStorage.setItem('japc11-dk2-course-v1-guest', JSON.stringify(data));
      }
    }, old);
    await page.goto(`/#/vecka/${week.id}/vocab`);
    await page.reload();
    await expect(page.locator('.course-flashcard-jp')).toHaveText(
      week.vocab[0].kanji || week.vocab[0].kana,
    );
    await page.locator('.course-flashcard-jp').click();
    await expect(page.locator('main')).toContainText(week.vocab[0].sv);
    await page.goto(`/#/vecka/${week.id}/grammar`);
    await expect(page.locator('main')).toContainText(week.grammar[0].title);
    await page.goto(`/#/vecka/${week.id}/kanji`);
    await expect(page.locator('main')).toContainText(week.kanji[0].kanji);
    await page.goto(`/#/vecka/${week.id}/dojo`);
    await page.getByRole('button', { name: 'Skriv själv', exact: true }).click();
    const form = week.weekNumber === 6 ? 'た' : 'ない';
    const verb = week.conjugations[0];
    await expect(page.locator('#dojo-input')).toHaveAttribute(
      'placeholder',
      `Skriv ${form}-form i kana eller kanji...`,
    );
    await page.locator('#dojo-input').fill(form === 'た' ? verb.taFormKana! : verb.naiFormKana!);
    await page.getByRole('button', { name: `Kontrollera ${form}-form`, exact: true }).click();
    await expect(page.locator('.dojo-feedback-box.ok')).toBeVisible();
    await page.reload();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('japc11-dk2-course-v1-guest')!),
    );
    expect(saved.masteredVocabIds['w1-v01']).toBe(true);
    expect(saved.masteredDojoIds[verb.id]).toBe(true);
    await page.goto(`/#/vecka/${week.id}/quiz`);
    for (let i = 0; i < week.quiz.length; i++) {
      await expect(page.locator('.course-quiz-prompt')).toHaveText(week.quiz[i].prompt);
      await page.getByRole('button', { name: week.quiz[i].answer, exact: true }).click();
      await expect(page.locator('.dojo-feedback-box.ok')).toBeVisible();
      await page
        .getByRole('button', {
          name: i === week.quiz.length - 1 ? 'Visa resultat 🏁' : 'Nästa fråga →',
          exact: true,
        })
        .click();
    }
    await expect(page.locator('.course-quiz-score-circle strong')).toHaveText('14 / 14');
    const score = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem('japc11-dk2-course-v1-guest')!).quizBestResults[id],
      week.id,
    );
    expect(score.score).toBe(14);
  });
}

test('Arena exposes and selects all new weeks', async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: 'preview-test', displayName: 'Testare' }),
    ),
  );
  await page.goto('/#/arena');
  for (const week of courseWeeks.slice(4)) {
    const button = page.getByRole('button', {
      name: `Kapitel ${week.lessonNumber}`,
      exact: true,
    });
    await button.click();
    await expect(button).toHaveClass(/active/);
  }
  await page.getByRole('button', { name: 'Alla (kapitel 6–12)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Alla (kapitel 6–12)', exact: true })).toHaveClass(
    /active/,
  );
});
