import { test, expect } from '@playwright/test';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';
import { SUSHI_CATALOG } from '../../src/course/sushi-game/catalog.ts';

for (const tier of [2, 3] as const) {
  for (const furnished of [false, true]) {
    test(`expanded tier ${tier}, ${furnished ? 'owned furnishings' : 'basic room'}: fits existing activity`, async ({
      page,
    }, info) => {
      const state = createDefaultRestaurantState(`expanded-${tier}-${furnished}`, Date.now(), {
        restaurantTier: tier,
        kitchenCapacity: 6,
        serviceCapacity: 6,
        inventory: furnished
          ? SUSHI_CATALOG.filter((item) => item.requiredRestaurantTier <= tier).map(
              (item) => item.id,
            )
          : [],
        equipped: furnished
          ? { wallSlot: 'paper_lantern', floorSlot: 'potted_plant' }
          : { wallSlot: null, floorSlot: null },
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        if (!error.message.includes('/firestore.googleapis.com/')) errors.push(error.message);
      });
      await page.addInitScript((fixture) => {
        sessionStorage.setItem(
          'japc11-mock-user',
          JSON.stringify({ uid: fixture.id, displayName: 'Expanded QA' }),
        );
        localStorage.setItem(`japc11-sushi-finale-seen-${fixture.id}`, 'true');
        localStorage.setItem(`japc11-dk2-sushi-v1-${fixture.id}`, JSON.stringify(fixture));
      }, state);
      await page.goto('/#/sushi');
      const scene = page.getByTestId('restaurant-scene');
      await expect(scene).toBeVisible();
      await expect(page.getByTestId('starter-room')).toHaveAttribute(
        'href',
        `/sprites/sushi/tiers/tier-${tier}-expanded.png`,
      );
      await expect(page.getByTestId('counter-foreground')).toHaveAttribute(
        'href',
        `/sprites/sushi/tiers/tier-${tier}-expanded-front.png`,
      );
      await expect
        .poll(() =>
          page.evaluate(() =>
            Promise.all(
              Array.from(
                document.querySelectorAll<SVGImageElement>(
                  '[data-testid="starter-room"], [data-testid="counter-foreground"]',
                ),
              ).map(async (element) => {
                const image = new Image();
                image.src = element.href.baseVal;
                await image.decode();
                return image.naturalWidth;
              }),
            ),
          ),
        )
        .toEqual([1536, 1536]);
      await expect(page.getByTestId('sushi-activity-chef')).toBeVisible();
      expect(await page.locator('.sushi-scene-guest').count()).toBe(3);
      if (!furnished) {
        await expect(page.getByTestId('art-conveyor-belt')).toHaveCount(0);
        await expect(page.getByTestId('art-sous_chef')).toHaveCount(0);
        await expect(scene.locator('[data-dish="salmon_nigiri"]')).toHaveCount(0);
      }
      const saved = await page.evaluate(
        (uid) => localStorage.getItem(`japc11-dk2-sushi-v1-${uid}`),
        state.id,
      );
      await page.getByTestId('sushi-guest-0').click();
      await expect(page.getByTestId('sushi-phrase-bubble')).toBeVisible();
      await page.keyboard.press('Escape');
      await page.getByTestId('sushi-guest-0').blur();
      for (const [phase, time] of [
        ['preparing', 1600],
        ['serving', 5200],
        ['reaction', 7600],
      ] as const) {
        await scene.evaluate((element, ms) => {
          for (const animation of element.getAnimations({ subtree: true })) {
            animation.pause();
            animation.currentTime = ms;
          }
        }, time);
        await page.screenshot({ path: info.outputPath(`${phase}.png`) });
      }
      expect(
        await page.evaluate((uid) => localStorage.getItem(`japc11-dk2-sushi-v1-${uid}`), state.id),
      ).toBe(saved);
      expect(errors).toEqual([]);
      await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    });
  }
}
