import { test, expect } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';

test('real income, visible telemetry and collection remain usable', async ({ page }, testInfo) => {
  const now = Date.UTC(2026, 9, 27, 12);
  await page.clock.setFixedTime(now);
  const state = createDefaultRestaurantState('audit-browser', now, {
    uncollectedUnits: 14400 * 60000,
    usedProductionMs: 24 * 3600000,
  });
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Audit' }),
    );
    localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/sushi');
  const collect = page.getByTestId('sushi-collect-btn');
  await expect(collect.locator('.sushi-collect-yen')).toHaveText('¥ 14,400');
  for (const id of ['sushi-rate-info', 'sushi-capped-badge', 'sushi-uncollected-amount']) {
    const element = page.getByTestId(id);
    await element.scrollIntoViewIfNeeded();
    await expect(element).toBeInViewport();
    expect(await element.evaluate((el) => el.closest('.sr-only'))).toBeNull();
    expect((await element.boundingBox())!.width).toBeGreaterThan(50);
  }
  await collect.click();
  await expect(collect).toBeDisabled();
  await expect(page.getByTestId('sushi-reward-pop')).toContainText('14400');
  await expect(collect.locator('.sushi-collect-yen')).toHaveText('¥ 0');
  await expect(collect).toHaveAttribute('aria-label', /Hämta 0 intjänade yen/);
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await expect
    .poll(async () => (await page.locator('.sushi-progress-fill').boundingBox())?.width)
    .toBe(0);
  await expect(page.getByTestId('sushi-capped-badge')).toHaveCount(0);
  await expect(page.getByTestId('sushi-uncollected-amount')).toContainText('0');
  await expect(page.getByTestId('sushi-spendable-balance')).toContainText('14,400');
  await expect(
    page.locator('.sushi-stats-plaque, .sushi-clock-badge, .sushi-calendar-badge'),
  ).toHaveCount(0);
  await expect(page.getByTestId('starter-room')).toHaveAttribute(
    'href',
    '/sprites/sushi/tiers/tier-1.png',
  );
  await expect(page.locator('image[href$="sakura_sushi_scene.png"]')).toHaveCount(0);
  const main = page.locator('.sushi-main');
  expect(await main.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('collected.png') });
  expect(errors).toEqual([]);
});

test('cozy companion: guests teach phrases and a goal leads to a visible purchase', async ({
  page,
}, testInfo) => {
  const now = Date.UTC(2026, 9, 27, 12);
  await page.clock.setFixedTime(now);
  const fixture = createDefaultRestaurantState('cozy-browser', now, {
    balanceUnits: 1000 * 60000,
    permanentGrants: ['prep_counter'],
  });
  await page.addInitScript((state) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: state.id, displayName: 'Sakura' }),
    );
    localStorage.setItem(`japc11-dk2-sushi-v1-${state.id}`, JSON.stringify(state));
  }, fixture);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('sushi-guest-0')).toBeVisible();
  await expect(page.getByTestId('art-prep-counter')).toHaveCount(0);
  await page.getByTestId('sushi-guest-0').click();
  await expect(page.getByTestId('sushi-phrase-bubble')).toContainText('いらっしゃいませ');
  await expect(page.getByTestId('sushi-phrase-bubble')).toContainText('Välkommen in');
  await page.getByRole('button', { name: 'Nästa fras' }).click();
  await expect(page.getByTestId('sushi-phrase-bubble')).toContainText('いただきます');
  await page.getByRole('button', { name: 'Stäng samtal' }).click();
  await page.getByTestId('sushi-goal-action').click();
  await page.getByTestId('buy-btn-prep_counter').click();
  await expect(page.getByTestId('sushi-reward-pop')).toContainText('Nyhet!');
  await expect(page.getByTestId('art-prep-counter')).toHaveCount(1);
  await page.getByTestId('sushi-close-shop-btn').click();
  await expect(page.getByTestId('sushi-next-goal')).toContainText('1 / 21');
  await expect(page.getByTestId('sushi-rate-info')).toContainText('20 ¥/min');
  await page.locator('.sushi-production-details summary').click();
  await expect(page.getByTestId('sushi-register-bottleneck-explainer')).toBeVisible();
  await page.locator('.sushi-production-details summary').click();
  // Wait for the reward animation to finish before reviewing the normal playfield.
  await expect(page.getByTestId('sushi-reward-pop')).toHaveCount(0, { timeout: 5000 });
  const banner = page.getByTestId('sushi-unlock-banner');
  await expect(banner).toBeVisible();
  expect((await banner.boundingBox())!.height).toBeLessThan(150);
  await page.screenshot({ path: testInfo.outputPath('cozy-unlock.png') });
  await page.getByTestId('sushi-banner-dismiss-btn').click();
  await page.screenshot({ path: testInfo.outputPath('cozy-playfield.png') });
});

test('buying and removing decoration changes the rendered scene', async ({ page }) => {
  const now = Date.UTC(2026, 9, 27, 12);
  await page.clock.setFixedTime(now);
  const state = createDefaultRestaurantState('audit-decoration', now, {
    balanceUnits: 1000 * 60000,
    permanentGrants: ['paper_lantern'],
  });
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Audit' }),
    );
    localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  await page.goto('/#/sushi');
  const lantern = page.getByTestId('art-paper_lantern');
  await expect(page.getByTestId('sushi-collect-btn')).toBeDisabled();
  await expect(lantern).toHaveCount(0);
  await page.getByTestId('sushi-toggle-shop').click();
  await page.getByTestId('buy-btn-paper_lantern').click();
  await expect(page.getByTestId('owned-indicator-paper_lantern')).toBeVisible();
  await page.getByTestId('sushi-close-shop-btn').click();
  await page.getByTestId('sushi-toggle-menu').click();
  const wallSlot = page.getByTestId('decoration-wallSlot');
  await wallSlot.locator('summary').click();
  await wallSlot.getByRole('button', { name: /Papperslykta/ }).click();
  await expect(lantern).toHaveCount(1);
  await wallSlot.getByRole('button', { name: /Ta bort från/ }).click();
  await expect(lantern).toHaveCount(0);
  await page.getByTestId('sushi-close-menu-btn').click();
  await expect(page.getByTestId('starter-room')).toHaveAttribute(
    'href',
    '/sprites/sushi/tiers/tier-1.png',
  );
  await expect(page.locator('image[href$="sakura_sushi_scene.png"]')).toHaveCount(0);
});
