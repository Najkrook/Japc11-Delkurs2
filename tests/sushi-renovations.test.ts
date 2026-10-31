import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultRestaurantState } from '../src/course/sushi-game/economy.ts';
import { SushiService, InMemorySushiRepository } from '../src/course/sushi-game/domain-service.ts';
import {
  migrateRestaurantTier,
  RESTAURANT_RENOVATIONS,
} from '../src/course/sushi-game/renovations.ts';
import { SUSHI_CATALOG } from '../src/course/sushi-game/catalog.ts';
import { getRestaurantActivity } from '../src/course/sushi-game/restaurant-scene.ts';

const now = 100000;
async function fixture(overrides = {}) {
  const repo = new InMemorySushiRepository();
  const state = createDefaultRestaurantState('renovation-user', now, {
    balanceUnits: 20000 * 60000,
    ...overrides,
  });
  await repo.set(state);
  return { repo, service: new SushiService(repo), state };
}

test('both renovations require previous tier, bronze and exact spendable balance', async () => {
  for (const renovation of RESTAURANT_RENOVATIONS) {
    const { service, repo, state } = await fixture({ restaurantTier: renovation.targetTier - 1 });
    let result = await service.renovateRestaurant(state.id, renovation.targetTier, 'buy', now);
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.reason, 'MEDAL_REQUIRED');
    await repo.set({
      ...state,
      permanentGrants: [renovation.bronzeGrant],
      balanceUnits: renovation.priceUnits - 1,
      uncollectedUnits: 1e12,
    });
    result = await service.renovateRestaurant(state.id, renovation.targetTier, 'buy', now);
    if (!result.success) assert.equal(result.reason, 'INSUFFICIENT_FUNDS');
    else assert.fail();
    await repo.set({
      ...state,
      permanentGrants: [renovation.bronzeGrant],
      balanceUnits: renovation.priceUnits,
    });
    result = await service.renovateRestaurant(state.id, renovation.targetTier, 'buy', now);
    assert.ok(result.success);
    assert.equal(result.state?.balanceUnits, 0);
    assert.equal(result.state?.restaurantTier, renovation.targetTier);
    assert.equal(result.state?.kitchenCapacity, state.kitchenCapacity);
    assert.equal(result.state?.serviceCapacity, state.serviceCapacity);
    assert.equal(result.state?.averageRevenuePerOrder, state.averageRevenuePerOrder);
    assert.equal(result.state?.capMs, state.capMs);
  }
});

test('later medals cannot skip a renovation; concurrent retries debit once and bind request identity', async () => {
  const { service, state, repo } = await fixture({
    permanentGrants: ['conveyor_belt', 'sous_chef'],
  });
  const skip = await service.renovateRestaurant(state.id, 3, 'skip', now);
  assert.equal(skip.success, false);
  if (!skip.success) assert.equal(skip.reason, 'PREVIOUS_TIER_REQUIRED');
  const results = await Promise.all(
    Array.from({ length: 6 }, () => service.renovateRestaurant(state.id, 2, 'same', now + 1000)),
  );
  assert.ok(results.every((r) => r.success));
  assert.equal(results.filter((r) => r.success && !r.wasAlreadyProcessed).length, 1);
  const saved = (await repo.get(state.id))!;
  assert.equal(saved.balanceUnits, state.balanceUnits - 3600 * 60000);
  assert.equal(saved.uncollectedUnits, 10000);
  assert.equal(saved.usedProductionMs, 1000);
  const conflict = await service.renovateRestaurant(state.id, 3, 'same', now + 1000);
  if (!conflict.success) assert.equal(conflict.reason, 'REQUEST_CONFLICT');
  else assert.fail();
  for (const target of [0, 1, 4, NaN, 2.5])
    assert.equal(
      (await service.renovateRestaurant(state.id, target, 'invalid', now)).success,
      false,
    );
  assert.equal(
    (await service.renovateRestaurant('another-account', 2, 'other', now)).success,
    false,
  );
});

