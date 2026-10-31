import { test, expect } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';

test('guest phrases, locked prices and empty decoration link are usable', async ({ page }) => {
  const state = createDefaultRestaurantState('usability-browser', Date.now());
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Test' }),
    );
    localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [{ lang: 'en-US', name: 'English' }],
        addEventListener() {},
        cancel() {},
        speak() {},
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        constructor(_text: string) {}
      },
    });
  }, state);
  await page.goto('/#/sushi');
  await expect(page.getByTestId('sushi-next-goal')).toContainText('Brons (60 %)');
  await expect(page.getByTestId('sushi-next-goal')).toContainText('0 % klart');
  await page.getByTestId('sushi-guest-0').click();
  await page.getByTestId('sushi-phrase-speak').click();
  await expect(page.getByTestId('sushi-speech-error')).toContainText('saknar en japansk');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('sushi-phrase-bubble')).toHaveCount(0);
  await page.getByTestId('sushi-toggle-menu').click();
  await page.getByTestId('decoration-wallSlot').locator('summary').click();
  await page.getByTestId('decoration-shop-wallSlot').click();
  await expect(page.getByRole('tab', { name: 'Dekoration' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByTestId('unlock-card-paper_lantern')).toBeVisible();
  await expect(page.getByTestId('unlock-card-prep_counter')).toBeHidden();
  await expect(page.getByTestId('locked-price-paper_lantern')).toContainText('¥ 300');
  await page.getByRole('tab', { name: 'Alla', exact: true }).click();
  await expect(page.getByTestId('capacity-preview-prep_counter')).toContainText('1 → 3');
  await expect(page.getByTestId('upgrade-preview-conveyor_belt')).toContainText('+0 ¥/min');
  await expect(page.getByTestId('bottleneck-explainer-conveyor_belt')).toContainText(
    'köket producerar bara 1',
  );
});

test('an unlocked goal opens an unfiltered shop after visiting decoration', async ({ page }) => {
  const state = createDefaultRestaurantState('usability-unlocked', Date.now(), {
    permanentGrants: ['prep_counter'],
    balanceUnits: 1000 * 60000,
  });
  await page.addInitScript((fixture) => {
    sessionStorage.setItem(
      'japc11-mock-user',
      JSON.stringify({ uid: fixture.id, displayName: 'Test' }),
    );
    localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
  }, state);
  await page.goto('/#/sushi');
  await page.getByTestId('sushi-toggle-menu').click();
  await page.getByTestId('decoration-wallSlot').locator('summary').click();
  await page.getByTestId('decoration-shop-wallSlot').click();
  await page.getByTestId('sushi-close-shop-btn').click();
  await expect(page.getByTestId('sushi-next-goal')).toContainText('¥ 50');
  await page.getByTestId('sushi-goal-action').click();
  await expect(page.getByTestId('buy-btn-prep_counter')).toBeVisible();
});
