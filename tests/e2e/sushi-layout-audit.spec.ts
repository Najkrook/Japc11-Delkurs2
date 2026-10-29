import { test, expect, type Page } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import { SUSHI_CATALOG } from '../../src/course/sushi-game/catalog.ts';

async function seed(page: Page, tier: 1 | 2 | 3, furnished = true) {
  const state = createDefaultRestaurantState(`layout-audit-${tier}`, Date.now(), {
    restaurantTier: tier,
    kitchenCapacity: 6,
    serviceCapacity: 6,
    balanceUnits: 20000 * 60000,
    permanentGrants: SUSHI_CATALOG.map((item) => item.id),
    inventory: furnished
      ? SUSHI_CATALOG.filter((item) => item.requiredRestaurantTier <= tier).map((item) => item.id)
      : [],
    equipped: furnished
      ? { wallSlot: 'paper_lantern', floorSlot: 'potted_plant' }
      : { wallSlot: null, floorSlot: null },
    completedProjects: ['study_nook', 'lantern_evening', 'garden_terrace', 'hanami_festival'],
  });
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Layout QA' }),
    );
    localStorage.setItem(`japc11-sushi-finale-seen-${fixture.id}`, 'true');
    localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('restaurant-scene')).toBeVisible();
  const notice = page.getByTestId('sushi-banner-dismiss-btn');
  if (await notice.isVisible()) await notice.click();
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 640, height: 720 },
]) {
  for (const tier of [1, 2] as const) {
    test(`tier ${tier + 1} renovation preview leaves the room unobscured at ${viewport.width}px`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await seed(page, tier);
      await page.getByTestId('sushi-toggle-shop').click();
      await page.getByTestId('preview-renovation').click();
      await expect(page.getByTestId('restaurant-scene')).toHaveAttribute(
        'data-tier',
        String(tier + 1),
      );
      const scene = (await page.locator('.sushi-pixel-world').boundingBox())!;
      const panel = (await page.getByTestId('sushi-renovation-preview').boundingBox())!;
      expect(overlaps(scene, panel), 'the preview controls cover the room').toBe(false);
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(viewport.width);
      const buy = page.getByTestId('sushi-renovation-preview').getByTestId('buy-renovation');
      await expect(buy).toBeVisible();
      const buyBox = (await buy.boundingBox())!;
      expect(buyBox.y + buyBox.height).toBeLessThanOrEqual(panel.y + panel.height);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('preview-renovation')).toBeFocused();
    });
  }
}

test('narrow phone keeps the guest hint clear and offers distinct guest controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(page, 3);
  const scene = (await page.locator('.sushi-pixel-world').boundingBox())!;
  const hint = (await page.locator('.sushi-guest-hint').boundingBox())!;
  const goal = (await page.getByTestId('sushi-next-goal').boundingBox())!;
  const register = (await page.getByTestId('sushi-cash-register').boundingBox())!;
  const rate = (await page.getByTestId('sushi-rate-info').boundingBox())!;
  const collect = (await page.locator('.sushi-collect-btn').boundingBox())!;
  expect(overlaps(scene, hint), 'the hint covers the restaurant artwork').toBe(false);
  expect(overlaps(scene, goal), 'the goal covers the restaurant artwork').toBe(false);
  expect(register.y + register.height).toBeLessThanOrEqual(740);
  expect(overlaps(rate, collect), 'the income rate overlaps the collect button').toBe(false);
  expect(hint.height).toBeGreaterThanOrEqual(44);
  await page.getByTestId('sushi-guest-hint').click();
  await expect(page.getByTestId('sushi-phrase-bubble')).toBeVisible();
  await page.keyboard.press('Escape');
  const guests = page.locator('.sushi-scene-guest');
  const labels = await guests.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('aria-label')),
  );
  expect(new Set(labels).size).toBe(3);
  for (let index = 0; index < 3; index++) {
    await guests.nth(index).click();
    await expect(page.getByTestId('sushi-phrase-bubble')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

for (const viewport of [
  { width: 360, height: 740 },
  { width: 361, height: 740 },
  { width: 390, height: 844 },
  { width: 640, height: 720 },
]) {
  test(`mobile scene and controls do not overlap at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seed(page, 3);
    const scene = (await page.locator('.sushi-pixel-world').boundingBox())!;
    const hint = (await page.getByTestId('sushi-guest-hint').boundingBox())!;
    const production = (await page.locator('.sushi-production-details summary').boundingBox())!;
    expect(overlaps(scene, hint)).toBe(false);
    expect(hint.y + hint.height).toBeLessThanOrEqual(production.y);
  });
}

test('a closed goal with a long item name leaves the mobile room clear', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(page, 1, false);
  const goal = (await page.getByTestId('sushi-next-goal').boundingBox())!;
  const scene = (await page.locator('.sushi-pixel-world').boundingBox())!;
  expect(goal.y + goal.height).toBeLessThanOrEqual(scene.y);
});

for (const width of [320, 390, 640]) {
  test(`an expanded goal explanation reflows above the room at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await seed(page, 1, false);
    await page.getByRole('button', { name: 'Inred', exact: true }).click();
    await page.getByText('Varför detta mål?').click();
    const goal = (await page.getByTestId('sushi-next-goal').boundingBox())!;
    const scene = (await page.locator('.sushi-pixel-world').boundingBox())!;
    const hint = (await page.getByTestId('sushi-guest-hint').boundingBox())!;
    const production = (await page.locator('.sushi-production-details summary').boundingBox())!;
    expect(goal.y + goal.height).toBeLessThanOrEqual(scene.y);
    expect(scene.y + scene.height).toBeLessThanOrEqual(hint.y);
    expect(hint.y + hint.height).toBeLessThanOrEqual(production.y);
  });
}

for (const tier of [1, 2, 3] as const) {
  test(`owned recipes have a visible position clear of guests in tier ${tier}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await seed(page, tier);
    const guests = await page.locator('.sushi-scene-guest').evaluateAll((elements) =>
      elements.map((element) => {
        const r = element.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    for (const item of SUSHI_CATALOG.filter(
      (entry) => entry.category === 'recipe' && entry.requiredRestaurantTier <= tier,
    )) {
      const sprite = page.getByTestId(`art-${item.id}`).locator('svg');
      await expect(sprite).toHaveCount(1);
      const box = await sprite.evaluate((element) => {
        const svg = element as SVGSVGElement;
        const matrix = (svg.parentElement as unknown as SVGGraphicsElement).getScreenCTM()!;
        const p = new DOMPoint(svg.x.baseVal.value, svg.y.baseVal.value).matrixTransform(matrix);
        const q = new DOMPoint(
          svg.x.baseVal.value + svg.width.baseVal.value,
          svg.y.baseVal.value + svg.height.baseVal.value,
        ).matrixTransform(matrix);
        return { x: p.x, y: p.y, width: q.x - p.x, height: q.y - p.y };
      });
      expect(
        guests.some((guest) => overlaps(box, guest)),
        `${item.id} is behind a guest in tier ${tier}`,
      ).toBe(false);
    }
  });
}