test('catalog requires both the medal and correct chapter-group tier', async () => {
  for (const tier of [1, 2, 3] as const) {
    for (const item of SUSHI_CATALOG) {
      const { service, state } = await fixture({
        restaurantTier: tier,
        permanentGrants: [item.id],
      });
      const result = await service.purchaseCatalogItem(state.id, item.id, `buy_${item.id}`, now);
      assert.equal(result.success, tier >= item.requiredRestaurantTier, item.id);
      if (!result.success) assert.equal(result.reason, 'RESTAURANT_TIER_REQUIRED');
    }
  }
});

test('legacy inventory determines free tier exactly once without changing any other fields', () => {
  for (const [inventory, tier] of [
    [[], 1],
    [['precision_knife'], 1],
    [['wave_print'], 2],
    [['omakase_menu'], 3],
    [['unknown'], 1],
  ] as const) {
    const legacy = createDefaultRestaurantState('old', now, {
      schemaVersion: 1,
      inventory: [...inventory],
      permanentGrants: ['sous_chef'],
      balanceUnits: 12345,
      uncollectedUnits: 6789,
      completedProjects: ['study_nook'],
    });
    const migrated = migrateRestaurantTier(legacy);
    assert.equal(migrated.restaurantTier, tier);
    assert.equal(migrated.schemaVersion, 2);
    assert.deepEqual(
      { ...migrated, schemaVersion: legacy.schemaVersion, restaurantTier: legacy.restaurantTier },
      legacy,
    );
    assert.equal(migrateRestaurantTier(migrated), migrated);
  }
});

test('all service entrypoints migrate legacy saves and new saves stay at tier 1', async () => {
  const { service, state, repo } = await fixture({ schemaVersion: 1, inventory: ['sous_chef'] });
  await service.collectRevenue(state.id, 'collect', now);
  assert.equal((await repo.get(state.id))?.restaurantTier, 3);
  const fresh = await service.getOrInitRestaurant('fresh', now, ['sous_chef']);
  assert.equal(fresh.restaurantTier, 1);
  assert.equal(fresh.schemaVersion, 2);
});

test('guest counts follow the room seats without changing production timing', () => {
  const state = createDefaultRestaurantState('art', now, {
    serviceCapacity: 6,
    kitchenCapacity: 6,
  });
  assert.equal(getRestaurantActivity(state, 1).guests, 2);
  assert.equal(getRestaurantActivity(state, 2).guests, 3);
  assert.equal(getRestaurantActivity(state, 3).guests, 3);
  assert.equal(
    getRestaurantActivity(state, 1).cycleSeconds,
    getRestaurantActivity(state, 3).cycleSeconds,
  );
});

test('the conveyor requires tier 3 while old tier 2 owners keep their purchase', async () => {
  const locked = await fixture({ restaurantTier: 2, permanentGrants: ['conveyor_belt'] });
  const rejected = await locked.service.purchaseCatalogItem(
    locked.state.id,
    'conveyor_belt',
    'belt-early',
    now,
  );
  assert.equal(rejected.success, false);
  if (!rejected.success) assert.equal(rejected.reason, 'RESTAURANT_TIER_REQUIRED');
  assert.equal((await locked.repo.get(locked.state.id))?.balanceUnits, locked.state.balanceUnits);

  const eligible = await fixture({ restaurantTier: 3, permanentGrants: ['conveyor_belt'] });
  const purchased = await eligible.service.purchaseCatalogItem(
    eligible.state.id,
    'conveyor_belt',
    'belt-final',
    now,
  );
  assert.equal(purchased.success, true);
  assert.equal(purchased.state?.serviceCapacity, eligible.state.serviceCapacity + 2);

  const legacy = createDefaultRestaurantState('old-belt-owner', now, {
    schemaVersion: 1,
    inventory: ['conveyor_belt'],
    serviceCapacity: 4,
    balanceUnits: 12345,
  });
  const migrated = migrateRestaurantTier(legacy);
  assert.equal(
    migrated.restaurantTier,
    2,
    'a tier-2 purchase must not grant a free tier-3 renovation',
  );
  assert.deepEqual(migrated.inventory, ['conveyor_belt']);
  assert.equal(migrated.serviceCapacity, 4);
  assert.equal(migrated.balanceUnits, 12345);
});
