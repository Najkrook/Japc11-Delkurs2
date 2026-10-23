/**
 * Unit & Integration Test Suite for Milestone 3
 * Tickets 06, 07, 08: Shop Catalog, Capacity & Cap Upgrades
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUSHI_CATALOG,
  getCatalogItem,
  isCatalogItem,
  previewUpgradeImpact,
  previewCatalogPurchase,
} from '../src/course/sushi-game/catalog.ts';
import {
  SushiService,
  InMemorySushiRepository,
  purchaseCatalogItem,
} from '../src/course/sushi-game/service.ts';
import {
  yenToUnits,
  unitsToWholeYen,
  calculateProductionRate,
  createDefaultRestaurantState,
} from '../src/course/sushi-game/economy.ts';
import {
  MS_PER_MINUTE,
  MS_PER_HOUR,
  DEFAULT_CAP_MS,
  EXTENDED_CAP_MS,
} from '../src/course/sushi-game/types.ts';

// ==========================================
// 1. Catalog Domain Engine Tests
// ==========================================

test('M3-Catalog: Canonical catalog defines all 7 MVP items with rich typing', () => {
  assert.equal(SUSHI_CATALOG.length, 7, 'Catalog must contain exactly 7 items');

  const prepCounter = getCatalogItem('prep_counter');
  assert.ok(prepCounter, 'prep_counter must exist');
  assert.equal(prepCounter.priceYen, 300);
  assert.equal(prepCounter.priceUnits, 18_000_000);
  assert.equal(prepCounter.kitchenCapacityDelta, 2);
  assert.equal(prepCounter.requiredLesson, 6);
  assert.equal(prepCounter.requiredTier, 'bronze');
  assert.equal(prepCounter.targetWeekId, 'week-1');

  const capExt = getCatalogItem('cap_extension_12h');
  assert.ok(capExt, 'cap_extension_12h must exist');
  assert.equal(capExt.priceYen, 1800);
  assert.equal(capExt.priceUnits, 108_000_000);
  assert.equal(capExt.newCapMs, EXTENDED_CAP_MS);
  assert.equal(capExt.requiredLesson, 7);
  assert.equal(capExt.requiredTier, 'bronze');
  assert.equal(capExt.targetWeekId, 'week-2');

  const conveyor = getCatalogItem('conveyor_belt');
  assert.ok(conveyor, 'conveyor_belt must exist');
  assert.equal(conveyor.priceYen, 3600);
  assert.equal(conveyor.priceUnits, 216_000_000);
  assert.equal(conveyor.serviceCapacityDelta, 2);
  assert.equal(conveyor.requiredLesson, 9);
  assert.equal(conveyor.requiredTier, 'bronze');
  assert.equal(conveyor.targetWeekId, 'week-4');
});

test('M3-Catalog: Type guard isCatalogItem and lookup getCatalogItem handle valid and invalid IDs', () => {
  assert.equal(isCatalogItem('prep_counter'), true);
  assert.equal(isCatalogItem('conveyor_belt'), true);
  assert.equal(isCatalogItem('cap_extension_12h'), true);
  assert.equal(isCatalogItem('non_existent_item'), false);
  assert.equal(isCatalogItem(''), false);

  assert.equal(getCatalogItem('unknown_id'), undefined);
});

test('M3-Bottleneck: calculateProductionRate accurately models base, upgraded, and asymmetrical bottlenecks', () => {
  // 1. Base cold start: kitchen 1, service 2 -> 10 ¥/min (bottleneck: kitchen)
  const baseRate = calculateProductionRate(1, 2, 10);
  assert.equal(baseRate.ordersPerMinute, 1);
  assert.equal(baseRate.yenPerMinute, 10);
  assert.equal(baseRate.bottleneck, 'kitchen');

  // 2. Prep counter bought first (+2 kitchen): kitchen 3, service 2 -> 20 ¥/min (bottleneck: service, +10 ¥/min)
  const prepFirstRate = calculateProductionRate(3, 2, 10);
  assert.equal(prepFirstRate.ordersPerMinute, 2);
  assert.equal(prepFirstRate.yenPerMinute, 20);
  assert.equal(prepFirstRate.bottleneck, 'service');

  // 3. Conveyor belt bought first (+2 service): kitchen 1, service 4 -> 10 ¥/min (bottleneck: kitchen, 0 ¥/min jump!)
  const conveyorFirstRate = calculateProductionRate(1, 4, 10);
  assert.equal(conveyorFirstRate.ordersPerMinute, 1);
  assert.equal(conveyorFirstRate.yenPerMinute, 10);
  assert.equal(conveyorFirstRate.bottleneck, 'kitchen');

  // 4. Prep counter bought AFTER conveyor belt: kitchen 3, service 4 -> 30 ¥/min (+20 ¥/min double jump!)
  const bothUpgradesRate = calculateProductionRate(3, 4, 10);
  assert.equal(bothUpgradesRate.ordersPerMinute, 3);
  assert.equal(bothUpgradesRate.yenPerMinute, 30);
  assert.equal(bothUpgradesRate.bottleneck, 'kitchen');
});

test('M3-Preview: previewCatalogPurchase provides prospective rates and pedagogical bottleneck callout', () => {
  const baseState = createDefaultRestaurantState('test-user', 1000);

  // Preview prep counter on base state
  const prepPreview = previewCatalogPurchase(baseState, 'prep_counter');
  assert.ok(prepPreview);
  assert.equal(prepPreview.prospectiveRate.yenPerMinute, 20);
  assert.equal(prepPreview.yenDelta, 10);
  assert.equal(prepPreview.isBottleneckLimiting, false);
  assert.ok(prepPreview.educationalExplanation.includes('Intäktstakten ökar direkt från 10 till 20 ¥/min (+10 ¥/min)'));

  // Preview conveyor belt on base state (where kitchen is bottleneck)
  const conveyorPreview = previewCatalogPurchase(baseState, 'conveyor_belt');
  assert.ok(conveyorPreview);
  assert.equal(conveyorPreview.prospectiveRate.yenPerMinute, 10);
  assert.equal(conveyorPreview.yenDelta, 0);
  assert.equal(conveyorPreview.isBottleneckLimiting, true);
  assert.ok(
    conveyorPreview.educationalExplanation.includes(
      'Detta köp ökar servicekapaciteten till 4 ordrar/min, men köket producerar bara 1 order/min',
    ),
    'Explanation must clarify that kitchen is limiting throughput',
  );

  // Preview cap extension
  const capPreview = previewCatalogPurchase(baseState, 'cap_extension_12h');
  assert.ok(capPreview);
  assert.equal(capPreview.newCapMs, EXTENDED_CAP_MS);
  assert.ok(capPreview.hasImmediateEffect);
  assert.ok(capPreview.educationalExplanation.includes('+4 timmar'));
});

// ==========================================
// 2. Server-Authoritative Purchase Engine Tests
// ==========================================

test('M3-Service: Validation guards reject missing or empty arguments', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  await assert.rejects(
    async () => await service.purchaseCatalogItem('', 'prep_counter'),
    /INVALID_UID/,
  );

  await assert.rejects(
    async () => await service.purchaseCatalogItem('user-1', ''),
    /INVALID_ITEM_ID/,
  );
});

test('M3-Service: Rejects purchase if user has no active restaurant (RESTAURANT_NOT_FOUND)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);

  const res = await service.purchaseCatalogItem('uninitialized-user', 'prep_counter');
  assert.equal(res.success, false);
  assert.equal(res.reason, 'RESTAURANT_NOT_FOUND');
});

test('M3-Service: Rejects purchase for unknown item (ITEM_NOT_FOUND)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  await service.getOrInitRestaurant('user-1', 1000);

  const res = await service.purchaseCatalogItem('user-1', 'golden_spatula');
  assert.equal(res.success, false);
  assert.equal(res.reason, 'ITEM_NOT_FOUND');
});

test('M3-Service: Rejects purchase if item is locked by study progress (ITEM_LOCKED)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  // User has 5,000 yen spendable balance, but NO permanent grants
  await service.getOrInitRestaurant('user-locked', 1000);
  await repo.transaction('user-locked', async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(5000) },
    result: null,
  }));

  const res = await service.purchaseCatalogItem('user-locked', 'prep_counter');
  assert.equal(res.success, false);
  assert.equal(res.reason, 'ITEM_LOCKED');
  assert.ok(res.message.includes('är låst'));
});

test('M3-Service: Rejects purchase if spendable balance is insufficient (INSUFFICIENT_FUNDS)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-poor';

  // User unlocked prep_counter (costs 300 yen / 18M units), but has only 200 yen balance (12M units)
  await service.getOrInitRestaurant(uid, 1000, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(200) },
    result: null,
  }));

  const res = await service.purchaseCatalogItem(uid, 'prep_counter');
  assert.equal(res.success, false);
  assert.equal(res.reason, 'INSUFFICIENT_FUNDS');
  assert.equal(res.requiredUnits, 18_000_000);
  assert.equal(res.actualUnits, 12_000_000);
});

test('M3-Service: Uncollected revenue CANNOT pay for purchases (Security Invariant)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-uncollected-cant-pay';
  const t0 = 1_000_000;

  // Unlocked prep_counter (300 yen), spendable balance = 50 yen (3M units)
  await service.getOrInitRestaurant(uid, t0, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(50) },
    result: null,
  }));

  // Advance time by 60 minutes: at 10 yen/min, uncollected accrues 600 yen (36M units)
  // Total potential assets = 50 + 600 = 650 yen > 300 yen, BUT spendable is only 50 yen!
  const t60m = t0 + 60 * MS_MINUTE;
  const res = await service.purchaseCatalogItem(uid, 'prep_counter', undefined, t60m);

  assert.equal(res.success, false, 'Uncollected revenue in cash register must NOT fund purchases');
  assert.equal(res.reason, 'INSUFFICIENT_FUNDS');
  assert.equal(res.actualUnits, yenToUnits(50));

  // Verify intermediate accrual was preserved in repo
  const afterCheck = await repo.get(uid);
  assert.ok(afterCheck);
  assert.equal(afterCheck.uncollectedUnits, yenToUnits(600), 'Accrued register income must be preserved');
  assert.equal(afterCheck.balanceUnits, yenToUnits(50), 'Spendable balance must be untouched');
  assert.equal(afterCheck.inventory.length, 0, 'No item purchased');
});

test('M3-Service: Successful purchase of prep_counter mutates balance, inventory, and kitchen capacity', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-prep-success';
  const t0 = 10_000_000;

  await service.getOrInitRestaurant(uid, t0, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(500) }, // 500 yen
    result: null,
  }));

  // Purchase prep_counter at t0 + 10 min
  const t10m = t0 + 10 * MS_MINUTE;
  const res = await service.purchaseCatalogItem(uid, 'prep_counter', 'tx_prep_1', t10m);

  assert.equal(res.success, true);
  assert.equal(res.debitedUnits, 18_000_000);
  assert.equal(res.debitedYen, 300);
  assert.equal(res.wasAlreadyProcessed, false);

  const state = res.state;
  assert.equal(unitsToWholeYen(state.balanceUnits), 200, '500 - 300 = 200 yen balance');
  assert.deepEqual(state.inventory, ['prep_counter']);
  assert.equal(state.kitchenCapacity, 3, 'Kitchen capacity increased by +2 (from 1 to 3)');
  assert.equal(state.serviceCapacity, 2, 'Service capacity unchanged');
  assert.equal(state.accountedAtMs, t10m);
  // Accrued 10 minutes at 10 yen/min = 100 yen preserved
  assert.equal(unitsToWholeYen(state.uncollectedUnits), 100);
});

test('M3-Service: Duplicate purchase rejection (ALREADY_OWNED)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-duplicate-buy';

  await service.getOrInitRestaurant(uid, 1000, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(1000) },
    result: null,
  }));

  // First purchase succeeds
  const res1 = await service.purchaseCatalogItem(uid, 'prep_counter');
  assert.equal(res1.success, true);

  // Second purchase fails with ALREADY_OWNED
  const res2 = await service.purchaseCatalogItem(uid, 'prep_counter');
  assert.equal(res2.success, false);
  assert.equal(res2.reason, 'ALREADY_OWNED');
  assert.ok(res2.message.includes('Du äger redan'));
});

test('M3-Service: Idempotency key avoids duplicate debit on retries', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-idempotent';

  await service.getOrInitRestaurant(uid, 1000, ['prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(500) },
    result: null,
  }));

  const idempotencyKey = 'unique_req_abc123';

  // Call 1: fresh
  const res1 = await service.purchaseCatalogItem(uid, 'prep_counter', idempotencyKey, 2000);
  assert.equal(res1.success, true);
  assert.equal(res1.wasAlreadyProcessed, false);
  assert.equal(res1.debitedYen, 300);
  assert.equal(unitsToWholeYen(res1.state.balanceUnits), 200);

  // Call 2: retry with same idempotency key
  const res2 = await service.purchaseCatalogItem(uid, 'prep_counter', idempotencyKey, 3000);
  assert.equal(res2.success, true);
  assert.equal(res2.wasAlreadyProcessed, true);
  assert.equal(unitsToWholeYen(res2.state.balanceUnits), 200, 'Balance must NOT be debited twice');
  assert.deepEqual(res2.state.inventory, ['prep_counter'], 'Inventory must NOT contain duplicate item');
});

// Helper constant for test brevity
const MS_MINUTE = MS_PER_MINUTE;

// ==========================================
// 3. 12h Cap Extension Scenarios A, B, C
// ==========================================

test('M3-Cap: Scenario A (Cap purchase before limit at 2h)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-cap-scen-a';
  const t0 = 1_000_000;

  // Unlocked cap_extension_12h (1,800 yen), starting balance 10,000 yen
  await service.getOrInitRestaurant(uid, t0, ['cap_extension_12h']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(10_000) },
    result: null,
  }));

  // Purchase at T = 2h
  const t2h = t0 + 2 * MS_PER_HOUR;
  const res = await service.purchaseCatalogItem(uid, 'cap_extension_12h', undefined, t2h);
  assert.equal(res.success, true);

  const state2h = res.state;
  assert.equal(unitsToWholeYen(state2h.balanceUnits), 8200, '10000 - 1800 = 8200 yen');
  assert.equal(unitsToWholeYen(state2h.uncollectedUnits), 1200, '2h at 10 yen/min = 1200 yen');
  assert.equal(state2h.usedProductionMs, 2 * MS_PER_HOUR);
  assert.equal(state2h.capMs, EXTENDED_CAP_MS);

  // Wait 10 hours after purchase (T = 12h) -> remaining 10h should be produced, register full
  const t12h = t0 + 12 * MS_PER_HOUR;
  const state12h = await service.getOrInitRestaurant(uid, t12h);
  assert.equal(unitsToWholeYen(state12h.uncollectedUnits), 7200, '1200 + 6000 = 7200 yen total');
  assert.equal(state12h.usedProductionMs, 12 * MS_PER_HOUR);

  // Wait 1 hour more (T = 13h) -> excess time discarded
  const t13h = t0 + 13 * MS_PER_HOUR;
  const state13h = await service.getOrInitRestaurant(uid, t13h);
  assert.equal(unitsToWholeYen(state13h.uncollectedUnits), 7200, 'Capped at 7200 yen');
  assert.equal(state13h.usedProductionMs, 12 * MS_PER_HOUR);
});

test('M3-Cap: Scenario B (Cap purchase at 8h limit)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-cap-scen-b';
  const t0 = 1_000_000;

  await service.getOrInitRestaurant(uid, t0, ['cap_extension_12h']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(10_000) },
    result: null,
  }));

  // Purchase at T = 8h (register full under 8h cap: 4,800 yen)
  const t8h = t0 + 8 * MS_PER_HOUR;
  const res = await service.purchaseCatalogItem(uid, 'cap_extension_12h', undefined, t8h);
  assert.equal(res.success, true);

  const state8h = res.state;
  assert.equal(unitsToWholeYen(state8h.balanceUnits), 8200);
  assert.equal(unitsToWholeYen(state8h.uncollectedUnits), 4800);
  assert.equal(state8h.usedProductionMs, 8 * MS_PER_HOUR);
  assert.equal(state8h.capMs, EXTENDED_CAP_MS);

  // Wait 1h after purchase (T = 9h) -> 1h new production
  const t9h = t0 + 9 * MS_PER_HOUR;
  const state9h = await service.getOrInitRestaurant(uid, t9h);
  assert.equal(unitsToWholeYen(state9h.uncollectedUnits), 5400, '4800 + 600 = 5400 yen');
  assert.equal(state9h.usedProductionMs, 9 * MS_PER_HOUR);

  // Wait 3h more (T = 12h) -> reaches 12h cap
  const t12h = t0 + 12 * MS_PER_HOUR;
  const state12h = await service.getOrInitRestaurant(uid, t12h);
  assert.equal(unitsToWholeYen(state12h.uncollectedUnits), 7200, '4800 + 2400 = 7200 yen');
  assert.equal(state12h.usedProductionMs, 12 * MS_PER_HOUR);
});

test('M3-Cap: Scenario C (Cap purchase at stopped register after 10h with prep counter)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-cap-scen-c';
  const t0 = 1_000_000;

  // Restaurant has prep_counter already (rate = 20 yen/min)
  await service.getOrInitRestaurant(uid, t0, ['cap_extension_12h']);
  await repo.transaction(uid, async (current) => ({
    state: {
      ...current!,
      kitchenCapacity: 3, // prep_counter active
      balanceUnits: yenToUnits(9700),
      inventory: ['prep_counter'],
    },
    result: null,
  }));

  // Student is away for 10 hours (8h productive, 2h stopped under 8h cap)
  const t10h = t0 + 10 * MS_PER_HOUR;
  // Purchase cap_extension_12h at T = 10h
  const res = await service.purchaseCatalogItem(uid, 'cap_extension_12h', undefined, t10h);
  assert.equal(res.success, true);

  const state10h = res.state;
  assert.equal(unitsToWholeYen(state10h.balanceUnits), 7900, '9700 - 1800 = 7900 yen');
  assert.equal(unitsToWholeYen(state10h.uncollectedUnits), 9600, '8h at 20 yen/min = 9600 yen');
  assert.equal(state10h.usedProductionMs, 8 * MS_PER_HOUR);
  assert.equal(state10h.capMs, EXTENDED_CAP_MS);

  // 1 hour later (T = 11h at 20 yen/min): earns 1200 yen
  const t11h = t0 + 11 * MS_PER_HOUR;
  const state11h = await service.getOrInitRestaurant(uid, t11h);
  assert.equal(unitsToWholeYen(state11h.uncollectedUnits), 10_800, '9600 + 1200 = 10800 yen');

  // 3 hours later (T = 14h): exactly 4 new productive hours earned, reaches 12h cap
  const t14h = t0 + 14 * MS_PER_HOUR;
  const state14h = await service.getOrInitRestaurant(uid, t14h);
  assert.equal(unitsToWholeYen(state14h.uncollectedUnits), 14_400, '9600 + 4800 = 14400 yen');
  assert.equal(state14h.usedProductionMs, 12 * MS_PER_HOUR);

  // Manual collection at T = 14h: transfers all 14,400 yen into balance, resets register, keeps 12h cap
  const collectRes = await service.collectRevenue(uid, 'collect_c_14h', t14h);
  assert.equal(collectRes.collectedYen, 14_400);
  assert.equal(unitsToWholeYen(collectRes.state.balanceUnits), 22_300, '7900 + 14400 = 22300 yen');
  assert.equal(collectRes.state.uncollectedUnits, 0);
  assert.equal(collectRes.state.usedProductionMs, 0);
  assert.equal(collectRes.state.capMs, EXTENDED_CAP_MS, '12h cap persists into fresh period');
});

// ==========================================
// 4. Asymmetrical Upgrade Path B (Conveyor Belt First)
// ==========================================

test('M3-Asymmetrical: Purchasing conveyor belt first gives ±0 yen/min, then prep counter gives +20 yen/min', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'user-conveyor-first';
  const t0 = 10_000_000;

  // User unlocked both conveyor_belt and prep_counter, has 5,000 yen
  await service.getOrInitRestaurant(uid, t0, ['conveyor_belt', 'prep_counter']);
  await repo.transaction(uid, async (current) => ({
    state: { ...current!, balanceUnits: yenToUnits(5000) },
    result: null,
  }));

  // Step 1: Buy conveyor belt first (+2 service, costs 3600 yen)
  const res1 = await service.purchaseCatalogItem(uid, 'conveyor_belt', 'tx_cb_1', t0);
  assert.equal(res1.success, true);
  assert.equal(res1.debitedYen, 3600);
  assert.equal(unitsToWholeYen(res1.state.balanceUnits), 1400);
  assert.equal(res1.state.serviceCapacity, 4);
  assert.equal(res1.state.kitchenCapacity, 1);

  // Rate remains 10 yen/min because kitchen is the bottleneck!
  const rateAfterCB = calculateProductionRate(
    res1.state.kitchenCapacity,
    res1.state.serviceCapacity,
    res1.state.averageRevenuePerOrder,
  );
  assert.equal(rateAfterCB.yenPerMinute, 10, 'Rate must remain 10 yen/min due to kitchen bottleneck');
  assert.equal(rateAfterCB.bottleneck, 'kitchen');

  // Step 2: Now buy prep counter (+2 kitchen, costs 300 yen)
  const res2 = await service.purchaseCatalogItem(uid, 'prep_counter', 'tx_pc_2', t0 + 1000);
  assert.equal(res2.success, true);
  assert.equal(res2.debitedYen, 300);
  assert.equal(unitsToWholeYen(res2.state.balanceUnits), 1100);
  assert.equal(res2.state.kitchenCapacity, 3);
  assert.equal(res2.state.serviceCapacity, 4);

  // Rate jumps from 10 to 30 yen/min (+20 yen/min double jump!)
  const finalRate = calculateProductionRate(
    res2.state.kitchenCapacity,
    res2.state.serviceCapacity,
    res2.state.averageRevenuePerOrder,
  );
  assert.equal(finalRate.yenPerMinute, 30, 'Rate jumps directly to 30 yen/min unlocking latent conveyor capacity');
  assert.equal(finalRate.bottleneck, 'kitchen');
});
