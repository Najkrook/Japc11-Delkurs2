import { test, expect, type Page } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import type { SushiRestaurantState } from '../../src/course/sushi-game/types.ts';

async function seed(page: Page, overrides: Partial<SushiRestaurantState>) {
  const state = createDefaultRestaurantState('conveyor-tier-test', Date.now(), {
    restaurantTier: 2,
    balanceUnits: 30000 * 60000,
    permanentGrants: ['conveyor_belt', 'sous_chef'],
    ...overrides,
  });
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'QA' }),
    );
    const key = `japc11-dk2-sushi-v1-${fixture.id}`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(fixture));
    localStorage.setItem(`japc11-sushi-finale-seen-${fixture.id}`, 'true');
  }, state);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('restaurant-scene')).toBeVisible();
}

test('the conveyor can be purchased only after renovating to tier three', async ({ page }) => {
  await seed(page, {});
  await page.getByTestId('sushi-toggle-shop').click();
  await expect(page.getByTestId('buy-btn-conveyor_belt')).toBeDisabled();
  await expect(page.getByTestId('tier-requirement-conveyor_belt')).toContainText('nivå 3');
  await page.getByTestId('buy-renovation').click();
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', '3');
  await page.getByTestId('sushi-toggle-shop').click();
  await expect(page.getByTestId('buy-btn-conveyor_belt')).toBeEnabled();
  await page.getByTestId('buy-btn-conveyor_belt').click();
  await expect(page.getByTestId('owned-indicator-conveyor_belt')).toBeVisible();
  await expect(page.getByTestId('art-conveyor-belt').locator('image')).toHaveAttribute(
    'href',
    '/sprites/sushi/upgrades/tier-3-l-conveyor.png',
  );
});

test('an older tier-two owner keeps the service bonus and sees the belt after renovation', async ({
  page,
}) => {
  await seed(page, { inventory: ['conveyor_belt'], serviceCapacity: 4 });
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-conveyor', 'false');
  await expect(page.getByTestId('art-conveyor-belt')).toHaveCount(0);
  await page.getByTestId('sushi-toggle-shop').click();
  await expect(page.getByTestId('owned-indicator-conveyor_belt')).toContainText(
    'servicebonusen är aktiv',
  );
  await page.getByTestId('buy-renovation').click();
  await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-conveyor', 'true');
  await expect(page.getByTestId('art-conveyor-belt')).toHaveCount(1);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('japc11-dk2-sushi-v1-conveyor-tier-test')!),
  );
  expect(saved.inventory).toContain('conveyor_belt');
  expect(saved.serviceCapacity).toBe(4);
});

test('plates follow the L-shaped conveyor around its corner', async ({ page }) => {
  await seed(page, {
    restaurantTier: 3,
    inventory: ['conveyor_belt'],
    kitchenCapacity: 6,
    serviceCapacity: 6,
  });
  const plate = page.locator('.sushi-serving-slot .sushi-travelling-plate').first();
  const points = await plate.evaluate((element) => {
    const animation = element.getAnimations()[0];
    animation.pause();
    return [3200, 4000, 5440].map((time) => {
      animation.currentTime = time;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { x: matrix.m41, y: matrix.m42, opacity: Number(getComputedStyle(element).opacity) };
    });
  });
  // A bend travels left and down to the corner, then left and up along the long run.
  expect(points[0].x).toBeGreaterThan(points[1].x);
  expect(points[1].x).toBeGreaterThan(points[2].x);
  expect(points[1].y).toBeGreaterThan(points[0].y);
  expect(points[1].y).toBeGreaterThan(points[2].y);
  expect(points[1].opacity).toBeGreaterThan(0.9);
});
