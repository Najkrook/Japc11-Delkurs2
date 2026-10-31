import { test, expect } from '@playwright/test';
import { SUSHI_CATALOG } from '../../src/course/sushi-game/catalog.ts';
import { createDefaultRestaurantState } from '../../src/course/sushi-game/economy.ts';

// Later study grants can unlock cosmetic projects before a player renovates.
// Check each room with the catalog items available at its tier and both slots.
for (const tier of [1, 2, 3] as const) {
  test(`tier ${tier} keeps its furnished scene after reload`, async ({ page }, info) => {
    const available = SUSHI_CATALOG.filter((item) => item.requiredRestaurantTier <= tier);
    const floor = tier === 3 ? 'golden_maneki_neko' : 'potted_plant';
    const state = createDefaultRestaurantState(`furnished-room-${tier}`, Date.now(), {
      restaurantTier: tier,
      kitchenCapacity: tier === 3 ? 6 : 4,
      serviceCapacity: tier === 1 ? 2 : 6,
      permanentGrants: SUSHI_CATALOG.map((item) => item.id),
      inventory: available.map((item) => item.id),
      completedProjects: ['study_nook', 'lantern_evening', 'garden_terrace', 'hanami_festival'],
      equipped: { wallSlot: 'noren_curtain', floorSlot: floor },
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
    const scene = page.getByTestId('restaurant-scene');
    await expect(scene).toHaveAttribute('data-tier', String(tier));
    for (const recipe of available.filter((item) => item.category === 'recipe')) {
      await expect(page.getByTestId(`art-${recipe.id}`)).toHaveCount(1);
    }
    for (const id of ['study_nook', 'lantern_evening', 'garden_terrace', 'hanami_festival']) {
      await expect(page.getByTestId(`art-project-${id}`)).toHaveCount(1);
    }
    await expect(page.getByTestId('art-noren_curtain')).toHaveCount(1);
    await expect(page.getByTestId(`art-${floor}`)).toHaveCount(1);
    await expect(page.getByTestId('art-paper_lantern')).toHaveCount(0);
    if (tier === 1) {
      await expect(page.getByTestId('art-prep-counter').locator('image')).toHaveAttribute(
        'href',
        '/sprites/sushi/upgrades/tier-1-prep-cabinet.png',
      );
    } else {
      await expect(page.getByTestId('art-service_counter').locator('image')).toHaveAttribute(
        'href',
        '/sprites/sushi/upgrades/entrance-host-station.png',
      );
    }
    if (tier === 3) {
      await expect(page.getByTestId('starter-room')).toHaveAttribute(
        'href',
        '/sprites/sushi/tiers/tier-3-expanded-no-bench.png',
      );
      await expect(page.getByTestId('art-conveyor-belt').locator('image')).toHaveAttribute(
        'href',
        '/sprites/sushi/upgrades/tier-3-l-conveyor.png',
      );
    } else {
      await expect(scene).toHaveAttribute('data-conveyor', 'false');
      await expect(page.getByTestId('art-conveyor-belt')).toHaveCount(0);
    }
    await scene.screenshot({ path: info.outputPath('furnished-room.png'), animations: 'disabled' });
    await page.reload();
    await expect(page.getByTestId('art-project-hanami_festival')).toHaveCount(1);
    await expect(page.getByTestId(`art-${floor}`)).toHaveCount(1);
    await expect(page.getByTestId('art-salmon_nigiri')).toHaveCount(1);
  });
}
