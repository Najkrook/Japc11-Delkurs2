import { test, expect, type Page } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import type { SushiRestaurantState } from '../../src/course/sushi-game/types.ts';

async function seed(page: Page, overrides: Partial<SushiRestaurantState> = {}) {
  const state = createDefaultRestaurantState('identity-followups', Date.now(), {
    balanceUnits: 20000 * 60000,
    ...overrides,
  });
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Sakura' }),
    );
    if (!localStorage.getItem(`japc11-dk2-sushi-v1-${fixture.id}`))
      localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('restaurant-scene')).toBeVisible();
}

test('named menu destinations show one section, support keyboard navigation and open memories directly', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByTestId('sushi-toggle-menu').click();
  const menu = page.getByTestId('sushi-scene-placeholder');
  await expect(menu.getByRole('tab', { name: 'Inredning', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('decoration-wallSlot')).toBeInViewport();
  await expect(menu.getByRole('tabpanel')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('menu-phone.png') });
  await menu.getByRole('tab', { name: 'Projekt', exact: true }).click();
  await expect(page.getByTestId('sushi-projects')).toBeInViewport();
  await expect(page.getByTestId('decoration-wallSlot')).toBeHidden();
  await menu.getByRole('tab', { name: 'Projekt', exact: true }).press('ArrowRight');
  await expect(menu.getByRole('tab', { name: 'Minnen', exact: true })).toBeFocused();
  await expect(page.getByTestId('sushi-chapter-honors')).toBeVisible();
  await menu.getByRole('tab', { name: 'Minnen', exact: true }).press('Home');
  await expect(menu.getByRole('tab', { name: 'Inredning', exact: true })).toBeFocused();
  await menu.getByRole('tab', { name: 'Meny', exact: true }).click();
  await expect(page.getByTestId('sushi-menu')).toContainText('Klassisk nigiri');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('sushi-toggle-menu')).toBeFocused();
  await page.getByRole('button', { name: /Kapitelminnen:/ }).click();
  await expect(menu.getByRole('tab', { name: 'Minnen', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

for (const tier of [1, 2, 3] as const) {
  test(`tier ${tier}: purchase offers a clear room reveal, keeps the workbench visible and never charges twice`, async ({
    page,
  }, info) => {
    await seed(page, { restaurantTier: tier, permanentGrants: ['prep_counter'] });
    await page.getByTestId('sushi-toggle-shop').click();
    await page.getByRole('tab', { name: 'Kök', exact: true }).click();
    await page.getByTestId('buy-btn-prep_counter').click();
    const see = page.getByTestId('sushi-see-purchase');
    await expect(see).toBeFocused();
    await expect(see).toBeInViewport();
    await see.click();
    const reveal = page.getByTestId('sushi-purchase-view');
    await expect(reveal).toBeFocused();
    await expect(reveal).toContainText('Förbättrad beredningsbänk');
    await expect(page.getByTestId('sushi-reward-pop')).toHaveCount(0);
    await expect(page.getByTestId('sushi-unlocks-panel')).toBeHidden();
    await expect(page.getByTestId('sushi-purchase-spotlight')).toHaveAttribute(
      'data-item-id',
      'prep_counter',
    );
    const room = await page.getByTestId('restaurant-scene').boundingBox();
    const toolbar = await reveal.boundingBox();
    expect(room!.y + room!.height).toBeLessThanOrEqual(toolbar!.y + 2);
    expect(toolbar!.y + toolbar!.height).toBeLessThan(page.viewportSize()!.height);
    const workbench = await page
      .getByTestId('art-prep-counter')
      .locator('svg')
      .evaluate((e) => ({ x: e.getAttribute('x'), width: e.getAttribute('width') }));
    const chef = await page
      .getByTestId('sushi-activity-chef')
      .locator('..')
      .evaluate((e) => ({ x: e.getAttribute('x'), width: e.getAttribute('width') }));
    expect(Number(workbench.x)).toBeGreaterThan(Number(chef.x) + Number(chef.width));
    await page.screenshot({ path: info.outputPath(`purchase-tier-${tier}.png`) });
    await reveal.getByRole('button', { name: 'Tillbaka till butik', exact: true }).click();
    await expect(see).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Kök', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await see.click();
    await page.keyboard.press('Escape');
    await expect(reveal).toHaveCount(0);
    await expect(page.getByTestId('sushi-toggle-shop')).toBeFocused();
    await page.reload();
    await expect(page.getByTestId('art-prep-counter')).toBeVisible();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('japc11-dk2-sushi-v1-identity-followups')!),
    );
    expect(saved.balanceUnits).toBe(19950 * 60000);
    expect(saved.inventory).toEqual(['prep_counter']);
  });
}

test('owned decoration is labeled unplaced and the purchase invitation keeps placement explicit', async ({
  page,
}) => {
  await seed(page, { permanentGrants: ['paper_lantern'] });
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByRole('tab', { name: 'Dekoration', exact: true }).click();
  await page.getByTestId('buy-btn-paper_lantern').click();
  await expect(page.getByTestId('owned-indicator-paper_lantern')).toHaveText('Ägd · Inte placerad');
  await page.getByTestId('sushi-see-purchase').click();
  await expect(page.getByTestId('sushi-decoration-preview')).toContainText('Ägd · Inte placerad');
  await page.getByTestId('sushi-preview-place').click();
  await expect(page.getByTestId('sushi-decoration-preview')).toHaveCount(0);
  await expect(page.getByTestId('art-paper_lantern')).toBeVisible();
  await page.getByTestId('sushi-toggle-shop').click();
  await expect(page.getByTestId('owned-indicator-paper_lantern')).toHaveText(
    'Placerad i restaurangen',
  );
});

test('catalog clearly distinguishes locked, saving, available and owned items', async ({
  page,
}) => {
  await seed(page, {
    balanceUnits: 100 * 60000,
    permanentGrants: ['prep_counter', 'salmon_nigiri'],
    inventory: ['potted_plant'],
  });
  await page.getByTestId('sushi-toggle-shop').click();
  for (const [id, state, badge] of [
    ['paper_lantern', 'locked', 'Låst'],
    ['salmon_nigiri', 'unaffordable', 'Spara yen'],
    ['prep_counter', 'affordable', 'Kan köpas'],
    ['potted_plant', 'owned', 'Ägd'],
  ]) {
    await expect(page.getByTestId(`unlock-card-${id}`)).toHaveAttribute(
      'data-purchase-state',
      state,
    );
    await expect(page.getByTestId(`unlock-badge-${id}`)).toContainText(badge);
  }
  await expect(page.getByTestId('buy-btn-prep_counter')).toBeEnabled();
  await expect(page.getByTestId('buy-btn-salmon_nigiri')).toBeDisabled();
  await expect(page.getByTestId('buy-btn-potted_plant')).toBeDisabled();
  await expect(page.getByTestId('study-link-btn-paper_lantern')).toBeEnabled();
});

test('purchase reveal fits a narrow phone and keeps reduced-motion highlighting static', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, { permanentGrants: ['prep_counter'] });
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByTestId('buy-btn-prep_counter').click();
  await page.getByTestId('sushi-see-purchase').click();
  const view = page.getByTestId('sushi-purchase-view');
  const bounds = await view.boundingBox();
  const room = await page.getByTestId('restaurant-scene').boundingBox();
  expect(room!.y + room!.height).toBeLessThanOrEqual(bounds!.y + 2);
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await expect(view.getByRole('button', { name: 'Klart', exact: true })).toBeInViewport();
  await expect(page.getByTestId('sushi-purchase-spotlight')).toHaveCSS('animation-name', 'none');
});

