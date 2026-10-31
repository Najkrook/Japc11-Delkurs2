import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUSHI_CATALOG,
  previewCatalogPurchase,
  previewUpgradeImpact,
} from '../src/course/sushi-game/catalog.ts';
import {
  calculateProductionRate,
  createDefaultRestaurantState,
} from '../src/course/sushi-game/economy.ts';
import { InMemorySushiRepository, SushiService } from '../src/course/sushi-game/domain-service.ts';
import { SUSHI_PROJECTS } from '../src/course/sushi-game/projects.ts';
import {
  DEFAULT_CAP_MS,
  EXTENDED_CAP_MS,
  MS_PER_HOUR,
  YEN_UNIT_MULTIPLIER as U,
} from '../src/course/sushi-game/types.ts';
import type { SushiRestaurantState } from '../src/course/sushi-game/types.ts';

const rate = (s: SushiRestaurantState) =>
  calculateProductionRate(s.kitchenCapacity, s.serviceCapacity, s.averageRevenuePerOrder)
    .yenPerMinute;
const grants = SUSHI_CATALOG.map((i) => i.id);
const fixture = async (overrides: Partial<SushiRestaurantState> = {}) => {
  const repo = new InMemorySushiRepository(),
    service = new SushiService(repo);
  const state = createDefaultRestaurantState('balance', 0, {
    permanentGrants: grants,
    restaurantTier: 3,
    ...overrides,
  });
  await repo.set(state);
  return { repo, service, state };
};

test('balance: first eligible purchase is exactly five minutes at the unchanged base rate', async () => {
  const { service } = await fixture();
  await service.collectRevenue('balance', 'five-minute-collect', 5 * 60_000);
  const bought = await service.purchaseCatalogItem('balance', 'prep_counter', 'first', 5 * 60_000);
  assert.equal(bought.success, true);
  if (!bought.success) return;
  assert.equal(bought.debitedYen, 50);
  assert.equal(bought.state.balanceUnits, 0);
  assert.equal(rate(bought.state), 20);
  assert.equal(bought.state.capMs, 24 * MS_PER_HOUR);
});

test('balance: chapter-order main purchases have useful immediate effects, final income stays90', async () => {
  const { service } = await fixture({ balanceUnits: 1000000 * U });
  const rates: number[] = [];
  for (const item of SUSHI_CATALOG.filter((i) => i.requiredTier === 'bronze')) {
    const result = await service.purchaseCatalogItem('balance', item.id, item.id, 0);
    assert.equal(result.success, true);
    if (result.success) rates.push(rate(result.state));
  }
  assert.deepEqual(rates, [20, 20, 22, 44, 48, 72, 90]);
  const final = await service.getOrInitRestaurant('balance', 0);
  assert.equal(final.capMs, 48 * MS_PER_HOUR);
  assert.equal(final.averageRevenuePerOrder, 15);
});

test('balance: base24h and extended48h remove repeated check-in advantage at a fixed rate', async () => {
  assert.equal(DEFAULT_CAP_MS, 24 * MS_PER_HOUR);
  assert.equal(EXTENDED_CAP_MS, 48 * MS_PER_HOUR);
  const amount = async (interval: number) => {
    const { service } = await fixture({
      capMs: EXTENDED_CAP_MS,
      kitchenCapacity: 3,
      serviceCapacity: 2,
    });
    for (let hour = interval; hour <= 48; hour += interval)
      await service.collectRevenue('balance', 'collect-' + hour, hour * MS_PER_HOUR);
    return (await service.getOrInitRestaurant('balance', 48 * MS_PER_HOUR)).balanceUnits;
  };
  assert.equal(await amount(12), await amount(24));
  assert.equal(await amount(24), await amount(48));
});

test('balance: generic equal-capacity service preview explicitly names the new kitchen limit', () => {
  const state = createDefaultRestaurantState('preview', 0, {
    kitchenCapacity: 4,
    serviceCapacity: 4,
  });
  const preview = previewUpgradeImpact(state, { serviceCapacityDelta: 2 });
  assert.equal(preview.yenDelta, 0);
  assert.equal(preview.isBottleneckLimiting, true);
  assert.match(preview.educationalExplanation, /köket producerar bara 4/);
});

