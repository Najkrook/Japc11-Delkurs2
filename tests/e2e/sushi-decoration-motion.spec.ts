import { test, expect, type Page } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import type { SushiRestaurantState } from '../../src/course/sushi-game/types.ts';

async function seed(page: Page, overrides: Partial<SushiRestaurantState> = {}) {
  const state = createDefaultRestaurantState('motion-browser', Date.now(), overrides);
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Animation' }),
    );
    localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('restaurant-scene')).toBeVisible();
}

test('owned decoration motion pauses and reduces correctly without revealing unequipped items', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    if (!error.message.includes('/firestore.googleapis.com/')) errors.push(error.message);
  });
  await seed(page, {
    inventory: ['paper_lantern', 'noren_curtain', 'andon_lantern', 'golden_maneki_neko'],
    permanentGrants: ['paper_lantern', 'noren_curtain', 'andon_lantern', 'golden_maneki_neko'],
    equipped: { wallSlot: 'paper_lantern', floorSlot: 'golden_maneki_neko' },
  });
  const scene = page.getByTestId('restaurant-scene');
  const cat = scene.locator('.sushi-lucky-cat-frames');
  const lantern = scene.locator('.sushi-lantern-sway');
  await expect(cat).toHaveCSS('animation-name', 'sushi-cat-beckon');
  await expect(lantern).toHaveCSS('animation-name', 'sushi-lantern-sway');
  await expect(scene.locator('.sushi-decoration-glow')).toHaveCSS(
    'animation-name',
    'sushi-warm-glow',
  );
  await expect(page.getByTestId('art-noren_curtain')).toHaveCount(0);
  await expect(page.getByTestId('art-andon_lantern')).toHaveCount(0);
  await expect(scene.locator('.sushi-falling-petal')).toHaveCount(3);
  await page.getByTestId('sushi-toggle-menu').click();
  await expect(cat).toHaveCSS('animation-play-state', 'paused');
  await expect(lantern).toHaveCSS('animation-play-state', 'paused');
  await page.getByTestId('sushi-close-menu-btn').click();
  await expect(cat).toHaveCSS('animation-play-state', 'running');
  await scene.evaluate((element) =>
    element.getAnimations({ subtree: true }).forEach((animation) => {
      animation.pause();
      animation.currentTime = 4900;
    }),
  );
  expect(
    await cat.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41),
  ).toBe(-512);
  await page.screenshot({ path: testInfo.outputPath('decorations-moving.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const selector of [
    '.sushi-lucky-cat-frames',
    '.sushi-lantern-sway',
    '.sushi-decoration-glow',
    '.sushi-falling-petal',
  ]) {
    const locator = scene.locator(selector).first();
    await expect(locator).toHaveCSS('animation-name', 'none');
  }
  await expect(cat).toHaveCSS('transform', 'none');
  await expect(scene.locator('.sushi-falling-petal').first()).toHaveCSS('opacity', '0');
  expect(errors).toEqual([]);
});

test('locked decoration previews demonstrate their motion without changing ownership', async ({
  page,
}, testInfo) => {
  await seed(page);
  const saved = await page.evaluate(() =>
    localStorage.getItem('japc11-dk2-sushi-v1-motion-browser'),
  );
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByRole('tab', { name: 'Dekoration', exact: true }).click();
  await page.getByTestId('preview-decoration-golden_maneki_neko').click();
  const cat = page.locator('.sushi-lucky-cat-frames');
  await expect(cat).toHaveCSS('animation-play-state', 'running');
  await expect(page.getByTestId('sushi-activity-chef')).toHaveCSS('animation-play-state', 'paused');
  await cat.evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    animation.currentTime = 4900;
  });
  await page.screenshot({ path: testInfo.outputPath('cat-preview.png') });
  for (let index = 0; index < 4; index++) await page.getByTestId('sushi-preview-previous').click();
  await expect(page.locator('.sushi-curtain-flutter')).toHaveCSS(
    'animation-name',
    'sushi-curtain-flutter',
  );
  await page.screenshot({ path: testInfo.outputPath('curtain-preview.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('art-noren_curtain')).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem('japc11-dk2-sushi-v1-motion-browser')),
  ).toBe(saved);
});

test('purchase and placement arrivals wait for the shop to close and do not restart on ticks', async ({
  page,
}, testInfo) => {
  await page.clock.install();
  await seed(page, {
    inventory: ['paper_lantern'],
    permanentGrants: ['prep_counter', 'paper_lantern', 'salmon_nigiri'],
    balanceUnits: 1000 * 60000,
  });
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByTestId('buy-btn-prep_counter').click();
  const arrival = page.getByTestId('art-prep-counter').locator('.sushi-item-arrival');
  await expect(arrival).toHaveCSS('animation-play-state', 'paused');
  await page.clock.runFor(3500);
  await page.getByTestId('sushi-close-shop-btn').click();
  await expect(arrival).toHaveCSS('animation-play-state', 'running');
  const animation = await arrival.evaluateHandle((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    animation.currentTime = 300;
    return animation;
  });
  await page.clock.runFor(1500);
  expect(
    await arrival.evaluate((element, initial) => element.getAnimations()[0] === initial, animation),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('purchase-arrival.png') });
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByTestId('buy-btn-salmon_nigiri').click();
  const recipeArrival = page.getByTestId('art-salmon_nigiri').locator('.sushi-item-arrival');
  await expect(recipeArrival).toHaveCSS('animation-play-state', 'paused');
  await page.getByTestId('sushi-close-shop-btn').click();
  await expect(recipeArrival).toHaveCSS('animation-play-state', 'running');
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByRole('tab', { name: 'Dekoration', exact: true }).click();
  await page.getByTestId('preview-decoration-paper_lantern').click();
  await page.getByTestId('sushi-preview-place').click();
  await expect(page.getByTestId('sushi-decoration-preview')).toHaveCount(0);
  const placed = page.getByTestId('art-paper_lantern').locator('.sushi-item-arrival');
  await expect(placed).toHaveCount(1);
  await expect(placed).toHaveCSS('animation-play-state', 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(placed).toHaveCSS('animation-name', 'none');
});
