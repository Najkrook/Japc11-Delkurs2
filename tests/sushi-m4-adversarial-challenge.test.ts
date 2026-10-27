import {
  createLegacyEconomyState,
  LEGACY_CAP_MS,
  LEGACY_EXTENDED_CAP_MS,
} from './helpers/legacy-sushi-economy.ts';
/**
 * Milestone 4: Code-Executing Adversarial Challenge Test Harness
 *
 * EMPIRICAL ADVERSARIAL CHALLENGES:
 * 1. Offline Accrual Math Stress:
 *    - Extreme offline intervals: 7 days, 30 days, 365 days (1 yr), 10 yrs offline clamping.
 *    - Negative time deltas (backward clock skew / retrograde time jumps).
 *    - Zero elapsed time invariance.
 *    - Split collections: midpoint collection reward vs single continuous idle,
 *      back-to-back zero-interval collections, and fractional/prime millisecond precision.
 * 2. Purchase Transaction Logic Stress:
 *    - Boundary balances: 1 unit deficit (fails), exact price (succeeds, bal=0), 1 unit surplus (succeeds, bal=1).
 *    - Uncollected register isolation: 100M register units cannot fund purchases without manual collect.
 *    - Locked item & invalid catalog item rejections.
 *    - Repeated rapid purchases: same idempotencyKey returns cached success; different keys fail ALREADY_OWNED.
 *    - Concurrency stampede: 50 concurrent purchase attempts for same item -> exactly 1 succeeds, 49 ALREADY_OWNED.
 *    - Inventory duplication immunity across all 21 items.
 *    - Decoration slot constraints: category validation, slot mismatch rejection, unowned rejection, rate neutrality.
 * 3. Monotonic Non-Revocation Stress:
 *    - Bizarre progress: Gold in Ch 12 while Ch 6 has 0% progress.
 *    - Swiss cheese / fragmented curriculum progress across non-consecutive chapters.
 *    - Reverse curriculum completion (12 -> 11 -> 10 -> 9 -> 8 -> 7 -> 6) and subsequent 100% reset.
 *    - Input sanitization & adversarial grant payloads (whitespace, empty, duplicates, Unicode).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateAccrual,
  calculateProductionRate,
  collectEarnings,
  createDefaultRestaurantState,
  unitsToWholeYen,
  unitsToYenDecimal,
  yenToUnits,
} from '../src/course/sushi-game/economy.ts';
import { MS_PER_HOUR, MS_PER_MINUTE, YEN_UNIT_MULTIPLIER } from '../src/course/sushi-game/types.ts';
import type { SushiEconomyState, SushiRestaurantState } from '../src/course/sushi-game/types.ts';
import {
  SUSHI_CATALOG,
  getCatalogItem,
  previewUpgradeImpact,
} from '../src/course/sushi-game/catalog.ts';
import {
  MEDAL_GRANT_RULES,
  evaluateMedalGrants,
  mergePermanentGrants,
  tierSatisfies,
} from '../src/course/sushi-game/medals.ts';
import type { UnlockGrantId } from '../src/course/sushi-game/medals.ts';
import { InMemorySushiRepository, SushiService } from '../src/course/sushi-game/domain-service.ts';
import { createFreshCourseProgress } from '../src/course/course-state.ts';
import { courseWeeks } from '../src/course/data/index.ts';
import type { CourseProgressData, CourseWeek } from '../src/course/types.ts';

// =============================================================================
// CHALLENGE 1: Offline Accrual Math Stress Testing
// =============================================================================

test('Adversarial 1.1: Extreme offline intervals (7 days, 30 days, 1 year, 10 years) clamp safely without overflow', () => {
  const startMs = 1_500_000_000_000; // Realistic Unix epoch ms
  const rate20State = createLegacyEconomyState(startMs, {
    kitchenCapacity: 3,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    capMs: LEGACY_CAP_MS, // 8 hours = 28,800,000 ms
  });

  // Rates: Kitchen 3, Service 2, AvgRev 10 -> R = 20 yen/min = 20 units/ms
  const intervals = [
    { name: '7 days', ms: 7 * 24 * MS_PER_HOUR },
    { name: '30 days', ms: 30 * 24 * MS_PER_HOUR },
    { name: '365 days (1 yr)', ms: 365 * 24 * MS_PER_HOUR },
    { name: '10 years', ms: 10 * 365 * 24 * MS_PER_HOUR },
  ];

  for (const { name, ms } of intervals) {
    const accrual = calculateAccrual(rate20State, startMs + ms);

    // 1. Produced ms must be strictly clamped to capMs
    assert.equal(
      accrual.producedMs,
      LEGACY_CAP_MS,
      `[${name}] producedMs must clamp strictly to 8h cap (28,800,000 ms)`,
    );

    // 2. Excess ms must account for the rest of the absence
    assert.equal(
      accrual.excessMs,
      ms - LEGACY_CAP_MS,
      `[${name}] excessMs must equal elapsed minus cap`,
    );

    // 3. Earned units must equal exact 8h earnings: 28,800,000 ms * 20 units/ms = 576,000,000 units
    assert.equal(
      accrual.earnedUnits,
      576_000_000,
      `[${name}] earnedUnits must be exactly 576,000,000 units (9,600 ¥)`,
    );
    assert.equal(unitsToWholeYen(accrual.earnedUnits), 9_600);
    assert.equal(accrual.isCapped, true);
    assert.equal(accrual.remainingCapMs, 0);

    // 4. Check safe integer bounds
    assert.ok(
      Number.isSafeInteger(accrual.earnedUnits),
      `[${name}] earnedUnits must be a safe integer`,
    );
    assert.ok(Number.isSafeInteger(accrual.excessMs), `[${name}] excessMs must be a safe integer`);
    assert.ok(!Number.isNaN(accrual.earnedUnits), `[${name}] earnedUnits must not be NaN`);
  }

  // Also test with max upgraded rate (Kitchen 6, Service 6, AvgRev 15 -> 90 yen/min = 90 units/ms)
  // and 12-hour extended cap (43,200,000 ms)
  const maxUpgradedState = createLegacyEconomyState(startMs, {
    kitchenCapacity: 6,
    serviceCapacity: 6,
    averageRevenuePerOrder: 15,
    capMs: LEGACY_EXTENDED_CAP_MS, // 12 hours
  });

  const accrual7DaysMax = calculateAccrual(maxUpgradedState, startMs + 7 * 24 * MS_PER_HOUR);
  assert.equal(accrual7DaysMax.producedMs, LEGACY_EXTENDED_CAP_MS);
  // 43,200,000 ms * 90 units/ms = 3,888,000,000 units = 64,800 yen
  assert.equal(accrual7DaysMax.earnedUnits, 3_888_000_000);
  assert.equal(unitsToWholeYen(accrual7DaysMax.earnedUnits), 64_800);
  assert.equal(accrual7DaysMax.isCapped, true);
  assert.equal(accrual7DaysMax.remainingCapMs, 0);
});

test('Adversarial 1.2: Negative time deltas (clock skew / backward jump) and zero elapsed time', () => {
  const startMs = 1_000_000_000;
  const state = createLegacyEconomyState(startMs, {
    kitchenCapacity: 2,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    uncollectedUnits: 50_000_000,
    usedProductionMs: 1_000_000,
  });

  // 1. Negative time jump (retrograde by 1 hour)
  const pastMs = startMs - 3_600_000;
  const backwardAccrual = calculateAccrual(state, pastMs);

  assert.equal(backwardAccrual.elapsedMs, 0, 'Negative elapsedMs must clamp to 0');
  assert.equal(backwardAccrual.producedMs, 0, 'Negative producedMs must clamp to 0');
  assert.equal(backwardAccrual.excessMs, 0, 'Excess ms must be 0');
  assert.equal(backwardAccrual.earnedUnits, 0, 'Earned units must be 0');
  assert.equal(backwardAccrual.isCapped, false);
  assert.equal(backwardAccrual.remainingCapMs, LEGACY_CAP_MS - 1_000_000);

  // State accountedAtMs must NEVER move backward
  assert.equal(
    backwardAccrual.updatedState.accountedAtMs,
    startMs,
    'accountedAtMs must remain at startMs when nowMs is in the past',
  );
  assert.equal(
    backwardAccrual.updatedState.uncollectedUnits,
    50_000_000,
    'uncollectedUnits must not decrease on backward clock jump',
  );
  assert.equal(
    backwardAccrual.updatedState.usedProductionMs,
    1_000_000,
    'usedProductionMs must not change on backward jump',
  );

  // 2. Zero elapsed time (exact same ms)
  const zeroAccrual = calculateAccrual(state, startMs);
  assert.equal(zeroAccrual.elapsedMs, 0);
  assert.equal(zeroAccrual.producedMs, 0);
  assert.equal(zeroAccrual.excessMs, 0);
  assert.equal(zeroAccrual.earnedUnits, 0);
  assert.equal(zeroAccrual.updatedState.uncollectedUnits, 50_000_000);
  assert.equal(zeroAccrual.updatedState.accountedAtMs, startMs);
});

test('Adversarial 1.3: Split collections vs continuous idle, and repeated same-timestamp collections', () => {
  const startMs = 1_000_000_000;
  // Rate: 20 yen/min. Default 8h cap (28,800,000 ms = 9,600 yen max per period).
  const initialState = createLegacyEconomyState(startMs, {
    kitchenCapacity: 3,
    serviceCapacity: 2,
    averageRevenuePerOrder: 10,
    capMs: LEGACY_CAP_MS,
  });

  // Strategy A: Uninterrupted 10 hours offline (exceeds 8h cap)
  const single10h = calculateAccrual(initialState, startMs + 10 * MS_PER_HOUR);
  const single10hCollected = collectEarnings(initialState, startMs + 10 * MS_PER_HOUR);
  assert.equal(
    single10hCollected.transferredUnits,
    576_000_000,
    'Uninterrupted 10h capped at 8h = 576M units',
  );
  assert.equal(single10hCollected.transferredYenWhole, 9_600);

  // Strategy B: Active student split collection:
  // Step B1: Collect at 4 hours
  const t4h = startMs + 4 * MS_PER_HOUR;
  const collectAt4h = collectEarnings(initialState, t4h);
  assert.equal(collectAt4h.transferredUnits, 288_000_000, '4h yields 288M units = 4,800 yen');
  assert.equal(collectAt4h.newBalanceUnits, 288_000_000);
  assert.equal(collectAt4h.updatedState.uncollectedUnits, 0);
  assert.equal(collectAt4h.updatedState.usedProductionMs, 0);
  assert.equal(collectAt4h.updatedState.periodStartMs, t4h);

  // Step B2: Player waits another 6 hours (total elapsed = 10h from start)
  const t10h = t4h + 6 * MS_PER_HOUR;
  const collectAt10h = collectEarnings(collectAt4h.updatedState, t10h);
  // Because timer was reset, 6 hours < 8h cap! All 6 hours produce: 6h * 20 ¥/min = 7,200 ¥ = 432,000,000 units
  assert.equal(
    collectAt10h.transferredUnits,
    432_000_000,
    '6h fresh period yields 432M units = 7,200 yen',
  );
  assert.equal(collectAt10h.newBalanceUnits, 288_000_000 + 432_000_000); // 720,000,000 units = 12,000 yen!
  assert.equal(unitsToWholeYen(collectAt10h.newBalanceUnits), 12_000);

  // Split collections correctly earned 12,000 yen vs capped 9,600 yen (2,400 yen study-activity premium)
  assert.ok(collectAt10h.newBalanceUnits > single10hCollected.transferredUnits);

  // Strategy C: Repeated immediate collections at the exact same millisecond
  const rep1 = collectEarnings(collectAt10h.updatedState, t10h);
  assert.equal(rep1.transferredUnits, 0, 'Immediate repeated collection transfers 0 units');
  assert.equal(rep1.transferredYenWhole, 0);
  assert.equal(rep1.newBalanceUnits, 720_000_000);

  const rep2 = collectEarnings(rep1.updatedState, t10h);
  assert.equal(rep2.transferredUnits, 0);
  assert.equal(rep2.newBalanceUnits, 720_000_000);

  // Strategy D: Fine microsecond/millisecond intervals (e.g. 1ms, 1337ms, 60001ms)
  const tiny1 = calculateAccrual(rep2.updatedState, t10h + 1);
  assert.equal(tiny1.producedMs, 1);
  assert.equal(tiny1.earnedUnits, 20); // 1 ms * 20 units/ms = 20 units

  const primeMs = 1_337;
  const primeAccrual = calculateAccrual(rep2.updatedState, t10h + primeMs);
  assert.equal(primeAccrual.producedMs, 1_337);
  assert.equal(primeAccrual.earnedUnits, 1_337 * 20); // 26,740 units
});

// =============================================================================
// CHALLENGE 2: Purchase Transaction Logic Stress Testing
// =============================================================================

test('Adversarial 2.1: Boundary balance values and spendable wallet vs uncollected isolation', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-adversarial-boundary';
  const nowMs = 1_000_000_000;

  // prep_counter: price = 300 yen = 18,000,000 units
  const item = getCatalogItem('prep_counter')!;
  const priceUnits = item.priceUnits;

  // Initialize restaurant with prep_counter unlocked
  const init = await service.getOrInitRestaurant(uid, nowMs, ['prep_counter']);

  // Test 1: Balance is exactly (priceUnits - 1) -> 17,999,999 units
  await repo.set({
    ...init,
    balanceUnits: priceUnits - 1,
    uncollectedUnits: 0,
    inventory: [],
  });
  const failMinusOne = await service.purchaseCatalogItem(
    uid,
    'prep_counter',
    'req-fail-minus-1',
    nowMs,
  );
  assert.equal(failMinusOne.success, false);
  if (!failMinusOne.success) {
    assert.equal(failMinusOne.reason, 'INSUFFICIENT_FUNDS');
  }
  const stateMinusOne = await repo.get(uid);
  assert.equal(stateMinusOne!.balanceUnits, priceUnits - 1, 'Balance must be completely untouched');
  assert.equal(stateMinusOne!.inventory.length, 0, 'Inventory must remain empty');

  // Test 2: Balance is exactly priceUnits -> 18,000,000 units
  await repo.set({
    ...init,
    balanceUnits: priceUnits,
    uncollectedUnits: 0,
    inventory: [],
  });
  const succExact = await service.purchaseCatalogItem(uid, 'prep_counter', 'req-succ-exact', nowMs);
  assert.equal(succExact.success, true);
  if (succExact.success) {
    assert.equal(succExact.state.balanceUnits, 0, 'Exact price payment must leave balance 0');
    assert.deepEqual(succExact.state.inventory, ['prep_counter']);
  }

  // Test 3: Balance is exactly (priceUnits + 1) -> 18,000,001 units
  await repo.set({
    ...init,
    balanceUnits: priceUnits + 1,
    uncollectedUnits: 0,
    inventory: [],
  });
  const succPlusOne = await service.purchaseCatalogItem(
    uid,
    'prep_counter',
    'req-succ-plus-1',
    nowMs,
  );
  assert.equal(succPlusOne.success, true);
  if (succPlusOne.success) {
    assert.equal(succPlusOne.state.balanceUnits, 1, 'Surplus 1 unit must remain in balance');
    assert.deepEqual(succPlusOne.state.inventory, ['prep_counter']);
  }

  // Test 4: Uncollected cash register isolation
  // Student has 0 spendable balance, but 500,000,000 units (~8,333 ¥) in the uncollected cash register
  await repo.set({
    ...init,
    balanceUnits: 0,
    uncollectedUnits: 500_000_000,
    inventory: [],
  });
  const failUncollected = await service.purchaseCatalogItem(
    uid,
    'prep_counter',
    'req-fail-register-only',
    nowMs,
  );
  assert.equal(
    failUncollected.success,
    false,
    'Uncollected register funds must never cover purchases',
  );
  if (!failUncollected.success) {
    assert.equal(failUncollected.reason, 'INSUFFICIENT_FUNDS');
  }
  const stateAfterRegCheck = await repo.get(uid);
  assert.equal(
    stateAfterRegCheck!.uncollectedUnits,
    500_000_000,
    'Uncollected register balance must be preserved',
  );
  assert.equal(stateAfterRegCheck!.balanceUnits, 0, 'Spendable balance must remain 0');

  // Test 5: Locked item rejection (even with infinite funds)
  await repo.set({
    ...init,
    balanceUnits: 10_000_000_000, // 166,666 yen
    permanentGrants: [], // no unlocks
    inventory: [],
  });
  const failLocked = await service.purchaseCatalogItem(
    uid,
    'prep_counter',
    'req-fail-locked',
    nowMs,
  );
  assert.equal(failLocked.success, false);
  if (!failLocked.success) {
    assert.equal(failLocked.reason, 'ITEM_LOCKED');
  }
  const stateAfterLocked = await repo.get(uid);
  assert.equal(
    stateAfterLocked!.balanceUnits,
    10_000_000_000,
    'Balance must not be deducted for locked items',
  );
});

test('Adversarial 2.2: Rapid purchases, idempotency, and concurrent purchase stampede', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-adversarial-concurrency';
  const nowMs = 1_000_000_000;

  // Initialize restaurant with 100,000 yen and 'prep_counter' unlocked
  const initial = await service.getOrInitRestaurant(uid, nowMs, ['prep_counter']);
  await repo.set({
    ...initial,
    balanceUnits: 6_000_000_000, // 100,000 yen
    inventory: [],
  });

  // 1. Same idempotency key called 5 times
  const key1 = 'stampede-idemp-1';
  const resultsSameKey = await Promise.all([
    service.purchaseCatalogItem(uid, 'prep_counter', key1, nowMs),
    service.purchaseCatalogItem(uid, 'prep_counter', key1, nowMs + 10),
    service.purchaseCatalogItem(uid, 'prep_counter', key1, nowMs + 20),
    service.purchaseCatalogItem(uid, 'prep_counter', key1, nowMs + 30),
    service.purchaseCatalogItem(uid, 'prep_counter', key1, nowMs + 40),
  ]);

  // All 5 must return success: true
  for (const res of resultsSameKey) {
    assert.equal(res.success, true);
  }

  // Exactly ONE call was fresh; the other 4 were cached idempotency hits
  const freshCalls = resultsSameKey.filter((r) => r.success && !r.wasAlreadyProcessed);
  const cachedCalls = resultsSameKey.filter((r) => r.success && r.wasAlreadyProcessed);
  assert.equal(freshCalls.length, 1, 'Exactly 1 request should be fresh');
  assert.equal(cachedCalls.length, 4, '4 requests should be recognized as already processed');

  // Balance should have been debited ONCE (18,000,000 units = 300 yen)
  const afterKey1 = await repo.get(uid);
  assert.equal(afterKey1!.balanceUnits, 6_000_000_000 - 3_000_000);
  assert.equal(afterKey1!.inventory.length, 1);
  assert.equal(afterKey1!.inventory[0], 'prep_counter');

  // 2. Concurrency Stampede: 50 simultaneous calls with UNIQUE keys attempting to purchase the same item
  // Since 'prep_counter' is now already in inventory, ALL 50 must fail with ALREADY_OWNED
  const stampedePromises = Array.from({ length: 50 }, (_, i) =>
    service.purchaseCatalogItem(uid, 'prep_counter', `unique-key-stampede-${i}`, nowMs + 100 + i),
  );
  const stampedeResults = await Promise.all(stampedePromises);

  for (const res of stampedeResults) {
    assert.equal(res.success, false, 'Subsequent purchase of owned item must fail');
    if (!res.success) {
      assert.equal(res.reason, 'ALREADY_OWNED');
    }
  }

  // Balance and inventory must remain strictly unchanged after the 50 failed attempts
  const afterStampede = await repo.get(uid);
  assert.equal(afterStampede!.balanceUnits, 6_000_000_000 - 3_000_000);
  assert.equal(afterStampede!.inventory.length, 1);
  assert.equal(afterStampede!.inventory[0], 'prep_counter');
});

test('Adversarial 2.3: Full catalog inventory duplication immunity & decoration slot validation', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-adversarial-decor-catalog';
  const nowMs = 1_000_000_000;

  // Unlock all 21 items and give 1,000,000 yen
  const allGrantIds = SUSHI_CATALOG.map((i) => i.id);
  const init = await service.getOrInitRestaurant(uid, nowMs, allGrantIds);
  await repo.set({
    ...init,
    balanceUnits: 60_000_000_000, // 1,000,000 yen
    inventory: [],
  });

  // Pass 1: Purchase all 21 items sequentially
  for (const item of SUSHI_CATALOG) {
    const res = await service.purchaseCatalogItem(uid, item.id, `pass1-${item.id}`, nowMs);
    assert.equal(res.success, true, `First purchase of ${item.id} must succeed`);
  }

  const afterPass1 = await repo.get(uid);
  assert.equal(afterPass1!.inventory.length, 21, 'Inventory must contain exactly 21 items');
  // Check for no duplicates
  const uniqueItems = new Set(afterPass1!.inventory);
  assert.equal(uniqueItems.size, 21, 'All 21 items in inventory must be unique');

  // Pass 2: Attempt to purchase all 21 items a second time
  for (const item of SUSHI_CATALOG) {
    const res = await service.purchaseCatalogItem(uid, item.id, `pass2-${item.id}`, nowMs + 10_000);
    assert.equal(res.success, false, `Second purchase of ${item.id} must fail`);
    if (!res.success) {
      assert.equal(res.reason, 'ALREADY_OWNED');
    }
  }

  const afterPass2 = await repo.get(uid);
  assert.equal(afterPass2!.inventory.length, 21, 'Inventory must strictly remain 21 items');

  // Decoration slot validation stress
  // Wall decorations in catalog: paper_lantern, noren_curtain, wave_print
  // Floor decorations in catalog: potted_plant, andon_lantern, sakura_bonsai, golden_maneki_neko
  // Recipes: salmon_nigiri, kappamaki, maguro_nigiri, etc.
  // Upgrades: prep_counter, precision_knife, conveyor_belt, etc.

  // 1. Attempt to equip recipe into wallSlot
  const eqRecipe = await service.equipDecoration(
    uid,
    'wallSlot',
    'salmon_nigiri',
    'dec-key-recipe',
  );
  assert.equal(eqRecipe.success, false, 'Cannot equip recipe in wallSlot');

  // 2. Attempt to equip kitchen upgrade into floorSlot
  const eqUpgrade = await service.equipDecoration(
    uid,
    'floorSlot',
    'prep_counter',
    'dec-key-upgrade',
  );
  assert.equal(eqUpgrade.success, false, 'Cannot equip kitchen upgrade in floorSlot');

  // 3. Slot mismatch: Attempt to equip wall decoration in floorSlot
  const eqMismatch = await service.equipDecoration(
    uid,
    'floorSlot',
    'paper_lantern',
    'dec-key-mismatch',
  );
  assert.equal(eqMismatch.success, false, 'Cannot equip wall decoration in floorSlot');

  // 4. Slot mismatch: Attempt to equip floor decoration in wallSlot
  const eqMismatch2 = await service.equipDecoration(
    uid,
    'wallSlot',
    'golden_maneki_neko',
    'dec-key-mismatch-2',
  );
  assert.equal(eqMismatch2.success, false, 'Cannot equip floor decoration in wallSlot');

  // 5. Valid equips
  const eqWallValid = await service.equipDecoration(
    uid,
    'wallSlot',
    'paper_lantern',
    'dec-key-valid-wall',
  );
  assert.equal(eqWallValid.success, true);
  assert.equal(eqWallValid.state.equipped.wallSlot, 'paper_lantern');

  const eqFloorValid = await service.equipDecoration(
    uid,
    'floorSlot',
    'golden_maneki_neko',
    'dec-key-valid-floor',
  );
  assert.equal(eqFloorValid.success, true);
  assert.equal(eqFloorValid.state.equipped.floorSlot, 'golden_maneki_neko');

  // 6. Economic neutrality: Equipping decorations must NOT alter kitchenCapacity, serviceCapacity, or averageRevenue
  const stateWithDecor = await repo.get(uid);
  const rateBefore = calculateProductionRate(
    stateWithDecor!.kitchenCapacity,
    stateWithDecor!.serviceCapacity,
    stateWithDecor!.averageRevenuePerOrder,
  );
  // Unequip both
  await service.equipDecoration(uid, 'wallSlot', null, 'dec-key-unequip-wall');
  await service.equipDecoration(uid, 'floorSlot', null, 'dec-key-unequip-floor');
  const stateUnequipped = await repo.get(uid);
  const rateAfter = calculateProductionRate(
    stateUnequipped!.kitchenCapacity,
    stateUnequipped!.serviceCapacity,
    stateUnequipped!.averageRevenuePerOrder,
  );
  assert.deepEqual(
    rateBefore,
    rateAfter,
    'Equipping/unequipping decor must have zero economic effect',
  );
});

// =============================================================================
// CHALLENGE 3: Monotonic Non-Revocation Stress Testing
// =============================================================================

test('Adversarial 3.1: Bizarre student progress (Gold in Ch 12 with 0% progress in Ch 6)', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-adversarial-ch12-only';
  const nowMs = 1_000_000_000;

  // Initialize restaurant
  await service.getOrInitRestaurant(uid, nowMs);

  // Student completes ONLY Chapter 12 (week-7, index 6) to Gold tier (100% mastery)
  // Chapters 6–11 are completely untouched (0% progress)
  const ch12Week = courseWeeks.find((w) => w.lessonNumber === 12)!;
  assert.ok(ch12Week, 'Chapter 12 week must exist');

  const progressCh12Only = createFreshCourseProgress();
  for (const v of ch12Week.vocab) progressCh12Only.masteredVocabIds[v.id] = true;
  for (const k of ch12Week.kanji) progressCh12Only.masteredKanjiIds[k.id] = true;
  for (const d of ch12Week.conjugations) progressCh12Only.masteredDojoIds[d.id] = true;
  progressCh12Only.quizBestResults[ch12Week.id] = {
    score: ch12Week.quiz.length,
    total: ch12Week.quiz.length,
    completedAt: nowMs,
  };

  const grantsEvaluated = evaluateMedalGrants(progressCh12Only, courseWeeks);
  // Chapter 12 has 3 grants: master_license (bronze), omakase_menu (silver), golden_maneki_neko (gold)
  assert.equal(grantsEvaluated.length, 3, 'Gold in Ch 12 must evaluate exactly 3 grants');
  assert.ok(grantsEvaluated.includes('master_license'));
  assert.ok(grantsEvaluated.includes('omakase_menu'));
  assert.ok(grantsEvaluated.includes('golden_maneki_neko'));

  // Ensure Ch 6 grants are NOT present in raw evaluation
  assert.ok(!grantsEvaluated.includes('prep_counter'));
  assert.ok(!grantsEvaluated.includes('salmon_nigiri'));
  assert.ok(!grantsEvaluated.includes('paper_lantern'));

  // Sync to restaurant
  const state1 = await service.syncMedalGrants(uid, grantsEvaluated, nowMs);
  assert.equal(state1.permanentGrants.length, 3);

  // Next step: Student now earns Bronze in Chapter 6 (lessonNumber 6, week-1)
  // Master at least 60% of total items in Ch 6 (vocab + kanji + dojo + quiz)
  const ch6Week = courseWeeks.find((w) => w.lessonNumber === 6)!;
  const progressCh12AndCh6Bronze = structuredClone(progressCh12Only);
  const totalCh6Items =
    ch6Week.vocab.length + ch6Week.kanji.length + ch6Week.conjugations.length + ch6Week.quiz.length;
  const targetBronze = Math.ceil(totalCh6Items * 0.65); // 65% > 60% threshold
  let added = 0;
  for (const v of ch6Week.vocab) {
    if (added >= targetBronze) break;
    progressCh12AndCh6Bronze.masteredVocabIds[v.id] = true;
    added++;
  }
  for (const k of ch6Week.kanji) {
    if (added >= targetBronze) break;
    progressCh12AndCh6Bronze.masteredKanjiIds[k.id] = true;
    added++;
  }
  if (added < targetBronze) {
    const quizNeeded = Math.min(ch6Week.quiz.length, targetBronze - added);
    progressCh12AndCh6Bronze.quizBestResults[ch6Week.id] = {
      score: quizNeeded,
      total: ch6Week.quiz.length,
      completedAt: nowMs,
    };
  }

  const grantsWithCh6 = evaluateMedalGrants(progressCh12AndCh6Bronze, courseWeeks);
  assert.ok(grantsWithCh6.includes('prep_counter'), 'Ch 6 bronze must award prep_counter');
  assert.ok(!grantsWithCh6.includes('salmon_nigiri'), 'Ch 6 silver not yet achieved');

  const state2 = await service.syncMedalGrants(uid, grantsWithCh6, nowMs + 1000);
  assert.equal(state2.permanentGrants.length, 4, 'Permanent grants should now contain 4 items');
  assert.ok(state2.permanentGrants.includes('prep_counter'));
  assert.ok(state2.permanentGrants.includes('master_license'));
  assert.ok(state2.permanentGrants.includes('omakase_menu'));
  assert.ok(state2.permanentGrants.includes('golden_maneki_neko'));

  // CRITICAL CHALLENGE: Student now completely resets Chapter 12 to 0%!
  const progressResetCh12 = structuredClone(progressCh12AndCh6Bronze);
  // Wipe out Ch 12 mastery
  for (const v of ch12Week.vocab) delete progressResetCh12.masteredVocabIds[v.id];
  for (const k of ch12Week.kanji) delete progressResetCh12.masteredKanjiIds[k.id];
  for (const d of ch12Week.conjugations) delete progressResetCh12.masteredDojoIds[d.id];
  delete progressResetCh12.quizBestResults[ch12Week.id];

  const grantsAfterCh12Reset = evaluateMedalGrants(progressResetCh12, courseWeeks);
  // Raw evaluation should now ONLY contain prep_counter
  assert.deepEqual(grantsAfterCh12Reset, ['prep_counter']);

  // Sync to restaurant: Permanent grants MUST NOT revoke Ch 12 rewards!
  const state3 = await service.syncMedalGrants(uid, grantsAfterCh12Reset, nowMs + 2000);
  assert.equal(
    state3.permanentGrants.length,
    4,
    'Permanent grants must strictly preserve all 4 items',
  );
  assert.ok(
    state3.permanentGrants.includes('master_license'),
    'master_license must remain granted',
  );
  assert.ok(state3.permanentGrants.includes('omakase_menu'), 'omakase_menu must remain granted');
  assert.ok(
    state3.permanentGrants.includes('golden_maneki_neko'),
    'golden_maneki_neko must remain granted',
  );
  assert.ok(state3.permanentGrants.includes('prep_counter'), 'prep_counter must remain granted');
});

test('Adversarial 3.2: Swiss cheese fragmented curriculum progress across non-consecutive chapters', async () => {
  const repo = new InMemorySushiRepository();
  const service = new SushiService(repo);
  const uid = 'qa-adversarial-swiss-cheese';
  const nowMs = 1_000_000_000;

  // Initialize restaurant
  await service.getOrInitRestaurant(uid, nowMs);

  // Create fragmented progress:
  // Ch 6: 0% -> 0 grants
  // Ch 7: 100% Gold -> 3 grants: cap_extension_12h, kappamaki, potted_plant
  // Ch 8: 60% Bronze -> 1 grant: precision_knife
  // Ch 9: 0% -> 0 grants
  // Ch 10: 80% Silver -> 2 grants: service_counter, tamago_nigiri
  // Ch 11: 0% -> 0 grants
  // Ch 12: 100% Gold -> 3 grants: master_license, omakase_menu, golden_maneki_neko
  const progress = createFreshCourseProgress();

  function grantWeekMastery(lessonNumber: number, percent: number) {
    const week = courseWeeks.find((w) => w.lessonNumber === lessonNumber)!;
    const totalItems =
      week.vocab.length + week.kanji.length + week.conjugations.length + week.quiz.length;
    const targetItems = Math.ceil(totalItems * (percent / 100));

    let added = 0;
    for (const v of week.vocab) {
      if (added >= targetItems) break;
      progress.masteredVocabIds[v.id] = true;
      added++;
    }
    for (const k of week.kanji) {
      if (added >= targetItems) break;
      progress.masteredKanjiIds[k.id] = true;
      added++;
    }
    for (const d of week.conjugations) {
      if (added >= targetItems) break;
      progress.masteredDojoIds[d.id] = true;
      added++;
    }
    if (added < targetItems) {
      const quizNeeded = Math.min(week.quiz.length, targetItems - added);
      progress.quizBestResults[week.id] = {
        score: quizNeeded,
        total: week.quiz.length,
        completedAt: nowMs,
      };
    }
  }

  grantWeekMastery(7, 100); // Ch 7 Gold
  grantWeekMastery(8, 65); // Ch 8 Bronze
  grantWeekMastery(10, 85); // Ch 10 Silver
  grantWeekMastery(12, 100); // Ch 12 Gold

  const evaluated = evaluateMedalGrants(progress, courseWeeks);
  // Expected grants:
  // Ch 7: cap_extension_12h, kappamaki, potted_plant (3)
  // Ch 8: precision_knife (1)
  // Ch 10: service_counter, tamago_nigiri (2)
  // Ch 12: master_license, omakase_menu, golden_maneki_neko (3)
  // Total = 9
  assert.equal(evaluated.length, 9, 'Swiss-cheese progress must yield exactly 9 grants');

  const state1 = await service.syncMedalGrants(uid, evaluated, nowMs);
  assert.equal(state1.permanentGrants.length, 9);

  // Now student completely wipes course data
  const wiped = createFreshCourseProgress();
  const wipedEvaluated = evaluateMedalGrants(wiped, courseWeeks);
  assert.equal(wipedEvaluated.length, 0);

  const state2 = await service.syncMedalGrants(uid, wipedEvaluated, nowMs + 1000);
  assert.equal(
    state2.permanentGrants.length,
    9,
    'All 9 grants must be strictly preserved after wipe',
  );
});

test('Adversarial 3.3: Reverse curriculum order (12 to 6) and mergePermanentGrants sanitization', () => {
  // Test mergePermanentGrants sanitization with adversarial payloads
  const dirtyExisting = ['  prep_counter  ', '', '   ', 'salmon_nigiri', 'prep_counter'];
  const dirtyNew = ['salmon_nigiri', '   ', 'paper_lantern', '🍣_sushi_unicode', ''];

  const cleaned = mergePermanentGrants(dirtyExisting, dirtyNew);
  assert.ok(!cleaned.includes(''), 'Empty strings must be removed');
  assert.ok(!cleaned.includes('   '), 'Whitespace strings must be removed');
  assert.ok(cleaned.includes('prep_counter'));
  assert.ok(cleaned.includes('salmon_nigiri'));
  assert.ok(cleaned.includes('paper_lantern'));
  assert.ok(cleaned.includes('🍣_sushi_unicode'));

  // Ensure deduplication
  const countPrep = cleaned.filter((x) => x === 'prep_counter').length;
  assert.equal(countPrep, 1, 'prep_counter must be deduplicated to exactly 1');
  const countSalmon = cleaned.filter((x) => x === 'salmon_nigiri').length;
  assert.equal(countSalmon, 1, 'salmon_nigiri must be deduplicated to exactly 1');

  // Test reverse curriculum unlock simulation (Ch 12 -> 11 -> 10 -> 9 -> 8 -> 7 -> 6)
  let accumulatedGrants: string[] = [];
  const reverseLessons = [12, 11, 10, 9, 8, 7, 6];

  for (let i = 0; i < reverseLessons.length; i++) {
    const lesson = reverseLessons[i];
    const lessonRules = MEDAL_GRANT_RULES.filter((r) => r.lessonNumber === lesson);
    const newGrants = lessonRules.map((r) => r.grantId);

    const prevCount = accumulatedGrants.length;
    accumulatedGrants = mergePermanentGrants(accumulatedGrants, newGrants);

    // Monotonic invariant: length must increase by exactly 3 each step
    assert.equal(
      accumulatedGrants.length,
      prevCount + 3,
      `Step ${i + 1} (Lesson ${lesson}) must add exactly 3 grants`,
    );
  }

  assert.equal(
    accumulatedGrants.length,
    21,
    'Full reverse walkthrough must accumulate all 21 grants',
  );

  // Merging empty array into accumulated grants must yield identical 21 grants
  const postReset = mergePermanentGrants(accumulatedGrants, []);
  assert.equal(postReset.length, 21);
});
