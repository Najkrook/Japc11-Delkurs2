import { test, expect, type Page } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import { SUSHI_CATALOG } from '../../src/course/sushi-game/catalog.ts';
import type { SushiRestaurantState } from '../../src/course/sushi-game/types.ts';

async function seed(page: Page, overrides: Partial<SushiRestaurantState> = {}) {
  const state = createDefaultRestaurantState('tier-browser', Date.now(), {
    balanceUnits: 20000 * 60000,
    ...overrides,
  });
  await page.addInitScript((fixture) => {
    localStorage.setItem(`japc11-sushi-finale-seen-${fixture.id}`, 'true');
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Tier Test' }),
    );
    if (!sessionStorage.getItem('tier-fixture-loaded')) {
      localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
      sessionStorage.setItem('tier-fixture-loaded', 'true');
    }
  }, state);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('restaurant-scene')).toBeVisible();
}
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('japc11-dk2-sushi-v1-tier-browser')!));

test('renovation preview is read-only, Escape restores focus, purchase persists and unlocks chapter items', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    if (!e.message.includes('/firestore.googleapis.com/')) errors.push(e.message);
  });
  await seed(page, { permanentGrants: ['conveyor_belt'] });
  await page.getByTestId('sushi-toggle-shop').click();
  await expect(page.getByTestId('buy-btn-conveyor_belt')).toBeDisabled();
  await expect(page.getByTestId('tier-requirement-conveyor_belt')).toContainText('nivå 2');
  const before = await saved(page);
  await page.getByTestId('preview-renovation').click();
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', '2');
  await expect(page.getByTestId('art-conveyor-belt')).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', '1');
  await expect(page.getByTestId('preview-renovation')).toBeFocused();
  await page.getByTestId('buy-renovation').click();
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', '2');
  expect((await saved(page)).balanceUnits).toBe(before.balanceUnits - 3600 * 60000);
  await page.getByTestId('sushi-toggle-shop').click();
  await expect(page.getByTestId('buy-btn-conveyor_belt')).toBeEnabled();
  await page.screenshot({ path: info.outputPath('tier-2-shop.png') });
  await page.reload();
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', '2');
  expect((await saved(page)).restaurantTier).toBe(2);
  expect(errors).toEqual([]);
});

test('medal and wallet requirements are separate; final tier has no older appearance selector', async ({
  page,
}, info) => {
  await seed(page, {
    restaurantTier: 2,
    balanceUnits: 10800 * 60000,
    permanentGrants: ['sous_chef'],
  });
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByTestId('buy-renovation').click();
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', '3');
  await page.getByTestId('sushi-toggle-shop').click();
  await expect(page.getByTestId('buy-renovation')).toHaveCount(0);
  await expect(page.locator('.sushi-renovation-complete')).toContainText('3/3');
  expect((await saved(page)).balanceUnits).toBe(0);
  await page.screenshot({ path: info.outputPath('tier-3-shop.png') });
});

test('failed image load retains purchased state and previous room; image retry never charges', async ({
  page,
}) => {
  let failedImageRequests = 0;
  await page.route('**/tiers/tier-2-front.png', (route) => {
    failedImageRequests++;
    return route.abort();
  });
  await seed(page, { permanentGrants: ['conveyor_belt'] });
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByTestId('buy-renovation').click();
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', '1');
  await expect(
    page.getByText('Renoveringen är köpt, men bilden kunde inte laddas.', { exact: false }),
  ).toBeVisible();
  const balance = (await saved(page)).balanceUnits;
  expect((await saved(page)).restaurantTier).toBe(2);
  await page.waitForTimeout(2100);
  expect(failedImageRequests).toBe(1);
  await page.unroute('**/tiers/tier-2-front.png');
  await page.getByRole('button', { name: 'Ladda bilden igen' }).click();
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', '2');
  expect((await saved(page)).balanceUnits).toBe(balance);
});

for (const tier of [1, 2, 3] as const)
  test(`tier ${tier} renders phases, owned items and stable motion`, async ({ page }, info) => {
    await seed(page, {
      restaurantTier: tier,
      serviceCapacity: 6,
      kitchenCapacity: 6,
      inventory: SUSHI_CATALOG.filter((i) => i.requiredRestaurantTier <= tier).map((i) => i.id),
      equipped: { wallSlot: 'paper_lantern', floorSlot: 'potted_plant' },
    });
    await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', String(tier));
    expect(await page.locator('.sushi-scene-guest').count()).toBe(tier === 1 ? 2 : 3);
    const chef = page.getByTestId('sushi-activity-chef');
    const animation = await chef.evaluateHandle((e) => e.getAnimations()[0]);
    await page.waitForTimeout(1200);
    expect(await chef.evaluate((e, a) => e.getAnimations()[0] === a, animation)).toBe(true);
    await page.getByTestId('sushi-guest-0').click();
    await expect(page.getByTestId('sushi-phrase-bubble')).toBeVisible();
    await page.keyboard.press('Escape');
    for (const [phase, time] of [
      ['preparing', 2000],
      ['serving', 5000],
      ['reaction', 7600],
    ] as const) {
      await page.getByTestId('restaurant-scene').evaluate((e, t) => {
        for (const a of e.getAnimations({ subtree: true })) {
          a.pause();
          a.currentTime = t;
        }
      }, time);
      await page.screenshot({ path: info.outputPath(`tier-${tier}-${phase}.png`) });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(chef).toHaveCSS('animation-name', 'none');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  });
