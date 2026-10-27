import { test, expect, type Page } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import type { SushiRestaurantState } from '../../src/course/sushi-game/types.ts';

async function seed(page: Page, overrides: Partial<SushiRestaurantState> = {}) {
  const state = createDefaultRestaurantState('activity-browser', Date.now(), overrides);
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Test' }),
    );
    localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('sushi-activity-chef')).toBeVisible();
}

test('preparation, serving and dining animate without restarting on the income ticker', async ({
  page,
}, testInfo) => {
  await page.clock.install();
  const writes: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    // Firestore's existing read subscription uses POST too; it is not a write.
    if (request.method() !== 'GET' && !request.url().includes('/Listen/'))
      writes.push(request.url());
  });
  await seed(page);
  const chef = page.getByTestId('sushi-activity-chef');
  const scene = page.getByTestId('restaurant-scene');
  const animation = await chef.evaluateHandle((element) => element.getAnimations()[0]);
  const saved = await page.evaluate(() =>
    localStorage.getItem('japc11-dk2-sushi-v1-activity-browser'),
  );
  await page.clock.runFor(2100);
  expect(
    await chef.evaluate((element, original) => element.getAnimations()[0] === original, animation),
  ).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem('japc11-dk2-sushi-v1-activity-browser')),
  ).toBe(saved);
  expect(writes).toEqual([]);
  expect(await scene.locator('[data-dish="salmon_nigiri"]').count()).toBe(0);
  for (const [phase, time] of [
    ['preparing', 2200],
    ['serving', 6600],
    ['dining', 9600],
    ['reaction', 11400],
  ] as const) {
    await scene.evaluate((element, position) => {
      for (const animation of element.getAnimations({ subtree: true })) {
        animation.pause();
        animation.currentTime = position;
      }
    }, time);
    if (phase === 'serving')
      await expect(scene.locator('.sushi-travelling-plate').first()).toHaveCSS('opacity', '1');
    if (phase === 'dining')
      await expect(scene.locator('.sushi-served-plate').first()).toHaveCSS('opacity', '1');
    await page.screenshot({ path: testInfo.outputPath(`${phase}.png`) });
  }
  await page.getByTestId('sushi-guest-0').click();
  await expect(page.getByTestId('sushi-phrase-bubble')).toBeVisible();
  expect(errors).toEqual([]);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
});

test('capped production, overlay and hidden-tab pause states resume correctly', async ({
  page,
}) => {
  await seed(page, { usedProductionMs: 24 * 3600000, uncollectedUnits: 14400 * 60000 });
  const scene = page.getByTestId('restaurant-scene');
  const chef = page.getByTestId('sushi-activity-chef');
  await expect(scene).toHaveAttribute('data-production-stopped', 'true');
  await expect(chef).toHaveCSS('animation-name', 'none');
  await expect(scene.locator('.sushi-serving-layer')).toBeHidden();
  await page.getByTestId('sushi-collect-btn').click();
  await expect(scene).toHaveAttribute('data-production-stopped', 'false');
  await expect(chef).toHaveCSS('animation-name', 'sushi-chef-prepare');
  await page.getByTestId('sushi-toggle-shop').click();
  await expect(scene).toHaveAttribute('data-paused', 'true');
  await expect(chef).toHaveCSS('animation-play-state', 'paused');
  await page.getByTestId('sushi-close-shop-btn').click();
  await expect(chef).toHaveCSS('animation-play-state', 'running');
  for (const hidden of [true, false]) {
    await page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    await expect(scene).toHaveAttribute('data-paused', String(hidden));
    await expect(chef).toHaveCSS('animation-play-state', hidden ? 'paused' : 'running');
  }
});

test('upgrades add owned dishes and sous-chef; reduced motion settles to static plates', async ({
  page,
}, testInfo) => {
  await seed(page, {
    restaurantTier: 3,
    kitchenCapacity: 6,
    serviceCapacity: 6,
    permanentGrants: ['prep_counter', 'conveyor_belt', 'salmon_nigiri', 'sous_chef'],
    inventory: ['prep_counter', 'conveyor_belt', 'salmon_nigiri', 'sous_chef'],
  });
  const scene = page.getByTestId('restaurant-scene');
  await expect(scene).toHaveAttribute('data-conveyor', 'true');
  expect(
    await scene.evaluate((el) => getComputedStyle(el).getPropertyValue('--activity-cycle')),
  ).toBe('8s');
  await expect(scene.locator('[data-dish="salmon_nigiri"]')).toHaveCount(3);
  await expect(scene.locator('[data-dish="maguro_nigiri"]')).toHaveCount(0);
  await expect(scene.locator('.sushi-sous-chef-working')).toHaveCount(1);
  await expect(page.getByTestId('art-conveyor-belt')).toHaveCSS('transform', 'none');
  await scene.evaluate((el) =>
    el.getAnimations({ subtree: true }).forEach((a) => {
      a.pause();
      a.currentTime = 4400;
    }),
  );
  await page.screenshot({ path: testInfo.outputPath('conveyor.png') });
  await scene.evaluate((el) =>
    el.getAnimations({ subtree: true }).forEach((a) => {
      a.currentTime = 28400;
    }),
  );
  await expect(
    scene.locator('[data-dish="salmon_nigiri"] .sushi-travelling-plate').first(),
  ).toHaveCSS('opacity', '1');
  await expect(
    scene.locator('[data-dish="basic_nigiri"] .sushi-travelling-plate').first(),
  ).toHaveCSS('opacity', '0');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByTestId('sushi-activity-chef')).toHaveCSS('animation-name', 'none');
  await expect(scene.locator('.sushi-travelling-plate').first()).toHaveCSS('opacity', '0');
  await expect(scene.locator('.sushi-served-plate').first()).toHaveCSS('opacity', '1');
});
