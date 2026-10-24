import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createFreshCourseProgress } from '../../src/course/course-state.ts';
import { courseWeeks } from '../../src/course/data/index.ts';

test.use({ hasTouch: true });

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

for (const width of [390, 1280]) {
  test(`recipe purchase and fixed decoration slots persist, retry and support keyboard at ${width}px`, async ({
    page,
  }) => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();
    await page.setViewportSize({ width, height: 900 });
    const sceneRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('restaurant-scene')) sceneRequests.push(request.url());
    });
    await page.goto('/');
    expect(sceneRequests).toHaveLength(0);
    const uid = await page.evaluate(async () => {
      const cloudPath = '/src/cloud.ts';
      const { auth } = await import(/* @vite-ignore */ cloudPath);
      const authPath = '/node_modules/.vite/deps/firebase_auth.js';
      const { signInWithCredential, GoogleAuthProvider } = await import(
        /* @vite-ignore */ authPath
      );
      const identity = 'decor-' + Date.now();
      const result = await signInWithCredential(
        auth,
        GoogleAuthProvider.credential(
          JSON.stringify({
            sub: identity,
            email: identity + '@example.test',
            email_verified: true,
          }),
        ),
      );
      return result.user.uid;
    });
    const require = createRequire(new URL('../../functions/package.json', import.meta.url));
    const { initializeApp, deleteApp } = require('firebase-admin/app');
    const admin = initializeApp({ projectId: 'demo-japc11-delkurs2' }, `browser-${width}`);
    const db = require('firebase-admin/firestore').getFirestore(admin);
    try {
      await page.locator('[data-course-nav="sushi"]').click();
      await expect(page.getByTestId('sushi-cash-register')).toBeVisible();
      await expect(page.getByTestId('restaurant-scene')).toBeVisible();
      expect(sceneRequests.length).toBeGreaterThan(0);
      await expect(page.getByTestId('art-prep-counter')).toHaveCount(0);
      await expect(page.getByTestId('art-conveyor-belt')).toHaveCount(0);
      await page
        .getByTestId('restaurant-scene')
        .screenshot({ path: `test-results/restaurant-base-${width}.png` });
      const progress = createFreshCourseProgress();
      progress.activeSubView = 'sushi';
      progress.updatedAt = Date.now() + 1000;
      for (const week of courseWeeks.filter((week) => [6, 7, 9].includes(week.lessonNumber))) {
        for (const word of week.vocab) progress.masteredVocabIds[word.id] = true;
        for (const kanji of week.kanji) progress.masteredKanjiIds[kanji.id] = true;
        for (const verb of week.conjugations) progress.masteredDojoIds[verb.id] = true;
        progress.quizBestResults[week.id] = {
          score: week.quiz.length,
          total: week.quiz.length,
          completedAt: 1,
        };
      }
      await db
        .doc(`users/${uid}/progress/course`)
        .set({ payload: JSON.stringify(progress), updatedAt: progress.updatedAt });
      await db.doc(`users/${uid}/sushi/restaurant`).update({ balanceUnits: 600_000_000 });
      await page.reload();
      await expect(page.getByTestId('buy-btn-salmon_nigiri')).toBeEnabled();
      await expect(page.getByTestId('menu-salmon_nigiri')).toHaveCount(0);
      for (const item of [
        'prep_counter',
        'conveyor_belt',
        'salmon_nigiri',
        'paper_lantern',
        'wave_print',
        'potted_plant',
      ]) {
        await page.getByTestId(`buy-btn-${item}`).click();
        await expect(page.getByTestId(`owned-indicator-${item}`)).toBeVisible();
      }
      await expect(page.getByTestId('menu-salmon_nigiri')).toBeVisible();
      await expect(page.getByTestId('placed-wallSlot')).toContainText('Tom plats');
      await expect(page.getByTestId('art-prep-counter')).toBeVisible();
      await expect(page.getByTestId('art-conveyor-belt')).toBeVisible();
      await expect(page.getByTestId('art-salmon_nigiri')).toBeVisible();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(
        await page
          .locator('.sushi-belt-tread')
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe('none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      expect(
        await page
          .locator('.sushi-belt-tread')
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe('sushi-belt-travel');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-paused', 'true');
      expect(
        await page
          .locator('.sushi-belt-tread')
          .evaluate((el) => getComputedStyle(el).animationPlayState),
      ).toBe('paused');
      await page.evaluate(() => {
        delete (document as unknown as Record<string, unknown>).hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-paused', 'false');
      const wall = page.getByTestId('decoration-wallSlot');
      await wall.locator('summary').focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await expect(wall.getByRole('button', { name: 'Placera Papperslykta' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('placed-wallSlot')).toContainText('Papperslykta');
      await expect(page.getByTestId('art-paper_lantern')).toBeVisible();
      let failSave = true;
      await page.route('**/europe-west1/sushi', async (route) => {
        if (
          failSave &&
          route.request().method() === 'POST' &&
          route.request().postDataJSON()?.data?.operation === 'equip'
        ) {
          failSave = false;
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({
              error: { status: 'UNAVAILABLE', message: 'Temporary failure' },
            }),
          });
        } else await route.continue();
      });
      await wall.getByRole('button', { name: 'Placera Vågmotiv' }).click();
      await expect(page.getByTestId('sushi-equip-error')).toBeVisible();
      await expect(page.getByTestId('placed-wallSlot')).toContainText('Papperslykta');
      await wall.getByRole('button', { name: 'Placera Vågmotiv' }).click();
      await expect(page.getByTestId('placed-wallSlot')).toContainText('Vågmotiv');
      const floor = page.getByTestId('decoration-floorSlot');
      await floor.locator('summary').click();
      if (width === 390) await floor.getByRole('button', { name: 'Placera Krukväxt' }).tap();
      else await floor.getByRole('button', { name: 'Placera Krukväxt' }).click();
      await expect(page.getByTestId('placed-floorSlot')).toContainText('Krukväxt');
      await page.reload();
      await expect(page.getByTestId('placed-wallSlot')).toContainText('Vågmotiv');
      await expect(page.getByTestId('placed-floorSlot')).toContainText('Krukväxt');
      await expect(page.getByTestId('menu-salmon_nigiri')).toBeVisible();
      await expect(page.getByTestId('art-wave_print')).toBeVisible();
      await expect(page.getByTestId('art-paper_lantern')).toHaveCount(0);
      await expect(page.getByTestId('art-potted_plant')).toBeVisible();
      await page
        .getByTestId('restaurant-scene')
        .screenshot({ path: `test-results/restaurant-upgraded-${width}.png` });
      await wall.locator('summary').click();
      await wall.getByRole('button', { name: 'Ta bort från väggplats' }).click();
      await expect(page.getByTestId('placed-wallSlot')).toContainText('Tom plats');
      await expect(page.getByTestId('art-wave_print')).toHaveCount(0);
      await page
        .getByTestId('sushi-scene-placeholder')
        .screenshot({ path: `test-results/personalization-${width}.png` });
      const overflow = await page.evaluate(() =>
        Array.from(document.querySelectorAll('body *'))
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .slice(0, 10)
          .map((element) => ({
            tag: element.tagName,
            class: element.className,
            width: element.getBoundingClientRect().width,
          })),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        JSON.stringify(overflow),
      ).toBeTruthy();
    } finally {
      await db.terminate();
      await deleteApp(admin);
    }
  });
}