test('migration: settle old cap/rate, discard stopped time, then apply new future-only rules once', async () => {
  const { service } = await fixture({
    balanceVersion: 1,
    capMs: 8 * MS_PER_HOUR,
    inventory: ['prep_counter', 'precision_knife'],
    kitchenCapacity: 4,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    balanceUnits: 123 * U,
    uncollectedUnits: 17,
  });
  const migrated = await service.getOrInitRestaurant('balance', 30 * MS_PER_HOUR);
  assert.equal(migrated.uncollectedUnits, 20 * 8 * 60 * U + 17);
  assert.equal(migrated.balanceUnits, 123 * U);
  assert.equal(migrated.usedProductionMs, 8 * MS_PER_HOUR);
  assert.equal(migrated.capMs, 24 * MS_PER_HOUR);
  assert.equal(rate(migrated), 22);
  assert.equal(migrated.accountedAtMs, 30 * MS_PER_HOUR);
  const same = await service.getOrInitRestaurant('balance', 30 * MS_PER_HOUR);
  assert.deepEqual(same, migrated);
  const future = await service.getOrInitRestaurant('balance', 31 * MS_PER_HOUR);
  assert.equal(future.uncollectedUnits, migrated.uncollectedUnits + 22 * 60 * U);
});

test('migration: old extended cap becomes48h without changing an already-owned upgrade or replaying old stopped time', async () => {
  const { service } = await fixture({
    balanceVersion: undefined,
    capMs: 12 * MS_PER_HOUR,
    inventory: ['prep_counter', 'cap_extension_12h'],
    kitchenCapacity: 3,
    serviceCapacity: 2,
  });
  const migrated = await service.getOrInitRestaurant('balance', 72 * MS_PER_HOUR);
  assert.equal(migrated.uncollectedUnits, 20 * 12 * 60 * U);
  assert.equal(migrated.usedProductionMs, 12 * MS_PER_HOUR);
  assert.equal(migrated.capMs, 48 * MS_PER_HOUR);
  assert.ok(migrated.inventory.includes('cap_extension_12h'));
  const next = await service.getOrInitRestaurant('balance', 73 * MS_PER_HOUR);
  assert.equal(next.uncollectedUnits, migrated.uncollectedUnits + 20 * 60 * U);
});

for (const operation of ['collect', 'purchase', 'sync', 'project', 'equip'] as const) {
  test(`migration: direct ${operation} also migrates before acting`, async () => {
    const { service, repo } = await fixture({
      balanceVersion: 1,
      capMs: 8 * MS_PER_HOUR,
      inventory: ['prep_counter', 'precision_knife'],
      kitchenCapacity: 4,
      serviceCapacity: 2,
      balanceUnits: 1000000 * U,
    });
    const now = 30 * MS_PER_HOUR;
    if (operation === 'collect') await service.collectRevenue('balance', 'direct', now);
    if (operation === 'purchase')
      await service.purchaseCatalogItem('balance', 'salmon_nigiri', 'direct', now);
    if (operation === 'sync') await service.syncMedalGrants('balance', [], now);
    if (operation === 'project')
      await service.purchaseRestaurantProject('balance', 'study_nook', 'direct', now);
    if (operation === 'equip')
      await service.equipDecoration('balance', 'wallSlot', null, 'direct', now);
    const state = (await repo.get('balance'))!;
    assert.equal(state.balanceVersion, 2);
    assert.equal(rate(state), 22);
    assert.equal(state.capMs, 24 * MS_PER_HOUR);
    if (operation !== 'collect') assert.equal(state.uncollectedUnits, 20 * 8 * 60 * U);
  });
}

