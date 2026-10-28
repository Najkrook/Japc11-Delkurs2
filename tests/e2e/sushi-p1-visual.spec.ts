import { test, expect } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import { SUSHI_CATALOG } from '../../src/course/sushi-game/catalog.ts';

test('phone shop shows category results and can return to the required renovation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = createDefaultRestaurantState('p1-shop', Date.now(), {
    balanceUnits: 20000 * 60000,
    permanentGrants: SUSHI_CATALOG.map((item) => item.id),
  });
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'QA' }),
    );
    localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('restaurant-scene')).toBeVisible();
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByRole('tab', { name: 'Dekoration', exact: true }).click();
  await expect(page.getByTestId('sushi-renovation-card')).toHaveCount(0);
  const first = page.getByTestId('unlock-card-paper_lantern');
  await expect(first).toBeInViewport();
  const bounds = await first.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(844);
  expect(
    await first
      .locator('.sushi-card-desc')
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  await page
    .getByTestId('unlock-card-wave_print')
    .getByRole('button', { name: 'Se nästa renovering' })
    .click();
  await expect(page.getByRole('tab', { name: 'Alla', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('sushi-renovation-card')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('sushi-toggle-shop')).toBeFocused();
});

test('narrow phone keeps the goal and balance separate with readable status text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#/sushi');
  await page.getByTestId('sushi-local-login-btn').click();
  await expect(page.getByTestId('restaurant-scene')).toBeVisible();
  const goal = await page.getByTestId('sushi-next-goal').boundingBox();
  const balance = await page.getByTestId('sushi-spendable-balance').boundingBox();
  expect(goal!.x + goal!.width).toBeLessThanOrEqual(balance!.x);
  for (const selector of [
    '.sushi-register-label',
    '.sushi-funds-label',
    '.sushi-goal-progress',
    '.sushi-goal-action small',
  ]) {
    expect(
      await page.locator(selector).evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
    ).toBeGreaterThanOrEqual(14);
  }
  const hint = await page.locator('.sushi-guest-hint').boundingBox();
  const production = await page.locator('.sushi-production-details summary').boundingBox();
  expect(hint!.y + hint!.height).toBeLessThanOrEqual(production!.y);
});

for (const tier of [1, 2, 3] as const) {
  for (const wall of ['paper_lantern', 'wave_print', 'noren_curtain']) {
    test(`tier ${tier}: certificate has its own space beside ${wall}`, async ({ page }) => {
      const state = createDefaultRestaurantState(`p1-wall-${tier}-${wall}`, Date.now(), {
        restaurantTier: tier,
        inventory: ['master_license', wall],
        equipped: { wallSlot: wall, floorSlot: null },
      });
      await page.addInitScript((fixture) => {
        sessionStorage.setItem(
          'japc11-mock-user',
          JSON.stringify({ uid: fixture.id, displayName: 'QA' }),
        );
        localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
      }, state);
      await page.goto('/#/sushi');
      await expect(page.getByTestId('restaurant-scene')).toHaveAttribute('data-tier', String(tier));
      // Measure the clipped sprite viewport; the outer SVG group also includes
      // the invisible, overflowing atlas pixels and is not a visual footprint.
      const clippedBounds = (element: Element) => {
        const sprite = element as SVGSVGElement;
        const matrix = (sprite.parentElement as unknown as SVGGraphicsElement).getScreenCTM()!;
        const x = sprite.x.baseVal.value,
          y = sprite.y.baseVal.value;
        const w = sprite.width.baseVal.value,
          h = sprite.height.baseVal.value;
        const corners = [
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h],
        ].map(([cx, cy]) => new DOMPoint(cx, cy).matrixTransform(matrix));
        return {
          left: Math.min(...corners.map((p) => p.x)),
          right: Math.max(...corners.map((p) => p.x)),
        };
      };
      const certificate = await page
        .getByTestId('art-master_license')
        .locator('svg')
        .evaluate(clippedBounds);
      const decoration = await page
        .getByTestId(`art-${wall}`)
        .locator('svg')
        .evaluate(clippedBounds);
      expect(certificate.right).toBeLessThanOrEqual(decoration.left);
    });
  }
}