test('all four menu destinations fit a narrow phone without clipped labels', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(page);
  await page.getByTestId('sushi-toggle-menu').click();
  const tabs = page.getByRole('tablist', { name: 'Restaurangens avdelningar' }).getByRole('tab');
  for (const tab of await tabs.all()) {
    await expect(tab).toBeInViewport();
    expect(await tab.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  }
  await expect(page.getByRole('tab', { name: 'Inredning', exact: true })).toBeFocused();
});

for (const variant of [
  { name: 'missing medal', overrides: {}, state: 'locked', reason: 'Kräver brons i kapitel 9.' },
  {
    name: 'missing funds',
    overrides: { permanentGrants: ['conveyor_belt'], balanceUnits: 0 },
    state: 'unaffordable',
    reason: 'Saknar ¥ 3',
  },
  {
    name: 'ready',
    overrides: { permanentGrants: ['conveyor_belt'] },
    state: 'affordable',
    reason: 'Du kan renovera nu.',
  },
] as const) {
  test(`renovation: ${variant.name} has an explicit reason and consistent action state in both themes`, async ({
    page,
  }, info) => {
    await seed(page, variant.overrides as Partial<SushiRestaurantState>);
    await page.getByTestId('sushi-toggle-shop').click();
    const renovation = page.getByTestId('sushi-renovation-card');
    const buy = page.getByTestId('buy-renovation');
    await expect(renovation).toHaveAttribute('data-purchase-state', variant.state);
    await expect(page.getByTestId('sushi-renovation-reason')).toContainText(variant.reason);
    await expect(buy).toHaveAttribute('aria-describedby', 'sushi-renovation-reason-shop');
    for (let theme = 0; theme < 2; theme++) {
      if (variant.state === 'affordable') await expect(buy).toBeEnabled();
      else {
        await expect(buy).toBeDisabled();
        expect(await buy.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
          'rgb(227, 221, 209)',
        );
      }
      await page.screenshot({ path: info.outputPath(`renovation-theme-${theme}.png`) });
      if (theme === 0) {
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: /🍵 Washi|🌸 Sakura/ }).click();
        await page.getByTestId('sushi-toggle-shop').click();
      }
    }
  });
}