test('migration: early legacy license never loses revenue or stacks bonuses beyond final90', async () => {
  const { service } = await fixture({
    balanceVersion: 1,
    capMs: 8 * MS_PER_HOUR,
    inventory: ['prep_counter', 'master_license'],
    kitchenCapacity: 3,
    serviceCapacity: 2,
    averageRevenuePerOrder: 15,
    balanceUnits: 1000000 * U,
  });
  let state = await service.getOrInitRestaurant('balance', 0);
  assert.equal(state.averageRevenuePerOrder, 15);
  const preview = previewCatalogPurchase(state, 'precision_knife')!;
  assert.equal(preview.yenDelta, 0);
  assert.match(preview.educationalExplanation, /redan denna intäktsbonus/);
  for (const id of ['precision_knife', 'conveyor_belt', 'service_counter', 'sous_chef']) {
    const bought = await service.purchaseCatalogItem('balance', id, id, 0);
    assert.equal(bought.success, true);
    if (bought.success) state = bought.state;
  }
  assert.equal(state.averageRevenuePerOrder, 15);
  assert.equal(rate(state), 90);
  assert.equal(rate(await service.getOrInitRestaurant('balance', 0)), 90);
});

test('projects: single debit, retries, concurrency and old missing project field are safe', async () => {
  const { service, repo } = await fixture({
    balanceUnits: 1000000 * U,
    completedProjects: undefined,
  });
  const [a, b] = await Promise.all([
    service.purchaseRestaurantProject('balance', 'study_nook', 'project-a', 0),
    service.purchaseRestaurantProject('balance', 'study_nook', 'project-b', 0),
  ]);
  assert.equal([a, b].filter((x) => x.success).length, 1);
  const first = a.success ? a : b;
  assert.equal(first.success, true);
  const retry = await service.purchaseRestaurantProject(
    'balance',
    'study_nook',
    a.success ? 'project-a' : 'project-b',
    0,
  );
  assert.equal(retry.success, true);
  if (retry.success) assert.equal(retry.wasAlreadyProcessed, true);
  const state = (await repo.get('balance'))!;
  assert.deepEqual(state.completedProjects, ['study_nook']);
  assert.equal(state.balanceUnits, 940000 * U);
  assert.equal(rate(state), 10);
  assert.equal(state.capMs, 24 * MS_PER_HOUR);
  assert.equal(
    (
      await service.purchaseRestaurantProject(
        'balance',
        'lantern_evening',
        a.success ? 'project-a' : 'project-b',
        0,
      )
    ).success,
    false,
  );
});

test('projects: reject locked/unknown items and uncollected funds, preserve exact register remainder', async () => {
  const { service, repo } = await fixture({
    permanentGrants: [],
    balanceUnits: 0,
    uncollectedUnits: 1000000 * U + 13,
  });
  const locked = await service.purchaseRestaurantProject('balance', 'study_nook', 'locked', 0);
  assert.equal(locked.success, false);
  if (!locked.success) assert.equal(locked.reason, 'PROJECT_LOCKED');
  const unknown = await service.purchaseRestaurantProject('balance', '__proto__', 'unknown', 0);
  assert.equal(unknown.success, false);
  if (!unknown.success) assert.equal(unknown.reason, 'PROJECT_NOT_FOUND');
  await service.syncMedalGrants('balance', ['prep_counter'], 0);
  const insufficient = await service.purchaseRestaurantProject(
    'balance',
    'study_nook',
    'insufficient',
    0,
  );
  assert.equal(insufficient.success, false);
  if (!insufficient.success) assert.equal(insufficient.reason, 'INSUFFICIENT_FUNDS');
  assert.equal((await repo.get('balance'))!.uncollectedUnits, 1000000 * U + 13);
});

test('projects: optional finite goals never alter production, course grants or catalog completion', async () => {
  const { service } = await fixture({ balanceUnits: 10000000 * U });
  let state = await service.getOrInitRestaurant('balance', 0);
  for (const project of SUSHI_PROJECTS) {
    const result = await service.purchaseRestaurantProject('balance', project.id, project.id, 0);
    assert.equal(result.success, true);
    if (result.success) state = result.state;
  }
  assert.equal(state.completedProjects!.length, 4);
  assert.equal(state.inventory.length, 0);
  assert.deepEqual(state.permanentGrants, grants);
  assert.equal(rate(state), 10);
  assert.equal(state.capMs, 24 * MS_PER_HOUR);
  assert.equal(state.usedProductionMs, 0);
});
